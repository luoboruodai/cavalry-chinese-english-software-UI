// Included by the macOS private-ABI firewall. Approved UI drawing callsites only.
// Shared run planning also keeps separately guarded measurement and elision in sync.
#include <algorithm>
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
    std::atomic<std::uint64_t> measureMatched{0}, measured{0}, measureFallbackCalls{0};
};
CanvasTextState gCanvasText;
thread_local bool canvasTextRecursion = false;
struct CanvasCallsite { std::uintptr_t offset; std::array<std::uint8_t, 5> bytes; };
#if defined(__arm64__) && defined(CAVALRY_I18N_CAVALRY_280)
constexpr std::size_t kCanvasCallBytes = 4;
constexpr CanvasCallsite kCanvasCallsites[] = {
    {0x4827e8, {0x99,0xfb,0x24,0x94}}, // lina::Drawable UI text
    {0x482828, {0x89,0xfb,0x24,0x94}},
    {0x5781d0, {0x1f,0x25,0x21,0x94}}, // connection-view label
    {0x5dcda8, {0x29,0x92,0x1f,0x94}}, // time-editor user names
    {0x5dda44, {0x02,0x8f,0x1f,0x94}},
    {0x5de958, {0x3d,0x8b,0x1f,0x94}},
    {0x5deb30, {0xc7,0x8a,0x1f,0x94}},
    {0xbfb598, {0x2d,0x18,0x07,0x94}}, // tracking hint; paired with exact measure caller
};
constexpr std::size_t kCanvasMeasureCallsiteCount = 1;
constexpr CanvasCallsite kCanvasMeasureCallsites[] = {
    {0xbfb53c, {0x98,0x21,0x07,0x94}},
};
#elif defined(__x86_64__) && defined(CAVALRY_I18N_CAVALRY_280)
constexpr std::size_t kCanvasCallBytes = 5;
constexpr CanvasCallsite kCanvasCallsites[] = {
    {0x502003, {0xe8,0x31,0x15,0xa4,0x00}}, // lina::Drawable UI text
    {0x50204f, {0xe8,0xe5,0x14,0xa4,0x00}},
    {0x6134c0, {0xe8,0x74,0x00,0x93,0x00}}, // connection-view label
    {0x6892d2, {0xe8,0x62,0xa2,0x8b,0x00}}, // time-editor user names
    {0x68a25b, {0xe8,0xd9,0x92,0x8b,0x00}},
    {0x68b652, {0xe8,0xe2,0x7e,0x8b,0x00}},
    {0x68b8f1, {0xe8,0x43,0x7c,0x8b,0x00}},
    {0xd5c9b6, {0xe8,0x7e,0x6b,0x1e,0x00}}, // tracking hint; paired with exact measure caller
};
constexpr std::size_t kCanvasMeasureCallsiteCount = 1;
constexpr CanvasCallsite kCanvasMeasureCallsites[] = {
    {0xd5c919, {0xe8,0xc3,0x7e,0x1e,0x00}},
};
#elif defined(__arm64__)
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
constexpr std::size_t kCanvasMeasureCallsiteCount = 0;
constexpr CanvasCallsite kCanvasMeasureCallsites[] = {{0, {0x00,0x00,0x00,0x00,0x00}}};
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
constexpr std::size_t kCanvasMeasureCallsiteCount = 0;
constexpr CanvasCallsite kCanvasMeasureCallsites[] = {{0, {0x00,0x00,0x00,0x00,0x00}}};
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
    auto makeFont = reinterpret_cast<MakeScalableFontFunction>(imageAddress(gState.coreImage, kMakeScalableFontOffset));
#if defined(CAVALRY_I18N_CAVALRY_280)
    auto makeTypeface = reinterpret_cast<MakeTypefaceFromCTFontFunction>(
        imageAddress(gState.skiaImage, kMakeTypefaceFromCTFontOffset));
    CFStringRef familyRef = CFStringCreateWithCString(
        kCFAllocatorDefault, family, kCFStringEncodingUTF8);
    CTFontRef ctFont = familyRef != nullptr
        ? CTFontCreateWithName(familyRef, 1.0, nullptr)
        : nullptr;
    if (familyRef != nullptr) CFRelease(familyRef);
    if (ctFont == nullptr) return nullptr;
    auto typeface = makeTypeface(ctFont);
    CFRelease(ctFont);
#else
    auto makeTypeface = reinterpret_cast<MakeTypefaceFunction>(imageAddress(gState.skiaImage, kMakeTypefaceOffset));
    auto typeface = makeTypeface(family, kNormalSkFontStyle);
