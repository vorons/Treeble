#pragma once

#include <saucer/smartview.hpp>
#include <string>
#include "../Types.h"

class FileScanner;
class TagReader;
class WebViewAudioBackend;
class SystemTray;
class MPRIS2;
struct PlayerState;

// Incomplete type is fine — only used as a pointer.
typedef struct _GtkWindow GtkWindow;

class IPCHandler
{
public:
    IPCHandler(saucer::smartview &wv, FileScanner &fs, TagReader &tr,
               WebViewAudioBackend &ab, PlayerState &state,
               SystemTray &tray,
               GtkWindow *parent_window = nullptr);

    /** Load saved state from disk. Returns default if no file exists. */
    SavedState loadState();
    /** Save state to disk. */
    void saveState(const SavedState &s);

    /** Expose IPC that saves state from the frontend. */
    void exposeSaveStateIPC();
    /** Call on window close — fills window geometry and writes to disk. */
    void saveStateOnExit();
    /** Call on maximize event — updates maximized state without saving. */
    void onMaximize(bool maximized);

    /// Apply saved musicFolder (if non-empty) to FileScanner.
    void applyMusicFolder(const SavedState &s);

    /// Attach MPRIS2 for state-change notifications.
    void set_mpris(MPRIS2 *mpris) { m_mpris = mpris; }

private:
    saucer::smartview &m_wv;
    FileScanner &m_fs;
    TagReader &m_tr;
    WebViewAudioBackend &m_ab;
    PlayerState &m_state;
    SystemTray &m_tray;
    MPRIS2 *m_mpris{};
    GtkWindow *m_parent_window{};
    SavedState m_lastSaved;
    std::string m_defaultMusicRoot;
};
