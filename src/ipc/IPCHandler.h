#pragma once

#include <saucer/smartview.hpp>
#include <string>
#include "../Types.h"

class FileScanner;
class TagReader;
class WebViewAudioBackend;
class SystemTray;
struct PlayerState;

class IPCHandler
{
public:
    IPCHandler(saucer::smartview &wv, FileScanner &fs, TagReader &tr,
               WebViewAudioBackend &ab, PlayerState &state,
               SystemTray &tray);

    /** Load saved state from disk. Returns default if no file exists. */
    SavedState loadState();
    /** Save state to disk. */
    void saveState(const SavedState &s);

    /** Expose IPC that saves state from the frontend. */
    void exposeSaveStateIPC();
    /** Call on window close — fills window geometry and writes to disk. */
    void saveStateOnExit();

private:
    saucer::smartview &m_wv;
    FileScanner &m_fs;
    TagReader &m_tr;
    WebViewAudioBackend &m_ab;
    PlayerState &m_state;
    SystemTray &m_tray;
    SavedState m_lastSaved;
};
