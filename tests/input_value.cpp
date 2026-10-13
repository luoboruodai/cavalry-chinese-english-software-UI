// QLineEdit text is a commit value, not display-only UI. No Cavalry is opened.
#include "../injector/cavalry_i18n_input_policy.h"
#include <QtWidgets/QApplication>
#include <QtWidgets/QStyledItemDelegate>
#include <QtWidgets/QTreeView>
#include <QtGui/QStandardItemModel>
#include <QtGui/QKeyEvent>
#include <cassert>
#include <cstdio>
int main(int argc,char **argv) {
    QApplication app(argc,argv);
    using namespace cavalry_i18n;
    for (const auto &text : {QStringLiteral("Rectangle Pattern"),QStringLiteral("Position"),
            QStringLiteral("矩形图案（Rectangle Pattern）"),QStringLiteral("Rotation [1.Position]"),
            QStringLiteral("/project/Position.cv"),QStringLiteral("width * 2"),QString()}) {
        for (bool readOnly:{false,true}) {
            QLineEdit edit;edit.setText(text);edit.setReadOnly(readOnly);
            edit.setPlaceholderText("Layer name");edit.setCursorPosition(text.size()/2);edit.setModified(true);
            edit.setSelection(0,qMin(3,text.size()));
            const auto cursor=edit.cursorPosition();const auto selected=edit.selectedText();
            int changes=0;QObject::connect(&edit,&QLineEdit::textChanged,[&]{++changes;});
            assert(setTranslatedPlaceholder(&edit,QStringLiteral("图层名称（Layer name）")));
            assert(!setTranslatedPlaceholder(&edit,QStringLiteral("图层名称（Layer name）")));
            assert(!setTranslatedPlaceholder(&edit,QString()));
            assert(edit.text()==text && changes==0 && edit.isModified());
            assert(edit.cursorPosition()==cursor && edit.selectedText()==selected);
            // Prove what a delegate commits after translation, not just signals.
            QStandardItemModel model(1,1);QStyledItemDelegate delegate;
            delegate.setModelData(&edit,&model,model.index(0,0));
            assert(model.data(model.index(0,0),Qt::EditRole).toString()==text);
        }
    }
    QComboBox editable;editable.setEditable(true);editable.setEditText("Arial");
    assert(preservesSelectionValue(editable.lineEdit()));
    setTranslatedPlaceholder(editable.lineEdit(),QStringLiteral("字体（Font）"));
    assert(editable.currentText()=="Arial");
    QStandardItem item("Position");assert(preservesEditableItemValue(item.flags()));
    item.setEditable(false);assert(!preservesEditableItemValue(item.flags()));
    assert(!setTranslatedPlaceholder(nullptr,QStringLiteral("test")));
    puts("PASS: 14 input/delegate-commit cases, selection/cursor/modified state, editable items and font values preserved");
}
