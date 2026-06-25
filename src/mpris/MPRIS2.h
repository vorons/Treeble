#pragma once

#include <memory>
#include <string>

#include <saucer/smartview.hpp>

class PlayerState;
class IAudioBackend;

namespace saucer
{
    class application;
    class window;
} // namespace saucer

class MPRIS2
{
public:
    struct Impl;

    MPRIS2(saucer::application *app, saucer::window &window,
           saucer::smartview &webview,
           PlayerState &state, IAudioBackend &audio);
    ~MPRIS2();

    MPRIS2(MPRIS2 &&) noexcept;
    MPRIS2 &operator=(MPRIS2 &&) noexcept;

    /// Emit PropertiesChanged for org.mpris.MediaPlayer2.Player.
    void notify();

    void set_repeat_mode(const std::string &mode);
    void set_shuffle(bool shuffle);

private:
    std::unique_ptr<Impl> m_impl;
};
