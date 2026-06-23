#include "ResourceServer.h"
#include <saucer/smartview.hpp>
#include <fstream>
#include <filesystem>
#include <cstdio>
#include <charconv>

namespace fs = std::filesystem;

void ResourceServer::register_scheme()
{
    saucer::webview::register_scheme("app");
}

ResourceServer::ResourceServer(saucer::smartview &wv)
{
    wv.handle_scheme("app", [this](const saucer::scheme::request &req) -> saucer::scheme::response
    {
        return handle(req);
    });
}

std::string ResourceServer::percent_decode(std::string_view s)
{
    std::string out;
    out.reserve(s.size());
    for (std::size_t i = 0; i < s.size(); ++i)
    {
        if (s[i] == '%' && i + 2 < s.size())
        {
            int hi = 0, lo = 0;
            std::from_chars(&s[i + 1], &s[i + 2], hi, 16);
            std::from_chars(&s[i + 2], &s[i + 3], lo, 16);
            out += static_cast<char>((hi << 4) | lo);
            i += 2;
        }
        else if (s[i] == '+')
            out += ' ';
        else
            out += s[i];
    }
    return out;
}

saucer::scheme::response ResourceServer::handle(const saucer::scheme::request &req)
{
    // URL: app://audio/path/to/file.mp3
    auto url_str = req.url().string();
    constexpr std::string_view prefix = "app://audio";

    if (url_str.size() <= prefix.size() || url_str.substr(0, prefix.size()) != prefix)
        return {.data = saucer::stash::from_str("Not Found"), .mime = "text/plain", .status = 404};

    auto raw_path = url_str.substr(prefix.size());
    auto decoded = percent_decode(raw_path);

    if (decoded.empty())
        decoded = "/";

    // ── open file ─────────────────────────────────────────────────────────
    std::ifstream file(decoded, std::ios::binary | std::ios::ate);
    if (!file)
    {
        std::fprintf(stderr, "ResourceServer: cannot open %s\n", decoded.c_str());
        return {.data = saucer::stash::from_str("Not Found"), .mime = "text/plain", .status = 404};
    }

    auto file_size = file.tellg();
    file.seekg(0);

    // ── MIME from extension ───────────────────────────────────────────────
    auto ext = fs::path(decoded).extension().string();
    std::string mime = "audio/mpeg";
    if (ext == ".flac")      mime = "audio/flac";
    else if (ext == ".wav")  mime = "audio/wav";
    else if (ext == ".ogg" || ext == ".opus") mime = "audio/ogg";
    else if (ext == ".m4a")  mime = "audio/mp4";

    // ponytail: whole-file delivery, no Range/206 support.
    // Without it <audio> seek fails. Upgrade: check req.headers() for Range,
    // seek file, return 206 with Content-Range.
    std::string data(static_cast<std::size_t>(file_size), '\0');
    file.read(data.data(), file_size);

    return {
        .data   = saucer::stash::from_str(std::move(data)),
        .mime   = std::move(mime),
        .status = 200,
    };
}
