#include "TagReader.h"
#include <taglib/fileref.h>
#include <taglib/tag.h>
#include <taglib/tpropertymap.h>

std::tuple<std::string, std::string, std::uint64_t> TagReader::read(const std::string &path)
{
    TagLib::FileRef file(path.c_str());
    if (file.isNull() || !file.tag())
        return {};

    auto *tag = file.tag();
    std::string title = tag->title().to8Bit(true);
    std::string artist = tag->artist().to8Bit(true);

    auto dur = std::uint64_t{};
    if (auto *prop = file.audioProperties())
        dur = static_cast<std::uint64_t>(prop->lengthInSeconds());

    return {title, artist, dur};
}
