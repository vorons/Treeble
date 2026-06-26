#include "Types.h"
#include "fs/FileScanner.h"
#include "metadata/TagReader.h"
#include "audio/WebViewAudioBackend.h"
#include "ipc/IPCHandler.h"
#include "web/ResourceServer.h"
#include "tray/SystemTray.h"
#include "mpris/MPRIS2.h"

#include <saucer/smartview.hpp>
#include <saucer/embedded/all.hpp>

#include <cstdio>
#include <cstring>
#include <cstdlib>
#include <csignal>
#include <fstream>
#include <string>

#include <gio/gio.h>

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

// ── signal-safe cleanup globals ──────────────────────────────────────────
// ponytail: globals are fine for a single-instance desktop app. If Treeble
// ever needs multiple instances or in-process testing, these would move into
// the application class or a dedicated lifecycle manager.
static IPCHandler *g_ipc{};
static saucer::application *g_app{};

static void handle_signal(int sig)
{
    if (g_ipc)
        g_ipc->saveStateOnExit();
    if (g_app)
        g_app->quit();
    (void)sig;
}

coco::stray start(saucer::application *app)
{
    g_app = app;

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
    g_ipc = &ipc;

    // ── MPRIS2 (D-Bus media player integration) ──────────────────────────
    MPRIS2            mpris(app, *window, *webview, state, audio, tray);
    ipc.set_mpris(&mpris);

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

// ── CLI helpers ────────────────────────────────────────────────────────────
static void print_version()
{
    std::printf("Treeble %s\n", TREEBLE_VERSION);
}

static void print_help()
{
    std::printf(
        "Usage: treeble [OPTION]...\n"
        "Folder-first music player for Linux.\n"
        "\n"
        "Options:\n"
        "  --version       print version and exit\n"
        "  --help          print this help and exit\n"
        "  --toggle-pause  toggle play/pause on running instance\n"
    );
}

static int toggle_pause()
{
    GError *err = nullptr;
    auto *conn = g_bus_get_sync(G_BUS_TYPE_SESSION, nullptr, &err);
    if (!conn)
    {
        std::fprintf(stderr, "treeble: D-Bus connection failed: %s\n", err->message);
        g_error_free(err);
        return 1;
    }

    auto *reply = g_dbus_connection_call_sync(
        conn,
        "org.mpris.MediaPlayer2.treeble",
        "/org/mpris/MediaPlayer2",
        "org.mpris.MediaPlayer2.Player",
        "PlayPause",
        nullptr,              // parameters
        nullptr,              // reply type
        G_DBUS_CALL_FLAGS_NONE,
        -1,                   // timeout (default)
        nullptr,              // cancellable
        &err
    );

    g_object_unref(conn);

    if (!reply)
    {
        std::fprintf(stderr, "treeble: --toggle-pause failed: %s\n", err->message);
        g_error_free(err);
        return 1;
    }

    g_variant_unref(reply);
    return 0;
}

int main(int argc, char *argv[])
{
    if (argc > 1)
    {
        if (std::strcmp(argv[1], "--version") == 0)
        {
            print_version();
            return 0;
        }
        if (std::strcmp(argv[1], "--help") == 0)
        {
            print_help();
            return 0;
        }
        if (std::strcmp(argv[1], "--toggle-pause") == 0)
        {
            return toggle_pause();
        }
        std::fprintf(stderr, "treeble: unknown option '%s'\n", argv[1]);
        std::fprintf(stderr, "Try 'treeble --help' for more information.\n");
        return 1;
    }

    signal(SIGTERM, handle_signal);
    signal(SIGINT,  handle_signal);

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
