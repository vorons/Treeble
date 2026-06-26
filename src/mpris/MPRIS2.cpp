#include "MPRIS2.h"
#include "Types.h"
#include "audio/IAudioBackend.h"
#include "tray/SystemTray.h"

#include <saucer/window.hpp>
#include <saucer/app.hpp>

#include <gio/gio.h>

#include <cstdio>
#include <string>
#include <thread>

// ── D-Bus introspection XML: org.mpris.MediaPlayer2 ─────────────────────────
static constexpr const char s_mpris_object_path[] = "/org/mpris/MediaPlayer2";
static constexpr const char s_mpris_bus_name[]    = "org.mpris.MediaPlayer2.treeble";

static constexpr const char s_mpris_introspection[] =
    "<node>"
    "  <interface name='org.mpris.MediaPlayer2'>"
    "    <method name='Raise'/>"
    "    <method name='Quit'/>"
    "    <property name='CanQuit' type='b' access='read'/>"
    "    <property name='CanRaise' type='b' access='read'/>"
    "    <property name='HasTrackList' type='b' access='read'/>"
    "    <property name='Identity' type='s' access='read'/>"
    "    <property name='DesktopEntry' type='s' access='read'/>"
    "    <property name='SupportedUriSchemes' type='as' access='read'/>"
    "    <property name='SupportedMimeTypes' type='as' access='read'/>"
    "  </interface>"
    "  <interface name='org.mpris.MediaPlayer2.Player'>"
    "    <method name='Next'/>"
    "    <method name='Previous'/>"
    "    <method name='Pause'/>"
    "    <method name='PlayPause'/>"
    "    <method name='Stop'/>"
    "    <method name='Play'/>"
    "    <method name='Seek'>"
    "      <arg direction='in' name='Offset' type='x'/>"
    "    </method>"
    "    <method name='SetPosition'>"
    "      <arg direction='in' name='TrackId' type='o'/>"
    "      <arg direction='in' name='Position' type='x'/>"
    "    </method>"
    "    <method name='OpenUri'>"
    "      <arg direction='in' name='Uri' type='s'/>"
    "    </method>"
    "    <property name='PlaybackStatus' type='s' access='read'/>"
    "    <property name='LoopStatus' type='s' access='read'/>"
    "    <property name='Rate' type='d' access='read'/>"
    "    <property name='Shuffle' type='b' access='read'/>"
    "    <property name='Metadata' type='a{sv}' access='read'/>"
    "    <property name='Volume' type='d' access='readwrite'/>"
    "    <property name='Position' type='x' access='read'/>"
    "    <property name='MinimumRate' type='d' access='read'/>"
    "    <property name='MaximumRate' type='d' access='read'/>"
    "    <property name='CanGoNext' type='b' access='read'/>"
    "    <property name='CanGoPrevious' type='b' access='read'/>"
    "    <property name='CanPlay' type='b' access='read'/>"
    "    <property name='CanPause' type='b' access='read'/>"
    "    <property name='CanSeek' type='b' access='read'/>"
    "    <property name='CanControl' type='b' access='read'/>"
    "    <signal name='Seeked'>"
    "      <arg name='Position' type='x'/>"
    "    </signal>"
    "  </interface>"
    "</node>";

// ── struct MPRIS2::Impl ──────────────────────────────────────────────────
struct MPRIS2::Impl
{
    MPRIS2 *self{};
    saucer::application *app{};
    saucer::window &window;
    saucer::smartview &webview;
    PlayerState &state;
    IAudioBackend &audio;
    SystemTray &tray;

    GDBusConnection *conn{};
    guint root_id{};
    guint player_id{};
    guint name_id{};

    std::string repeat_mode{"off"};
    bool shuffle{false};

    // Cached metadata for change detection
    std::string last_track_path;
    bool last_playing{};
    bool last_paused{};
    double last_volume{-1};

    GMainLoop *loop{};
    std::thread thread;

    Impl(saucer::window &win, saucer::smartview &wv, PlayerState &st, IAudioBackend &aud, SystemTray &tr)
        : window(win), webview(wv), state(st), audio(aud), tray(tr) {}

    ~Impl()
    {
        if (loop)
            g_main_loop_quit(loop);
        if (thread.joinable())
            thread.join();
        if (name_id)
            g_bus_unown_name(name_id);
        if (root_id)
            g_dbus_connection_unregister_object(conn, root_id);
        if (player_id)
            g_dbus_connection_unregister_object(conn, player_id);
        if (conn)
            g_object_unref(conn);
    }
};

