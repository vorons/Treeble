#pragma once

#include "Types.h"
#include <string>
#include <vector>

class FileScanner
{
public:
    explicit FileScanner(std::string root_dir);

    /// Build full folder tree from root (fast, scans dirs only).
    FolderTree scan_tree();

    /// List audio files in a directory (lazy, reads on call).
    std::vector<std::string> list_audio(const std::string &dir);

    /// Change root directory (re-scan on next call).
    void set_root(const std::string &path);

    /// Get current root directory.
    const std::string &root() const { return m_root; }

private:
    /// Recursively scan directory. Returns true if node (or its descendants) contain audio files.
    /// Prunes branches that have no audio files.
    bool scan_tree_recursive(FolderTree &node);
    bool is_audio_ext(const std::string &ext) const;

    std::string m_root;
    static constexpr const char *s_extensions[] = {".mp3", ".flac", ".wav", ".ogg", ".m4a", ".opus", ".wma"};
};
