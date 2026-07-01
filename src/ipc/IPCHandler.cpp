#include "IPCHandler.h"
#include "Types.h"
#include "fs/FileScanner.h"
#include "metadata/TagReader.h"
#include "audio/WebViewAudioBackend.h"
#include "tray/SystemTray.h"
#include "mpris/MPRIS2.h"

#include <saucer/smartview.hpp>
#include <algorithm>
#include <cstdio>
#include <fstream>
#include <cstdlib>
#include <filesystem>
#include <charconv>

#include <gtk/gtk.h>

// ── persistent state helpers ───────────────────────────────────────────────
namespace fs = std::filesystem;

static std::string state_dir()
{
    auto *xdg = std::getenv("XDG_DATA_HOME");
    if (xdg && *xdg)
        return std::string(xdg) + "/treeble";
    if (auto *home = std::getenv("HOME"))
        return std::string(home) + "/.local/share/treeble";
    return "/tmp/treeble-state";
}

static std::string state_path()
{
    return state_dir() + "/state.json";
}

// Minimal JSON writer — ponytail: avoids pulling in a full JSON library.
static std::string json_escape(const std::string &s)
{
    std::string out;
    out.reserve(s.size() + 2);
    for (auto ch : s)
    {
        switch (ch)
        {
        case '"':  out += "\\\""; break;
        case '\\': out += "\\\\"; break;
        case '\n': out += "\\n";  break;
        case '\r': out += "\\r";  break;
        case '\t': out += "\\t";  break;
        default:    out += ch;      break;
        }
    }
    return out;
}

// Format double with '.' decimal separator regardless of locale.
static std::string fmt_double(double val)
{
    std::string s = std::to_string(val);
    // Replace locale-dependent comma with dot
    for (auto &ch : s)
        if (ch == ',')
            ch = '.';
    return s;
}

static std::string serialize_state(const SavedState &s)
{
    return
        "{"
        "\"windowX\":" + std::to_string(s.windowX) + ","
        "\"windowY\":" + std::to_string(s.windowY) + ","
        "\"windowW\":" + std::to_string(s.windowW) + ","
        "\"windowH\":" + std::to_string(s.windowH) + ","
        "\"lastFolder\":\"" + json_escape(s.lastFolder) + "\","
        "\"lastTrackIndex\":" + std::to_string(s.lastTrackIndex) + ","
        "\"volume\":" + fmt_double(s.volume) + ","
        "\"repeatMode\":\"" + json_escape(s.repeatMode) + "\","
        "\"maximized\":" + (s.maximized ? "true" : "false") + ","
        "\"shuffle\":" + (s.shuffle ? "true" : "false") + ","
        "\"musicFolder\":\"" + json_escape(s.musicFolder) + "\""
        "}";
}

// ponytail: crude JSON parser — works for our known flat schema.
static SavedState parse_state(const std::string &json)
{
    SavedState s;
    auto find = [&](const std::string &key) -> std::string
    {
        auto i = json.find("\"" + key + "\":");
        if (i == std::string::npos)
            return {};
        i += key.size() + 3; // skip "key":
        // skip whitespace
        while (i < json.size() && (json[i] == ' ' || json[i] == '\t'))
            ++i;
        if (i >= json.size()) return {};
        if (json[i] == '"') // string value
        {
            ++i;
            std::string val;
            while (i < json.size() && json[i] != '"')
            {
                if (json[i] == '\\' && i + 1 < json.size())
                {
                    ++i;
                    switch (json[i])
                    {
                    case '"':  val += '"'; break;
                    case '\\': val += '\\'; break;
                    case 'n':  val += '\n'; break;
                    case 'r':  val += '\r'; break;
                    case 't':  val += '\t'; break;
                    default:   val += json[i]; break;
                    }
                }
                else
                    val += json[i];
                ++i;
            }
            return val;
        }
        else // number, true, false
        {
            auto end = json.find_first_of(",}", i);
            if (end == std::string::npos) end = json.size();
            return json.substr(i, end - i);
        }
    };
    auto n = [&](const std::string &key, int def) -> int
    {
        auto v = find(key);
        if (v.empty()) return def;
        int result{};
        auto [ptr, ec] = std::from_chars(v.data(), v.data() + v.size(), result);
        if (ec == std::errc{})
            return result;
        return def;
    };
    auto d = [&](const std::string &key, double def) -> double
    {
        auto v = find(key);
        std::fprintf(stderr, "[state] parse key='%s' found='%s'\n", key.c_str(), v.c_str());
        if (v.empty()) return def;
        // Normalize decimal separator: some locales may have produced ','
        for (auto &ch : v)
            if (ch == ',')
                ch = '.';
        // std::stod is locale-dependent; use from_chars which is not
        double result{};
        auto [ptr, ec] = std::from_chars(v.data(), v.data() + v.size(), result);
        if (ec == std::errc{})
            return result;
        return def;
    };
    auto b = [&](const std::string &key, bool def) -> bool
    {
        auto v = find(key);
        if (v.empty()) return def;
        return v == "true";
    };
    s.windowX       = n("windowX", 0);
    s.windowY       = n("windowY", 0);
    s.windowW       = n("windowW", 960);
    s.windowH       = n("windowH", 640);
    s.lastFolder    = find("lastFolder");
    s.lastTrackIndex = n("lastTrackIndex", 0);
    s.volume        = d("volume", 0.7);
    s.repeatMode    = find("repeatMode");
    if (s.repeatMode.empty()) s.repeatMode = "off";
    s.shuffle       = b("shuffle", false);
    s.maximized     = b("maximized", false);
    s.musicFolder   = find("musicFolder");
    return s;
}

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

