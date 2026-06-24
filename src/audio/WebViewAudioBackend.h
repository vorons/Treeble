#pragma once

#include "IAudioBackend.h"
#include <saucer/smartview.hpp>
#include <string>

class WebViewAudioBackend : public IAudioBackend
{
public:
    explicit WebViewAudioBackend(saucer::smartview &wv);

    void load(const std::string &path) override;
    void play() override;
    void pause() override;
    void seek(double position_sec) override;

    double position() const override;
    double duration() const override;
    void set_volume(double vol) override;
    double volume() const override;

    // Called from IPCHandler when <audio> fires timeupdate/ended/error
    void on_event(const std::string &type, double position, double duration);

private:
    void eval(const std::string &js);
    double eval_double(const std::string &js) const;

    saucer::smartview &m_wv;
    mutable double m_cached_position{};
    mutable double m_cached_duration{};
    double m_volume{0.7};
};
