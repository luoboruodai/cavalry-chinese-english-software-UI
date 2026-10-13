// No app or document opened: exact-caller font projection/ownership fixture.
#include "../injector/cavalry_i18n_macos_tool_help_text_path.cpp"
#include <cassert>
#include <string>
extern "C" void skTextUtilsGetPathInterposeTarget(const void *,std::size_t,int,float,float,const void *,void *) {}
extern "C" void skCanvasDrawSimpleTextInterposeTarget(void *,const void *,std::size_t,int,float,float,const void *,const void *) {}
extern "C" float skFontMeasureTextInterposeTarget(const void *,const void *,std::size_t,int,void *,const void *) {return 0;}
SkSpBlobAbi skTextBlobMakeFromTextInterposeTarget(const void *,std::size_t,const void *,int) {return {};}
static std::uintptr_t face(const void *f) {std::uintptr_t out;std::memcpy(&out,f,sizeof(out));return out;}
static void init(SkFontAbi &f,std::uintptr_t v) {std::memcpy(f.storage.data(),&v,sizeof(v));float size=12;std::memcpy(f.storage.data()+8,&size,4);}
static std::uint16_t glyph(const void *font,std::int32_t cp) {return face(font)==2 || face(font)==3 || cp<128 ? 7:0;}
static unsigned calls=0;static std::uintptr_t usedFace=0;static std::string seen;static bool fail=false;
static SkSpBlobAbi make(const void *text,std::size_t size,const void *font,int) {
    ++calls;usedFace=face(font);seen.assign(static_cast<const char *>(text),size);
    SkSpBlobAbi blob;blob.pointer=fail && usedFace==2 ? nullptr:reinterpret_cast<void *>(0x1234);return blob;
}
static float measure(const void *font,const void *,std::size_t,int,void *out,const void *) {
    usedFace=face(font);CanvasInkBounds r{-2,-9,38,3};std::memcpy(out,&r,sizeof(r));return 42;
}
int main() {
    SkFontAbi latin,zh,fallback,display;init(latin,1);init(zh,2);init(fallback,3);
    gCanvasText.chinese=&zh;gCanvasText.english=nullptr;gCanvasText.fallback=&fallback;
    gCanvasText.glyph=glyph;gCanvasText.measure=measure;
    gState.extensionImage.header=reinterpret_cast<const mach_header_64 *>(0x10000);
    gViewportName.original.store(make);gViewportName.ready.store(true);
    const auto blobCaller=imageAddress(gState.extensionImage,kViewportNameMakeCallsites[0].offset+kCanvasCallBytes);
    const auto metricCaller=imageAddress(gState.extensionImage,kViewportNameMeasureCallsites[0].offset+kCanvasCallBytes);
    const std::string text=u8"中文节点_ABC";
    assert(viewportNameFont(text.data(),text.size(),&latin,0,display));assert(face(&display)==2 && face(&latin)==1);
    assert(std::memcmp(display.storage.data()+8,latin.storage.data()+8,16)==0);
    auto result=makeViewportNameForCaller(blobCaller,text.data(),text.size(),&latin,0);
    assert(result.pointer==reinterpret_cast<void *>(0x1234) && usedFace==2 && seen==text);
    float advance=0;CanvasInkBounds ink{};
    assert(measureViewportNameForCaller(metricCaller,&latin,text.data(),text.size(),0,nullptr,advance,ink));
    assert(usedFace==2 && advance==42 && ink.left==-2 && ink.right==38);
    // Unknown scene/export callers, non-UTF8, malformed names and ordinary Latin pass through.
    for (void *unknown:{reinterpret_cast<void *>(0x8765),imageAddress(gState.extensionImage,kViewportNameMakeCallsites[0].offset)}) {
        auto raw=makeViewportNameForCaller(unknown,text.data(),text.size(),&latin,0);assert(raw.pointer && usedFace==1 && seen==text);
        assert(!measureViewportNameForCaller(unknown,&latin,text.data(),text.size(),0,nullptr,advance,ink));
    }
    assert(!viewportNameFont(text.data(),text.size(),&latin,1,display));
    assert(!viewportNameFont("\xe4\xb8",2,&latin,0,display));
    assert(!viewportNameFont("a\nb",3,&latin,0,display));
    assert(!viewportNameFont("ASCII",5,&latin,0,display));
    gCanvasText.chinese=&latin;assert(viewportNameFont(text.data(),text.size(),&latin,0,display));assert(face(&display)==3);
    gCanvasText.chinese=&zh;gCanvasText.english=&fallback;
    assert(viewportNameFont("ASCII",5,&latin,0,display) && face(&display)==3);
    fail=true;auto retry=makeViewportNameForCaller(blobCaller,text.data(),text.size(),&latin,0);
    assert(retry.pointer && usedFace==1 && seen==text); // empty projected blob falls back, no leak or double unref
    gViewportName.ready.store(false);
    auto disabled=makeViewportNameForCaller(blobCaller,text.data(),text.size(),&latin,0);assert(disabled.pointer && usedFace==1);
    assert(!measureViewportNameForCaller(metricCaller,&latin,text.data(),text.size(),0,nullptr,advance,ink));
    std::uint64_t stats[4];assert(cavalry_bilingual_viewport_name_diagnostics_v1(stats,4));assert(stats[1]==1 && stats[2]==1);
}
