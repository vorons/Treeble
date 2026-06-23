#pragma once

#include <memory>
#include <string>
#include <functional>

struct PlayerState;

class MPRIS2
{
public:
    MPRIS2();
    ~MPRIS2();

    /// Update MPRIS2 with current player state.
    void update(const PlayerState &state);

    /// Set callback to invoke when MPRIS2 client requests play/pause/next/prev/seek.
    /// Called from D-Bus thread.
    void on_play(std::function<void()> cb);
    void on_pause(std::function<void()> cb);
    void on_next(std::function<void()> cb);
    void on_prev(std::function<void()> cb);
    void on_seek(std::function<void(double)> cb);

private:
    struct Impl;
    std::unique_ptr<Impl> m_impl;
};
