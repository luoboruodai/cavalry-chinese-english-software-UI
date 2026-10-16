// Fixed viewport overlays are Path text. This projection shares the verified Core text renderer,
// but only the two GraphicsViewportBase::renderFrame callsites can activate its exact whitelist.
namespace {
#if defined(CAVALRY_I18N_CAVALRY_280)
constexpr std::size_t kViewportHintCount = 6;
#else
constexpr std::size_t kViewportHintCount = 5;
#endif
struct ViewportHint {
    const char *source;
    char translation[512];
    std::size_t sourceSize, translationSize;
};
constexpr const char *kViewportSources[kViewportHintCount] = {
    "Active Camera: Layer Tools Disabled.",
#if defined(CAVALRY_I18N_CAVALRY_280)
    "Viewport Quality: Full",
#endif
    "Viewport Quality: High", "Viewport Quality: Balanced",
    "Viewport Quality: Low", "Viewport Quality: Lowest",
};
struct ViewportPathState {
    std::atomic<bool> ready{false};
    ViewportHint hints[kViewportHintCount]{};
    std::atomic<std::uint64_t> recognized{0}, rendered{0}, fallback{0};
};
ViewportPathState gViewportPath;
#if defined(__arm64__) && defined(CAVALRY_I18N_CAVALRY_280)
constexpr std::size_t kViewportCallBytes = 4;
constexpr std::uintptr_t kViewportReturnAddresses[] = {0x23c9bc, 0x23ce80};
constexpr CanvasCallsite kViewportCallsites[] = {
    {0x23c9b8, {0xce,0x11,0x00,0x94}},
    {0x23ce7c, {0x9d,0x10,0x00,0x94}},
};
#elif defined(__x86_64__) && defined(CAVALRY_I18N_CAVALRY_280)
constexpr std::size_t kViewportCallBytes = 5;
constexpr std::uintptr_t kViewportReturnAddresses[] = {0x27545c, 0x27572d};
constexpr CanvasCallsite kViewportCallsites[] = {
    {0x275457, {0xe8,0xb4,0x51,0x00,0x00}},
    {0x275728, {0xe8,0xe3,0x4e,0x00,0x00}},
};
#elif defined(__arm64__)
constexpr std::size_t kViewportCallBytes = 4;
constexpr std::uintptr_t kViewportReturnAddresses[] = {0x17bcb0, 0x17bee8};
constexpr CanvasCallsite kViewportCallsites[] = {
    {0x17bcac, {0xc3,0x10,0x00,0x94}},
    {0x17bee4, {0x35,0x10,0x00,0x94}},
};
#elif defined(__x86_64__)
constexpr std::size_t kViewportCallBytes = 5;
constexpr std::uintptr_t kViewportReturnAddresses[] = {0x1a52c4, 0x1a551b};
constexpr CanvasCallsite kViewportCallsites[] = {
    {0x1a52bf, {0xe8,0x1c,0x4d,0x00,0x00}},
    {0x1a5516, {0xe8,0xc5,0x4a,0x00,0x00}},
};
#endif
const ViewportHint *viewportPathHintFor(const void *text, std::size_t size, bool *bilingual = nullptr) noexcept {
    if (bilingual != nullptr) *bilingual = false;
    if (!text || size == 0 || size > 256) return nullptr;
    for (const auto &hint : gViewportPath.hints) {
        if (size == hint.sourceSize && std::memcmp(text, hint.source, size) == 0) return &hint;
        if (matchesBilingualText(hint.translation, hint.translationSize, hint.source, text, size)) {
            if (bilingual != nullptr) *bilingual = true;
            return &hint;
        }
    }
    return nullptr;
}
bool callerChainMatchesViewport(void *return0, void *return1, void *return2) noexcept {
    if (!gViewportPath.ready.load(std::memory_order_acquire) ||
        return0 != imageAddress(gState.coreImage, kCoreGetPathReturn) ||
        return1 != imageAddress(gState.extensionImage, kExtensionMakePathReturn)) return false;
    for (const auto address : kViewportReturnAddresses) {
        if (return2 == imageAddress(gState.extensionImage, address)) return true;
    }
    return false;
}
} // namespace
namespace cavalry_i18n {
void configureMacViewportHints(const MacViewportHintTranslation *entries, std::size_t count) noexcept {
    if (!entries || count < kViewportHintCount || gViewportPath.ready.load(std::memory_order_acquire) ||
        !gState.vendorContractVerified.load(std::memory_order_acquire) ||
        !gState.rendererReady.load(std::memory_order_acquire)) return;
    for (std::size_t index = 0; index < kViewportHintCount; ++index) {
        if (!entries[index].source || !entries[index].translation ||
            std::strcmp(entries[index].source, kViewportSources[index]) != 0) return;
        const auto size = std::strlen(entries[index].translation);
        if (size < 2 || size >= sizeof(gViewportPath.hints[index].translation)) return;
        auto &hint = gViewportPath.hints[index];
        hint.source = kViewportSources[index];
        hint.sourceSize = std::strlen(hint.source);
        hint.translationSize = size;
        std::memcpy(hint.translation, entries[index].translation, size + 1);
    }
    for (const auto &site : kViewportCallsites) {
        const auto start = reinterpret_cast<std::uintptr_t>(imageAddress(gState.extensionImage, site.offset));
        const auto textStart = static_cast<std::uintptr_t>(gState.extensionImage.slide) +
            gState.extensionImage.textSegment->vmaddr;
        const auto textEnd = textStart + gState.extensionImage.textSegment->vmsize;
        if (start < textStart || start + kViewportCallBytes > textEnd ||
            std::memcmp(reinterpret_cast<const void *>(start), site.bytes.data(), kViewportCallBytes) != 0) return;
    }
    gViewportPath.ready.store(true, std::memory_order_release);
}
} // namespace cavalry_i18n
extern "C" bool cavalry_bilingual_viewport_diagnostics_v1(std::uint64_t *out, std::size_t count) noexcept {
    if (!out || count != 4) return false;
    out[0] = gViewportPath.ready.load();
    out[1] = gViewportPath.recognized.load();
    out[2] = gViewportPath.rendered.load();
    out[3] = gViewportPath.fallback.load();
    return true;
}
