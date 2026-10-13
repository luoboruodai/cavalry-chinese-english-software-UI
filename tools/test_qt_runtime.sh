#!/bin/bash
set -euo pipefail
: "${CAVALRY_QT_PREFIX:?Set CAVALRY_QT_PREFIX to the Qt 6.6.3 SDK}"
OUT="${CB_TEST_OUTPUT:-$(mktemp -d)}"
mkdir -p "$OUT"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
QT="$CAVALRY_QT_PREFIX/lib"
node "$ROOT/tools/prepare_runtime.js"
clang++ -std=c++17 -DQT_NO_VERSION_TAGGING "$ROOT/tests/qt_runtime.cpp" -o "$OUT/qt-runtime-test" -F"$QT" -I"$QT/QtCore.framework/Headers" -framework QtWidgets -framework QtGui -framework QtCore -Wl,-rpath,"$QT"
QT_QPA_PLATFORM=offscreen "$OUT/qt-runtime-test" '{zh}（{en}）' "$OUT/qt-default-fonts.png"
printf '%s' '{"schemaVersion":1,"template":"{en} / {zh}","zhFont":"PingFang SC","enFont":"Arial"}' > "$OUT/qt-settings.json"
QT_QPA_PLATFORM=offscreen CAVALRY_BILINGUAL_CONFIG="$OUT/qt-settings.json" "$OUT/qt-runtime-test" '{en} / {zh}' "$OUT/qt-custom-fonts.png"
printf '%s' '{"schemaVersion":99,"template":"{en}"}' > "$OUT/qt-settings.json"
QT_QPA_PLATFORM=offscreen CAVALRY_BILINGUAL_CONFIG="$OUT/qt-settings.json" "$OUT/qt-runtime-test" '{zh}（{en}）'
clang++ -std=c++17 -DQT_NO_VERSION_TAGGING "$ROOT/tests/attribute_label.cpp" -o "$OUT/attribute-label-test" -F"$QT" -I"$QT/QtCore.framework/Headers" -framework QtWidgets -framework QtGui -framework QtCore -Wl,-rpath,"$QT"
QT_QPA_PLATFORM=offscreen "$OUT/attribute-label-test"
clang++ -std=c++17 -DQT_NO_VERSION_TAGGING "$ROOT/tests/input_value.cpp" -o "$OUT/input-value-test" -F"$QT" -I"$QT/QtCore.framework/Headers" -framework QtWidgets -framework QtGui -framework QtCore -Wl,-rpath,"$QT"
QT_QPA_PLATFORM=offscreen "$OUT/input-value-test"
