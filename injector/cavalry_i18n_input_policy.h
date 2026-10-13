/**
 * [INPUT]: 依赖 Qt 6.6.3 QObject 父链/类型识别与 QComboBox 的公开 editable 状态
 * [OUTPUT]: 选择值/补全输入保护、只写 placeholder 的 QLineEdit API 及可编辑 item 保护；所有 QLineEdit 的 text 都是提交数据，不得翻译
 * [POS]: injector 双平台共享的输入边界；按控件数据语义保护原值，不按字体名称或译文字典猜测身份
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <QtWidgets/QComboBox>
#include <QtWidgets/QLineEdit>

namespace cavalry_i18n {

// ---- 输入值与展示文案分离 -----------------------------------------------
// Cavalry 的字体族/样式使用 editable Combo；DisplayRole 可能同时是提交值。
// 沿父链覆盖 Qt popup container，不调用 view()，避免在 Paint 中创建控件。
inline bool preservesSelectionValue(const QObject *object)
{
    for (const QObject *current = object; current; current = current->parent()) {
        const auto *combo = qobject_cast<const QComboBox *>(current);
        if (combo && (combo->isEditable() || combo->inherits("QFontComboBox"))) {
            return true;
        }
    }
    return false;
}

// ---- 补全编辑器的值不因构建时序改变语义 -------------------------------
// 父链只决定搜索索引能否挂接，不能决定用户输入能否被翻译。
// 提示文案使用 placeholder；保留 parentless/重挂接期间已有的输入。
inline bool preservesCompleterInputValue(const QObject *object)
{
    return object && object->inherits("CompleterLineEdit");
}

// QSignalBlocker is NOT a data/display boundary: delegates later commit text().
// This is the only shared QLineEdit translation write; it never reads text().
inline bool setTranslatedPlaceholder(QLineEdit *edit, const QString &display) {
    if (!edit || display.isEmpty() || edit->placeholderText() == display) return false;
    edit->setPlaceholderText(display);
    return true;
}
inline bool preservesEditableItemValue(Qt::ItemFlags flags) noexcept {
    return flags.testFlag(Qt::ItemIsEditable);
}

} // namespace cavalry_i18n