struct SavedStateView
{
    int windowX{};
    int windowY{};
    int windowW{};
    int windowH{};
    bool maximized{};
    std::string lastFolder;
    int lastTrackIndex{};
    double volume{0.7};
    std::string repeatMode{"off"};
    bool shuffle{};
    std::string musicFolder;
};

static TrackView to_view(const Track &t)
{
    return {t.path, t.title, t.artist, t.duration_sec};
}

static SavedStateView to_view(const SavedState &s)
{
    return {s.windowX, s.windowY, s.windowW, s.windowH, s.maximized,
            s.lastFolder, s.lastTrackIndex,
            s.volume, s.repeatMode, s.shuffle, s.musicFolder};
}

// ── constructor ─────────────────────────────────────────────────────────────
IPCHandler::IPCHandler(saucer::smartview &wv, FileScanner &fs, TagReader &tr,
                       WebViewAudioBackend &ab, PlayerState &state,
                       SystemTray &tray,
                       GtkWindow *parent_window)
    : m_wv(wv), m_fs(fs), m_tr(tr), m_ab(ab), m_state(state), m_tray(tray),
      m_parent_window(parent_window)
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
        m_tray.set_active(true);
        auto &t = m_state.queue[m_state.current_index];
        std::fprintf(stderr, "[IPC] playInFolder: idx=%zu title=%s path=%s\n", m_state.current_index, t.title.c_str(), t.path.c_str());
        m_ab.load(t.path);
        m_ab.play();
        if (m_mpris) m_mpris->notify();
    });

    wv.expose("play", [this](int index)
    {
        std::fprintf(stderr, "[IPC] play index=%d, queue.size=%zu\n", index, m_state.queue.size());
        if (index < 0 || static_cast<std::size_t>(index) >= m_state.queue.size())
        {
            std::fprintf(stderr, "[IPC] play: index out of range\n");
            return;
        }
        m_state.current_index = static_cast<std::size_t>(index);
        m_state.playing = true;
        m_state.paused = false;
        m_tray.set_active(true);
        auto &t = m_state.queue[m_state.current_index];
        std::fprintf(stderr, "[IPC] play: idx=%zu title=%s dur=%lu path=%s\n", m_state.current_index, t.title.c_str(), static_cast<unsigned long>(t.duration_sec), t.path.c_str());
        m_ab.load(t.path);
        m_ab.play();
        if (m_mpris) m_mpris->notify();
    });

    wv.expose("pause", [this]()
    {
        m_ab.pause();
        m_state.paused = true;
        m_tray.set_active(false);
        if (m_mpris) m_mpris->notify();
    });

    wv.expose("resume", [this]()
    {
        m_ab.play();
        m_state.paused = false;
        m_tray.set_active(true);
        if (m_mpris) m_mpris->notify();
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
            m_state.playing = false;
            m_tray.set_active(false);
            if (m_mpris) m_mpris->notify();
        }
        else if (type == "error")
        {
            std::fprintf(stderr, "Audio error on track index %zu\n", m_state.current_index);
            if (m_mpris) m_mpris->notify();
        }
    });

    // ── window controls (custom title bar) ───────────────────────────────
    wv.expose("windowMinimize", [this]()
    {
        m_wv.parent().set_minimized(true);
    });

    wv.expose("windowMaximizeRestore", [this]() -> bool
    {
        auto &win = m_wv.parent();
        bool next = !win.maximized();
        win.set_maximized(next);
        return next;
    });

    wv.expose("windowClose", [this]()
    {
        m_wv.parent().close();
    });

    wv.expose("windowStartDrag", [this]()
    {
        m_wv.parent().start_drag();
    });

    // ── home directory ────────────────────────────────────────────────────
    wv.expose("getHome", [this]() -> std::string
    {
        return m_fs.scan_tree().path;
    });

    // ── folder picker ──────────────────────────────────────────────────────
    wv.expose("selectFolder", [this]() -> std::string
    {
        auto *dialog = gtk_file_dialog_new();
        gtk_file_dialog_set_title(dialog, "Select Music Folder");

        std::string result;
        auto *loop = g_main_loop_new(g_main_context_default(), FALSE);

        auto *data = new std::pair<std::string *, GMainLoop *>{&result, loop};
        // ponytail: data is deleted inside the callback after g_main_loop_quit.
        // gtk_file_dialog_select_folder has no GDestroyNotify parameter.
        gtk_file_dialog_select_folder(
            dialog,
            m_parent_window,
            nullptr,  // cancellable
            GAsyncReadyCallback(+[](GObject *source, GAsyncResult *res, gpointer user) {
                auto *d = static_cast<std::pair<std::string *, GMainLoop *> *>(user);
                GError *error = nullptr;
                GFile *file = gtk_file_dialog_select_folder_finish(
                    GTK_FILE_DIALOG(source), res, &error);
                if (file)
                {
                    char *path = g_file_get_path(file);
                    if (path)
                    {
                        *d->first = path;
                        g_free(path);
                    }
                    g_object_unref(file);
                }
                else if (error)
                {
                    g_error_free(error);
                }
                g_main_loop_quit(d->second);
                delete d;
            }),
            data
        );

        g_main_loop_run(loop);

        g_main_loop_unref(loop);
        g_object_unref(dialog);
        return result;
    });

    wv.expose("setMusicFolder", [this](const std::string &path) -> FolderTree
    {
        if (path.empty())
        {
            return m_fs.scan_tree();
        }
        m_fs.set_root(path);
        m_lastSaved.musicFolder = path;
        saveState(m_lastSaved);
        return m_fs.scan_tree();
    });

    // ── state persistence ─────────────────────────────────────────────────
    exposeSaveStateIPC();

    // Frontend calls this once at startup to get saved state
    wv.expose("loadState", [this]() -> SavedStateView
    {
        auto saved = loadState();
        std::fprintf(stderr, "[state] loadState IPC returning volume=%.2f\n", saved.volume);
        return to_view(saved);
    });
}

