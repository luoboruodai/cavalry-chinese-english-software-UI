// Synthetic Qt fixtures, not native Cavalry/Windows acceptance.
#include "../injector/cavalry_bilingual_settings_ui.h"
#include "../injector/cavalry_bilingual_runtime.h"
#include "../injector/cavalry_i18n_translation_policy.h"
#include <QtWidgets/QApplication>
#include <QtWidgets/QDialog>
#include <QtWidgets/QHBoxLayout>
#include <QtWidgets/QVBoxLayout>
#include <QtWidgets/QLineEdit>
#include <cassert>
#include <cstdio>
class PreferencesWindow : public QWidget { Q_OBJECT };
class GraphicsViewportWindow : public QWidget { Q_OBJECT };
class GroupButton : public QWidget { Q_OBJECT public: using QWidget::QWidget; };
class PopOverView : public QDialog { Q_OBJECT public: using QDialog::QDialog; };
class ComboBox : public QComboBox { Q_OBJECT public: using QComboBox::QComboBox; };
using namespace cavalry_bilingual;
static QString tr(const char *context, const char *source) {
    const QString s=QString::fromUtf8(source);
    if (QString::fromUtf8(context)=="BilingualPreferences" && s=="Off") return QStringLiteral("关闭（Off）");
    return QStringLiteral("设置选项（")+s+QStringLiteral("）");
}
int main(int argc, char **argv) {
    QApplication app(argc,argv);
    assert(cavalry_i18n::requiresExactTranslationContext("BilingualPreferences","Off"));
    PreferencesWindow prefs;
    QWidget row(&prefs); QHBoxLayout rowLayout(&row);
    QLabel name(tr("MenuBarManager","Autosave Folders")); rowLayout.addWidget(&name);
    ComboBox combo; combo.addItems({"Off", "Weekday-Day-Month-Year", "Weekday-Month-Day-Year", "Year-Month-Day-Weekday"});rowLayout.addWidget(&combo);
    int changes=0, committedIndex=-1;
    QObject::connect(&combo,&QComboBox::currentTextChanged,[&] { ++changes; });
    QObject::connect(&combo,&QComboBox::currentIndexChanged,[&](int index) { committedIndex=index; });
    assert(!translateAutosaveFolderOff(&combo,tr,false));
    assert(translateAutosaveFolderOff(&combo,tr,true));
    assert(combo.currentIndex()==0 && !combo.currentData().isValid() && changes==0 && committedIndex==-1);
    assert(combo.itemText(0)==QStringLiteral("关闭（Off）") && combo.itemText(1)=="Weekday-Day-Month-Year");
    assert(!translateAutosaveFolderOff(&combo,tr,true));
    combo.setCurrentIndex(1);assert(committedIndex==1 && changes==1);
    combo.setCurrentIndex(0);assert(committedIndex==0);
    combo.setItemText(0,"Off");combo.setEditable(true);
    assert(!translateAutosaveFolderOff(&combo,tr,true));assert(combo.currentText()=="Off");
    combo.setEditable(false);combo.setItemData(0,QString("Off"));
    assert(!translateAutosaveFolderOff(&combo,tr,true));
    combo.setItemData(0,QVariant());combo.setItemText(1,"Unknown schema");assert(!translateAutosaveFolderOff(&combo,tr,true));
    combo.setItemText(1,"Weekday-Day-Month-Year");name.setText("Other setting");assert(!translateAutosaveFolderOff(&combo,tr,true));
    name.setText(tr("MenuBarManager","Autosave Folders"));
    row.setParent(nullptr);assert(!translateAutosaveFolderOff(&combo,tr,true));row.setParent(&prefs);
    QLineEdit input(&row);input.setText("Off");
    assert(translateAutosaveFolderOff(&combo,tr,true));assert(input.text()=="Off");

    // Actual Preferences uses nested HBoxes whose widgets all share one parent.
    QWidget flat(&prefs);QVBoxLayout flatLayout(&flat);
    auto *correctRow=new QHBoxLayout;auto *otherRow=new QHBoxLayout;
    flatLayout.addLayout(correctRow);flatLayout.addLayout(otherRow);
    auto *correctLabel=new QLabel(tr("MenuBarManager","Autosave Folders"));
    auto *correctCombo=new ComboBox;auto *otherCombo=new ComboBox;
    for (auto *c:{correctCombo,otherCombo}) c->addItems({"Off","Weekday-Day-Month-Year","Weekday-Month-Day-Year","Year-Month-Day-Weekday"});
    correctRow->addWidget(correctLabel);correctRow->addWidget(correctCombo);
    otherRow->addWidget(new QLabel("Other setting"));otherRow->addWidget(otherCombo);
    assert(correctCombo->parentWidget()==otherCombo->parentWidget());
    assert(translateAutosaveFolderOff(correctCombo,tr,true));
    assert(!translateAutosaveFolderOff(otherCombo,tr,true));
    assert(otherCombo->currentText()=="Off");

    auto *button=new GroupButton(&prefs);auto *buttonLayout=new QHBoxLayout(button);
    auto *title=new QLabel(tr("MenuBarManager","Minimise Cache"));title->setFixedWidth(92);
    buttonLayout->addWidget(title);button->setFixedWidth(112);
    assert(repairPreferenceCacheButton(&prefs,tr));
    assert(title->minimumWidth()>=title->fontMetrics().horizontalAdvance(title->text()));
    assert(button->minimumWidth()>=title->minimumWidth()+32);
    assert(!repairPreferenceCacheButton(&prefs,tr));
    auto *unrelated=new GroupButton(&prefs);auto *other=new QLabel("Arbitrary user title",unrelated);
    other->setFixedWidth(30);repairPreferenceCacheButton(&prefs,tr);assert(other->minimumWidth()==30);

    GraphicsViewportWindow viewport;
    PopOverView popup(&viewport);auto *outer=new QVBoxLayout(&popup);outer->setContentsMargins(24,24,24,24);
    auto *content=new QWidget;auto *stack=new QVBoxLayout(content);content->setFixedWidth(260);outer->addWidget(content);
    QList<QLabel*> labels;QList<QComboBox*> combos;
    for (const char *source:{"Viewport Quality","Viewport Tool Help","Show Drawables","Display Color Space"}) {
        auto *r=new QWidget;auto *layout=new QHBoxLayout(r);layout->setSpacing(8);
        auto *label=new QLabel(tr("MenuBarManager",source));label->setFixedWidth(126);labels.append(label);
        auto *choice=new QComboBox;choice->addItem(QStringLiteral("自动（监视器）（Auto (Monitor)）"),42);
        polishWidget(choice);combos.append(choice);layout->addWidget(label);layout->addWidget(choice);stack->addWidget(r);
    }
    popup.resize(310,200);popup.show();app.processEvents();
    const auto identity=combos[0]->currentData();
    assert(isViewportSettingsPopup(&popup,tr));
    scheduleSettingsLayout(labels[0],tr);scheduleSettingsLayout(labels[1],tr);app.processEvents();app.processEvents();
    assert(!popup.property("cb.settings.layoutPending").toBool());
    for (auto *label:labels) {
        assert(label->width()>=label->fontMetrics().horizontalAdvance(label->text()));
        auto *r=label->parentWidget();auto *choice=r->findChild<QComboBox*>();
        assert(label->geometry().right()<choice->geometry().left());
        assert(choice->geometry().right()<r->width());
    }
    assert(combos[0]->currentData()==identity && combos[0]->currentIndex()==0);
    const auto width=popup.width();assert(!repairViewportSettingsPopup(&popup,tr));assert(popup.width()==width);
    assert(popup.geometry().right()<=popup.screen()->availableGeometry().right());
    popup.setParent(nullptr);assert(!isViewportSettingsPopup(&popup,tr));
    popup.setParent(&viewport);labels[0]->setText("User Viewport Quality");
    assert(!isViewportSettingsPopup(&popup,tr));
    // A queued callback must tolerate deletion without dereferencing freed widgets.
    auto *temporary=new PreferencesWindow;auto *tempLabel=new QLabel("anything",temporary);
    scheduleSettingsLayout(tempLabel,tr);delete temporary;app.processEvents();
    printf("PASS: scoped settings enums, identity/signal preservation, cache label, popup geometry, idempotency and lifetime\n");
}
#include "settings_ui.moc"
