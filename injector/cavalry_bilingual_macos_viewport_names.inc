// Exact 2.7.2 viewport layer-name TextBlob producer only. Never translates text,
// changes a scene font, retains names, touches a node, or hooks document export.
// Mixed text inside ONE vendor blob uses its CJK family as a whole; pure Latin
// blobs may use the configured English family. Measurement uses the SAME choice.
#include <CommonCrypto/CommonDigest.h>
struct SkSpBlobAbi {
    void *pointer=nullptr;
    SkSpBlobAbi() noexcept = default;
    SkSpBlobAbi(SkSpBlobAbi &&other) noexcept : pointer(other.pointer) { other.pointer=nullptr; }
    SkSpBlobAbi(const SkSpBlobAbi &)=delete;
    ~SkSpBlobAbi() {} // ownership is transferred untouched to the vendor caller
};
static_assert(sizeof(SkSpBlobAbi)==sizeof(void *));
namespace {
using MakeBlobFunction=SkSpBlobAbi (*)(const void *,std::size_t,const void *,int);
struct ViewportNameState {
    std::atomic<MakeBlobFunction> original{nullptr};
    std::atomic<bool> ready{false};
    std::atomic<std::uint64_t> projected{0},measured{0},fallbackCalls{0};
};
ViewportNameState gViewportName;
#if defined(__arm64__)
constexpr std::uintptr_t kViewportNameOffset=0x17e340;
constexpr std::size_t kViewportNameSize=0xee4;
constexpr char kViewportNameSha256[]="500624c7a8492af750c7c47ef2203a3db94a48c546708e9681629d1efbaebf60";
constexpr CanvasCallsite kViewportNameMakeCallsites[]={
    {0x17ebf0,{0xcb,0x85,0x28,0x94}},
    {0x17eda8,{0x5d,0x85,0x28,0x94}},
};
constexpr CanvasCallsite kViewportNameMeasureCallsites[]={
    {0x17e558,{0xb1,0xaa,0x28,0x94}},
    {0x17e5ec,{0x8c,0xaa,0x28,0x94}},
    {0x17eca0,{0xdf,0xa8,0x28,0x94}},
    {0x17edf0,{0x8b,0xa8,0x28,0x94}},
};
#elif defined(__x86_64__)
constexpr std::uintptr_t kViewportNameOffset=0x1a7c70;
constexpr std::size_t kViewportNameSize=0x1280;
constexpr char kViewportNameSha256[]="593b09e6fbaabfc9050142fd6ce43a2511ceaa593689bdae12476c2b7f91d73e";
constexpr CanvasCallsite kViewportNameMakeCallsites[]={
    {0x1a87d1,{0xe8,0x4d,0x4c,0xb8,0x00}},
    {0x1a8a07,{0xe8,0x17,0x4a,0xb8,0x00}},
};
constexpr CanvasCallsite kViewportNameMeasureCallsites[]={
    {0x1a7ece,{0xe8,0x1c,0x9b,0xb8,0x00}},
    {0x1a7f71,{0xe8,0x79,0x9a,0xb8,0x00}},
    {0x1a88bb,{0xe8,0x2f,0x91,0xb8,0x00}},
    {0x1a8a62,{0xe8,0x88,0x8f,0xb8,0x00}},
};
#endif
MakeBlobFunction originalViewportNameBlob() noexcept {
    auto original=gViewportName.original.load(std::memory_order_acquire);
    if (original) return original;
    LoadedImage image{};
    if (findLoadedImage("libskia.dylib",&image)) {
        original=reinterpret_cast<MakeBlobFunction>(findMachOSymbol(image,
            "__ZN10SkTextBlob12MakeFromTextEPKvmRK6SkFont14SkTextEncoding"));
        if (original) gViewportName.original.store(original,std::memory_order_release);
    }
    return original;
}
template <std::size_t N> bool viewportNameCaller(void *caller,const CanvasCallsite (&sites)[N]) noexcept {
    for (const auto &site:sites)
        if (caller==imageAddress(gState.extensionImage,site.offset+kCanvasCallBytes)) return true;
    return false;
}
bool viewportNameContract() noexcept {
    const auto &image=gState.extensionImage;
    if (!image.textSegment || kViewportNameOffset>image.textSegment->vmsize ||
        kViewportNameSize>image.textSegment->vmsize-kViewportNameOffset) return false;
    const auto code=imageAddress(image,kViewportNameOffset);
    if (findMachOSymbol(image,"__ZZN20GraphicsViewportBase11renderFrameER8SkCanvasbENK4$_32clEP12DrawableNodeb")!=code) return false;
    unsigned char digest[CC_SHA256_DIGEST_LENGTH]{};
    if (!CC_SHA256(code,static_cast<CC_LONG>(kViewportNameSize),digest)) return false;
    constexpr char hex[]="0123456789abcdef";
    for (std::size_t i=0;i<sizeof(digest);++i)
        if (hex[digest[i]>>4]!=kViewportNameSha256[2*i] || hex[digest[i]&15]!=kViewportNameSha256[2*i+1]) return false;
    for (const auto &site:kViewportNameMakeCallsites)
        if (std::memcmp(imageAddress(image,site.offset),site.bytes.data(),kCanvasCallBytes)!=0) return false;
    for (const auto &site:kViewportNameMeasureCallsites)
        if (std::memcmp(imageAddress(image,site.offset),site.bytes.data(),kCanvasCallBytes)!=0) return false;
    return true;
}
void configureViewportNames() noexcept {
    if (!gState.vendorContractVerified.load(std::memory_order_acquire) || !gCanvasText.ready.load(std::memory_order_acquire)) return;
    if (viewportNameContract() && originalViewportNameBlob()) gViewportName.ready.store(true,std::memory_order_release);
}
bool viewportNameFont(const char *text,std::size_t size,const void *font,int encoding,SkFontAbi &display) {
    if (!font || encoding!=0 || !gCanvasText.glyph) return false;
    thread_local std::vector<cavalry_bilingual::Utf8Run> runs;
    if (!cavalry_bilingual::textRuns(text,size,runs)) return false;
    bool cjk=false;for(const auto &run:runs)cjk|=run.cjk;
    const auto *family=cjk ? gCanvasText.chinese : gCanvasText.english;
    if (!family) return false; // ordinary ASCII stays on its original face
    float fontSize=0;std::memcpy(&fontSize,static_cast<const char *>(font)+sizeof(void *),sizeof(fontSize));
    if (!std::isfinite(fontSize) || fontSize<=0 || fontSize>4096) return false;
    copyCanvasFont(display,font,family);
    if (canvasFontCovers(&display,text,size)) return true;
    if (!gCanvasText.fallback) return false;
    copyCanvasFont(display,font,gCanvasText.fallback);
    return canvasFontCovers(&display,text,size);
}
bool measureViewportNameForCaller(void *caller,const void *font,const char *text,std::size_t size,
                                  int encoding,const void *paint,float &advance,CanvasInkBounds &bounds) {
    if (!gViewportName.ready.load(std::memory_order_acquire) ||
        !viewportNameCaller(caller,kViewportNameMeasureCallsites)) return false;
    SkFontAbi display;
    if (!viewportNameFont(text,size,font,encoding,display)) return false;
    CanvasInkBounds ink{};
    const float value=gCanvasText.measure(&display,text,size,encoding,&ink,paint);
    if (!std::isfinite(value) || value<0 || value>1e6 || !std::isfinite(ink.left) ||
        !std::isfinite(ink.top) || !std::isfinite(ink.right) || !std::isfinite(ink.bottom)) return false;
    advance=value;bounds=ink;
    gViewportName.measured.fetch_add(1,std::memory_order_relaxed);return true;
}
SkSpBlobAbi makeViewportNameForCaller(void *caller,const void *text,std::size_t size,const void *font,int encoding) {
    const auto original=originalViewportNameBlob();
    if (!original) return {};
    if (gViewportName.ready.load(std::memory_order_acquire) && viewportNameCaller(caller,kViewportNameMakeCallsites)) {
        SkFontAbi display;bool changed=false;
        try { changed=viewportNameFont(static_cast<const char *>(text),size,font,encoding,display); } catch (...) { changed=false; }
        if (changed) {
            auto result=original(text,size,&display,encoding);
            if (result.pointer) {gViewportName.projected.fetch_add(1,std::memory_order_relaxed);return result;}
        }
        gViewportName.fallbackCalls.fetch_add(1,std::memory_order_relaxed);
    }
    return original(text,size,font,encoding);
}
} // namespace
__attribute__((noinline)) SkSpBlobAbi cavalryBilingualMakeViewportNameBlob(
    const void *text,std::size_t size,const void *font,int encoding) {
    return makeViewportNameForCaller(__builtin_extract_return_addr(__builtin_return_address(0)),text,size,font,encoding);
}
SkSpBlobAbi skTextBlobMakeFromTextInterposeTarget(const void *,std::size_t,const void *,int)
    __asm("__ZN10SkTextBlob12MakeFromTextEPKvmRK6SkFont14SkTextEncoding");
__attribute__((used)) static struct {const void *replacement;const void *replacee;}
kViewportNameBlobInterpose __attribute__((section("__DATA,__interpose")))={
    reinterpret_cast<const void *>(cavalryBilingualMakeViewportNameBlob),reinterpret_cast<const void *>(skTextBlobMakeFromTextInterposeTarget)
};
extern "C" bool cavalry_bilingual_viewport_name_diagnostics_v1(std::uint64_t *out,std::size_t count) noexcept {
    if (!out || count!=4) return false;
    out[0]=gViewportName.ready.load();out[1]=gViewportName.projected.load();
    out[2]=gViewportName.measured.load();out[3]=gViewportName.fallbackCalls.load();return true;
}
