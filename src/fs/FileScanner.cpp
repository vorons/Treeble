#include "FileScanner.h"
#include <filesystem>
#include <algorithm>

namespace fs = std::filesystem;

FileScanner::FileScanner(std::string root_dir)
    : m_root(std::move(root_dir))
{
}

void FileScanner::set_root(const std::string &path)
{
    m_root = path;
}

FolderTree FileScanner::scan_tree()
{
    FolderTree root;
    root.path = m_root;
    root.name = fs::path(m_root).filename().string();
    if (root.name.empty())
        root.name = m_root;
    scan_tree_recursive(root);
    return root;
}

bool FileScanner::scan_tree_recursive(FolderTree &node)
{
    std::error_code ec;
    bool hasAudio = false;
    std::vector<FolderTree> valid_children;

    for (auto &entry : fs::directory_iterator(node.path, ec))
    {
        if (entry.is_directory())
        {
            FolderTree child;
            child.path = entry.path().string();
            child.name = entry.path().filename().string();
            if (scan_tree_recursive(child))
            {
                valid_children.push_back(std::move(child));
                hasAudio = true;
            }
        }
        else if (entry.is_regular_file())
        {
            auto ext = entry.path().extension().string();
            std::ranges::transform(ext, ext.begin(), [](unsigned char c) { return std::tolower(c); });
            if (is_audio_ext(ext))
                hasAudio = true;
        }
    }

    node.children = std::move(valid_children);
    return hasAudio;
}

std::vector<std::string> FileScanner::list_audio(const std::string &dir)
{
    std::vector<std::string> result;
    std::error_code ec;

    // ponytail: std::map<std::string, std::vector<std::string>> cache could be added
    // if the same dir is listed multiple times
    for (auto &entry : fs::directory_iterator(dir, ec))
    {
        if (!entry.is_regular_file())
            continue;
        auto ext = entry.path().extension().string();
        std::ranges::transform(ext, ext.begin(), [](unsigned char c) { return std::tolower(c); });
        if (is_audio_ext(ext))
            result.push_back(entry.path().string());
    }
    std::ranges::sort(result);
    return result;
}

bool FileScanner::is_audio_ext(const std::string &ext) const
{
    for (auto *e : s_extensions)
        if (ext == e)
            return true;
    return false;
}
