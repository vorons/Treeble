# Treeble Technical Specification

## Purpose

A folder-first, local-only music player for Linux. Browsing the filesystem directory tree replaces playlist management — folders *are* playlists.

## User

Linux desktop users who store music in a directory hierarchy and want a lightweight, bloat-free player without library scanning, databases, cloud features, or streaming integration.

## Use-case

- Browse a music directory tree, click a folder, see its audio tracks listed
- Double-click a track to play; Next/Prev stay within the current folder
- Play/pause, seek, volume via keyboard (Space, ←/→, Ctrl+↑/↓) or player bar
- Repeat (off/one/all) and shuffle toggles
- Background playback via system tray; media keys via MPRIS2
- Window position, size, volume, last folder/track, repeat/shuffle survive restart

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                  saucer::smartview (WebKitGTK)                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Frontend (React + TypeScript + Vite + Tailwind v4)  │    │
│  │  • FileTree (sidebar) → selectFolder, getTracks      │    │
│  │  • TrackList (main) → playTrack, togglePause         │    │
│  │  • HeaderBar (player bar + custom title bar)          │    │
│  │  • StatusBar (repeat/shuffle + folder info)           │    │
│  │  • Zustand store (playerStore) — single source        │    │
│  └──────────────────────┬───────────────────────────────┘    │
│                          ↕ JSON calls via saucer expose/bind  │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  C++ Backend (C++23, CMake)                          │    │
│  │  • IPCHandler   — all IPC endpoints, state save/load │    │
│  │  • FileScanner  — lazy FS traversal (dirs+audio)     │    │
│  │  • TagReader    — TagLib wrapper (title, artist, dur) │    │
│  │  • WebViewAudioBackend — IAudioBackend impl via <audio> │
│  │  • ResourceServer — libsoup HTTP server (Range supp.) │    │
│  │  • SystemTray — StatusNotifierItem (Ayatana/KDE)      │    │
│  │  • MPRIS2 — org.mpris.MediaPlayer2.treeble (D-Bus)    │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

**Key design decisions:**

- **C++ holds the truth** for queue, play state, folder cache — frontend is a "dumb terminal"
- **No database** — filesystem is the database, lazy-scanned at startup (directories only), tracks on click
- **Audio via WebView** — `<audio>` element in WebKitGTK handles decode; HTML5 Audio API controls playback
- **Local HTTP server** — WebKitGTK sandbox blocks `file://`, so ResourceServer streams files over `http://127.0.0.1:<port>` with `Range` header support
- **Frontend state** backed by Zustand store; C++ backend invoked via saucer `expose`/`bind` JSON IPC
- **i18n** — custom zero-dependency module with JSON locale files and a plain `t(key)` function; locale detected from `navigator.language` at startup

## Stack

| Layer | Technology | Version/Constraint |
|---|---|---|
| Language | C++ | C++23 (GCC 13+, Clang 16+) |
| Build | CMake + CPM/FetchContent | ≥3.21 |
| WebView | Saucer (`saucer::smartview`) | v8.0.4 (in-repo fetch) |
| Audio decode | WebKitGTK `<audio>` element | webkit2gtk-4.1 |
| HTTP server | libsoup | 3.0 |
| Tags | TagLib | pkg-config |
| System tray | D-Bus StatusNotifierItem (Ayatana) | via dbusmenu-glib + GDBus |
| MPRIS2 | GDBus on `org.mpris.MediaPlayer2.treeble` | GLib/GIO |
| Frontend | React + TypeScript | React 19, TypeScript 6 |
| Build (frontend) | Vite | v8.x |
| Styling | Tailwind CSS | v4 |
| UI components | shadcn-svelte? → shadcn React primitives (Radix UI) | @radix-ui/react-slider etc. |
| State | Zustand | v5 |
| Icons | lucide-react | — |
| i18n | Custom zero-dep (JSON + `t()` function) | `frontend/src/lib/i18n.ts` |
| Packaging | CPack (TGZ/DEB/RPM) | — |

## Entry

- **Binary entry:** `src/main.cpp` → `main()` → `saucer::application::create({.id = "treeble"})->run(start)`
- **Frontend entry:** `frontend/src/main.tsx` → React root rendering `<App />`
- **IPC bridge:** `frontend/src/lib/ipc.ts` — thin wrapper over `window.saucer.exposed[method]`

## Contract: i18n

### Locale detection

Detected once at startup from `navigator.language` (e.g. `"ru"`, `"en"`). Falls back to `"en"` if the language code has no registered locale file. No runtime switching — requires restart.

### Translation files

| File | Language |
|---|---|
| `frontend/src/locales/en.json` | English (default) |
| `frontend/src/locales/ru.json` | Russian |

Shape: flat `{ "key": "translated string" }`. All locale JSON files are statically imported at Vite build time — no dynamic imports, no extra requests.

### API