// ── helpers ────────────────────────────────────────────────────────────────
static std::string playback_status(const PlayerState &s)
{
    if (!s.playing)
        return "Stopped";
    return s.paused ? "Paused" : "Playing";
}

static std::string loop_status(const std::string &mode)
{
    if (mode == "one")
        return "Track";
    if (mode == "folder")
        return "Playlist";
    return "None";
}

static std::string track_id(std::size_t idx)
{
    return "/org/treeble/Track/" + std::to_string(idx);
}

static GVariant *build_metadata(const PlayerState &state)
{
    auto *builder = g_variant_builder_new(G_VARIANT_TYPE("a{sv}"));

    if (!state.queue.empty() && state.current_index < state.queue.size())
    {
        auto &t = state.queue[state.current_index];

        // mpris:trackid
        auto tid = track_id(state.current_index);
        g_variant_builder_add(builder, "{sv}", "mpris:trackid",
                              g_variant_new_object_path(tid.c_str()));

        // mpris:length (microseconds)
        g_variant_builder_add(builder, "{sv}", "mpris:length",
                              g_variant_new_int64(static_cast<gint64>(t.duration_sec) * 1000000));

        // xesam:title
        if (!t.title.empty())
            g_variant_builder_add(builder, "{sv}", "xesam:title",
                                  g_variant_new_string(t.title.c_str()));

        // xesam:artist
        if (!t.artist.empty())
        {
            const char *artist = t.artist.c_str();
            auto *artists = g_variant_new_strv(&artist, 1);
            g_variant_builder_add(builder, "{sv}", "xesam:artist", artists);
        }

        // xesam:url
        auto url = "file://" + t.path;
        g_variant_builder_add(builder, "{sv}", "xesam:url",
                              g_variant_new_string(url.c_str()));
    }

    auto result = g_variant_builder_end(builder);
    g_variant_builder_unref(builder);
    return result;
}

// ── property getter ────────────────────────────────────────────────────────
static GVariant *
get_mpris_property(GDBusConnection * /*conn*/, const gchar * /*sender*/,
                   const gchar * /*object_path*/, const gchar *interface_name,
                   const gchar *property_name, GError ** /*error*/, gpointer user_data)
{
    auto *impl = static_cast<MPRIS2::Impl *>(user_data);

    // ── org.mpris.MediaPlayer2 (root) ─────────────────────────────────
    if (g_strcmp0(interface_name, "org.mpris.MediaPlayer2") == 0)
    {
        if (g_strcmp0(property_name, "CanQuit") == 0)
            return g_variant_new_boolean(TRUE);
        if (g_strcmp0(property_name, "CanRaise") == 0)
            return g_variant_new_boolean(TRUE);
        if (g_strcmp0(property_name, "HasTrackList") == 0)
            return g_variant_new_boolean(FALSE);
        if (g_strcmp0(property_name, "Identity") == 0)
            return g_variant_new_string("Treeble");
        if (g_strcmp0(property_name, "DesktopEntry") == 0)
            return g_variant_new_string("treeble");
        if (g_strcmp0(property_name, "SupportedUriSchemes") == 0)
        {
            const char *schemes[] = {"file", nullptr};
            return g_variant_new_strv(schemes, 1);
        }
        if (g_strcmp0(property_name, "SupportedMimeTypes") == 0)
        {
            const char *mime[] = {
                "audio/mpeg", "audio/flac", "audio/ogg",
                "audio/wav", "audio/mp4", nullptr
            };
            return g_variant_new_strv(mime, 5);
        }
        return nullptr;
    }

    // ── org.mpris.MediaPlayer2.Player ─────────────────────────────────
    if (g_strcmp0(interface_name, "org.mpris.MediaPlayer2.Player") == 0)
    {
        if (g_strcmp0(property_name, "PlaybackStatus") == 0)
            return g_variant_new_string(playback_status(impl->state).c_str());

        if (g_strcmp0(property_name, "LoopStatus") == 0)
            return g_variant_new_string(loop_status(impl->repeat_mode).c_str());

        if (g_strcmp0(property_name, "Rate") == 0)
            return g_variant_new_double(1.0);

        if (g_strcmp0(property_name, "Shuffle") == 0)
            return g_variant_new_boolean(impl->shuffle);

        if (g_strcmp0(property_name, "Metadata") == 0)
            return build_metadata(impl->state);

        if (g_strcmp0(property_name, "Volume") == 0)
            return g_variant_new_double(impl->audio.volume());

        if (g_strcmp0(property_name, "Position") == 0)
            return g_variant_new_int64(
                static_cast<gint64>(impl->audio.position() * 1000000));

        if (g_strcmp0(property_name, "MinimumRate") == 0)
            return g_variant_new_double(1.0);

        if (g_strcmp0(property_name, "MaximumRate") == 0)
            return g_variant_new_double(1.0);

        if (g_strcmp0(property_name, "CanGoNext") == 0)
            return g_variant_new_boolean(!impl->state.queue.empty());

        if (g_strcmp0(property_name, "CanGoPrevious") == 0)
            return g_variant_new_boolean(!impl->state.queue.empty());

        if (g_strcmp0(property_name, "CanPlay") == 0)
            return g_variant_new_boolean(!impl->state.queue.empty());

        if (g_strcmp0(property_name, "CanPause") == 0)
            return g_variant_new_boolean(impl->state.playing);

        if (g_strcmp0(property_name, "CanSeek") == 0)
            return g_variant_new_boolean(TRUE);

        if (g_strcmp0(property_name, "CanControl") == 0)
            return g_variant_new_boolean(TRUE);

        return nullptr;
    }

    return nullptr;
}

