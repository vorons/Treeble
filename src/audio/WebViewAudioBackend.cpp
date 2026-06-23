#include "WebViewAudioBackend.h"
#include <saucer/smartview.hpp>
#include <cstdio>

WebViewAudioBackend::WebViewAudioBackend(saucer::smartview &wv)
    : m_wv(wv)
{
}

void WebViewAudioBackend::load(const std::string &path)
{
    // Sanitize path for JS string (escape backslashes, quotes)
    std::string safe;
    safe.reserve(path.size() + 16);
    for (char c : path)
    {
        if (c == '\\') safe += "\\\\";
        else if (c == '\'') safe += "\\'";
        else safe += c;
    }
    eval(std::format("window.audioPlayer.load('{}')", safe));
}

void WebViewAudioBackend::play()
{
    eval("window.audioPlayer.play()");
}

void WebViewAudioBackend::pause()
{
    eval("window.audioPlayer.pause()");
}

void WebViewAudioBackend::seek(double position_sec)
{
    eval(std::format("window.audioPlayer.seek({})", position_sec));
}

double WebViewAudioBackend::position() const
{
    return m_cached_position;
}

double WebViewAudioBackend::duration() const
{
    return m_cached_duration;
}

void WebViewAudioBackend::set_volume(double vol)
{
    eval(std::format("window.audioPlayer.setVolume({})", vol));
}

void WebViewAudioBackend::on_event(const std::string &type, double position, double duration)
{
    if (type == "timeupdate")
    {
        m_cached_position = position;
        m_cached_duration = duration;
    }
    // ended/error handled by IPCHandler
}

void WebViewAudioBackend::eval(const std::string &js)
{
    // ponytail: call base webview::execute directly to bypass smartview's
    // consteval format_string wrapper.
    auto &base = static_cast<saucer::webview &>(m_wv);
    base.execute(js);
}

double WebViewAudioBackend::eval_double(const std::string &js) const
{
    // ponytail: evaluate is a coroutine, skip for now; position/duration
    // come from timeupdate events instead.
    return 0.0;
}