| Function | Returns | Description |
|---|---|---|
| `init()` | `void` | Detect locale, load dictionary. Call once before rendering. |
| `t(key)` | `string` | Translate key. Fallback chain: current locale → en.json → raw key. |
| `locale()` | `string` | Return the active locale code (e.g. `"en"`, `"ru"`). |

### C++ tray menu

Inline translation map in `src/tray/SystemTray.cpp` keyed by `g_get_language_names()[0]`. Three strings: `"Hide"`, `"Show"`, `"Quit"`. No IPC needed — detected once at construction.

All IPC methods are exposed via `webview.expose("name", handler)` on the C++ side and called via `window.saucer.exposed.name(...)` on the frontend side. Return values are JSON-serialised automatically by Saucer's glaze runtime.

### Backend → Frontend (exposed)

| Method | Args | Returns | Description |
|---|---|---|---|
| `getTree` | — | `FolderTree` | Full directory tree from root (dirs only, fast) |
| `getTracks` | `dir: string` | `Track[]` | Audio files + tags in a folder (lazy) |
| `playInFolder` | `dir, index` | — | Set queue from folder, play track at index |
| `play` | `index` | — | Play queue[index] (queue already set) |
| `pause` | — | — | Pause playback |
| `resume` | — | — | Resume playback |
| `seek` | `position: double` | — | Seek to position (seconds) |
| `setVolume` | `vol: double` | — | Set volume 0.0–1.0 |
| `getState` | — | `PlayerStateView` | Full snapshot (queue, index, playing, pos) |
| `audioEvent` | `type, pos, dur` | — | `<audio>` event notification from frontend |
| `loadState` | — | `SavedStateView` | Persisted state from disk |
| `saveState` | `lastFolder, lastTrackIndex, volume, repeatMode, shuffle` | — | Persist current state to disk |
| `windowMinimize` | — | — | Minimize window |
| `windowMaximizeRestore` | — | `bool` | Toggle maximize/restore, returns new state |
| `windowClose` | — | — | Close window (hides to tray) |
| `windowStartDrag` | — | — | Start window drag (custom title bar) |
| `getHome` | — | `string` | Root music directory path |
| `selectFolder` | — | `string` | Open native GTK folder picker dialog, return selected path or empty |
| `setMusicFolder` | `path: string` | `FolderTree` | Change music root folder, persist, return new tree |

### Frontend → C++ (window.audioPlayer)

Exposed via `window.audioPlayer` by frontend, called from `WebViewAudioBackend`:

| Method | Args | Description |
|---|---|---|
| `load(src)` | `string` | Set `<audio>` element src (absolute path, URL-encoded) |
| `play()` | — | Call `el.play()` |
| `pause()` | — | Call `el.pause()` |
| `seek(sec)` | `number` | Set `el.currentTime` |
| `setVolume(vol)` | `number` | Set `el.volume` |

### C++ → Frontend (global helpers for MPRIS)

| Global fn | Description |
|---|---|
| `window.__treeble_next()` | Trigger next track (respects repeat/shuffle) |
| `window.__treeble_prev()` | Trigger previous track |
| `window.__treeble_set_state(partial)` | Merge state into Zustand store (for MPRIS play/pause/stop) |

## Contract: Data Types

### Track / TrackView

| Field | Type | Description |
|---|---|---|
| `path` | string | Absolute filesystem path |
| `title` | string | From tags (fallback: filename) |
| `artist` | string | From tags (empty if missing) |
| `durationSec` | uint64 | Seconds (from TagLib `audioProperties`) |

### FolderTree

| Field | Type | Description |
|---|---|---|
| `path` | string | Absolute path |
| `name` | string | Directory basename |
| `children` | FolderTree[] | Subdirectories (recursive) |

### SavedState (persisted JSON at `~/.local/share/treeble/state.json`)

| Field | Type | Description |
|---|---|---|
| `windowX/Y/W/H` | int | Window geometry |
| `maximized` | bool | Was maximized on close |
| `lastFolder` | string | Current folder path |
| `lastTrackIndex` | int | Index in folder tracks |
| `volume` | double | 0.0–1.0 |
| `repeatMode` | string | `"off"` / `"one"` / `"folder"` |
| `shuffle` | bool | Shuffle enabled |
| `musicFolder` | string | Custom music root (overrides XDG_MUSIC_DIR); empty = use default |

## Contract: External Interfaces

### org.mpris.MediaPlayer2.treeble (D-Bus)

Root interface `org.mpris.MediaPlayer2`:
- `Raise()` / `Quit()` — show window / quit app

Player interface `org.mpris.MediaPlayer2.Player`:
- `Play()`, `Pause()`, `PlayPause()`, `Stop()` — playback control
- `Next()`, `Previous()` — track navigation (delegates to frontend helpers)
- `Seek(Offset: x)`, `SetPosition(TrackId: o, Position: x)` — seek
- `OpenUri()` — no-op (not supported)
- Properties: `PlaybackStatus`, `LoopStatus`, `Shuffle`, `Metadata`, `Volume`, `Position`, `CanXxx`

