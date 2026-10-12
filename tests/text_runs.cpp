#include "../injector/cavalry_bilingual_text_runs.h"
#include <cassert>
#include <string>
int main() {
    using namespace cavalry_bilingual;
    std::vector<Utf8Run> runs;
    const std::string text = u8"年份计数_1978到2026（Glyphs）";
    assert(textRuns(text.data(), text.size(), runs));
    std::string recomposed;
    for (const auto &run : runs) recomposed.append(text, run.offset, run.length);
    assert(recomposed == text);
    assert(runs.front().cjk && runs.front().length == 12);
    assert(!runs[1].cjk && text.substr(runs[1].offset, runs[1].length) == "_1978");
    for (const std::string invalid : {std::string("\xc0\xaf", 2), std::string("\xed\xa0\x80", 3), std::string("\xf4\x90\x80\x80", 4), std::string("\xe4\xb8", 2), std::string("a\0b",3), std::string("a\nb")}) {
        assert(!textRuns(invalid.data(), invalid.size(), runs)); assert(runs.empty());
    }
    const std::string supplementary=u8"A𠀀B";
    assert(textRuns(supplementary.data(), supplementary.size(),runs)); assert(runs.size()==3 && runs[1].length==4 && runs[1].cjk);
    const std::string accent=u8"é中文";
    assert(textRuns(accent.data(),accent.size(),runs));assert(runs[0].length==3);
    assert(!textRuns(std::string(8193,'a').data(),8193,runs));
}
