#pragma once
// Public Qt APIs only. No mutation of model identity, user text or font files.
#include <QFile>
#include <QCoreApplication>
#include <QJsonDocument>
#include <QJsonObject>
#include <QtGui/QFontDatabase>
#include <QtGui/QFont>
#include <QRegularExpression>
#include <QtWidgets/QWidget>
#include <QtWidgets/QAbstractButton>
#include <QtWidgets/QPushButton>
#include <QtWidgets/QToolButton>
#include <QtWidgets/QTabBar>
#include <QtWidgets/QComboBox>
#include <QtWidgets/QLayout>
#include <memory>
#include <map>
#include <mutex>
#include <vector>

namespace cavalry_bilingual {
struct Settings { QString pattern = QStringLiteral("{zh}（{en}）"); QString zhFont, enFont; };
inline const Settings &settings() {
    static const Settings value = [] {
        Settings result;
        auto path = QString::fromUtf8(qgetenv("CAVALRY_BILINGUAL_CONFIG"));
#ifdef Q_OS_WIN
        if (path.isEmpty() && QCoreApplication::instance())
            path = QCoreApplication::applicationDirPath() + QStringLiteral("/cavalry-bilingual-settings.json");
#endif
        QFile file(path);
        if (!file.fileName().isEmpty() && file.open(QIODevice::ReadOnly) && file.size() <= 8192) {
            const auto doc = QJsonDocument::fromJson(file.readAll());
            const auto object = doc.object();
            if (object.value("schemaVersion").toInt() == 1) {
                const auto pattern = object.value("template").toString();
                auto literal = pattern; literal.remove("{zh}"); literal.remove("{en}");
                if (pattern.count("{zh}") == 1 && pattern.count("{en}") == 1 && pattern.size() <= 80 &&
                    !literal.contains(QRegularExpression(QStringLiteral("[{}<>%&\\x00-\\x1f]")))) result.pattern = pattern;
                // Windows QPA creates the translator during QGuiApplication construction.
                // Do not touch QFontDatabase/platform integration here; resolve fonts at first UI use.
                const auto validFamily = [](const QString &name) { return name.size() <= 100 && !name.contains(QRegularExpression(QStringLiteral("[<>\";\\x00-\\x1f]"))); };
                const auto zh = object.value("zhFont").toString();
                const auto en = object.value("enFont").toString();
                if (validFamily(zh)) result.zhFont = zh;
                if (validFamily(en)) result.enFont = en;
            }
        }
        return result;
    }();
    return value;
}
inline bool hasCjk(const QString &text) {
    for (auto c : text) { const auto u = c.unicode(); if ((u >= 0x3400 && u <= 0x9fff) || (u >= 0xf900 && u <= 0xfaff)) return true; }
    return false;
}
inline QString format(const QString &source, const QString &translation, const QString &pattern) {
    if (source.isEmpty() || source == translation || !hasCjk(translation)) return translation;
    // Substitute tokens in the template, not in source/translation (which may themselves contain braces).
    QString out;
    for (int i = 0; i < pattern.size();) {
        if (pattern.mid(i, 4) == "{zh}") { out += translation; i += 4; }
        else if (pattern.mid(i, 4) == "{en}") { out += source; i += 4; }
        else { out += pattern[i++]; }
    }
    return out;
}
template <typename Entry> const Entry *entries(const Entry *source, int count) {
    struct Table { std::vector<QByteArray> strings; std::vector<Entry> entries; };
    static std::mutex lock;
    static std::map<const Entry *, std::unique_ptr<Table>> tables;
    std::lock_guard<std::mutex> guard(lock);
    auto &table = tables[source];
    if (!table) {
        table = std::make_unique<Table>(); table->strings.reserve(count); table->entries.reserve(count);
        for (int i = 0; i < count; ++i) {
            table->strings.push_back(format(QString::fromUtf8(source[i].sourceText), QString::fromUtf8(source[i].translation), settings().pattern).toUtf8());
            auto entry = source[i]; entry.translation = table->strings.back().constData(); table->entries.push_back(entry);
        }
    }
    return table->entries.data();
}
inline QFont displayFont(QFont font) {
    // NoFontMerging disables CJK fallback and causes tofu even for user-owned names.
    font.setStyleStrategy(static_cast<QFont::StyleStrategy>((int(font.styleStrategy()) & ~int(QFont::NoFontMerging)) | int(QFont::PreferDefault)));
    QStringList families;
    const auto &config = settings();
    if (!config.enFont.isEmpty()) families << config.enFont;
    if (!config.zhFont.isEmpty()) families << config.zhFont;
    families << font.families(); families.removeDuplicates();
    font.setFamilies(families);
    return font;
}
inline void polishWidget(QWidget *widget) {
    if (!widget) return;
    const auto oldFont = widget->font();
    const auto font = displayFont(oldFont);
    if (font != oldFont) widget->setFont(font);
    if (auto tabs = qobject_cast<QTabBar *>(widget)) {
        tabs->setUsesScrollButtons(true); tabs->setElideMode(Qt::ElideNone);
    }
    if (auto button = qobject_cast<QAbstractButton *>(widget)) {
        const auto text = button->text();
        if (hasCjk(text) && text.contains(QRegularExpression("[A-Za-z]"))) {
            button->setToolTip(text);
            // Never expand icon-only toggles or viewport geometry; text buttons can ask their layout for space.
            // Toolbars must remain compressible: expanding every text tool button
            // forces the entire Cavalry window wider than the physical display.
            if (qobject_cast<QPushButton *>(button)) {
                const auto hint = button->sizeHint();
                if (hint.isValid()) {
                    if (button->maximumWidth() < hint.width()) button->setMaximumWidth(QWIDGETSIZE_MAX);
                    button->setMinimumWidth(hint.width());
                    button->updateGeometry();
                }
            }
        }
    }
}
} // namespace cavalry_bilingual
