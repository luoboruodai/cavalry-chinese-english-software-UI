#!/bin/bash
set -euo pipefail
: "${CAVALRY_QT_PREFIX:?Set CAVALRY_QT_PREFIX to the Qt 6.6.3 SDK}"
OUT="${CB_TEST_OUTPUT:-$(mktemp -d)}"
mkdir -p "$OUT"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
QT="$CAVALRY_QT_PREFIX/lib"
FLAGS=(-include "$ROOT/injector/cavalry_bilingual_qt_compat.h")
case "${CB_TEST_ARCH:-}" in
  "") ;;
  arm64|x86_64) FLAGS+=(-arch "$CB_TEST_ARCH") ;;
  *) echo "CB_TEST_ARCH must be arm64 or x86_64" >&2; exit 1 ;;
esac
echo "Qt fixture host=$(uname -m), requested=${CB_TEST_ARCH:-host}; translated execution is not native hardware acceptance"

node "$ROOT/tools/prepare_runtime.js"
clang++ "${FLAGS[@]}" -std=c++17 -DQT_NO_VERSION_TAGGING "$ROOT/tests/qt_runtime.cpp" -o "$OUT/qt-runtime-test" -F"$QT" -I"$QT/QtCore.framework/Headers" -framework QtWidgets -framework QtGui -framework QtCore -Wl,-rpath,"$QT"
QT_QPA_PLATFORM=offscreen "$OUT/qt-runtime-test" '{zh}（{en}）' "$OUT/qt-default-fonts.png"
printf '%s' '{"schemaVersion":1,"template":"{en} / {zh}","zhFont":"PingFang SC","enFont":"Arial"}' > "$OUT/qt-settings.json"
QT_QPA_PLATFORM=offscreen CAVALRY_BILINGUAL_CONFIG="$OUT/qt-settings.json" "$OUT/qt-runtime-test" '{en} / {zh}' "$OUT/qt-custom-fonts.png"
printf '%s' '{"schemaVersion":99,"template":"{en}"}' > "$OUT/qt-settings.json"
QT_QPA_PLATFORM=offscreen CAVALRY_BILINGUAL_CONFIG="$OUT/qt-settings.json" "$OUT/qt-runtime-test" '{zh}（{en}）'
clang++ "${FLAGS[@]}" -std=c++17 -DQT_NO_VERSION_TAGGING "$ROOT/tests/attribute_label.cpp" -o "$OUT/attribute-label-test" -F"$QT" -I"$QT/QtCore.framework/Headers" -framework QtWidgets -framework QtGui -framework QtCore -Wl,-rpath,"$QT"
QT_QPA_PLATFORM=offscreen "$OUT/attribute-label-test"
clang++ "${FLAGS[@]}" -std=c++17 -DQT_NO_VERSION_TAGGING "$ROOT/tests/input_value.cpp" -o "$OUT/input-value-test" -F"$QT" -I"$QT/QtCore.framework/Headers" -framework QtWidgets -framework QtGui -framework QtCore -Wl,-rpath,"$QT"
QT_QPA_PLATFORM=offscreen "$OUT/input-value-test"
"$CAVALRY_QT_PREFIX/libexec/moc" "$ROOT/tests/settings_ui.cpp" -o "$OUT/settings_ui.moc"
clang++ "${FLAGS[@]}" -std=c++17 -DQT_NO_VERSION_TAGGING "$ROOT/tests/settings_ui.cpp" -o "$OUT/settings-ui-test" -I"$OUT" -F"$QT" -I"$QT/QtCore.framework/Headers" -framework QtWidgets -framework QtGui -framework QtCore -Wl,-rpath,"$QT"
QT_QPA_PLATFORM=offscreen "$OUT/settings-ui-test"
