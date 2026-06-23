#pragma once

#include <saucer/smartview.hpp>
#include <string>

class FileScanner;
class TagReader;
class WebViewAudioBackend;
class MPRIS2;
struct PlayerState;

class IPCHandler
{
public:
    IPCHandler(saucer::smartview &wv, FileScanner &fs, TagReader &tr,
               WebViewAudioBackend &ab, MPRIS2 &mpris, PlayerState &state);

private:
    saucer::smartview &m_wv;
    FileScanner &m_fs;
    TagReader &m_tr;
    WebViewAudioBackend &m_ab;
    MPRIS2 &m_mpris;
    PlayerState &m_state;
};
