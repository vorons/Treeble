#pragma once

#include <cstdint>
#include <string>
#include <vector>
#include <chrono>

struct Track
{
    std::string path;
    std::string title;
    std::string artist;
    std::uint64_t duration_sec{};
};

struct FolderEntry
{
    std::string path;     // absolute
    std::string name;     // basename
    bool is_directory{};
};

struct PlayerState
{
    std::vector<Track> queue;
    std::size_t current_index{};
    bool playing{};
    bool paused{};
    double position_sec{};
};

struct FolderTree
{
    std::string path;
    std::string name;
    std::vector<FolderTree> children;
};

struct SavedState
{
    int windowX{};
    int windowY{};
    int windowW{};
    int windowH{};
    std::string lastFolder;
    int lastTrackIndex{};
    double volume{0.7};
    std::string repeatMode{"off"};
    bool shuffle{};
};
