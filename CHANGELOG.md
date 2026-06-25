# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- AppImage packaging pipeline (`scripts/package-appimage.sh`)
- GitHub Actions release workflow (`.github/workflows/release.yml`)
- CMake install rules for binary, `.desktop` file, and icon
- `treeble.desktop` with categories `AudioVideo;Player;`, MimeType, and PlayPause action
- `assets/treeble.png` — 256×256 app icon
- CLI argument parsing: `--version`, `--help`, `--toggle-pause` (`src/main.cpp`)

### Fixed
- **MPRIS2 Next/Previous**: D-Bus `Next` and `Previous` methods are no longer no-op.
  They now delegate to frontend navigation via `__treeble_next()` / `__treeble_prev()`,
  respecting repeat/shuffle logic from the Zustand store.
- **SIGTERM/SIGINT**: state is now persisted before exit when killed via `kill`,
  `systemctl --user stop`, or session end (`src/main.cpp`).
- **state.json corruption**: writes go through a temp file (`state.json.tmp`)
  with atomic `rename()`; corrupted files on load are deleted and default
  state is returned (`src/ipc/IPCHandler.cpp`).

## [0.5.0] — 2026-06-24

### Added
- MPRIS2 D-Bus integration (`org.mpris.MediaPlayer2.treeble`) — media keys,
  playerctl, GNOME/KDE shell integration
  - `org.mpris.MediaPlayer2` (root): Raise, Quit, identity, URI schemes
  - `org.mpris.MediaPlayer2.Player`: Play, Pause, PlayPause, Stop, Seek,
    SetPosition, PlaybackStatus, LoopStatus, Shuffle, Volume, Metadata,
    Position, Can* flags, PropertiesChanged signals
- `IAudioBackend::volume()` getter — exposed for MPRIS2 Volume property

### Fixed
- Left accent border on active track was invisible because `border-border/40`
  (border-color shorthand) overrode `border-l-primary` via tailwind-merge.
  Split into `border-b-border/40` (bottom) + `border-l-primary` (left).

## [0.4.0] — 2026-06-22

### Added
- State persistence (window geometry, volume, last folder/track, repeat mode, shuffle)
- Maximized window state persist/restore
- Resizable folder tree panel with embedded drag handle
- Keyboard shortcuts: Ctrl+←/→ (prev/next track), Ctrl+↑/↓ (volume), Ctrl+M (mute)

### Changed
- HeaderBar consolidation: TitleBar + PlayerBar merged into one component
- Tracks separator opacity bumped to 40%
- Window control button size increased to 32px

### Removed
- Minimize-to-tray handler (was duplicating close-to-tray behaviour)
- 4 unused Radix UI components and their dependencies
- Radix ScrollArea (replaced with plain `overflow-y-auto` + GPU promotion)
- Stale radix packages from lockfile

### Fixed
- Blurry font on scroll in WebKitGTK (GPU layer promotion on scroll viewport)
- Mute toggle: pre-mute volume now restores correctly
- Space key starts playback when no track is playing (was no-op)
- Maximized restore: skip size/position when maximized, `set_maximized()` after
  `show()`, persist on maximize event
- All 5 open code-review findings (ResourceServer path traversal, LAN exposure,
  `std::stoll` throw, double-advance on ended, `std::stoi` crash on corrupt state)

## [0.3.0] — 2026-06-20

### Added
- System tray icon via StatusNotifierItem D-Bus protocol (Ayatana AppIndicator)
- Repeat (3-state: off / one / folder) and shuffle toggle
- Volume percentage tooltip on hover
- Remaining time label (duration − position)
- Error toasts for failed IPC calls

### Changed
- Full UI migration to shadcn/ui + Radix components
- Warm amber colour palette, gradient progress bar, subtle glow effects
- TitleBar merged into PlayerBar as a continuous band
- Tray icon: music note with B&W/accent colour states (D-Bus SNI pixmap)
- Sort UI simplified to inline Name/Duration toggles
- Status bar restructured for new controls

### Removed
- Custom progress tooltip (replaced Radix Tooltip back to custom absolute div)
- Sort dropdown/popover (was overengineered for two options)

### Fixed
- GTK 3/4 conflict (switched from Ayatana AppIndicator to raw SNI D-Bus)
- Tray icon colours: white B&W, amber active
- Folder icons: show Folder on all folders, Music icon on active folder
- Volume slider: unmute on drag + sync initial volume from state
- Playback queue replacement on folder navigation
- Sort crash on folder click and related track bugs

## [0.2.0] — 2026-06-18

### Added
- Custom title bar with window drag and control buttons
- Keyboard shortcuts: Space (play/pause), ←/→ (seek ±5 s)
- Hover tooltip with time on progress bar
- Empty state placeholder with icon and keyboard hints
- Track sorting by name/duration
- Track separators via `divide-y`
- Filled track on volume range slider

### Changed
- PlayerBar moved to top, StatusBar added at bottom
- Track position shown in StatusBar instead of file count
- Reduced progress bar transition to 100ms
- Drag region restricted to title text only

### Fixed
- `file://` URI blocked by WebKitGTK sandbox — replaced with local HTTP server
  (`http://127.0.0.1:<port>`), supporting Range-based seeking
- Music dir detection via XDG user-dirs
- CSS color values (bare HSL tuples wrapped in `hsl()`)

## [0.1.0] — 2026-06-16

### Added
- Initial release: folder-first music player for Linux
- Folder tree navigation (lazy filesystem scan)
- Track list with TagLib metadata (title, artist, duration, filename fallback)
- Playback via HTML5 `<audio>` in Saucer WebView
- Local HTTP server for audio streaming (Range support)
- Player bar: play/pause, next/prev, seek, volume
- CMake + Vite build system with embedded frontend

[0.5.0]: https://github.com/.../treeble/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/.../treeble/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/.../treeble/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/.../treeble/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/.../treeble/releases/tag/v0.1.0
