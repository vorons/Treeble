#pragma once

#include <saucer/smartview.hpp>
#include <string>

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

private:
    saucer::smartview &m_wv;
    FileScanner &m_fs;
    TagReader &m_tr;
    WebViewAudioBackend &m_ab;
    PlayerState &m_state;
    SystemTray &m_tray;
};
