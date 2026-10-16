// Native Windows CTest: exercise the real display translator with bilingual mode.
#include "../injector/windows/cavalry_i18n_display.h"
#include "../injector/windows/cavalry_i18n_translator.h"
#include <QtWidgets/QApplication>
#include <QtWidgets/QComboBox>
#include <QtWidgets/QLineEdit>
#include <QtWidgets/QPushButton>
#include <QtWidgets/QTabBar>
#include <QtWidgets/QToolButton>
#include <cassert>
#include <cstdio>
int main(int argc, char **argv) {
    QApplication app(argc,argv);
    CavalryEmbeddedTranslator translator(QStringLiteral("zh-Hans"));
    CavalryDisplayTranslator display(translator);
    QPushButton button(QStringLiteral("Cancel"));button.setFixedWidth(36);
    QFont font=button.font();font.setStyleStrategy(QFont::NoFontMerging);button.setFont(font);
    display.translateWidget(&button);
    assert(button.text().contains(QStringLiteral("取消")) && button.text().contains("Cancel"));
    assert(!(button.font().styleStrategy() & QFont::NoFontMerging));
    assert(button.minimumWidth() >= button.fontMetrics().horizontalAdvance(button.text()) + 32);
    QComboBox combo;combo.addItem("Pretty",11);combo.addItem("Compact",22);combo.setFixedWidth(55);
    display.translateWidget(&combo);
    assert(combo.currentText().contains(QStringLiteral("格式化")) && combo.currentText().contains("Pretty"));
    assert(combo.currentIndex()==0 && combo.itemData(0).toInt()==11 && combo.itemData(1).toInt()==22);
    assert(combo.minimumWidth()>=combo.fontMetrics().horizontalAdvance(combo.currentText())+48);
    QLineEdit value;value.setText("Rectangle Pattern");value.setPlaceholderText("Search...");
    display.translateWidget(&value);assert(value.text()=="Rectangle Pattern");
    QToolButton tool;tool.setText("Cancel");tool.setFixedWidth(36);
    display.translateWidget(&tool);assert(tool.minimumWidth()==36 && tool.maximumWidth()==36);
    QTabBar tabs;tabs.addTab("Preferences");display.translateWidget(&tabs);
    assert(tabs.usesScrollButtons() && tabs.elideMode()==Qt::ElideNone);
    const auto width=button.minimumWidth();display.translateWidget(&button);assert(button.minimumWidth()==width);
    puts("PASS: real Windows bilingual display/width/font policy; inputs and enum identities preserved");
}
