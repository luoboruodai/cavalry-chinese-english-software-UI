// Deterministic display-only regression: no vendor libraries, app, document,
// account or user's scene are opened. Mirrors the reviewed byte-pop loop.
#include "../injector/cavalry_i18n_macos_tool_help_text_path.cpp"
#include <cassert>
#include <limits>
#include <string>
extern "C" void skTextUtilsGetPathInterposeTarget(const void *,std::size_t,int,float,float,const void *,void *) {}
extern "C" void skCanvasDrawSimpleTextInterposeTarget(void *,const void *,std::size_t,int,float,float,const void *,const void *) {}
extern "C" float skFontMeasureTextInterposeTarget(const void *,const void *,std::size_t,int,void *,const void *) { return 0; }
static std::uintptr_t face(const void *font) { std::uintptr_t out;std::memcpy(&out,font,sizeof(out));return out; }
static void init(SkFontAbi &font,std::uintptr_t value) { std::memcpy(font.storage.data(),&value,sizeof(value));float size=12;std::memcpy(font.storage.data()+sizeof(void*),&size,4); }
static std::uint16_t glyph(const void *font,std::int32_t cp) {
    return face(font)==3 || (face(font)==2 ? cavalry_bilingual::isCjkScalar(cp) : cp<128) ? 7 : 0;
}
static bool badAdvance=false,badBounds=false;
static float measure(const void *font,const void *text,std::size_t size,int encoding,void *out,const void *) {
    assert(encoding==0);
    float advance=0; bool anyInk=false;
    std::size_t offset=0;std::uint32_t cp;
    while (cavalry_bilingual::nextScalar(static_cast<const char *>(text),size,offset,cp)) {
        advance+=face(font)==2 ? 10 : face(font)==3 ? 8 : 6; anyInk|=cp!=' ';
    }
    if (out) {
        CanvasInkBounds ink=anyInk ? CanvasInkBounds{-1,-8,advance-1,2} : CanvasInkBounds{};
        if (badBounds) ink.right=std::numeric_limits<float>::quiet_NaN();
        std::memcpy(out,&ink,sizeof(ink));
    }
    return badAdvance ? -1 : advance;
}
static unsigned passedThrough=0;
static float original(const void *,const void *,std::size_t,int,void *out,const void *) {
    ++passedThrough; CanvasInkBounds marker{1,2,3,4};if(out)std::memcpy(out,&marker,sizeof(marker));return 123;
}
static bool valid(const std::string &s) {
    std::size_t i=0;std::uint32_t cp;while(i<s.size())if(!cavalry_bilingual::nextScalar(s.data(),s.size(),i,cp))return false;return true;
}
static void *caller(int index) { return imageAddress(gState.extensionImage,kGraphMeasureCallsites[index].offset+kCanvasCallBytes); }
static float width(const std::string &text,const void *font,int which) {
    float advance=0;CanvasInkBounds ink{};
    if(!measureGraphTextForCaller(caller(which),font,text.data(),text.size(),0,nullptr,advance,ink))
        measure(font,text.data(),text.size(),0,&ink,nullptr);
    return ink.right-ink.left;
}
static std::string elide(std::string text,float limit,const void *font,unsigned &iterations) {
    if(width(text,font,0)<=limit)return text;
    while(!text.empty()) {
        text.pop_back();++iterations;
        if(width(text+"...",font,2)<=limit)return text+"...";
    }
    return width("...",font,1)<=limit ? "..." : "";
}
SkSpBlobAbi skTextBlobMakeFromTextInterposeTarget(const void *,std::size_t,const void *,int) { return {}; }
int main() {
    using cavalry_bilingual::hasSplitScalarBeforeEllipsis;
    for(const auto &scalar:{std::string(u8"中"),std::string(u8"é"),std::string(u8"𠀀"),std::string(u8"😀")})
        for(std::size_t n=1;n<scalar.size();++n) {
            const auto split="A"+scalar.substr(0,n)+"...";
            assert(hasSplitScalarBeforeEllipsis(split.data(),split.size()));
        }
    for(const auto &s:{std::string("..."),std::string(u8"中文..."),std::string("Layer 12..."),
                      std::string("\x80...",4),std::string("\xe0\x80...",5),std::string("\xed\xa0...",5),
                      std::string("\xf4\x90...",5),std::string("\xff\xe4...",5),std::string("\xe4"),
                      std::string("a\n\xe4...",6),std::string(8193,'x')})
        assert(!hasSplitScalarBeforeEllipsis(s.data(),s.size()));
    assert(!hasSplitScalarBeforeEllipsis(nullptr,4));
    SkFontAbi latin,zh,fallback;init(latin,1);init(zh,2);init(fallback,3);
    gState.extensionImage.header=reinterpret_cast<const mach_header_64 *>(0x10000);
    gCanvasText.chinese=&zh;gCanvasText.english=&latin;gCanvasText.fallback=&fallback;
    gCanvasText.glyph=glyph;gCanvasText.measure=measure;
    float advance=-99;CanvasInkBounds ink{9,9,9,9};
    const std::string sample=u8"中文_AB";const auto saved=sample;
    assert(measureGraphTextForCaller(caller(0),&latin,sample.data(),sample.size(),0,nullptr,advance,ink));
    assert(advance==38 && ink.left==-1 && ink.right==37 && ink.top==-8 && ink.bottom==2);
    assert(sample==saved && face(&latin)==1); // original text and font stay unchanged
    assert(measureGraphTextForCaller(caller(0),&latin,"  ",2,0,nullptr,advance,ink));
    assert(advance==12 && ink.left==0 && ink.right==0); // empty-ink space is not a visible rect
    assert(!measureGraphTextForCaller(reinterpret_cast<void *>(0x1234),&latin,sample.data(),sample.size(),0,nullptr,advance,ink));
    assert(!measureGraphTextForCaller(caller(0),&latin,sample.data(),sample.size(),1,nullptr,advance,ink));
    assert(!measureGraphTextForCaller(caller(0),nullptr,sample.data(),sample.size(),0,nullptr,advance,ink));
    const std::string split="\xe4\xb8...";
    assert(!measureGraphTextForCaller(caller(0),&latin,split.data(),split.size(),0,nullptr,advance,ink));
    assert(!measureGraphTextForCaller(caller(1),&latin,split.data(),split.size(),0,nullptr,advance,ink));
    assert(measureGraphTextForCaller(caller(2),&latin,split.data(),split.size(),0,nullptr,advance,ink));
    assert(ink.right-ink.left>=1e20f); // loop consumes BOUNDS, not the advance return value
    unsigned samples=0;
    for(const std::string &text:{sample,std::string(u8"A中文é😀𠀀B"),std::string(u8"节点端口（Position）"),
                                 std::string(u8"é_自定义名称"),std::string("User layer name..."),std::string(u8"中文     "),std::string("Rectangle Pattern"),std::string("Position")}) {
        for(int w=0;w<=250;++w) {
            unsigned iterations=0;const auto result=elide(text,static_cast<float>(w),&latin,iterations);
            assert(valid(result)); assert(iterations<=text.size());
            assert(result.empty() || width(result,&latin,0)<=w); ++samples;
        }
    }
    assert(samples==2008);
    // A configured family missing glyphs uses exactly the draw planner's fallback.
    gCanvasText.chinese=&latin;
    assert(measureGraphTextForCaller(caller(0),&latin,sample.data(),sample.size(),0,nullptr,advance,ink));
    assert(advance==34);gCanvasText.chinese=&zh;
    badAdvance=true;advance=-99;ink={9,9,9,9};
    assert(!measureCanvasRuns(sample.data(),sample.size(),&latin,nullptr,advance,ink));
    assert(advance==-99 && ink.left==9);badAdvance=false;
    badBounds=true;
    assert(!measureCanvasRuns(sample.data(),sample.size(),&latin,nullptr,advance,ink));badBounds=false;
    // An installed interposer MUST forward unrelated callers and document rendering.
    gGraphMeasure.original.store(original);gGraphMeasure.ready.store(true);
    assert(cavalryBilingualMeasureGraphText(&latin,sample.data(),sample.size(),0,&ink,nullptr)==123);
    assert(passedThrough==1 && ink.left==1 && ink.bottom==4);
    assert(cavalryBilingualMeasureGraphText(&latin,sample.data(),sample.size(),0,nullptr,nullptr)==123);
    assert(passedThrough==2);
    gGraphMeasure.ready.store(false);
    assert(cavalryBilingualMeasureGraphText(&latin,sample.data(),sample.size(),0,&ink,nullptr)==123);
    std::uint64_t counters[4];assert(cavalry_bilingual_graph_measure_diagnostics_v1(counters,4));
    assert(!cavalry_bilingual_graph_measure_diagnostics_v1(counters,3));
    assert(counters[0]==0 && counters[1]>0 && counters[2]>0);
}
