#pragma once

#include <cstdint>
#include <string>
#include <tuple>

class TagReader
{
public:
    /// Returns (title, artist, duration_sec).
    /// On failure all fields empty/zero.
    std::tuple<std::string, std::string, std::uint64_t> read(const std::string &path);
};
