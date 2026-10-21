#!/usr/bin/env bash
# Build the separate Cavalry 2.8 / Qt 6.9.2 injector without replacing the 2.7 runtime.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
QT_PREFIX="${CAVALRY_QT_280_PREFIX:-$ROOT/../tools-local/qt-280/6.9.2/macos}"
FRAMEWORKS="${CAVALRY_280_FRAMEWORKS:-/Applications/Cavalry 2.8.app/Contents/Frameworks}"
if [ ! -d "$FRAMEWORKS" ]; then
  FRAMEWORKS="$QT_PREFIX/lib"
fi
CAVALRY_QT_PREFIX="$QT_PREFIX" \
CAVALRY_QT_VERSION="${CAVALRY_QT_280_VERSION:-6.9.2}" \
CAVALRY_I18N_CAVALRY_280=1 \
bash "$ROOT/tools/build_translator_injector.sh" \
  "$ROOT/dist/libCavalryTranslatorInjector-280.dylib" \
  "$FRAMEWORKS"
