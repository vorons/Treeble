#include "IPCHandler.h"
#include "Types.h"
#include "fs/FileScanner.h"
#include "metadata/TagReader.h"
#include "audio/WebViewAudioBackend.h"
#include "mpris/MPRIS2.h"

#include <saucer/smartview.hpp>
#include <algorithm>
#include <cstdio>
#include <mutex>

static std::mutex s_state_mtx; // ponytail: single lock, per-command if contention

// ── helpers ─────────────────────────────────────────────────────────────────
static Track make_track(const std::string &path, TagReader &tr)
{
    Track t;
    t.path = path;
    auto [title, artist, dur] = tr.read(path);
    t.title = title.empty() ? path.substr(path.find_last_of('/') + 1) : title;
    t.artist = artist;
    t.duration_sec = dur;
    return t;
}

// Glaze-compatible aggregate structs for JSON serialization ──────────────────
struct TrackView
{
    std::string path;
    std::string title;
    std::string artist;
    std::uint64_t durationSec{};
};

struct PlayerStateView
{
    std::vector<TrackView> queue;
    int currentIndex{};
    bool playing{};
    bool paused{};
    double positionSec{};
};

static TrackView to_view(const Track &t)
{
    return {t.path, t.title, t.artist, t.duration_sec};
}

// ── constructor ─────────────────────────────────────────────────────────────
IPCHandler::IPCHandler(saucer::smartview &wv, FileScanner &fs, TagReader &tr,
                       WebViewAudioBackend &ab, MPRIS2 &mpris, PlayerState &state)
    : m_wv(wv), m_fs(fs), m_tr(tr), m_ab(ab), m_mpris(mpris), m_state(state)
{
    // ── tree (folder list) ────────────────────────────────────────────────
    // Returns the folder tree. Frontend calls this once at startup.
    // The result is serialized automatically by Saucer's glaze serializer.
    wv.expose("getTree", [this]() -> FolderTree
    {
        return m_fs.scan_tree();
    });

    // ── tracks in a folder ────────────────────────────────────────────────
    // ponytail: purely a query — does NOT touch m_state.queue.
    // The queue is only set when the user explicitly plays a track.
    wv.expose("getTracks", [this](const std::string &dir) -> std::vector<TrackView>
    {
        auto files = m_fs.list_audio(dir);
        std::vector<TrackView> out;
        out.reserve(files.size());
        for (auto &f : files)
        {
            auto t = make_track(f, m_tr);
            out.push_back(to_view(t));
        }
        return out;
    });

    // ── playback controls ─────────────────────────────────────────────────
    // ponytail: playInFolder is the main entry — sets queue from folder, then plays.
    // The old `play(index)` is kept for backward compat but no longer called from frontend.
    wv.expose("playInFolder", [this](const std::string &dir, int index)
    {
        std::lock_guard lk(s_state_mtx);
        auto files = m_fs.list_audio(dir);
        m_state.queue.clear();
        m_state.queue.reserve(files.size());
        for (auto &f : files)
            m_state.queue.push_back(make_track(f, m_tr));

        if (index < 0 || static_cast<std::size_t>(index) >= m_state.queue.size())
            return;

        m_state.current_index = static_cast<std::size_t>(index);
        m_state.playing = true;
        m_state.paused = false;
        auto &t = m_state.queue[m_state.current_index];
        std::fprintf(stderr, "[IPC] playInFolder: idx=%zu title=%s path=%s\n", m_state.current_index, t.title.c_str(), t.path.c_str());
        m_ab.load(t.path);
        m_ab.play();
        m_mpris.update(m_state);
    });

    wv.expose("play", [this](int index)
    {
        std::lock_guard lk(s_state_mtx);
        std::fprintf(stderr, "[IPC] play index=%d, queue.size=%zu\n", index, m_state.queue.size());
        if (index < 0 || static_cast<std::size_t>(index) >= m_state.queue.size())
        {
            std::fprintf(stderr, "[IPC] play: index out of range\n");
            return;
        }
        m_state.current_index = static_cast<std::size_t>(index);
        m_state.playing = true;
        m_state.paused = false;
        auto &t = m_state.queue[m_state.current_index];
        std::fprintf(stderr, "[IPC] play: idx=%zu title=%s dur=%lu path=%s\n", m_state.current_index, t.title.c_str(), static_cast<unsigned long>(t.duration_sec), t.path.c_str());
        m_ab.load(t.path);
        m_ab.play();
        m_mpris.update(m_state);
    });

    wv.expose("pause", [this]()
    {
        std::lock_guard lk(s_state_mtx);
        m_ab.pause();
        m_state.paused = true;
        m_mpris.update(m_state);
    });

    wv.expose("resume", [this]()
    {
        std::lock_guard lk(s_state_mtx);
        m_ab.play();
        m_state.paused = false;
        m_mpris.update(m_state);
    });

    wv.expose("next", [this]() -> int
    {
        std::lock_guard lk(s_state_mtx);
        if (m_state.current_index + 1 < m_state.queue.size())
        {
            ++m_state.current_index;
            auto &t = m_state.queue[m_state.current_index];
            m_ab.load(t.path);
            m_ab.play();
            m_mpris.update(m_state);
        }
        return static_cast<int>(m_state.current_index);
    });

    wv.expose("prev", [this]() -> int
    {
        std::lock_guard lk(s_state_mtx);
        if (m_state.current_index > 0)
        {
            --m_state.current_index;
            auto &t = m_state.queue[m_state.current_index];
            m_ab.load(t.path);
            m_ab.play();
            m_mpris.update(m_state);
        }
        return static_cast<int>(m_state.current_index);
    });

    // ── seek / volume ─────────────────────────────────────────────────────
    wv.expose("seek", [this](double position)
    {
        m_ab.seek(position);
    });

    wv.expose("setVolume", [this](double volume)
    {
        m_ab.set_volume(volume);
    });

    // ── full state snapshot ───────────────────────────────────────────────
    wv.expose("getState", [this]() -> PlayerStateView
    {
        std::lock_guard lk(s_state_mtx);
        PlayerStateView out;
        out.currentIndex = m_state.current_index;
        out.playing = m_state.playing;
        out.paused = m_state.paused;
        out.positionSec = m_ab.position();
        out.queue.reserve(m_state.queue.size());
        for (auto &t : m_state.queue)
            out.queue.push_back(to_view(t));
        return out;
    });

    // ── events from audio element ─────────────────────────────────────────
    // Frontend calls this when <audio> fires ended / timeupdate / error
    wv.expose("audioEvent", [this](const std::string &type, double position, double duration)
    {
        std::fprintf(stderr, "[audioEvent] type=%s pos=%.2f dur=%.2f\n", type.c_str(), position, duration);
        m_ab.on_event(type, position, duration);

        if (type == "ended")
        {
            // Auto-advance to next track
            std::lock_guard lk(s_state_mtx);
            if (m_state.current_index + 1 < m_state.queue.size())
            {
                ++m_state.current_index;
                auto &t = m_state.queue[m_state.current_index];
                m_ab.load(t.path);
                m_ab.play();
                m_mpris.update(m_state);
            }
        }
        else if (type == "error")
        {
            std::fprintf(stderr, "Audio error on track index %zu\n", m_state.current_index);
        }
    });

    // ── home directory ────────────────────────────────────────────────────
    wv.expose("getHome", [this]() -> std::string
    {
        return m_fs.scan_tree().path;
    });
}
