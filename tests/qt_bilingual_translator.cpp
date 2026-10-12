// Must work with only QCoreApplication: Windows loads its QPA delegate before a GUI platform exists.
#include <QtCore/QCoreApplication>
#include "../injector/windows/cavalry_i18n_translator.h"
#include <cassert>
int main(int argc,char **argv) {
    QCoreApplication app(argc,argv);
    CavalryEmbeddedTranslator translator(QStringLiteral("zh-Hans"));
    const auto file=translator.translate("MenuBarManager","File");
    assert(file.contains(QStringLiteral("文件")) && file.contains(QStringLiteral("File")));
    assert(!file.contains(QStringLiteral("{en}")) && !file.contains(QStringLiteral("{zh}")));
    assert(translator.entryCount()>3800);
    // Unknown user-owned names remain absent rather than acquiring an invented translation.
    assert(translator.translate("UserLayer","PRIVATE_FIXTURE_2026").isEmpty());
}
