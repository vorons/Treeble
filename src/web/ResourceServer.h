#pragma once

#include <saucer/smartview.hpp>
#include <string>

class ResourceServer
{
public:
    /// Must be called once before any saucer::webview is created.
    static void register_scheme();

    explicit ResourceServer(saucer::smartview &wv);

private:
    static std::string percent_decode(std::string_view s);
};