// ── property setter (Volume only) ──────────────────────────────────────────
static gboolean
set_mpris_property(GDBusConnection * /*conn*/, const gchar * /*sender*/,
                   const gchar * /*object_path*/, const gchar *interface_name,
                   const gchar *property_name, GVariant *value,
                   GError **error, gpointer user_data)
{
    auto *impl = static_cast<MPRIS2::Impl *>(user_data);

    if (g_strcmp0(interface_name, "org.mpris.MediaPlayer2.Player") == 0 &&
        g_strcmp0(property_name, "Volume") == 0)
    {
        if (!g_variant_is_of_type(value, G_VARIANT_TYPE_DOUBLE))
        {
            g_set_error_literal(error, G_DBUS_ERROR, G_DBUS_ERROR_INVALID_ARGS,
                                "Volume must be a double");
            return FALSE;
        }
        double vol = g_variant_get_double(value);
        if (vol < 0.0) vol = 0.0;
        if (vol > 1.0) vol = 1.0;
        impl->audio.set_volume(vol);
        return TRUE;
    }

    g_set_error_literal(error, G_DBUS_ERROR, G_DBUS_ERROR_PROPERTY_READ_ONLY,
                        "Property is read-only");
    return FALSE;
}

// ── method call handler ────────────────────────────────────────────────────
static void
handle_mpris_method_call(GDBusConnection *conn, const gchar * /*sender*/,
                         const gchar * /*object_path*/, const gchar *interface_name,
                         const gchar *method_name, GVariant *parameters,
                         GDBusMethodInvocation *invocation, gpointer user_data)
{
    auto *impl = static_cast<MPRIS2::Impl *>(user_data);

    auto ok = [&]() { g_dbus_method_invocation_return_value(invocation, nullptr); };
    auto err = [&](const char *msg) {
        g_dbus_method_invocation_return_error(invocation, G_DBUS_ERROR,
                                               G_DBUS_ERROR_UNKNOWN_METHOD, "%s", msg);
    };

    if (g_strcmp0(interface_name, "org.mpris.MediaPlayer2") == 0)
    {
        if (g_strcmp0(method_name, "Raise") == 0)
        {
            impl->window.show();
            ok();
            return;
        }
        if (g_strcmp0(method_name, "Quit") == 0)
        {
            impl->app->quit();
            ok();
            return;
        }
        err("Unknown method");
        return;
    }

    if (g_strcmp0(interface_name, "org.mpris.MediaPlayer2.Player") == 0)
    {
        if (g_strcmp0(method_name, "Play") == 0)
        {
            if (!impl->state.queue.empty())
            {
                impl->state.playing = true;
                impl->state.paused = false;
                impl->audio.play();
                impl->tray.set_active(true);
                {
                    auto &base = static_cast<saucer::webview &>(impl->webview);
                    base.execute("window.__treeble_set_state({playing:true,paused:false})");
                }
                if (impl->self) impl->self->notify();
            }
            ok();
            return;
        }
        if (g_strcmp0(method_name, "Pause") == 0)
        {
            impl->state.paused = true;
            impl->audio.pause();
            impl->tray.set_active(false);
            {
                auto &base = static_cast<saucer::webview &>(impl->webview);
                base.execute("window.__treeble_set_state({paused:true})");
            }
            if (impl->self) impl->self->notify();
            ok();
            return;
        }
        if (g_strcmp0(method_name, "PlayPause") == 0)
        {
            if (!impl->state.queue.empty())
            {
                if (impl->state.paused || !impl->state.playing)
                {
                    impl->state.playing = true;
                    impl->state.paused = false;
                    impl->audio.play();
                    impl->tray.set_active(true);
                    {
                        auto &base = static_cast<saucer::webview &>(impl->webview);
                        base.execute("window.__treeble_set_state({playing:true,paused:false})");
                    }
                }
                else
                {
                    impl->state.paused = true;
                    impl->audio.pause();
                    impl->tray.set_active(false);
                    {
                        auto &base = static_cast<saucer::webview &>(impl->webview);
                        base.execute("window.__treeble_set_state({paused:true})");
                    }
                }
                if (impl->self) impl->self->notify();
            }
            ok();
            return;
        }
        if (g_strcmp0(method_name, "Stop") == 0)
        {
            impl->state.playing = false;
            impl->state.paused = false;
            impl->audio.pause();
            impl->audio.seek(0);
            impl->tray.set_active(false);
            {
                auto &base = static_cast<saucer::webview &>(impl->webview);
                base.execute("window.__treeble_set_state({playing:false,paused:false,positionSec:0})");
            }
            if (impl->self) impl->self->notify();
            ok();
            return;
        }
        if (g_strcmp0(method_name, "Next") == 0)
        {
            // ponytail: queue navigation (repeat/shuffle) is owned by the
            // frontend Zustand store. Eval the global helper instead of
            // duplicating that logic here.
            auto &base = static_cast<saucer::webview &>(impl->webview);
            base.execute("__treeble_next()");
            ok();
            return;
        }
        if (g_strcmp0(method_name, "Previous") == 0)
        {
            auto &base = static_cast<saucer::webview &>(impl->webview);
            base.execute("__treeble_prev()");
            ok();
            return;
        }
        if (g_strcmp0(method_name, "Seek") == 0)
        {
            gint64 offset_us = 0;
            g_variant_get(parameters, "(x)", &offset_us);
            double pos = impl->audio.position() + static_cast<double>(offset_us) / 1e6;
            if (pos < 0) pos = 0;
            impl->audio.seek(pos);
            ok();
            return;
        }
        if (g_strcmp0(method_name, "SetPosition") == 0)
        {
            const gchar *tid = nullptr;
            gint64 pos_us = 0;
            g_variant_get(parameters, "(&ox)", &tid, &pos_us);
            // Accept any track id for now (we have just one track list)
            double pos = static_cast<double>(pos_us) / 1e6;
            if (pos < 0) pos = 0;
            impl->audio.seek(pos);
            ok();
            return;
        }
        if (g_strcmp0(method_name, "OpenUri") == 0)
        {
            // ponytail: OpenUri is not supported — we don't expose a file picker.
            ok();
            return;
        }
        err("Unknown method");
        return;
    }

    err("Unknown interface");
}

