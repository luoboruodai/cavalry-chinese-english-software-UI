#pragma once
// Bounded UTF-8 script segmentation. Never translates or normalizes user content.
#include <cstddef>
#include <cstdint>
#include <vector>
namespace cavalry_bilingual {
struct Utf8Run { std::size_t offset, length; bool cjk; };
inline bool nextScalar(const char *text, std::size_t size, std::size_t &offset, std::uint32_t &scalar) noexcept {
    if (!text || offset >= size) return false;
    const auto lead = static_cast<unsigned char>(text[offset++]);
    unsigned count = 0; std::uint32_t minimum = 0;
    if (lead < 0x80) { scalar = lead; return true; }
    if (lead >= 0xc2 && lead <= 0xdf) { scalar = lead & 0x1f; count = 1; minimum = 0x80; }
    else if (lead >= 0xe0 && lead <= 0xef) { scalar = lead & 0x0f; count = 2; minimum = 0x800; }
    else if (lead >= 0xf0 && lead <= 0xf4) { scalar = lead & 7; count = 3; minimum = 0x10000; }
    else return false;
    for (unsigned i = 0; i < count; ++i) {
        if (offset >= size) return false;
        const auto byte = static_cast<unsigned char>(text[offset++]);
        if ((byte & 0xc0) != 0x80) return false;
        scalar = (scalar << 6) | (byte & 0x3f);
    }
    return scalar >= minimum && scalar <= 0x10ffff && !(scalar >= 0xd800 && scalar <= 0xdfff);
}
inline bool isCjkScalar(std::uint32_t value) noexcept {
    return (value >= 0x2e80 && value <= 0x9fff) || (value >= 0xac00 && value <= 0xd7af) ||
        (value >= 0xf900 && value <= 0xfaff) || (value >= 0xff01 && value <= 0xffef) ||
        (value >= 0x20000 && value <= 0x323af);
}
inline bool textRuns(const char *text, std::size_t size, std::vector<Utf8Run> &runs) {
    runs.clear();
    if (!text || size == 0 || size > 8192) return false;
    std::size_t offset = 0;
    while (offset < size) {
        const auto begin = offset; std::uint32_t scalar;
        if (!nextScalar(text, size, offset, scalar) || scalar < 0x20 || scalar == 0x7f) { runs.clear(); return false; }
        // Combining marks and variation selectors stay with their base; no code-point tearing.
        const bool inherits = (scalar >= 0x300 && scalar <= 0x36f) || (scalar >= 0xfe00 && scalar <= 0xfe0f);
        const bool cjk = inherits && !runs.empty() ? runs.back().cjk : isCjkScalar(scalar);
        if (!runs.empty() && runs.back().cjk == cjk) runs.back().length += offset - begin;
        else runs.push_back({begin, offset - begin, cjk});
        if (runs.size() > 256) { runs.clear(); return false; }
    }
    return !runs.empty();
}
} // namespace cavalry_bilingual
