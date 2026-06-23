#include "Types.h"
#include "fs/FileScanner.h"
#include "metadata/TagReader.h"
#include "audio/WebViewAudioBackend.h"
#include "ipc/IPCHandler.h"
#include "web/ResourceServer.h"
#include "mpris/MPRIS2.h"

#include <saucer/smartview.hpp>
#include <saucer/embedded/all.hpp>

#include <cstdio>
#include <string>
#include <cstdlib>

// ── helpers ─────────────────────────────────────────────────────────────────
static std::string music_dir()
{
    if (auto *env = std::getenv("TREEBLE_ROOT"))
        return env;

    if (auto *home = std::getenv("HOME"))
        return std::string(home) + "/Music";

    return "/tmp";
}

coco::stray start(saucer::application *app)
{
    // ── window ────────────────────────────────────────────────────────────
    auto window  = saucer::window::create(app).value();
    auto webview = saucer::smartview::create({.window = window});

    window->set_title("Treeble");
    window->set_size({.w = 960, .h = 640});
    window->set_min_size({.w = 640, .h = 400});

    // ── services ──────────────────────────────────────────────────────────
    auto root = music_dir();
    std::printf("Treeble root: %s\n", root.c_str());

    FileScanner       scanner(root);
    TagReader         tag_reader;
    PlayerState       state;
    WebViewAudioBackend audio(*webview);
    MPRIS2            mpris;
    ResourceServer    res_server(*webview);
    IPCHandler        ipc(*webview, scanner, tag_reader, audio, mpris, state);

    // ── embedded frontend ─────────────────────────────────────────────────
    webview->embed(saucer::embedded::all());
    webview->serve("/index.html");

    window->show();

    // ── run ───────────────────────────────────────────────────────────────
    co_await app->finish();
}

int main()
{
    try
    {
        // Register custom scheme before any webview creation
        ResourceServer::register_scheme();

        return saucer::application::create({.id = "treeble"})->run(start);
    }
    catch (const std::exception &e)
    {
        std::fprintf(stderr, "Fatal: %s\n", e.what());
        return 1;
    }
}
