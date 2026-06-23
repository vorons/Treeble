#include "ResourceServer.h"
#include <saucer/smartview.hpp>
#include <fstream>
#include <filesystem>
#include <cstdio>
#include <cstring>

namespace fs = std::filesystem;

void ResourceServer::register_scheme()
{
    saucer::webview::register_scheme("app");
}

ResourceServer::ResourceServer(saucer::smartview &wv)
{
    wv.handle_scheme("app", [this](const saucer::scheme::request &req,
                                   const saucer::scheme::executor &exec)
    {
        auto url       = req.url();
        auto url_str   = url.string();
        auto file_path = url.path().string();

        std::fprintf(stderr, "[ResourceServer] url=%s  path=%s\n", url_str.c_str(), file_path.c_str());

        // ── open file ─────────────────────────────────────────────────────
        std::ifstream file(file_path, std::ios::binary | std::ios::ate);
        if (!file)
        {
            std::fprintf(stderr, "[ResourceServer] cannot open: %s\n", file_path.c_str());

            // Check if the path might need a leading /
            auto alt = "/" + file_path;
            file.open(alt, std::ios::binary | std::ios::ate);
            if (file)
                file_path = alt;
        }

        if (!file)
        {
            std::fprintf(stderr, "[ResourceServer] still cannot open: %s\n", file_path.c_str());
            exec.resolve({
                .data   = saucer::stash::from_str("Not Found"),
                .mime   = "text/plain",
                .headers = {{"Access-Control-Allow-Origin", "*"}},
                .status = 404,
            });
            return;
        }

        auto file_size = file.tellg();
        file.seekg(0);

        std::fprintf(stderr, "[ResourceServer] serving file=%s size=%ld\n", file_path.c_str(), static_cast<long>(file_size));

        // ── MIME from extension ───────────────────────────────────────────
        auto ext = fs::path(file_path).extension().string();
        // Normalize to lowercase
        for (auto &c : ext) c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));

        std::string mime = "audio/mpeg";
        if (ext == ".flac")      mime = "audio/flac";
        else if (ext == ".wav")  mime = "audio/wav";
        else if (ext == ".ogg" || ext == ".opus") mime = "audio/ogg";
        else if (ext == ".m4a")  mime = "audio/mp4";

        // ── Range support ─────────────────────────────────────────────────
        // Check if the request has a Range header
        auto headers = req.headers();
        auto range_it = headers.find("Range");
        std::size_t start = 0;
        std::size_t end = static_cast<std::size_t>(file_size) - 1;
        int status = 200;

        if (range_it != headers.end())
        {
            std::fprintf(stderr, "[ResourceServer] Range header: %s\n", range_it->second.c_str());
            // Parse "bytes=N-M" or "bytes=N-"
            std::string_view rng = range_it->second;
            if (rng.starts_with("bytes="))
            {
                rng.remove_prefix(6);
                auto dash = rng.find('-');
                if (dash != std::string_view::npos)
                {
                    auto start_str = rng.substr(0, dash);
                    auto end_str   = rng.substr(dash + 1);
                    if (!start_str.empty())
                        start = static_cast<std::size_t>(std::stoll(std::string(start_str)));
                    if (!end_str.empty())
                        end = static_cast<std::size_t>(std::stoll(std::string(end_str)));
                    // Clamp
                    if (end >= static_cast<std::size_t>(file_size))
                        end = static_cast<std::size_t>(file_size) - 1;
                    status = 206; // Partial Content
                }
            }
        }

        // ── read chunk ────────────────────────────────────────────────────
        auto chunk_size = end - start + 1;
        std::string data(chunk_size, '\0');
        file.seekg(static_cast<std::ifstream::pos_type>(start));
        file.read(data.data(), static_cast<std::streamsize>(chunk_size));

        // Build Content-Range header for 206
        std::map<std::string, std::string> resp_headers = {
            {"Access-Control-Allow-Origin", "*"},
            {"Content-Range", "bytes " + std::to_string(start) + "-" + std::to_string(end) + "/" + std::to_string(static_cast<long long>(file_size))},
        };

        exec.resolve({
            .data   = saucer::stash::from_str(std::move(data)),
            .mime   = std::move(mime),
            .headers = std::move(resp_headers),
            .status = status,
        });
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
