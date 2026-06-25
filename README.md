<img src="https://github.com/vorons/Treeble/raw/main/assets/treeble.png" alt="Treeble" width="300" height="200">

# Treeble

> A folder-first music player for Linux. Think "file manager for your music."

![Screenshot](https://github.com/vorons/Treeble/raw/main/assets/screenshot.png)

**Version 0.7.1**

Treeble is a minimal, local-only music player built around a simple idea: **folders are playlists**. Browse your music directory tree on the left, click a folder to see its tracks on the right, double-click a track to play. Next/Prev stay within the current folder.

No database. No streaming. No cloud. No bloat.

## Features

- **Folder tree navigation** – browse your music library the same way your filesystem organises it
- **Folder-scoped playback** – Next/Prev cycle tracks inside the current folder, not the whole library
- **Tag-aware display** – title, artist, duration read via TagLib (falls back to filename)
- **HTML5 audio via WebView** – playback runs through the system WebKitGTK webview (no GStreamer pipeline to maintain … yet)
- **Local HTTP streaming** – audio files are served to the sandboxed webview over `http://127.0.0.1:<port>`, supporting `Range` requests for seek without loading the whole file into RAM
- **Player bar** – play/pause, next/prev, seek, volume
- **Keyboard shortcuts** – Space (play/pause), ←/→ (rewind −5 s / +5 s)
- **System tray** – background playback with tray menu
- **Window persistence** – remembers position, size, volume, last folder and track, repeat/shuffle mode
- **Repeat & shuffle** – repeat off / one / all, shuffle toggle
- **MPRIS2** – media keys integration (play/pause, next, prev, position, seek, volume)
- **Dark & light theme** – via CSS `prefers-color-scheme`

### What Treeble is *not*

Treeble intentionally omits things that belong in a full-featured library manager:

- ❌ No music database / library scan – what you see is what's on disk
- ❌ No playlists – your folder tree *is* your playlist
- ❌ No cover art – ignored during tag parsing
- ❌ No streaming services, no scrobbling, no DAP sync
- ❌ No EQ, no audio effects, no crossfade
- ❌ No Android/iOS/Windows/macOS support (Linux-only)

## Quick start

### Dependencies

- C++23 compiler (GCC 13+, Clang 16+)
- CMake 3.21+
- Node.js 20+
- pkg-config

**Fedora:**
```bash
sudo dnf install webkit2gtk4.1-devel json-glib-devel taglib-devel glib2-devel \
  gtk4-devel libsoup3-devel dbusmenu-gtk3-devel
```

**Ubuntu/Debian:**
```bash
sudo apt install libwebkitgtk-6.0-dev libjson-glib-dev libtag1-dev \
  libglib2.0-dev libgtk-4-dev libsoup-3.0-dev libdbusmenu-glib-dev
```

### Build & run

```bash
./build.sh
./build/treeble
```

Or manually:

```bash
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j "$(nproc)"
./build/treeble
```

> ⚠️ If you installed WebKitGTK or other libs in a non-standard prefix, set `PKG_CONFIG_PATH` and `LIBRARY_PATH` accordingly — the `build.sh` script does this for `~/.local`.

### Configuration

| Environment | Default | Description |
|-------------|---------|-------------|
| `TREEBLE_ROOT` | `~/Music` (or XDG `XDG_MUSIC_DIR`) | Root directory for the music library |

## Controls

| Interaction | Action |
|-------------|--------|
| Double-click a track | Play |
| Space (global) | Play / Pause |
| ← / → (global) | Rewind −5 s / +5 s |
| Player bar buttons | Play/Pause, Next, Prev, Seek, Volume |
| Slider | Seek / Volume |
| Repeat button | Cycle: off → one → all |
| Shuffle toggle | Shuffle on/off |

## Architecture (in brief)

```
┌──────────────────────────────────────────────────────────┐
│                   saucer::smartview                       │
│  ┌──────────────────────────────────────────────────┐    │
│  │  Frontend (React + Vite + Tailwind + Zustand)    │    │
│  │  ┌──────────┐  ┌────────────┐  ┌─────────────┐  │    │
│  │  │ TreeView │  │ TrackList  │  │ PlayerBar   │  │    │
│  │  └──────────┘  └────────────┘  └─────────────┘  │    │
│  └──────────────────────────────────────────────────┘    │
│            ↕ IPC (JSON via saucer bind/eval)              │
│  ┌──────────────────────────────────────────────────┐    │
│  │  C++ Backend                                      │    │
│  │  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │    │
│  │  │FileScanner│  │TagReader │  │WebviewAudioB…  │  │    │
│  │  │ (lazy FS)│  │ (TagLib) │  │(<audio> + app:…│) │    │
│  │  └──────────┘  └──────────┘  └────────────────┘  │    │
│  │  ┌──────────┐  ┌──────────────┐  ┌────────────┐  │    │
│  │  │MPRIS2    │  │ResourceServer│  │SystemTray  │  │    │
│  │  │ (GDBus)  │  │ (libsoup)   │  │            │  │    │
│  │  └──────────┘  └──────────────┘  └────────────┘  │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

**Key points:**

- **Business logic lives in C++.** The frontend is a "dumb terminal" — it renders UI and sends raw commands. The backend holds the queue, current index, play state, and folder cache.
- **Lazy filesystem scan.** The folder tree is built at startup (fast — directories only). Track listing for a folder is loaded on click and cached in an `unordered_map`.
- **Audio streaming.** WebKitGTK's sandbox blocks `file://` URIs, so a local libsoup HTTP server serves audio files with `Range` header support for efficient seek. The frontend gets a `window.__audioBaseURL` injected at page load.
- **MPRIS2** exposes the player to the system's media keys via `org.mpris.MediaPlayer2.treeble` over D-Bus.

## Development

```bash
# Backend (one-time build)
cmake -B build -DCMAKE_BUILD_TYPE=Debug
cmake --build build -j "$(nproc)"

# Frontend dev server (HMR)
cd frontend
npm install
npm run dev

# Point the backend to the dev server (WIP — for now the backend embeds
# the production build; see CMakeLists.txt for the embedded workflow)
```

Frontend source lives in `frontend/`. The production build is embedded into the C++ binary at CMake configure time via `saucer_embed()`.

## FAQ / Design decisions

**Why no database?**  
Because the filesystem *is* the database. A database needs syncing; the filesystem is always up to date. For a library of a few thousand tracks, walking the directory tree on startup is instant.

**Why HTML5 `<audio>` and not GStreamer?**  
GStreamer is the long-term plan. The Saucer webview gives us a working audio pipeline for free — `<audio>` handles MP3, FLAC, Ogg, WAV, Opus out of the box. When the GStreamer backend is written, it'll be a one-line swap behind the `IAudioBackend` interface.

**Why a local HTTP server instead of `file://`?**  
WebKitGTK sandbox blocks `file://` URIs. A local HTTP server on `127.0.0.1` bypasses this cleanly and gives us `Range`-based seeking for free.

**Why Zustand over Redux/Context?**  
It maps cleanly to the IPC pattern: C++ sends a JSON event → Zustand store updates → React re-renders. No boilerplate, no context providers, no middleware.

## License

MIT