### org.kde.StatusNotifierItem (D-Bus) — System tray

- Registers on session bus under `/StatusNotifierItem`
- Icon: PNG + raw ARGB32 pixmap (B&W when idle, accent-coloured when playing)
- Menu: Show/Hide, Quit via dbusmenu-glib
- `Activate`/`SecondaryActivate` toggle window visibility

### Local HTTP API (`http://127.0.0.1:<port>`)

- Routes: `/audio/<url-encoded-absolute-path>`
- Supports `Range: bytes=N-M` header → returns `206 Partial Content`
- Path traversal protection (rejects `..`)
- CORS: `Access-Control-Allow-Origin: *`

## Flow: Track Playback

1. User clicks folder in sidebar → `selectFolder(path)` → IPC `getTracks(path)` → `FolderEntry[]` displayed
2. User double-clicks or clicks play on a track → `playTrack(index)` → IPC `playInFolder(folder, index)`
3. C++ `IPCHandler::playInFolder`:
   - Scans folder → builds `Track` list → sets `m_state.queue`
   - Calls `WebViewAudioBackend::load(path)` → eval JS `audioPlayer.load(url)`
   - Calls `WebViewAudioBackend::play()` → eval JS `audioPlayer.play()`
4. Frontend loads `<audio src="http://127.0.0.1:<port>/audio/<path>">` → ResourceServer streams file
5. `<audio>` fires `timeupdate` → frontend calls IPC `audioEvent("timeupdate", pos, dur)` → C++ caches position
6. Track ends → `audioEvent("ended")` → frontend Zustand store determines next track (repeat/shuffle logic), calls IPC `play(index)` to load next

## Flow: State Persistence

1. On every meaningful state change (volume, track, folder, repeat/shuffle), frontend calls IPC `saveState(...)`
2. C++ serialises `SavedState` to `~/.local/share/treeble/state.json` via atomic write (`.tmp` + rename)
3. On startup, `FileTree` calls `init()` → calls `getTree()` and `_loadAndApplyState()` → IPC `loadState()`
4. If `lastFolder` is set, loads tracks from that folder, restores volume, repeat/shuffle, window geometry

## Invariant

- **One window, one process.** Treeble is a single-instance desktop app. Multiple instances would share no state (each has its own in-memory queue).
- **Queue is scoped to one folder.** The queue is always the contents of the folder the user last played from. Navigating folders does not change the queue until a track is played.
- **Frontend does not hold write authority over the queue** — it asks the backend to play. The backend writes the queue on `playInFolder`, the frontend mirrors it for display.
- **MPRIS2 Next/Previous delegates to frontend** — the repeat/shuffle logic lives in Zustand, not in C++. MPRIS calls `window.__treeble_next()` JS helpers.
- **All IPC is synchronous from C++ perspective** — Saucer exposes blocking C++ lambdas that return values; the frontend awaits promises.

## Constraint

- **Linux-only.** Depends on WebKitGTK, libsoup, GLib/GIO, dbusmenu-glib — all Linux platform libraries.
- **WebKitGTK sandbox** blocks `file://` — audio must be served via HTTP.
- **No network access** — HTTP server binds only `127.0.0.1`, music folder is purely local.
- **Frontend build must happen before C++ link** — saucer_embed requires `dist/` at CMake configure time.
- **State file format is hand-rolled JSON** — no full JSON library; parser is fragile against schema changes.
- **GMainLoop required** for D-Bus (MPRIS2 + SystemTray) — runs in a dedicated thread since Saucer uses its own event loop.

## Convention

- **Ponytail comments** (`// ponytail: reason`) mark intentional simplifications with known ceilings and upgrade paths.
- **Minimal JSON parsing** — hand-written JSON writer/parser in `IPCHandler.cpp` (`serialize_state` / `parse_state`). Intentional: avoids pulling in a JSON library for a flat schema with 10 fields.
- **Single header per backend module** in `src/` — each module (fs, metadata, audio, ipc, web, tray, mpris) has exactly one `.h` + one `.cpp`.
- **No dependency injection framework** — services are constructed manually in `start()` and wired into `IPCHandler`.
- **Frontend uses `@/` path alias** — configured in Vite `resolve.alias`.
- **No frontend tests** — no test framework configured. Backend has no tests either.
- **All IPC goes through `lib/ipc.ts`** — direct access to `window.saucer.exposed` is encapsulated; consumers import typed functions.
- **Error handling in IPC** — frontend wraps every backend call in try/catch and shows toast on failure via `sonner`.
- **Global signal handlers** in `main.cpp` for SIGTERM/SIGINT — save state and quit cleanly.
- **Window close hides to tray** — the window `close` event handler calls `hide()` instead of `quit()`. Actual quit only via tray menu "Quit".
- **i18n without framework** — custom `t(key)` function + static JSON imports. Intentional: ~30 strings don't justify react-i18next. C++ tray menu uses inline `tr()` map with `std::string_view` locale detection.
