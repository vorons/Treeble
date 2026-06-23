#include "ResourceServer.h"

#include <libsoup/soup.h>

#include <fstream>
#include <filesystem>
#include <cstdio>
#include <cstring>
#include <cstdlib>
#include <algorithm>
#include <cerrno>
#include <functional>

namespace fs = std::filesystem;

struct ResourceServer::Impl
{
    _SoupServer *server{};
    int port_num{0};
    std::string base;
};

ResourceServer::ResourceServer()
    : m_impl(std::make_unique<Impl>())
{
}

ResourceServer::~ResourceServer()
{
    if (m_impl->server)
        g_object_unref(m_impl->server);
}

bool ResourceServer::start()
{
    auto *server = soup_server_new(nullptr);
    if (!server)
        return false;

    // Listen on localhost only, random port
    GError *error = nullptr;
    if (!soup_server_listen_local(server, 0, static_cast<SoupServerListenOptions>(0), &error))
    {
        std::fprintf(stderr, "[ResourceServer] failed to listen: %s\n", error->message);
        g_error_free(error);
        g_object_unref(server);
        return false;
    }

    // Get the actual port
    int port = 0;
    GSList *uris = soup_server_get_uris(server);
    for (GSList *l = uris; l; l = l->next)
    {
        auto *uri = static_cast<GUri *>(l->data);
        port = g_uri_get_port(uri);
        if (port > 0)
            break;
    }
    g_slist_free_full(uris, reinterpret_cast<GDestroyNotify>(g_uri_unref));

    if (port <= 0)
    {
        std::fprintf(stderr, "[ResourceServer] could not determine port\n");
        g_object_unref(server);
        return false;
    }

    // Register request handler
    soup_server_add_handler(server, "/audio",
                            reinterpret_cast<SoupServerCallback>(&on_request),
                            this, nullptr);

    m_impl->server  = server;
    m_impl->port_num = port;
    m_impl->base     = "http://127.0.0.1:" + std::to_string(port);

    std::fprintf(stderr, "[ResourceServer] listening on port %d\n", port);
    return true;
}

int ResourceServer::port() const
{
    return m_impl->port_num;
}

std::string ResourceServer::base_url() const
{
    return m_impl->base;
}

// ── static helpers ─────────────────────────────────────────────────────────

std::string ResourceServer::mime_type(const std::string &ext)
{
    if (ext == ".flac")      return "audio/flac";
    if (ext == ".wav")       return "audio/wav";
    if (ext == ".ogg" || ext == ".opus") return "audio/ogg";
    if (ext == ".m4a")       return "audio/mp4";
    return "audio/mpeg";
}

