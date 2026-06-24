#include "Types.h"
#include "fs/FileScanner.h"
#include "metadata/TagReader.h"
#include "audio/WebViewAudioBackend.h"
#include "ipc/IPCHandler.h"
#include "web/ResourceServer.h"
#include "tray/SystemTray.h"

#include <saucer/smartview.hpp>
#include <saucer/embedded/all.hpp>

#include <cstdio>
#include <string>
#include <cstdlib>
#include <fstream>

// ── helpers ─────────────────────────────────────────────────────────────────
static std::string xdg_music_dir()
{
    if (auto *home = std::getenv("HOME"))
    {
        auto path = std::string(home) + "/.config/user-dirs.dirs";
        std::ifstream f(path);
        std::string line;
        while (std::getline(f, line))
        {
            // Match XDG_MUSIC_DIR="..." or XDG_MUSIC_DIR=...
            static constexpr char prefix[] = "XDG_MUSIC_DIR=";
            auto pos = line.find(prefix);
            if (pos == std::string::npos)
                continue;
            auto val = line.substr(pos + sizeof(prefix) - 1);
            // Strip surrounding quotes
            if (val.size() >= 2 && (val.front() == '\"' || val.front() == '\'') && val.front() == val.back())
                val = val.substr(1, val.size() - 2);
            // Expand leading $HOME/
            if (val.rfind("$HOME/", 0) == 0)
                val.replace(0, 5, home);
            return val;
        }
    }
    return {};
}

static std::string music_dir()
{
    if (auto *env = std::getenv("TREEBLE_ROOT"))
        return env;

    if (auto xdg = xdg_music_dir(); !xdg.empty())
        return xdg;

    if (auto *home = std::getenv("HOME"))
        return std::string(home) + "/Music";

    return "/tmp";
}

coco::stray start(saucer::application *app)
{
    // ── local HTTP server for audio ──────────────────────────────────────
    ResourceServer audio_server;
    if (!audio_server.start())
    {
        std::fprintf(stderr, "Fatal: could not start audio HTTP server\n");
        co_return;
    }

    // ── window ────────────────────────────────────────────────────────────
    auto window  = saucer::window::create(app).value();
    auto webview = saucer::smartview::create({.window = window});

    window->set_title("Treeble");
    window->set_size({.w = 960, .h = 640});
    window->set_min_size({.w = 640, .h = 400});
    // ponytail: partial removes the native title bar but keeps the window
    // border/frame so the user can still resize by dragging edges.
    window->set_decorations(saucer::window::decoration::partial);

    // ── services ──────────────────────────────────────────────────────────
    auto root = music_dir();
    std::printf("Treeble root: %s\n", root.c_str());

    FileScanner       scanner(root);
    TagReader         tag_reader;
    PlayerState       state;
    WebViewAudioBackend audio(*webview);

    // ── system tray icon (must be before IPC handler) ────────────────────
    SystemTray        tray(app, *window);

    // ResourceServer already owns the HTTP server; register with IPC
    IPCHandler        ipc(*webview, scanner, tag_reader, audio, state, tray);

    // ── restore saved state ───────────────────────────────────────────────
    {
        auto saved = ipc.loadState();
        // Only restore size/position when NOT maximized — otherwise we'd
        // overwrite the window-manager's normal-size memory with screen size.
        if (!saved.maximized && saved.windowW > 0 && saved.windowH > 0)
        {
            window->set_size({.w = saved.windowW, .h = saved.windowH});
            window->set_position({.x = saved.windowX, .y = saved.windowY});
        }
        // Save state on window close
        window->on<saucer::window::event::close>([&ipc]() -> saucer::policy
        {
            ipc.saveStateOnExit();
            // ponytail: always allow close
            return saucer::policy::allow;
        });

        // Track maximized state without saving (avoids overwriting player state)
        window->on<saucer::window::event::maximize>([&ipc](bool maximized)
        {
            ipc.onMaximize(maximized);
        });
    }

    // ── embedded frontend ─────────────────────────────────────────────────
    webview->embed(saucer::embedded::all());

    // ── inject audio base URL into JS ─────────────────────────────────────
    // This must be done BEFORE serving the page, so the frontend has it
    auto base_url = audio_server.base_url();
    webview->expose("__audioBaseURL", [base_url]() -> std::string
    {
        return base_url;
    });
    // ponytail: avoid std::format in consteval context
    // Use base webview::execute (cstring_view) not smartview::execute (format_string)
    auto js = "window.__audioBaseURL = '" + base_url + "';";
    static_cast<saucer::webview &>(*webview).execute(js);

    webview->serve("/index.html");

    window->show();

    // Restore maximized state AFTER show() — some window managers
    // ignore set_maximized() before the window is mapped.
    if (auto saved = ipc.loadState(); saved.maximized)
    {
        window->set_maximized(true);
    }

    // ── run ───────────────────────────────────────────────────────────────
    co_await app->finish();
}

int main()
{
    try
    {
        return saucer::application::create({.id = "treeble"})->run(start);
    }
    catch (const std::exception &e)
    {
        std::fprintf(stderr, "Fatal: %s\n", e.what());
        return 1;
    }
}
