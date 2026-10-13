#pragma once
// Display-only projection. The platform must provide the exact verified primary label,
// not merely a QLabel with an AttrControlRowLayout somewhere in its ancestry.
#include <QtCore/QVariant>
#include <QtWidgets/QLabel>
#include <QtGui/QFontMetrics>
#include <QtGui/QTextDocument>

namespace cavalry_bilingual {
inline int attributeColumnMinimum(QLabel *primary, QWidget *owner, const QString &full) {
    if (!primary || !owner || !owner->parentWidget()) return 0;
    const int budget = qMin(260, owner->parentWidget()->width() / 2);
    const int chrome = qMax(32, owner->width() - primary->width());
    return qMin(budget, primary->fontMetrics().horizontalAdvance(full) + chrome + 8);
}

inline bool projectAttributeLabel(QLabel *candidate, QWidget *owner, QLabel *primary,
                                  const QString &full) {
    if (!candidate || !owner || candidate != primary || !owner->isAncestorOf(candidate) ||
        full.isEmpty() || full.size() > 512) return false;

    constexpr const char *lastTip = "cb.attribute.lastTooltip";
    constexpr const char *vendorTip = "cb.attribute.vendorTooltip";
    const auto previous = candidate->property(lastTip);
    // Keep the vendor's explanatory help, including changes when a row is rebound.
    if (!previous.isValid() || candidate->toolTip() != previous.toString())
        candidate->setProperty(vendorTip, candidate->toolTip());
    QString help = candidate->property(vendorTip).toString();
    if (help.isEmpty() && owner->parentWidget()) help = owner->parentWidget()->toolTip();
    if (Qt::mightBeRichText(help)) { QTextDocument document; document.setHtml(help); help=document.toPlainText(); }
    QString tip = QStringLiteral("<qt><b>%1</b>").arg(full.toHtmlEscaped());
    if (!help.isEmpty() && help != full)
        tip += QStringLiteral("<br/>%1").arg(help.toHtmlEscaped());
    tip += QStringLiteral("</qt>");
    if (candidate->toolTip() != tip) candidate->setToolTip(tip);
    if (previous.toString() != tip) candidate->setProperty(lastTip, tip);

    // Fit the real allocation, never force the label over connection icons or editors.
    // Full text remains available through the native delayed tooltip even in a narrow pane.
    const int width = qMax(0, candidate->contentsRect().width() - 2 * candidate->margin());
    const QString display = candidate->fontMetrics().elidedText(full, Qt::ElideRight, width);
    if (candidate->textFormat() != Qt::PlainText) candidate->setTextFormat(Qt::PlainText);
    if (candidate->text() != display) candidate->setText(display);
    return true;
}
} // namespace cavalry_bilingual
