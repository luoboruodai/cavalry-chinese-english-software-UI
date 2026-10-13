// Deterministic algorithm test: NO vendor libraries loaded and NO document/app opened.
#include "../injector/cavalry_i18n_macos_tool_help_text_path.cpp"
#include <cassert>
#include <string>
extern "C" void skTextUtilsGetPathInterposeTarget(const void *, std::size_t, int, float, float, const void *, void *) {}
extern "C" void skCanvasDrawSimpleTextInterposeTarget(void *, const void *, std::size_t, int, float, float, const void *, const void *) {}
extern "C" float skFontMeasureTextInterposeTarget(const void *, const void *, std::size_t, int, void *, const void *) { return 0; }
struct Draw { std::string text; float x,y; const void *paint; std::uintptr_t face; };
static std::vector<Draw> drawn;
static std::uintptr_t face(const void *font) { std::uintptr_t out; std::memcpy(&out,font,sizeof(out)); return out; }
static std::uint16_t glyph(const void *font,std::int32_t scalar) {
    if (face(font)==3) return 7; // synthetic universal fallback
    return (face(font)==2 ? scalar>127 : scalar<128) ? 7 : 0;
}
static float measure(const void *font,const void *text,std::size_t size,int,void *,const void *) {
    std::size_t pos=0; std::uint32_t cp; float width=0;
    while(cavalry_bilingual::nextScalar(static_cast<const char*>(text),size,pos,cp)) width+=face(font)==2?10:6;
    return width;
}
static void draw(void*,const void *text,std::size_t size,int,float x,float y,const void *font,const void *paint) {
    drawn.push_back({std::string(static_cast<const char*>(text),size),x,y,paint,face(font)});
}
static void init(SkFontAbi &font,std::uintptr_t value) { std::memcpy(font.storage.data(),&value,sizeof(value));float size=12;std::memcpy(font.storage.data()+sizeof(void*),&size,4); }
int main() {
    SkFontAbi latin,zh,fallback; init(latin,1);init(zh,2);init(fallback,3);
    gCanvasText.chinese=&zh;gCanvasText.fallback=&fallback;gCanvasText.english=&latin;
    gCanvasText.glyph=glyph;gCanvasText.measure=measure;
    int canvas=1,paint=42;std::string text=u8"年份_2026";
    assert(paintCanvasRuns(draw,&canvas,text.data(),text.size(),20,30,&latin,&paint));
    assert(drawn.size()==2 && drawn[0].text==u8"年份" && drawn[1].text=="_2026");
    assert(drawn[0].x==20 && drawn[1].x==40 && drawn[1].y==30);
    assert(drawn[0].paint==&paint && drawn[1].paint==&paint); // preserve color/style/opacity object
    assert(drawn[0].face==2 && drawn[1].face==1);
    drawn.clear();
    std::string invalid("x\xed\xa0\x80",4);
    assert(!paintCanvasRuns(draw,&canvas,invalid.data(),invalid.size(),0,0,&latin,&paint));assert(drawn.empty());
    gCanvasText.english=nullptr;
    assert(!paintCanvasRuns(draw,&canvas,"ASCII",5,0,0,&latin,&paint));assert(drawn.empty());
    // The interposer must pass through unknown callers (including all scene-text renderer calls).
    gCanvasText.original.store(draw);gCanvasText.ready.store(true);
    cavalryBilingualDrawSimpleText(&canvas,text.data(),text.size(),0,20,30,&latin,&paint);
    assert(drawn.size()==1 && drawn[0].text==text && drawn[0].face==1);
    drawn.clear();
    gCanvasText.chinese=&latin; // unavailable glyphs use fallback, not tofu
    assert(paintCanvasRuns(draw,&canvas,text.data(),text.size(),0,0,&latin,&paint));assert(drawn[0].face==3);
    assert(face(&latin)==1); // never mutate the caller's font
    std::uint64_t counters[4];assert(cavalry_bilingual_canvas_diagnostics_v1(counters,4));
    assert(!cavalry_bilingual_canvas_diagnostics_v1(counters,3));
    gViewportPath.ready.store(true);
    gViewportPath.hints[0].source = "Active Camera: Layer Tools Disabled.";
    gViewportPath.hints[0].sourceSize = std::strlen(gViewportPath.hints[0].source);
    assert(viewportPathHintFor(gViewportPath.hints[0].source, gViewportPath.hints[0].sourceSize) == &gViewportPath.hints[0]);
    assert(viewportPathHintFor("user-owned layer name", 21) == nullptr);
    gState.coreImage.header = reinterpret_cast<const mach_header_64*>(0x10000);
    gState.extensionImage.header = reinterpret_cast<const mach_header_64*>(0x20000);
    assert(callerChainMatchesViewport(imageAddress(gState.coreImage,kCoreGetPathReturn), imageAddress(gState.extensionImage,kExtensionMakePathReturn), imageAddress(gState.extensionImage,kViewportReturnAddresses[0])));
    assert(!callerChainMatchesViewport(imageAddress(gState.coreImage,kCoreGetPathReturn), imageAddress(gState.extensionImage,kExtensionMakePathReturn), imageAddress(gState.extensionImage,0xabcdef)));
    std::uint64_t viewportCounters[4]; assert(cavalry_bilingual_viewport_diagnostics_v1(viewportCounters,4));
    assert(!cavalry_bilingual_viewport_diagnostics_v1(viewportCounters,3));
}
