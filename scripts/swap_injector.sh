#!/bin/bash
# swap_injector.sh — 把自构建的注入器 dylib 换入 Cavalry.app 并重启验证（仅本机 M0 spike 用）
# 用法: bash swap_injector.sh <path-to-new-dylib>
set -euo pipefail

DYLIB="${1:?usage: swap_injector.sh <new-dylib-path>}"
APP="/Applications/Cavalry.app"
FW="$APP/Contents/Frameworks"

pgrep -x Cavalry >/dev/null 2>&1 && { osascript -e 'tell application "Cavalry" to quit' || true; sleep 4; pgrep -x Cavalry >/dev/null && pkill -x Cavalry || true; }

# 备份现有 dylib（首次）
if [ ! -f "$DYLIB.bak-dropped" ]; then
  cp "$FW/libCavalryTranslatorInjector.dylib" "$DYLIB.bak-dropped" 2>/dev/null || true
fi

cp "$DYLIB" "$FW/libCavalryTranslatorInjector.dylib"
chmod 755 "$FW/libCavalryTranslatorInjector.dylib"
codesign --sign - --force --deep --timestamp=none "$APP" 2>&1 | tail -1
codesign --verify --no-strict "$APP" && echo "verify OK"
open -a "$APP"
sleep 12
pgrep -x Cavalry >/dev/null && echo "Cavalry RUNNING with $(basename "$DYLIB")" || { echo "LAUNCH FAILED"; exit 1; }
