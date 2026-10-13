// Isolated public-Qt regression harness. This is NOT Cavalry end-to-end acceptance.
#include "../injector/cavalry_bilingual_runtime.h"
#include "../injector/cavalry_i18n_translation_policy.h"
#include <QtWidgets/QApplication>
#include <QtGui/QTextLayout>
#include <QtGui/QGlyphRun>
#include <QtGui/QImage>
#include <QtGui/QPainter>
#include <cassert>
#include <cstdio>
struct TranslationEntry { const char *context, *sourceText, *translation; };
#define CAVALRY_BILINGUAL_ENTRIES(array, count) cavalry_bilingual::entries(array, count)
#include "../injector/generated_translations.inc"
int main(int argc, char **argv) {
    QApplication app(argc, argv);
    using namespace cavalry_bilingual;
    assert(cavalry_i18n::requiresExactTranslationContext("BilingualVendorEffects", "Paint"));
    assert(cavalry_i18n::requiresExactTranslationContext("BilingualVendorEffects", "Extract"));
    const QString pattern = argc > 1 ? QString::fromUtf8(argv[1]) : QStringLiteral("{zh}（{en}）");
    assert(settings().pattern == pattern);
    assert(format("Undo %1", "撤销 %1", pattern).arg("Move").count("Move") == 2);
    assert(format("{zh}", "字面变量", "{zh} / {en}") == "字面变量 / {zh}");
    assert(format("Open", "打开", "{en} / {zh}") == "Open / 打开");
    int count = 0;
    const auto *table = entriesForLanguage(QStringLiteral("zh-Hans"), &count);
    assert(count > 3800);
    int bilingual = 0;
    for (int i = 0; i < count; ++i) {
        const auto source = QString::fromUtf8(table[i].sourceText);
        const auto translated = QString::fromUtf8(table[i].translation);
        if (hasCjk(translated) && source != translated) { assert(translated.contains(source)); ++bilingual; }
    }
    assert(bilingual > 3800);
    QFont original("Arial", 14); original.setStyleStrategy(QFont::NoFontMerging);
    auto font = displayFont(original);
    assert(!(font.styleStrategy() & QFont::NoFontMerging));
    const QString sample = QStringLiteral("年份计数_1978到2026 路径生长_Start-End 字形（Glyphs）");
    QTextLayout layout(sample, font);
    layout.beginLayout(); auto line = layout.createLine(); line.setLineWidth(1600); layout.endLayout();
    int glyphs = 0;
    for (auto run : layout.glyphRuns()) for (auto glyph : run.glyphIndexes()) { assert(glyph != 0); ++glyphs; }
    assert(glyphs > 30);
    QImage preview(1800, 100, QImage::Format_ARGB32_Premultiplied); preview.fill(Qt::white);
    QPainter painter(&preview); painter.setFont(font); painter.setPen(Qt::black); painter.drawText(QPointF(16, 50), sample); painter.end();
    if (argc > 2) assert(preview.save(QString::fromUtf8(argv[2])));
    QPushButton button(QStringLiteral("生成器（Generator）")); button.setFixedWidth(36);
    polishWidget(&button); assert(button.minimumWidth() >= button.sizeHint().width());
    QToolButton tool; tool.setText(QStringLiteral("清除选中内容（Clear Selected）"));
    tool.setToolButtonStyle(Qt::ToolButtonTextOnly); tool.setFixedWidth(36);
    polishWidget(&tool); assert(tool.minimumWidth() == 36 && tool.maximumWidth() == 36);
    assert(tool.toolTip() == tool.text());
    QTabBar tabs; tabs.addTab(QStringLiteral("属性编辑器（Attribute Editor）")); polishWidget(&tabs);
    assert(tabs.usesScrollButtons() && tabs.elideMode() == Qt::ElideNone);
    printf("PASS: %d entries, %d bilingual entries, %d nonzero glyphs; placeholder, font, button and tabs checks\n", count, bilingual, glyphs);
}