void ResourceServer::on_request(_SoupServer * /*server*/,
                                _SoupServerMessage *msg,
                                const char *path,
                                void * /*query*/,
                                void *user_data)
{
    auto *self = static_cast<ResourceServer *>(user_data);

    // Path comes as "/audio/...", extract the part after "/audio/"
    std::string p(path ? path : "");
    if (p.rfind("/audio/", 0) == 0)
        p = p.substr(7); // strip "/audio/"

    // URL-decode the path
    auto *decoded = g_uri_unescape_string(p.c_str(), nullptr);
    std::string file_path = decoded ? decoded : p;
    g_free(decoded);

    std::fprintf(stderr, "[ResourceServer] GET %s -> %s\n", path, file_path.c_str());

    // ── reject path traversal ───────────────────────────────────────────
    // Only absolute paths (starting with /) are valid; reject any containing ..
    if (file_path.empty() || file_path[0] != '/' ||
        file_path.find("/../") != std::string::npos ||
        file_path.rfind("/..", 0) == 0 || file_path == "..")
    {
        std::fprintf(stderr, "[ResourceServer] path traversal rejected: %s\n", file_path.c_str());
        soup_server_message_set_status(msg, SOUP_STATUS_FORBIDDEN, nullptr);
        auto *headers = soup_server_message_get_response_headers(msg);
        soup_message_headers_append(headers, "Access-Control-Allow-Origin", "*");
        return;
    }

    // ── open file ─────────────────────────────────────────────────────
    std::ifstream file(file_path, std::ios::binary | std::ios::ate);
    if (!file)
    {
        // try with leading slash
        auto alt = "/" + file_path;
        file.open(alt, std::ios::binary | std::ios::ate);
        if (file)
            file_path = alt;
    }

    if (!file)
    {
        std::fprintf(stderr, "[ResourceServer] not found: %s\n", file_path.c_str());
        soup_server_message_set_status(msg, SOUP_STATUS_NOT_FOUND, nullptr);
        auto *headers = soup_server_message_get_response_headers(msg);
        soup_message_headers_append(headers, "Access-Control-Allow-Origin", "*");
        return;
    }

    auto file_size = static_cast<std::size_t>(file.tellg());
    file.seekg(0);

    std::fprintf(stderr, "[ResourceServer] serving %s (%zu bytes)\n", file_path.c_str(), file_size);

    // ── MIME type ────────────────────────────────────────────────────
    auto ext = fs::path(file_path).extension().string();
    for (auto &c : ext) c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
    std::string mime = mime_type(ext);

    // ── Parse Range header ───────────────────────────────────────────
    auto *req_headers = soup_server_message_get_request_headers(msg);
    const char *range_str = soup_message_headers_get_one(req_headers, "Range");

    std::size_t range_start = 0;
    std::size_t range_end   = file_size - 1;
    bool has_range = false;

    if (range_str)
    {
        std::fprintf(stderr, "[ResourceServer] Range: %s\n", range_str);
        // Parse "bytes=N-M" or "bytes=N-"
        std::string_view rv(range_str);
        if (rv.starts_with("bytes="))
        {
            rv.remove_prefix(6);
            auto dash = rv.find('-');
            if (dash != std::string_view::npos)
            {
                auto start_str = rv.substr(0, dash);
                auto end_str   = rv.substr(dash + 1);
                if (!start_str.empty())
                    range_start = static_cast<std::size_t>(std::stoll(std::string(start_str)));
                if (!end_str.empty())
                    range_end = static_cast<std::size_t>(std::stoll(std::string(end_str)));
                if (range_end >= file_size)
                    range_end = file_size - 1;
                has_range = true;
            }
        }
    }

    auto chunk_size = range_end - range_start + 1;

    // ── read chunk ───────────────────────────────────────────────────
    file.seekg(static_cast<std::ifstream::pos_type>(range_start));
    auto *buf = static_cast<char *>(g_malloc(chunk_size));
    file.read(buf, static_cast<std::streamsize>(chunk_size));

    // ── build response ───────────────────────────────────────────────
    auto *headers = soup_server_message_get_response_headers(msg);

    soup_message_headers_append(headers, "Access-Control-Allow-Origin", "*");
    soup_message_headers_append(headers, "Accept-Ranges", "bytes");

    if (has_range)
    {
        auto cr = "bytes " + std::to_string(range_start) + "-"
                  + std::to_string(range_end) + "/"
                  + std::to_string(file_size);
        soup_message_headers_append(headers, "Content-Range", cr.c_str());
        soup_server_message_set_status(msg, SOUP_STATUS_PARTIAL_CONTENT, nullptr);
    }
    else
    {
        soup_server_message_set_status(msg, SOUP_STATUS_OK, nullptr);
    }

    // Set response body (SOUP_MEMORY_TAKE = libsoup will g_free)
    soup_server_message_set_response(msg, mime.c_str(),
                                     SOUP_MEMORY_TAKE, buf, chunk_size);

    std::fprintf(stderr, "[ResourceServer] -> %d, %zu bytes [%zu..%zu/%zu]\n",
                 has_range ? 206 : 200, chunk_size, range_start, range_end, file_size);
}
