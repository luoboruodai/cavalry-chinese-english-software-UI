#pragma once
// [INPUT]: Public Qt 6.6.3 widgets, exact macOS settings owners and installed translations.
// [OUTPUT]: Scoped settings labels/enum display and queued layout repair; no scene/input writes.
// [POS]: macOS ordinary-Qt settings adapter. Windows is not enabled without host evidence.
// [PROTOCOL]: Keep injector/CLAUDE.md and the synthetic + real-host checks in sync.
#include "cavalry_i18n_input_policy.h"
#include <QtCore/QPointer>
#include <QtCore/QSignalBlocker>
#include <QtCore/QTimer>
#include <QtGui/QScreen>
#include <QtWidgets/QLabel>
#include <QtWidgets/QLayout>
#include <QtWidgets/QHBoxLayout>
#include <QtWidgets/QWidget>
#include <algorithm>
#include <cstring>
#include <functional>

namespace cavalry_bilingual {
using SettingsTranslation = std::function<QString(const char *, const char *)>;
inline bool exactSettingsClass(const QObject *object, const char *name) {
    return object && std::strcmp(object->metaObject()->className(), name) == 0;
}
inline QWidget *settingsAncestor(QWidget *widget, const char *name) {
    for (auto *current = widget; current; current = current->parentWidget())
        if (exactSettingsClass(current, name)) return current;
    return nullptr;
}
inline bool settingsTextMatches(const QString &text, const char *source,
                                const SettingsTranslation &translate) {
    if (text == QString::fromUtf8(source)) return true;
    const auto display = translate("MenuBarManager", source);
    return !display.isEmpty() && text == display;
}

// Qt reparents every widget in nested layouts to the same container. A parent
// match is not a row match; inspect the owning HBox items instead of sibling counts.
inline bool autosaveFolderRow(QLayout *layout, const QComboBox *combo,
                              const SettingsTranslation &translate, int depth = 0) {
    if (!layout || depth > 8) return false;
    bool ownsCombo = false;
    int labels = 0, combos = 0;
    for (int i = 0; i < layout->count(); ++i) {
        auto *item = layout->itemAt(i);
        if (!item) continue;
        ownsCombo |= item->widget() == combo;
        combos += qobject_cast<QComboBox *>(item->widget()) != nullptr;
        if (const auto *label = qobject_cast<QLabel *>(item->widget()))
            labels += settingsTextMatches(label->text(), "Autosave Folders", translate);
    }
    if (qobject_cast<QHBoxLayout *>(layout) && ownsCombo && combos == 1 && labels == 1) return true;
    for (int i = 0; i < layout->count(); ++i) {
        if (auto *item = layout->itemAt(i); item && item->layout() &&
            autosaveFolderRow(item->layout(), combo, translate, depth + 1)) return true;
    }
    return false;
}

// The only short enum supported here is the observed Autosave Folders setting.
// The reviewed 2.7.2 producer commits currentIndex via an int slot (not currentText).
// Require its exact four-item schema and empty UserRole; do not generalize to other enums.
inline bool translateAutosaveFolderOff(QComboBox *combo, const SettingsTranslation &translate, bool vendorVerified) {
    if (!vendorVerified || !combo || !exactSettingsClass(combo, "ComboBox") ||
        cavalry_i18n::preservesSelectionValue(combo) ||
        !settingsAncestor(combo, "PreferencesWindow") || !combo->parentWidget()) return false;
    if (!autosaveFolderRow(combo->parentWidget()->layout(), combo, translate)) return false;
    const auto off = translate("BilingualPreferences", "Off");
    if (off.isEmpty() || combo->count() != 4 ||
        (combo->itemText(0) != QStringLiteral("Off") && combo->itemText(0) != off)) return false;
    const QStringList formats = {QStringLiteral("Weekday-Day-Month-Year"),
        QStringLiteral("Weekday-Month-Day-Year"), QStringLiteral("Year-Month-Day-Weekday")};
    for (int i = 0; i < combo->count(); ++i) {
        if (combo->itemData(i, Qt::UserRole).isValid()) return false;
        if (i > 0 && combo->itemText(i) != formats[i - 1]) return false;
    }
    bool changed = false;
    const QSignalBlocker blocker(combo);
    for (int i = 0; i < combo->count(); ++i) {
        if (combo->itemText(i) == QStringLiteral("Off")) {
            combo->setItemText(i, off);
            changed = true;
        }
    }
    return changed;
}

inline bool isViewportSettingsPopup(QWidget *popup, const SettingsTranslation &translate) {
    if (!exactSettingsClass(popup, "PopOverView") ||
        !settingsAncestor(popup->parentWidget(), "GraphicsViewportWindow")) return false;
    const auto labels = popup->findChildren<QLabel *>();
    for (const char *source : {"Viewport Quality", "Viewport Tool Help", "Show Drawables"}) {
        if (std::count_if(labels.begin(), labels.end(), [&](const QLabel *label) {
            return settingsAncestor(label->parentWidget(), "PopOverView") == popup &&
                   settingsTextMatches(label->text(), source, translate);
        }) != 1) return false;
    }
    return true;
}
inline bool isViewportSettingLabel(const QLabel *label, const SettingsTranslation &translate) {
    for (const char *source : {"Viewport Quality", "Display Color Space", "Layer Tools",
                              "Draw Debug Information", "Show FPS in Playback", "Viewport Tool Help",
                              "Show Drawables", "Shape Depth Debug"})
        if (settingsTextMatches(label->text(), source, translate)) return true;
    return false;
}
inline bool growSettingsWidth(QWidget *widget, int wanted, int limit) {
    wanted = qMin(wanted, limit);
    if (wanted <= widget->minimumWidth()) return false;
    if (widget->maximumWidth() < wanted) widget->setMaximumWidth(QWIDGETSIZE_MAX);
    widget->setMinimumWidth(wanted);
    widget->updateGeometry();
    return true;
}
inline int settingsLabelWidth(const QLabel *label) {
    return label->fontMetrics().horizontalAdvance(label->text()) +
           2 * label->margin() + qMax(0, label->indent()) + 4;
}
inline void growSettingsAncestors(QWidget *start, QWidget *stop, int limit) {
    for (auto *current = start; current && current != stop; current = current->parentWidget()) {
        if (auto *layout = current->layout()) {
            layout->invalidate();
            growSettingsWidth(current, layout->totalMinimumSize().width(), limit);
        }
    }
}
// Only called outside Paint in a coalesced event-loop callback. Never reparent controls
// or alter the vendor popup's event filter, modality, focus, actions or numeric fields.
inline bool repairViewportSettingsPopup(QWidget *popup, const SettingsTranslation &translate) {
    if (!isViewportSettingsPopup(popup, translate)) return false;
    const auto screen = popup->screen();
    if (!screen) return false;
    const QRect available = screen->availableGeometry().adjusted(8, 8, -8, -8);
    const int limit = qMax(64, available.width());
    const QRect originalGeometry = popup->geometry();
    bool changed = false;
    for (auto *label : popup->findChildren<QLabel *>()) {
        if (settingsAncestor(label->parentWidget(), "PopOverView") != popup ||
            !isViewportSettingLabel(label, translate)) continue;
        // Full label is still available if an unusually narrow screen cannot fit the row.
        if (label->toolTip().isEmpty()) label->setToolTip(label->text());
        changed |= growSettingsWidth(label, settingsLabelWidth(label), qMax(32, limit / 2));
        growSettingsAncestors(label->parentWidget(), popup, limit);
    }
    if (auto *layout = popup->layout()) {
        layout->invalidate();
        const int wanted = qMin(limit, layout->totalMinimumSize().width());
        changed |= growSettingsWidth(popup, wanted, limit);
        if (popup->width() < wanted) popup->resize(wanted, popup->height());
        if (popup->width() != originalGeometry.width()) {
            // Preserve the right-side anchor, but keep the actual popup inside this screen.
            popup->move(qBound(available.left(), originalGeometry.right() - popup->width() + 1,
                               available.right() - popup->width() + 1), originalGeometry.top());
            changed = true;
        }
    }
    return changed;
}
inline bool repairPreferenceCacheButton(QWidget *preferences, const SettingsTranslation &translate) {
    if (!exactSettingsClass(preferences, "PreferencesWindow")) return false;
    bool changed = false;
    for (auto *label : preferences->findChildren<QLabel *>()) {
        if (!settingsTextMatches(label->text(), "Minimise Cache", translate) ||
            !exactSettingsClass(label->parentWidget(), "GroupButton") ||
            settingsAncestor(label, "PreferencesWindow") != preferences) continue;
        auto *button = label->parentWidget();
        if (button->findChildren<QLabel *>().size() != 1) continue;
        const int labelWidth = settingsLabelWidth(label);
        changed |= growSettingsWidth(label, labelWidth, 800);
        if (auto *layout = button->layout()) layout->invalidate();
        const int desired = qMax(labelWidth + 32, button->layout() ? button->layout()->totalMinimumSize().width() : 0);
        changed |= growSettingsWidth(button, desired, 832);
        if (label->toolTip().isEmpty()) label->setToolTip(label->text());
    }
    return changed;
}
inline void scheduleSettingsLayout(QWidget *widget, const SettingsTranslation &translate) {
    QWidget *owner = settingsAncestor(widget, "PopOverView");
    if (owner && !isViewportSettingsPopup(owner, translate)) return;
    if (!owner) owner = settingsAncestor(widget, "PreferencesWindow");
    if (!owner || owner->property("cb.settings.layoutPending").toBool()) return;
    owner->setProperty("cb.settings.layoutPending", true);
    QPointer<QWidget> guarded(owner);
    QTimer::singleShot(0, owner, [guarded, translate]() {
        if (!guarded) return;
        // Keep pending true through mutations to avoid recursively queueing ourselves.
        repairViewportSettingsPopup(guarded, translate);
        repairPreferenceCacheButton(guarded, translate);
        guarded->setProperty("cb.settings.layoutPending", false);
    });
}
} // namespace cavalry_bilingual
