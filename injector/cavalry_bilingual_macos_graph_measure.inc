// Display-only Lina TextView elision adapter; included after the Canvas planner.
// NO string replacement, NodeView field writes, document edits or inline patches.
// Only three exact SkFont::measureText calls in the reviewed elision function can
// change metrics. All other callers, encodings and unsupported ABIs pass through.
#include "cavalry_bilingual_utf8_elision.h"
#include <CommonCrypto/CommonDigest.h>
namespace {
struct GraphMeasureState {
    std::atomic<MeasureTextFunction> original{nullptr};
    std::atomic<bool> ready{false};
    std::atomic<std::uint64_t> measured{0}, splitRejected{0}, fallbackCalls{0};
};
GraphMeasureState gGraphMeasure;
thread_local bool graphMeasureRecursion=false;
#if defined(__arm64__) && defined(CAVALRY_I18N_CAVALRY_280)
constexpr std::uintptr_t kGraphElideOffset=0x567054;
constexpr std::size_t kGraphElideSize=0x598;
constexpr char kGraphElideSha256[]="10c6c15586bb43e1f0a1a52d4216af08c87dd9959e31095753ace67bc0487d89";
constexpr CanvasCallsite kGraphMeasureCallsites[] = {
    {0x5670ec, {0xac,0x72,0x21,0x94}}, // full text; bounds.right-left is consumed
    {0x567134, {0x9a,0x72,0x21,0x94}}, // ASCII ellipsis
    {0x5673c0, {0xf7,0x71,0x21,0x94}}, // byte-pop candidate + ellipsis
};
#elif defined(__x86_64__) && defined(CAVALRY_I18N_CAVALRY_280)
constexpr std::uintptr_t kGraphElideOffset=0x5ffda0;
constexpr std::size_t kGraphElideSize=0x640;
constexpr char kGraphElideSha256[]="e579f62451d9dac915aed7843b64923eda412c2eb5d4e1878dcec3186c802be4";
constexpr CanvasCallsite kGraphMeasureCallsites[] = {
    {0x5ffe60, {0xe8,0x7c,0x49,0x94,0x00}},
    {0x5ffeb1, {0xe8,0x2b,0x49,0x94,0x00}},
    {0x6001e5, {0xe8,0xf7,0x45,0x94,0x00}},
};
#elif defined(__arm64__)
constexpr std::uintptr_t kGraphElideOffset=0x433e04;
constexpr std::size_t kGraphElideSize=0x598;
constexpr char kGraphElideSha256[]="c4ac15fc0bfa9ae71cefd0e4b65fd6683e47b57c6e91543b2a24573058913e64";
constexpr CanvasCallsite kGraphMeasureCallsites[] = {
    {0x433e9c, {0x60,0xd4,0x1d,0x94}}, // full text; bounds.right-left is consumed
    {0x433ee4, {0x4e,0xd4,0x1d,0x94}}, // ASCII ellipsis
    {0x434190, {0xa3,0xd3,0x1d,0x94}}, // byte-pop candidate + ellipsis
};
#elif defined(__x86_64__)
constexpr std::uintptr_t kGraphElideOffset=0x4ae3a0;
constexpr std::size_t kGraphElideSize=0x5e0;
constexpr char kGraphElideSha256[]="eb67095465ddf3bf0fb35c07a23a702cc38b4e39c5b6f2c8f48a125fe266c1f4";
constexpr CanvasCallsite kGraphMeasureCallsites[] = {
    {0x4ae45c, {0xe8,0x8e,0x35,0x88,0x00}},
    {0x4ae4ad, {0xe8,0x3d,0x35,0x88,0x00}},
    {0x4ae7ae, {0xe8,0x3c,0x32,0x88,0x00}},
};
#endif
MeasureTextFunction originalGraphMeasure() noexcept {
    auto original=gGraphMeasure.original.load(std::memory_order_acquire);
    if (original) return original;
    LoadedImage skia{};
    if (findLoadedImage("libskia.dylib",&skia)) {
        original=reinterpret_cast<MeasureTextFunction>(findMachOSymbol(skia,
            "__ZNK6SkFont11measureTextEPKvm14SkTextEncodingP6SkRectPK7SkPaint"));
        if (original) gGraphMeasure.original.store(original,std::memory_order_release);
    }
    return original;
}
bool verifyGraphElideCode() noexcept {
    const auto &image=gState.extensionImage;
    if (!image.textSegment || kGraphElideOffset>image.textSegment->vmsize ||
        kGraphElideSize>image.textSegment->vmsize-kGraphElideOffset) return false;
    const auto code=imageAddress(image,kGraphElideOffset);
    if (findMachOSymbol(image,"__ZN4lina8TextView16elideTextToWidthERKNSt3__112basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEEfRK6SkFont")!=code) return false;
    unsigned char digest[CC_SHA256_DIGEST_LENGTH]{};
    if (!CC_SHA256(code,static_cast<CC_LONG>(kGraphElideSize),digest)) return false;
    constexpr char hex[]="0123456789abcdef";
    for (std::size_t i=0;i<sizeof(digest);++i)
        if (hex[digest[i]>>4]!=kGraphElideSha256[2*i] || hex[digest[i]&15]!=kGraphElideSha256[2*i+1]) return false;
    return true;
}
void configureGraphMeasure() noexcept {
    if (!gState.vendorContractVerified.load(std::memory_order_acquire) || !gCanvasText.ready.load(std::memory_order_acquire)) return;
    if (!verifyGraphElideCode()) return;
    for (const auto &site:kGraphMeasureCallsites) {
        const auto *bytes=static_cast<const std::uint8_t *>(imageAddress(gState.extensionImage,site.offset));
        if (std::memcmp(bytes,site.bytes.data(),kCanvasCallBytes)!=0) return;
    }
    if (originalGraphMeasure()) gGraphMeasure.ready.store(true,std::memory_order_release);
}
int graphMeasureCallerIndex(void *caller) noexcept {
    for (int i=0;i<3;++i)
        if (caller==imageAddress(gState.extensionImage,kGraphMeasureCallsites[i].offset+kCanvasCallBytes)) return i;
    return -1;
}
bool measureGraphTextForCaller(void *caller, const void *font, const char *text, std::size_t size,
                              int encoding, const void *paint, float &advance, CanvasInkBounds &bounds) {
    const int index=graphMeasureCallerIndex(caller);
    if (index<0 || encoding!=0 || !font || !text || size==0 || size>8192) return false;
    if (index==2 && cavalry_bilingual::hasSplitScalarBeforeEllipsis(text,size)) {
        // The original loop removes one more byte whenever ink width exceeds
        // its available width. Reject ONLY a split-scalar candidate; this takes
        // at most three more iterations before the original loop is back on a
        // UTF-8 boundary. It also checks for an empty prefix, so no infinite loop.
        advance=1e20f; bounds={0,0,1e20f,1};
        gGraphMeasure.splitRejected.fetch_add(1,std::memory_order_relaxed);
        return true;
    }
    if (!measureCanvasRuns(text,size,font,paint,advance,bounds)) return false;
    gGraphMeasure.measured.fetch_add(1,std::memory_order_relaxed);
    return true;
}
} // namespace
extern "C" __attribute__((noinline)) float cavalryBilingualMeasureGraphText(const void *font,
    const void *text, std::size_t size, int encoding, void *bounds, const void *paint) noexcept {
    const auto original=originalGraphMeasure();
    if (!original) { if (bounds) std::memset(bounds,0,sizeof(CanvasInkBounds)); return 0; }
    if (!graphMeasureRecursion && (gGraphMeasure.ready.load(std::memory_order_acquire) ||
        gViewportName.ready.load(std::memory_order_acquire) || gCanvasText.ready.load(std::memory_order_acquire))) {
        graphMeasureRecursion=true;
        float advance=0; CanvasInkBounds ink{}; bool handled=false;
        void *caller=__builtin_extract_return_addr(__builtin_return_address(0));
        try {
            if (gGraphMeasure.ready.load(std::memory_order_acquire))
                handled=measureGraphTextForCaller(caller,font,static_cast<const char *>(text),size,encoding,paint,advance,ink);
            if (!handled && gCanvasText.ready.load(std::memory_order_acquire))
                handled=measureCanvasTextForCaller(caller,font,static_cast<const char *>(text),size,encoding,paint,advance,ink);
            if (!handled)
                handled=measureViewportNameForCaller(caller,font,static_cast<const char *>(text),size,encoding,paint,advance,ink);
        } catch (...) { handled=false; }
        graphMeasureRecursion=false;
        if (handled) { if (bounds) std::memcpy(bounds,&ink,sizeof(ink)); return advance; }
        // Only count a reviewed caller's fallback, not unrelated scene rendering.
        if (graphMeasureCallerIndex(__builtin_extract_return_addr(__builtin_return_address(0)))>=0)
            gGraphMeasure.fallbackCalls.fetch_add(1,std::memory_order_relaxed);
    }
    return original(font,text,size,encoding,bounds,paint);
}
extern "C" float skFontMeasureTextInterposeTarget(const void *, const void *, std::size_t, int, void *, const void *)
    __asm("__ZNK6SkFont11measureTextEPKvm14SkTextEncodingP6SkRectPK7SkPaint");
__attribute__((used)) static struct { const void *replacement; const void *replacee; }
kBilingualGraphMeasureInterpose __attribute__((section("__DATA,__interpose"))) = {
    reinterpret_cast<const void *>(cavalryBilingualMeasureGraphText), reinterpret_cast<const void *>(skFontMeasureTextInterposeTarget)
};
// Aggregate counters only. No user names, strings, scene paths or connection IDs.
extern "C" bool cavalry_bilingual_graph_measure_diagnostics_v1(std::uint64_t *out,std::size_t count) noexcept {
    if (!out || count!=4) return false;
    out[0]=gGraphMeasure.ready.load(); out[1]=gGraphMeasure.measured.load();
    out[2]=gGraphMeasure.splitRejected.load(); out[3]=gGraphMeasure.fallbackCalls.load(); return true;
}
