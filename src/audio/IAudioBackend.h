#pragma once

#include <string>

class IAudioBackend
{
public:
    virtual ~IAudioBackend() = default;

    virtual void load(const std::string &path) = 0;
    virtual void play() = 0;
    virtual void pause() = 0;
    virtual void seek(double position_sec) = 0;

    virtual double position() const = 0;
    virtual double duration() const = 0;
    virtual void set_volume(double vol) = 0; // 0.0 – 1.0
    virtual double volume() const = 0;
};
