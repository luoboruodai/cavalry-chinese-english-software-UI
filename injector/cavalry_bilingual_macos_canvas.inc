// Included by the macOS private-ABI firewall. Exactly seven UI callsites, not a global document renderer.
namespace {
using DrawSimpleTextFunction = void (*)(void *, const void *, std::size_t, int, float, float, const void *, const void *);
using MeasureTextFunction = float (*)(const void *, const void *, std::size_t, int, void *, const void *);
using FontGlyphFunction = std::uint16_t (*)(const void *, std::int32_t);
struct CanvasTextState {
    std::atomic<DrawSimpleTextFunction> original{nullptr};
    std::atomic<bool> ready{false};
    MeasureTextFunction measure = nullptr;
    FontGlyphFunction glyph = nullptr;
    SkFontAbi *chinese = nullptr, *english = nullptr, *fallback = nullptr;
    std::atomic<std::uint64_t> matched{0}, rendered{0}, fallbackCalls{0};
};
CanvasTextState gCanvasText;
thread_local bool canvasTextRecursion = false;
struct CanvasCallsite { std::uintptr_t offset; std::array<std::uint8_t, 5> bytes; };
#if defined(__arm64__)
constexpr std::size_t kCanvasCallBytes = 4;
constexpr CanvasCallsite kCanvasCallsites[] = {
    {0x368ca0, {0x45,0xf8,0x20,0x94}}, // lina::Drawable UI text
    {0x368ce0, {0x35,0xf8,0x20,0x94}},
    {0x444ca8, {0x43,0x88,0x1d,0x94}}, // connection-view label
    {0x49a1f8, {0xef,0x32,0x1c,0x94}}, // time-editor user names
    {0x49af34, {0xa0,0x2f,0x1c,0x94}},
    {0x49be88, {0xcb,0x2b,0x1c,0x94}},
    {0x49c078, {0x4f,0x2b,0x1c,0x94}},
};
#elif defined(__x86_64__)
constexpr std::size_t kCanvasCallBytes = 5;
constexpr CanvasCallsite kCanvasCallsites[] = {
    {0x3cf3d3, {0xe8,0xe3,0x14,0x96,0x00}},
    {0x3cf41f, {0xe8,0x97,0x14,0x96,0x00}},
    {0x4c1760, {0xe8,0x56,0xf1,0x86,0x00}},
    {0x524d82, {0xe8,0x34,0xbb,0x80,0x00}},
    {0x525dd2, {0xe8,0xe4,0xaa,0x80,0x00}},
    {0x527243, {0xe8,0x73,0x96,0x80,0x00}},
    {0x5274f4, {0xe8,0xc2,0x93,0x80,0x00}},
};
#endif
DrawSimpleTextFunction originalCanvasText() noexcept {
    auto original = gCanvasText.original.load(std::memory_order_acquire);
    if (original) return original;
    LoadedImage skia{};
    if (findLoadedImage("libskia.dylib", &skia)) {
        original = reinterpret_cast<DrawSimpleTextFunction>(findMachOSymbol(skia,
            "__ZN8SkCanvas14drawSimpleTextEPKvm14SkTextEncodingffRK6SkFontRK7SkPaint"));
        if (original) gCanvasText.original.store(original, std::memory_order_release);
    }
    return original;
}
SkFontAbi *makeCanvasFont(const char *family) noexcept {
    if (!family || !family[0]) return nullptr;
    auto makeTypeface = reinterpret_cast<MakeTypefaceFunction>(imageAddress(gState.skiaImage, kMakeTypefaceOffset));
    auto makeFont = reinterpret_cast<MakeScalableFontFunction>(imageAddress(gState.coreImage, kMakeScalableFontOffset));
    auto typeface = makeTypeface(family, kNormalSkFontStyle);
    if (!typeface.pointer) return nullptr;
    auto font = makeFont(std::move(typeface), 1.0f);
    return new (std::nothrow) SkFontAbi(std::move(font)); // process-lifetime fonts, not per-frame allocations
}
void configureCanvasText(const char *zh, const char *en) noexcept {
    if (!gState.vendorContractVerified.load(std::memory_order_acquire) || gCanvasText.ready.load()) return;
    for (const auto &site : kCanvasCallsites) {
        const auto *bytes = static_cast<const std::uint8_t *>(imageAddress(gState.extensionImage, site.offset));
        if (std::memcmp(bytes, site.bytes.data(), kCanvasCallBytes) != 0) return;
    }
    if (!originalCanvasText()) return;
    gCanvasText.measure = reinterpret_cast<MeasureTextFunction>(findMachOSymbol(gState.skiaImage,
        "__ZNK6SkFont11measureTextEPKvm14SkTextEncodingP6SkRectPK7SkPaint"));
    gCanvasText.glyph = reinterpret_cast<FontGlyphFunction>(findMachOSymbol(gState.skiaImage,
        "__ZNK6SkFont14unicharToGlyphEi"));
    gCanvasText.fallback = makeCanvasFont("PingFang SC");
    gCanvasText.chinese = zh && zh[0] ? makeCanvasFont(zh) : gCanvasText.fallback;
    if (!gCanvasText.chinese) gCanvasText.chinese = gCanvasText.fallback;
    gCanvasText.english = en && en[0] ? makeCanvasFont(en) : nullptr;
    const bool ready = gCanvasText.measure && gCanvasText.glyph && gCanvasText.fallback && gCanvasText.chinese;
    gCanvasText.ready.store(ready, std::memory_order_release);
}
bool approvedCanvasCaller(void *caller) noexcept {
    for (const auto &site : kCanvasCallsites)
        if (caller == imageAddress(gState.extensionImage, site.offset + kCanvasCallBytes)) return true;
    return false;
}
void copyCanvasFont(SkFontAbi &out, const void *original, const SkFontAbi *family) noexcept {
    std::memcpy(out.storage.data(), original, out.storage.size());
    // Replace only the typeface reference; size/scale/skew/hinting remain exactly the caller's.
    if (family) std::memcpy(out.storage.data(), family->storage.data(), sizeof(void *));
}
bool canvasFontCovers(const void *font, const char *text, std::size_t size) noexcept {
    std::size_t offset=0; std::uint32_t scalar;
    while (offset < size) {
        if (!cavalry_bilingual::nextScalar(text,size,offset,scalar)) return false;
        if (scalar > 0x20 && gCanvasText.glyph(font,static_cast<std::int32_t>(scalar)) == 0) return false;
    }
    return true;
}
struct PlannedCanvasRun {
    cavalry_bilingual::Utf8Run run;
    const SkFontAbi *family;
    float advance;
};
// Plan every run before painting so a late unsupported glyph cannot leave half-translated/double-painted text.
bool paintCanvasRuns(DrawSimpleTextFunction original, void *canvas, const char *text, std::size_t size,
    float x, float y, const void *font, const void *paint) {
    thread_local std::vector<cavalry_bilingual::Utf8Run> runs;
    if (!cavalry_bilingual::textRuns(text,size,runs)) return false;
    bool hasCjk=false; for (const auto &run:runs) hasCjk |= run.cjk;
    if (!hasCjk && !gCanvasText.english) return false;
    float fontSize=0; std::memcpy(&fontSize,static_cast<const char *>(font)+sizeof(void *),sizeof(fontSize));
    if (!std::isfinite(fontSize) || fontSize <= 0 || fontSize > 4096 || !std::isfinite(x) || !std::isfinite(y)) return false;
    thread_local std::vector<PlannedCanvasRun> plan; plan.clear(); plan.reserve(runs.size());
    double total=0;
    for (const auto &run:runs) {
        const SkFontAbi *family=run.cjk ? gCanvasText.chinese : gCanvasText.english;
        SkFontAbi display; copyCanvasFont(display,font,family);
        if (!canvasFontCovers(&display,text+run.offset,run.length)) {
            family=gCanvasText.fallback; copyCanvasFont(display,font,family);
            if (!canvasFontCovers(&display,text+run.offset,run.length)) return false;
        }
        const float advance=gCanvasText.measure(&display,text+run.offset,run.length,0,nullptr,paint);
        if (!std::isfinite(advance) || advance < 0 || advance > 1e6) return false;
        total+=advance; if (!std::isfinite(x+total) || total>1e6) return false;
        plan.push_back({run,family,advance});
    }
    float cursor=x;
    for (const auto &item:plan) {
        SkFontAbi display; copyCanvasFont(display,font,item.family);
        original(canvas,text+item.run.offset,item.run.length,0,cursor,y,&display,paint);
        cursor+=item.advance;
    }
    return true;
}
} // namespace
extern "C" __attribute__((noinline)) void cavalryBilingualDrawSimpleText(void *canvas, const void *text,
    std::size_t size, int encoding, float x, float y, const void *font, const void *paint) noexcept {
    const auto original=originalCanvasText();
    if (!original) return; // Link contract guarantees the original symbol is present in the supported host.
    if (!canvasTextRecursion && gCanvasText.ready.load(std::memory_order_acquire) && canvas && text && font && paint && encoding==0 &&
        approvedCanvasCaller(__builtin_extract_return_addr(__builtin_return_address(0)))) {
        gCanvasText.matched.fetch_add(1,std::memory_order_relaxed);
        canvasTextRecursion=true;
        bool painted=false;
        try { painted=paintCanvasRuns(original,canvas,static_cast<const char *>(text),size,x,y,font,paint); } catch (...) { painted=false; }
        canvasTextRecursion=false;
        if (painted) { gCanvasText.rendered.fetch_add(1,std::memory_order_relaxed); return; }
        gCanvasText.fallbackCalls.fetch_add(1,std::memory_order_relaxed);
    }
    original(canvas,text,size,encoding,x,y,font,paint);
}
extern "C" void skCanvasDrawSimpleTextInterposeTarget(void *, const void *, std::size_t, int, float, float, const void *, const void *)
    __asm("__ZN8SkCanvas14drawSimpleTextEPKvm14SkTextEncodingffRK6SkFontRK7SkPaint");
__attribute__((used)) static struct { const void *replacement; const void *replacee; }
kBilingualCanvasInterpose __attribute__((section("__DATA,__interpose"))) = {
    reinterpret_cast<const void *>(cavalryBilingualDrawSimpleText), reinterpret_cast<const void *>(skCanvasDrawSimpleTextInterposeTarget)
};
// Counters only: no user names, paths or text content in diagnostics.
extern "C" bool cavalry_bilingual_canvas_diagnostics_v1(std::uint64_t *out, std::size_t count) noexcept {
    if (!out || count!=4) return false;
    out[0]=gCanvasText.ready.load(); out[1]=gCanvasText.matched.load(); out[2]=gCanvasText.rendered.load(); out[3]=gCanvasText.fallbackCalls.load(); return true;
}