#endif
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
    for (std::size_t i = 0; i < kCanvasMeasureCallsiteCount; ++i) {
        const auto &site = kCanvasMeasureCallsites[i];
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
bool approvedCanvasMeasureCaller(void *caller) noexcept {
    for (std::size_t i = 0; i < kCanvasMeasureCallsiteCount; ++i)
        if (caller == imageAddress(gState.extensionImage, kCanvasMeasureCallsites[i].offset + kCanvasCallBytes)) return true;
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
// SkRect is four floats in the already UUID-locked Skia ABI.
struct CanvasInkBounds { float left = 0, top = 0, right = 0, bottom = 0; };
static_assert(sizeof(CanvasInkBounds) == 16);
struct PlannedCanvasRun {
    cavalry_bilingual::Utf8Run run;
    const SkFontAbi *family;
    float advance;
    CanvasInkBounds bounds;
};
// Measurement and drawing MUST use the same fonts, glyph fallback and advances.
// Plan all runs first, so late failure cannot leave half-painted/double-painted text.
bool planCanvasRuns(const char *text, std::size_t size, const void *font, const void *paint,
                    bool withBounds, std::vector<PlannedCanvasRun> &plan) {
    plan.clear();
    thread_local std::vector<cavalry_bilingual::Utf8Run> runs;
    if (!font || !gCanvasText.measure || !gCanvasText.glyph || !cavalry_bilingual::textRuns(text,size,runs)) return false;
    bool hasCjk=false; for (const auto &run:runs) hasCjk |= run.cjk;
    if (!hasCjk && !gCanvasText.english) return false;
    float fontSize=0; std::memcpy(&fontSize,static_cast<const char *>(font)+sizeof(void *),sizeof(fontSize));
    if (!std::isfinite(fontSize) || fontSize <= 0 || fontSize > 4096) return false;
    plan.reserve(runs.size());
    double total=0;
    for (const auto &run:runs) {
        const SkFontAbi *family=run.cjk ? gCanvasText.chinese : gCanvasText.english;
        SkFontAbi display; copyCanvasFont(display,font,family);
        if (!canvasFontCovers(&display,text+run.offset,run.length)) {
            family=gCanvasText.fallback; copyCanvasFont(display,font,family);
            if (!canvasFontCovers(&display,text+run.offset,run.length)) return false;
        }
        CanvasInkBounds bounds{};
        const float advance=gCanvasText.measure(&display,text+run.offset,run.length,0,withBounds ? &bounds : nullptr,paint);
        if (!std::isfinite(advance) || advance < 0 || advance > 1e6) return false;
        if (withBounds && (!std::isfinite(bounds.left) || !std::isfinite(bounds.top) ||
            !std::isfinite(bounds.right) || !std::isfinite(bounds.bottom) ||
            std::fabs(bounds.left)>1e6 || std::fabs(bounds.top)>1e6 ||
            std::fabs(bounds.right)>1e6 || std::fabs(bounds.bottom)>1e6)) return false;
        total+=advance; if (total>1e6) return false;
        plan.push_back({run,family,advance,bounds});
    }
    return true;
}
bool measureCanvasRuns(const char *text, std::size_t size, const void *font, const void *paint,
                       float &advance, CanvasInkBounds &bounds) {
    thread_local std::vector<PlannedCanvasRun> plan;
    if (!planCanvasRuns(text,size,font,paint,true,plan)) return false;
    CanvasInkBounds combined{};
    bool hasInk=false;
    float cursor=0;
    for (const auto &item:plan) {
        auto ink=item.bounds;
        if (ink.left<ink.right && ink.top<ink.bottom) {
            ink.left+=cursor; ink.right+=cursor;
            if (!hasInk) { combined=ink; hasInk=true; }
            else {
                combined.left=std::min(combined.left,ink.left); combined.top=std::min(combined.top,ink.top);
                combined.right=std::max(combined.right,ink.right); combined.bottom=std::max(combined.bottom,ink.bottom);
            }
        }
        cursor+=item.advance;
    }
    advance=cursor; bounds=combined;
    return true;
}
bool measureCanvasTextForCaller(void *caller, const void *font, const char *text, std::size_t size,
                                int encoding, const void *paint, float &advance, CanvasInkBounds &bounds) {
    if (!approvedCanvasMeasureCaller(caller)) return false;
    gCanvasText.measureMatched.fetch_add(1,std::memory_order_relaxed);
    if (encoding!=0 || !font || !text || size==0 || size>8192) {
        gCanvasText.measureFallbackCalls.fetch_add(1,std::memory_order_relaxed);
        return false;
    }
    if (!measureCanvasRuns(text,size,font,paint,advance,bounds)) {
        gCanvasText.measureFallbackCalls.fetch_add(1,std::memory_order_relaxed);
        return false;
    }
    gCanvasText.measured.fetch_add(1,std::memory_order_relaxed);
    return true;
}
bool paintCanvasRuns(DrawSimpleTextFunction original, void *canvas, const char *text, std::size_t size,
                     float x, float y, const void *font, const void *paint) {
    if (!std::isfinite(x) || !std::isfinite(y)) return false;
    thread_local std::vector<PlannedCanvasRun> plan;
    if (!planCanvasRuns(text,size,font,paint,false,plan)) return false;
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
extern "C" bool cavalry_bilingual_canvas_measure_diagnostics_v1(std::uint64_t *out, std::size_t count) noexcept {
    if (!out || count!=4) return false;
    out[0]=gCanvasText.ready.load(); out[1]=gCanvasText.measureMatched.load(); out[2]=gCanvasText.measured.load(); out[3]=gCanvasText.measureFallbackCalls.load(); return true;
}
