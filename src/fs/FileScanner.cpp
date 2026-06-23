#include "FileScanner.h"
#include <filesystem>
#include <algorithm>

namespace fs = std::filesystem;

FileScanner::FileScanner(std::string root_dir)
    : m_root(std::move(root_dir))
{
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

void FileScanner::scan_tree_recursive(FolderTree &node)
{
    std::error_code ec;
    for (auto &entry : fs::directory_iterator(node.path, ec))
    {
        if (!entry.is_directory())
            continue;
        FolderTree child;
        child.path = entry.path().string();
        child.name = entry.path().filename().string();
        scan_tree_recursive(child);
        node.children.push_back(std::move(child));
    }
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
