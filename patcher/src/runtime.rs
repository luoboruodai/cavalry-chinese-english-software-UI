//! 运行时文件：CavalryLauncher shell 包装脚本、语言 marker、本工具安装清单。

use std::path::Path;

use crate::error::Result;
use crate::json::Json;
use crate::util;

pub const INJECTOR_DYLIB_NAME: &str = "libCavalryTranslatorInjector.dylib";
pub const WRAPPER_EXECUTABLE_NAME: &str = "CavalryLauncher";
pub const LANG_MARKER_NAME: &str = "cavalry-i18n-lang.txt";
pub const BILINGUAL_MANIFEST_NAME: &str = "cavalry-bilingual.json";

/// CavalryLauncher shell 包装器（移植自 Cavalry-i18n mac_runtime::build_launch_wrapper，
/// 去掉 Tauri 版的事务 journal 门控；保留 DYLD 混合所有权的剥离/去重逻辑）。
pub fn build_launch_wrapper() -> String {
    format!(
        r#"#!/bin/sh
set -eu
SELF_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
APP_ROOT="$(CDPATH= cd -- "$SELF_DIR/.." && pwd)"
LANG_FILE="$APP_ROOT/Resources/{LANG_MARKER_NAME}"
INJECTOR_PATH="$APP_ROOT/Frameworks/{INJECTOR_DYLIB_NAME}"
LANG_CODE=""
if [ -f "$LANG_FILE" ]; then
  LANG_CODE="$(tr -d '\n' < "$LANG_FILE")"
fi
# CAVALRY_I18N_LANG 由本 wrapper 独占，绝不继承调用方的值；
# DYLD_INSERT_LIBRARIES 为混合所有：仅移除本 injector 这一项，
# 保留并去重调用者的其它注入项（保持原顺序）。
strip_owned_injector() {{
  value="${{1-}}"
  result=""
  while [ -n "$value" ]; do
    case "$value" in
      *:*)
        entry="${{value%%:*}}"
        value="${{value#*:}}"
        ;;
      *)
        entry="$value"
        value=""
        ;;
    esac
    [ -n "$entry" ] || continue
    [ "$entry" = "$INJECTOR_PATH" ] && continue
    case ":$result:" in
      *":$entry:"*) continue ;;
    esac
    if [ -n "$result" ]; then
      result="$result:$entry"
    else
      result="$entry"
    fi
  done
  printf '%s' "$result"
}}
EXTERNAL_DYLD="$(strip_owned_injector "${{DYLD_INSERT_LIBRARIES-}}")"
if [ -f "$INJECTOR_PATH" ] && {{ [ "$LANG_CODE" = "zh-Hans" ] || [ "$LANG_CODE" = "zh-Hant" ] || [ "$LANG_CODE" = "ja_JP" ]; }}; then
  if [ -n "$EXTERNAL_DYLD" ]; then
    export DYLD_INSERT_LIBRARIES="$INJECTOR_PATH:$EXTERNAL_DYLD"
  else
    export DYLD_INSERT_LIBRARIES="$INJECTOR_PATH"
  fi
  export CAVALRY_I18N_LANG="$LANG_CODE"
else
  if [ -n "$EXTERNAL_DYLD" ]; then
    export DYLD_INSERT_LIBRARIES="$EXTERNAL_DYLD"
  else
    unset DYLD_INSERT_LIBRARIES
  fi
  unset CAVALRY_I18N_LANG
fi
exec "$SELF_DIR/Cavalry" "$@"
"#
    )
}

/// 写入 Contents/MacOS/CavalryLauncher（755）。
pub fn install_launch_wrapper(app_root: &Path) -> Result<()> {
    let target = app_root
        .join("Contents/MacOS")
        .join(WRAPPER_EXECUTABLE_NAME);
    util::atomic_write_with_mode(&target, build_launch_wrapper().as_bytes(), Some(0o755))?;
    Ok(())
}

pub fn language_marker_bytes(lang: &str) -> Vec<u8> {
    format!("{lang}\n").into_bytes()
}

/// 本工具的安装清单：{"version": <crate 版本>, "lang": <lang>, "installedAt": <rfc3339>}。
pub fn bilingual_manifest_json(version: &str, lang: &str, installed_at: &str) -> Json {
    Json::Obj(vec![
        ("version".to_string(), Json::str(version)),
        ("lang".to_string(), Json::str(lang)),
        (
            "installedAt".to_string(),
            Json::str(installed_at.to_string()),
        ),
    ])
}

#[cfg(test)]
mod tests {
    use super::{bilingual_manifest_json, build_launch_wrapper, LANG_MARKER_NAME};

    #[test]
    fn wrapper_matches_runtime_contract() {
        let wrapper = build_launch_wrapper();
        assert!(wrapper.contains("DYLD_INSERT_LIBRARIES"));
        assert!(wrapper.contains("CAVALRY_I18N_LANG"));
        assert!(wrapper.contains(LANG_MARKER_NAME));
        assert!(wrapper.starts_with("#!/bin/sh"));
        assert!(wrapper.contains("exec \"$SELF_DIR/Cavalry\" \"$@\""));
    }

    #[test]
    fn manifest_has_stable_shape() {
        let json = bilingual_manifest_json("0.1.0", "zh-Hans", "2026-09-15T08:00:00Z");
        assert_eq!(
            json.render(),
            "{\"version\":\"0.1.0\",\"lang\":\"zh-Hans\",\"installedAt\":\"2026-09-15T08:00:00Z\"}"
        );
    }
}
