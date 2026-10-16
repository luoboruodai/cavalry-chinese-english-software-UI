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
static float measure(const void *font,const void *text,std::size_t size,int,void *out,const void *) {
    std::size_t pos=0; std::uint32_t cp; float width=0;
    while(cavalry_bilingual::nextScalar(static_cast<const char*>(text),size,pos,cp)) width+=face(font)==2?10:6;
    if (out) {
        CanvasInkBounds ink=width>0 ? CanvasInkBounds{-1,-8,width-1,2} : CanvasInkBounds{};
        std::memcpy(out,&ink,sizeof(ink));
    }
    return width;
}
static void draw(void*,const void *text,std::size_t size,int,float x,float y,const void *font,const void *paint) {
    drawn.push_back({std::string(static_cast<const char*>(text),size),x,y,paint,face(font)});
}
static void init(SkFontAbi &font,std::uintptr_t value) { std::memcpy(font.storage.data(),&value,sizeof(value));float size=12;std::memcpy(font.storage.data()+sizeof(void*),&size,4); }
SkSpBlobAbi skTextBlobMakeFromTextInterposeTarget(const void *,std::size_t,const void *,int) { return {}; }
static int retryConfigurationCalls = 0;
static int originalGetPathCalls = 0;
static bool originalSawConfigurationRetry = false;
static void retryConfigurationForTest() noexcept { ++retryConfigurationCalls; }
static void originalGetPathForTest(const void *, std::size_t, int, float, float, const void *, void *) {
    ++originalGetPathCalls;
    originalSawConfigurationRetry = retryConfigurationCalls == 1;
}
#if defined(CAVALRY_I18N_CAVALRY_280)
static_assert(kActionCount == 13);
static_assert(kAllSourceBits == 0x1fff);
static_assert(kViewportHintCount == 6);
constexpr const char *kSoftSelectionSources[] = {
    "Click drag a line between two vertices to create an edge",
    "Click drag a line between two vertices to create an edge.",
    "Disable Soft Selection",
    "Click drag to edit Soft Selection size",
    "Add or edit Bind positions",
};
#endif
int main() {
#if defined(CAVALRY_I18N_CAVALRY_280)
    for (std::size_t index = 0; index < 5; ++index) {
        assert(std::string(kApprovedActions[8 + index].source) == kSoftSelectionSources[index]);
        assert(kApprovedActions[8 + index].sourceBit == (1ull << (8 + index)));
        assert(!kApprovedActions[8 + index].prefixCallsite);
    }
#endif
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
    const std::string bilingual = u8"插入关键帧（Insert Keyframe）";
    assert(matchesBilingualText("插入关键帧", std::strlen("插入关键帧"), "Insert Keyframe", bilingual.data(), bilingual.size()));
    const std::string assembled = u8"启用吸附（Enable Snapping）";
    assert(matchesBilingualText(assembled.data(), assembled.size(), "Enable Snapping", assembled.data(), assembled.size()));
    const std::string duplicated = assembled + u8"（Enable Snapping）";
    assert(!matchesBilingualText(assembled.data(), assembled.size(), "Enable Snapping", duplicated.data(), duplicated.size()));
    const std::string userText = u8"用户名称（Insert Keyframe）";
    assert(!matchesBilingualText("插入关键帧", std::strlen("插入关键帧"), "Insert Keyframe", userText.data(), userText.size()));
    gState.coreImage.header = reinterpret_cast<const mach_header_64*>(0x10000);
    gState.extensionImage.header = reinterpret_cast<const mach_header_64*>(0x20000);
    assert(callerChainMatches(imageAddress(gState.coreImage,kCoreGetPathReturn), imageAddress(gState.extensionImage,kExtensionMakePathReturn), imageAddress(gState.extensionImage,kExtensionActionReturn)));
#if defined(CAVALRY_I18N_CAVALRY_280)
    assert(callerChainMatches(imageAddress(gState.coreImage,kCoreGetPathReturn), imageAddress(gState.extensionImage,kExtensionMakePathReturn), imageAddress(gState.extensionImage,kExtensionPrefixReturn), true));
    assert(!callerChainMatches(imageAddress(gState.coreImage,kCoreGetPathReturn), imageAddress(gState.extensionImage,kExtensionMakePathReturn), imageAddress(gState.extensionImage,kExtensionPrefixReturn)));
    assert(!callerChainMatches(imageAddress(gState.coreImage,kCoreGetPathReturn), imageAddress(gState.extensionImage,kExtensionMakePathReturn), imageAddress(gState.extensionImage,kExtensionActionReturn), true));
    gCanvasText.chinese=&zh;gCanvasText.english=&latin;
    const auto savedText=text;
    for (std::size_t i=0;i<kCanvasMeasureCallsiteCount;++i) {
        void *caller=imageAddress(gState.extensionImage,kCanvasMeasureCallsites[i].offset+kCanvasCallBytes);
        float advance=0;CanvasInkBounds ink{};
        assert(measureCanvasTextForCaller(caller,&latin,text.data(),text.size(),0,nullptr,advance,ink));
        assert(advance==50 && ink.left==-1 && ink.right==49 && ink.top==-8 && ink.bottom==2);
    }
    assert(text==savedText && face(&latin)==1);
    float advance=0;CanvasInkBounds ink{};
    assert(!measureCanvasTextForCaller(reinterpret_cast<void*>(0x1234),&latin,text.data(),text.size(),0,nullptr,advance,ink));
    const std::string tooLong(8193,'x');
    void *trackingCaller=imageAddress(gState.extensionImage,kCanvasMeasureCallsites[0].offset+kCanvasCallBytes);
    assert(!measureCanvasTextForCaller(trackingCaller,&latin,tooLong.data(),tooLong.size(),0,nullptr,advance,ink));
    std::uint64_t measureCounters[4];assert(cavalry_bilingual_canvas_measure_diagnostics_v1(measureCounters,4));
    assert(!cavalry_bilingual_canvas_measure_diagnostics_v1(measureCounters,3));
    assert(measureCounters[0]==1 && measureCounters[1]==kCanvasMeasureCallsiteCount+1);
    assert(measureCounters[2]==kCanvasMeasureCallsiteCount && measureCounters[3]==1);
#endif
    assert(callerChainMatchesViewport(imageAddress(gState.coreImage,kCoreGetPathReturn), imageAddress(gState.extensionImage,kExtensionMakePathReturn), imageAddress(gState.extensionImage,kViewportReturnAddresses[0])));
    assert(!callerChainMatchesViewport(imageAddress(gState.coreImage,kCoreGetPathReturn), imageAddress(gState.extensionImage,kExtensionMakePathReturn), imageAddress(gState.extensionImage,0xabcdef)));
    std::uint64_t viewportCounters[4]; assert(cavalry_bilingual_viewport_diagnostics_v1(viewportCounters,4));
    assert(!cavalry_bilingual_viewport_diagnostics_v1(viewportCounters,3));
    retryConfigurationCalls = 0;
    originalGetPathCalls = 0;
    originalSawConfigurationRetry = false;
    gState.configured.store(false);
    gState.originalGetPath.store(originalGetPathForTest);
    cavalry_i18n::setMacToolHelpTextPathConfigurationRetry(retryConfigurationForTest);
    replacementSkTextUtilsGetPath("unknown", 7, 0, 0, 0, nullptr, nullptr);
    assert(retryConfigurationCalls == 1);
    assert(originalGetPathCalls == 1 && originalSawConfigurationRetry);
    cavalry_i18n::setMacToolHelpTextPathConfigurationRetry(nullptr);
    gState.originalGetPath.store(nullptr);
}
