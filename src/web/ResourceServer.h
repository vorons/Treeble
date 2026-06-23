#pragma once

#include <string>
#include <memory>

struct _SoupServer;
struct _SoupServerMessage;

class ResourceServer
{
public:
    ResourceServer();
    ~ResourceServer();

    /// Start the HTTP server on a random port. Returns the port or 0 on failure.
    bool start();

    /// Port the server is listening on (0 if not started).
    int port() const;

    /// Base URL for audio files, e.g. "http://127.0.0.1:12345".
    std::string base_url() const;

private:
    static void on_request(_SoupServer *server, _SoupServerMessage *msg,
                           const char *path, void * /*query*/, void *user_data);

    static std::string mime_type(const std::string &ext);

private:
    struct Impl;
    std::unique_ptr<Impl> m_impl;
};