// ── interface vtable ───────────────────────────────────────────────────────
static const GDBusInterfaceVTable s_mpris_vtable = {
    handle_mpris_method_call,
    get_mpris_property,
    set_mpris_property
};

// ── constructor ────────────────────────────────────────────────────────────
MPRIS2::MPRIS2(saucer::application *app, saucer::window &window,
               saucer::smartview &webview,
               PlayerState &state, IAudioBackend &audio,
               SystemTray &tray)
    : m_impl(std::make_unique<Impl>(window, webview, state, audio, tray))
{
    m_impl->self = this;
    m_impl->app = app;

    GError *dbus_err = nullptr;

    m_impl->conn = g_bus_get_sync(G_BUS_TYPE_SESSION, nullptr, &dbus_err);
    if (!m_impl->conn)
    {
        std::fprintf(stderr, "[mpris] failed to connect to D-Bus: %s\n", dbus_err->message);
        g_error_free(dbus_err);
        return;
    }

    // Start GMainLoop thread
    m_impl->loop = g_main_loop_new(nullptr, FALSE);
    m_impl->thread = std::thread([loop = m_impl->loop]()
    {
        g_main_loop_run(loop);
    });

    // Register object with both interfaces
    GDBusNodeInfo *node = g_dbus_node_info_new_for_xml(s_mpris_introspection, nullptr);

    m_impl->root_id = g_dbus_connection_register_object(
        m_impl->conn, s_mpris_object_path,
        node->interfaces[0], // first interface
        &s_mpris_vtable, m_impl.get(), nullptr, &dbus_err);

    if (m_impl->root_id == 0)
    {
        std::fprintf(stderr, "[mpris] failed to register object: %s\n", dbus_err->message);
        g_error_free(dbus_err);
    }

    // Register the second interface on the same object path
    // ponytail: g_dbus_connection_register_object takes ONE interface from
    // the node. We need TWO calls for the two interfaces.
    m_impl->player_id = g_dbus_connection_register_object(
        m_impl->conn, s_mpris_object_path,
        node->interfaces[1], // second interface
        &s_mpris_vtable, m_impl.get(), nullptr, &dbus_err);

    if (m_impl->player_id == 0)
    {
        std::fprintf(stderr, "[mpris] failed to register Player interface: %s\n", dbus_err->message);
        g_error_free(dbus_err);
    }

    g_dbus_node_info_unref(node);

    // Acquire bus name
    auto on_name_acquired = [](GDBusConnection *, const gchar *name, gpointer) -> void {
        std::fprintf(stderr, "[mpris] acquired bus name '%s'\n", name);
    };
    m_impl->name_id = g_bus_own_name(
        G_BUS_TYPE_SESSION, s_mpris_bus_name,
        G_BUS_NAME_OWNER_FLAGS_NONE,
        nullptr, on_name_acquired, nullptr,
        m_impl.get(), nullptr);

    std::fprintf(stderr, "[mpris] registered on session bus as %s\n", s_mpris_bus_name);
}

