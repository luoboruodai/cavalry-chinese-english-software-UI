/**
 * [INPUT]: 依赖已构建 qpa/qwindows.dll、可选 generic/cavalryi18n.dll、Qt 6.6.3 plugin metadata 与平台/通用工厂类型。
 * [OUTPUT]: 对外验证最终 QPA/可选generic二进制可加载、IID/key/工厂类型与generic无效语言拒绝；绝不创建平台、激活翻译runtime或加载厂商 DLL。
 * [POS]: injector/windows 的产物级 QPA 守门，补足纯 contract/source 测试无法覆盖的 metadata、导出和动态依赖回归。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#include <QtCore/QJsonArray>
#include <QtCore/QJsonObject>
#include <QtCore/QLibrary>
#include <QtCore/QPluginLoader>
#include <QtCore/QString>
#include <QtGui/QGenericPlugin>
#include <qpa/qplatformintegrationplugin.h>

#include <cstdio>

namespace {

bool fail(const QString &message)
{
    const QByteArray utf8 = message.toUtf8();
    std::fprintf(stderr, "%s\n", utf8.constData());
    std::fflush(stderr);
    return false;
}

} // namespace

int main(int argc, char *argv[])
{
    if (argc != 2 && argc != 3) {
        fail(QStringLiteral("Expected the built QPA proxy path and optional generic plugin path."));
        return 1;
    }

    QPluginLoader loader(QString::fromLocal8Bit(argv[1]));
    loader.setLoadHints(
        loader.loadHints() | QLibrary::PreventUnloadHint);

    const QJsonObject metadata = loader.metaData();
    const QJsonArray keys = metadata
        .value(QStringLiteral("MetaData"))
        .toObject()
        .value(QStringLiteral("Keys"))
        .toArray();
    if (metadata.value(QStringLiteral("IID")).toString()
            != QString::fromLatin1(
                QPlatformIntegrationFactoryInterface_iid)
        || keys.size() != 1
        || keys.at(0).toString() != QStringLiteral("windows")) {
        fail(QStringLiteral("Built QPA proxy metadata contract mismatch."));
        return 1;
    }

    QObject *const instance = loader.instance();
    if (instance == nullptr) {
        fail(
            QStringLiteral("Could not load built QPA proxy: %1")
                .arg(loader.errorString()));
        return 1;
    }
    if (qobject_cast<QPlatformIntegrationPlugin *>(instance)
        == nullptr) {
        fail(
            QStringLiteral(
                "Built QPA proxy does not implement QPlatformIntegrationPlugin."));
        return 1;
    }

    if (argc == 3) {
        QPluginLoader generic(QString::fromLocal8Bit(argv[2]));
        generic.setLoadHints(generic.loadHints() | QLibrary::PreventUnloadHint);
        const QJsonObject genericMetadata = generic.metaData();
        const QJsonArray genericKeys = genericMetadata
            .value(QStringLiteral("MetaData")).toObject()
            .value(QStringLiteral("Keys")).toArray();
        if (genericMetadata.value(QStringLiteral("IID")).toString()
                != QString::fromLatin1(QGenericPluginFactoryInterface_iid)
            || genericKeys.size() != 1
            || genericKeys.at(0).toString() != QStringLiteral("cavalryi18n")) {
            fail(QStringLiteral("Built generic plugin metadata contract mismatch."));
            return 1;
        }
        auto *factory = qobject_cast<QGenericPlugin *>(generic.instance());
        if (factory == nullptr) {
            fail(QStringLiteral("Could not load built generic plugin: %1").arg(generic.errorString()));
            return 1;
        }
        // These invalid requests must stop before constructing any runtime.
        for (const QString &language : {QString(), QStringLiteral(" zh-Hans"), QStringLiteral("unknown")}) {
            QObject *runtime = factory->create(QStringLiteral("cavalryi18n"), language);
            if (runtime != nullptr) {
                delete runtime;
                fail(QStringLiteral("Built generic plugin accepted invalid language specification."));
                return 1;
            }
        }
        QObject *runtime = factory->create(QStringLiteral("unknown"), QStringLiteral("zh-Hans"));
        if (runtime != nullptr) {
            delete runtime;
            fail(QStringLiteral("Built generic plugin accepted unknown factory key."));
            return 1;
        }
        std::puts("PASS: product QPA + generic DLL metadata, dynamic loading, factory types and invalid activation gate; no host hooks invoked");
    } else {
        std::puts("PASS: product QPA DLL metadata, dynamic loading and platform factory type; no platform created");
    }
    return 0;
}
