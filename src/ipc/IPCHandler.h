#pragma once

#include <saucer/smartview.hpp>
#include <string>

class FileScanner;
class TagReader;
class WebViewAudioBackend;
struct PlayerState;

class IPCHandler
{
public:
    IPCHandler(saucer::smartview &wv, FileScanner &fs, TagReader &tr,
               WebViewAudioBackend &ab, PlayerState &state);

private:
    saucer::smartview &m_wv;
    FileScanner &m_fs;
    TagReader &m_tr;
    WebViewAudioBackend &m_ab;
    PlayerState &m_state;
};
