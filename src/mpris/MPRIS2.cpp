#include "MPRIS2.h"
#include "Types.h"

// ponytail: MPRIS2 via GDBus is verbose boilerplate. Stub that prints to stderr
// for now. Full D-Bus implementation added when MPRIS2 is needed.
// Upgrade: use GDBus (gio-2.0) to register org.mpris.MediaPlayer2.treeble
// on the session bus with Play/Pause/Next/Prev/Seek/Position/Volume methods
// and PropertiesChanged signals.

struct MPRIS2::Impl
{
    std::function<void()> on_play;
    std::function<void()> on_pause;
    std::function<void()> on_next;
    std::function<void()> on_prev;
    std::function<void(double)> on_seek;

    PlayerState last_state;
};

MPRIS2::MPRIS2()
    : m_impl(std::make_unique<Impl>())
{
}

MPRIS2::~MPRIS2() = default;

void MPRIS2::update(const PlayerState &state)
{
    m_impl->last_state = state;
    // ponytail: print state; replace with D-Bus PropertiesChanged signal
}

void MPRIS2::on_play(std::function<void()> cb) { m_impl->on_play = std::move(cb); }
void MPRIS2::on_pause(std::function<void()> cb) { m_impl->on_pause = std::move(cb); }
void MPRIS2::on_next(std::function<void()> cb) { m_impl->on_next = std::move(cb); }
void MPRIS2::on_prev(std::function<void()> cb) { m_impl->on_prev = std::move(cb); }
void MPRIS2::on_seek(std::function<void(double)> cb) { m_impl->on_seek = std::move(cb); }
