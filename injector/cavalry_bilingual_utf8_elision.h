#pragma once
// Display-only guard for the reviewed Lina byte-pop elision loop. No text is
// rewritten, normalized, logged, or returned to Cavalry's document model.
#include "cavalry_bilingual_text_runs.h"
#include <cstring>

namespace cavalry_bilingual {
inline bool hasSplitScalarBeforeEllipsis(const char *text, std::size_t size) noexcept {
    if (!text || size < 4 || size > 8192 || std::memcmp(text + size - 3, "...", 3) != 0) return false;
    const auto prefixSize = size - 3;
    std::size_t offset = 0;
    while (offset < prefixSize) {
        const auto begin = offset;
        std::uint32_t scalar = 0;
        if (nextScalar(text, prefixSize, offset, scalar)) {
            if (scalar < 0x20 || scalar == 0x7f) return false;
            continue;
        }
        // Accept only a VALID leading fragment of one scalar at the very end.
        // A malformed scalar, stray continuation, overlong, surrogate or bad
        // interior byte is not evidence of the vendor's truncation operation.
        const auto lead = static_cast<unsigned char>(text[begin]);
        const unsigned required = lead >= 0xc2 && lead <= 0xdf ? 2 :
            lead >= 0xe0 && lead <= 0xef ? 3 : lead >= 0xf0 && lead <= 0xf4 ? 4 : 0;
        const auto remaining = prefixSize - begin;
        if (!required || remaining >= required) return false;
        for (std::size_t i = 1; i < remaining; ++i) {
            const auto byte = static_cast<unsigned char>(text[begin + i]);
            if ((byte & 0xc0) != 0x80) return false;
            if (i == 1 && ((lead == 0xe0 && byte < 0xa0) || (lead == 0xed && byte > 0x9f) ||
                          (lead == 0xf0 && byte < 0x90) || (lead == 0xf4 && byte > 0x8f))) return false;
        }
        return true;
    }
    return false;
}
} // namespace cavalry_bilingual