MPRIS2::~MPRIS2() = default;
MPRIS2::MPRIS2(MPRIS2 &&) noexcept = default;
MPRIS2 &MPRIS2::operator=(MPRIS2 &&) noexcept = default;

// ── notify: emit PropertiesChanged for Player interface ────────────────────
void MPRIS2::notify()
{
    if (!m_impl->conn || !m_impl->root_id)
        return;

    auto &st = m_impl->state;

    // Build changed properties
    auto *builder = g_variant_builder_new(G_VARIANT_TYPE("a{sv}"));

    auto status = playback_status(st);
    g_variant_builder_add(builder, "{sv}", "PlaybackStatus",
                          g_variant_new_string(status.c_str()));

    g_variant_builder_add(builder, "{sv}", "LoopStatus",
                          g_variant_new_string(loop_status(m_impl->repeat_mode).c_str()));

    g_variant_builder_add(builder, "{sv}", "Shuffle",
                          g_variant_new_boolean(m_impl->shuffle));

    g_variant_builder_add(builder, "{sv}", "Metadata",
                          build_metadata(st));

    auto vol = m_impl->audio.volume();
    g_variant_builder_add(builder, "{sv}", "Volume",
                          g_variant_new_double(vol));

    g_variant_builder_add(builder, "{sv}", "CanPlay",
                          g_variant_new_boolean(!st.queue.empty()));
    g_variant_builder_add(builder, "{sv}", "CanPause",
                          g_variant_new_boolean(st.playing));

    auto changed = g_variant_builder_end(builder);

    // Empty changed properties — emit nothing
    auto n_changed = g_variant_n_children(changed);
    if (n_changed == 0)
    {
        g_variant_unref(changed);
        g_variant_builder_unref(builder);
        return;
    }

    // Invalidated properties list (empty)
    auto *invalidated = g_variant_new_array(G_VARIANT_TYPE_STRING, nullptr, 0);

    g_dbus_connection_emit_signal(
        m_impl->conn, nullptr, s_mpris_object_path,
        "org.freedesktop.DBus.Properties",
        "PropertiesChanged",
        g_variant_new("(s@a{sv}@as)",
                      "org.mpris.MediaPlayer2.Player",
                      changed, invalidated),
        nullptr);

    g_variant_builder_unref(builder);
}


void MPRIS2::set_repeat_mode(const std::string &mode)
{
    m_impl->repeat_mode = mode;
}

void MPRIS2::set_shuffle(bool shuffle)
{
    m_impl->shuffle = shuffle;
}