SavedState IPCHandler::loadState()
{
    auto path = state_path();
    std::ifstream f(path);
    if (!f.is_open())
    {
        std::fprintf(stderr, "[state] no file, returning defaults\n");
        return {};
    }
    std::string json((std::istreambuf_iterator<char>(f)),
                      std::istreambuf_iterator<char>());
    f.close();
    try
    {
        auto s = parse_state(json);
        std::fprintf(stderr, "[state] parsed volume=%.2f\n", s.volume);
        return s;
    }
    catch (const std::exception &e)
    {
        std::fprintf(stderr, "[state] corrupt file (%s), removing and returning defaults\n", e.what());
        std::error_code ec;
        fs::remove(path, ec);
        return {};
    }
}

void IPCHandler::saveState(const SavedState &s)
{
    auto dir = state_dir();
    fs::create_directories(dir);
    auto path = state_path();
    auto tmp  = path + ".tmp";

    std::ofstream f(tmp);
    if (!f.is_open())
    {
        std::fprintf(stderr, "[state] failed to write %s\n", tmp.c_str());
        return;
    }
    f << serialize_state(s);
    f.close();

    // Atomic rename — readers either see the old file or the complete new file.
    std::error_code ec;
    fs::rename(tmp, path, ec);
    if (ec)
    {
        std::fprintf(stderr, "[state] rename failed: %s\n", ec.message().c_str());
        return;
    }
    std::fprintf(stderr, "[state] saved to %s\n", path.c_str());
}

void IPCHandler::exposeSaveStateIPC()
{
    m_wv.expose("saveState", [this](
        const std::string &lastFolder,
        int lastTrackIndex,
        double volume,
        const std::string &repeatMode,
        bool shuffle)
    {
        std::fprintf(stderr, "[state] IPC saveState volume=%.2f\n", volume);
        m_lastSaved.lastFolder     = lastFolder;
        m_lastSaved.lastTrackIndex = lastTrackIndex;
        m_lastSaved.volume         = volume;
        m_lastSaved.repeatMode     = repeatMode;
        m_lastSaved.shuffle        = shuffle;
        // Take window geometry and maximized state from current window
        auto &win = m_wv.parent();
        m_lastSaved.windowX = win.position().x;
        m_lastSaved.windowY = win.position().y;
        m_lastSaved.windowW = win.size().w;
        m_lastSaved.windowH = win.size().h;
        m_lastSaved.maximized = win.maximized();
        saveState(m_lastSaved);
        if (m_mpris)
        {
            m_mpris->set_repeat_mode(repeatMode);
            m_mpris->set_shuffle(shuffle);
            m_mpris->notify();
        }
    });
}

void IPCHandler::saveStateOnExit()
{
    auto &win = m_wv.parent();
    m_lastSaved.windowX = win.position().x;
    m_lastSaved.windowY = win.position().y;
    m_lastSaved.windowW = win.size().w;
    m_lastSaved.windowH = win.size().h;
    // maximized is kept from the last onMaximize() call — don't read
    // win.maximized() here because some window managers unmaximize
    // before close, losing the state.
    saveState(m_lastSaved);
}

void IPCHandler::onMaximize(bool maximized)
{
    m_lastSaved.maximized = maximized;
}

void IPCHandler::applyMusicFolder(const SavedState &s)
{
    if (!s.musicFolder.empty())
    {
        m_fs.set_root(s.musicFolder);
    }
}
