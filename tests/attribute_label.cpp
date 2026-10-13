#include "../injector/cavalry_bilingual_attribute_label.h"
#include <QtWidgets/QApplication>
#include <QtWidgets/QLineEdit>
#include <cassert>
#include <cstdio>
int main(int argc, char **argv) {
    QApplication app(argc, argv);
    QWidget owner;
    QLabel primary(&owner), connection(&owner), hint(&owner);
    QLineEdit value(&owner); value.setText("12.5");
    primary.setFixedSize(150,22); primary.setToolTip("Original vendor help < 5");
    connection.setFixedSize(16,16); connection.setText("◀"); hint.setText("X");
    const QString full = QStringLiteral("位置（Position）");
    const auto geometry = primary.geometry(); const auto policy = primary.sizePolicy();
    using cavalry_bilingual::projectAttributeLabel;
    assert(!projectAttributeLabel(&connection,&owner,&primary,full));
    assert(!projectAttributeLabel(&hint,&owner,&primary,full));
    assert(connection.text()=="◀" && hint.text()=="X" && value.text()=="12.5");
    assert(projectAttributeLabel(&primary,&owner,&primary,full));
    assert(primary.text()==full && primary.toolTip().contains(full));
    assert(primary.toolTip().contains("Original vendor help &lt; 5"));
    const auto tip=primary.toolTip();
    for(int i=0;i<100;++i) assert(projectAttributeLabel(&primary,&owner,&primary,full));
    assert(primary.toolTip()==tip && primary.geometry()==geometry && primary.sizePolicy()==policy);
    primary.setFixedWidth(50);
    projectAttributeLabel(&primary,&owner,&primary,full);
    assert(primary.fontMetrics().horizontalAdvance(primary.text())<=50);
    assert(primary.toolTip().contains(full) && primary.width()==50);
    primary.setFixedWidth(200); primary.setToolTip("New help after rebind");
    const QString next=QStringLiteral("旋转（Rotation）");
    projectAttributeLabel(&primary,&owner,&primary,next);
    assert(primary.text()==next && !primary.toolTip().contains(full));
    assert(primary.toolTip().contains("New help after rebind"));
    assert(!projectAttributeLabel(&primary,nullptr,&primary,next));
    assert(!projectAttributeLabel(&primary,&owner,&primary,QString(513,'x')));
    assert(value.text()=="12.5" && connection.minimumWidth()==16);
    QWidget row; row.resize(360,22); owner.setParent(&row); owner.resize(120,22);
    assert(cavalry_bilingual::attributeColumnMinimum(&primary,&owner,next) <= row.width()/2);
    owner.setParent(nullptr);
    printf("PASS: exact label identity, sibling icons, allocated width, idempotency, rebind, vendor help and editor preservation\n");
}
