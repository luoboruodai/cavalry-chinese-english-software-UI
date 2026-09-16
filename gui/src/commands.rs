//! Tauri 命令层：调用 cbpatch::ops，typed summary 以 serde_json 值交给前端，
//! 错误统一转成字符串消息由前端以 #141414/500 字重展示（不用红色）。

use std::fs;
use std::path::{Path, PathBuf};

use serde_json::{json, Value};
use tauri::State;

use cbpatch::backup;
use cbpatch::error::msg;
use cbpatch::ops;
use cbpatch::plist;
use cbpatch::runtime;
use cbpatch::util;
use cbpatch::Result as CbpatchResult;

use crate::GuiState;

fn err_string(error: cbpatch::Error) -> String {
    error.to_string()
}

// ---------------------------------------------------------------------------
// 时间戳与备份目录名解析（与 cbpatch::backup 的目录约定保持一致）
// ---------------------------------------------------------------------------

/// 备份目录名形如 `<version>-<unix_ts>` 或同秒碰撞的 `<version>-<unix_ts>-<counter>`。
fn backup_dir_timestamp(name: &str) -> Option<u64> {
    let parts: Vec<&str> = name.split('-').collect();
    if parts.len() < 2 {
        return None;
    }
    let last = parts.last().and_then(|part| part.parse::<u64>().ok());
    let prev = parts
        .get(parts.len().saturating_sub(2))
        .and_then(|part| part.parse::<u64>().ok());
    match (last, prev) {
        (Some(ts), _) if parts.len() == 2 => Some(ts),
        (Some(_), Some(ts)) => Some(ts),
        _ => None,
    }
}

/// 从目录名解析版本号（去掉尾部 `-<ts>` 与可选 `-<counter>`）。
fn backup_dir_version(name: &str) -> String {
    let mut parts: Vec<&str> = name.split('-').collect();
    if parts.len() >= 2 {
        parts.pop();
    }
    if parts.len() >= 2 && parts.last().is_some_and(|p| p.parse::<u32>().is_ok()) {
        parts.pop();
    }
    parts.join("-")
}

/// unix 秒 → "YYYY-MM-DD HH:MM"。macOS 用系统 `date -r`（本地时区），其余退化为 UTC  civil 换算。
fn format_unix_time(unix_ts: u64) -> String {
    #[cfg(target_os = "macos")]
    if let Ok(output) = util::run(
        "date",
        &[
            "-r".to_string(),
            unix_ts.to_string(),
            "+%Y-%m-%d %H:%M".to_string(),
        ],
    ) {
        if output.success {
            let text = output.stdout.trim().to_string();
            if !text.is_empty() {
                return text;
            }
        }
    }
    format_unix_time_utc(unix_ts)
}

/// std-only 的 civil 日期换算（ Howard Hinnant 算法），仅作非 macOS 兜底。
fn format_unix_time_utc(secs: u64) -> String {
    let days = (secs / 86_400) as i64;
    let sod = secs % 86_400;
    let (hour, minute) = (sod / 3600, (sod % 3600) / 60);
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = if m <= 2 { y + 1 } else { y };
    format!("{year:04}-{m:02}-{d:02} {hour:02}:{minute:02}")
}

/// 扫描备份根下所有带合法时间戳的备份目录，按时间戳降序返回（名称, 路径, 时间戳）。
fn scan_backups(backup_root: &Path) -> Vec<(u64, String, PathBuf)> {
    let mut items = Vec::new();
    if !backup_root.is_dir() {
        return items;
    }
    if let Ok(entries) = fs::read_dir(backup_root) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let name = entry.file_name().to_string_lossy().into_owned();
            if let Some(ts) = backup_dir_timestamp(&name) {
                items.push((ts, name, path));
            }
        }
    }
    items.sort_by(|a, b| b.0.cmp(&a.0));
    items
}

// ---------------------------------------------------------------------------
// composer/bilingual.config.json 读写
// ---------------------------------------------------------------------------

fn read_config(state: &GuiState) -> std::result::Result<Value, String> {
    let text = fs::read_to_string(&state.config_path).map_err(|error| {
        format!("无法读取配置 {}: {error}", state.config_path.display())
    })?;
    serde_json::from_str(&text)
        .map_err(|error| format!("配置 {} 不是合法 JSON: {error}", state.config_path.display()))
}

fn write_config(state: &GuiState, config: &Value) -> std::result::Result<(), String> {
    let mut serialized = serde_json::to_string(config)
        .map_err(|error| format!("序列化配置失败: {error}"))?;
    serialized.push('\n');
    util::atomic_write(&state.config_path, serialized.as_bytes())
        .map_err(|error| format!("写入配置失败: {error}"))
}

fn config_lang(state: &GuiState) -> Option<String> {
    read_config(state)
        .ok()
        .and_then(|config| config.get("lang").and_then(Value::as_str).map(str::to_string))
}

// ---------------------------------------------------------------------------
// restore：cbpatch::ops::restore 只支持「最新备份」，这里复刻其流程并参数化
// 备份目录（GUI 的备份区允许任选一份备份还原）。
// ---------------------------------------------------------------------------

struct RestoreOutcome {
    backup_dir: PathBuf,
    restored: Vec<String>,
    removed: Vec<String>,
}

fn restore_from_dir(app: &Path, backup_dir: &Path) -> CbpatchResult<RestoreOutcome> {
    ops::ensure_cavalry_not_running()?;
    if !app.is_dir() {
        return Err(msg(format!("找不到应用: {}", app.display())));
    }
    if !backup_dir.is_dir() {
        return Err(msg(format!("找不到备份目录: {}", backup_dir.display())));
    }

    let rel_plist = Path::new("Contents/Info.plist");
    let mut restored: Vec<String> = Vec::new();

    // 1. 备份文件按相对路径原子写回（Info.plist 在第 2 步条件处理）。
    for rel in backup::list_backup_files(backup_dir)? {
        if rel == rel_plist {
            continue;
        }
        let src = backup_dir.join(&rel);
        let dst = app.join(&rel);
        let bytes = fs::read(&src)?;
        let mode = util::mode_of(&src)?;
        util::atomic_write_with_mode(&dst, &bytes, mode)?;
        restored.push(rel.to_string_lossy().into_owned());
    }

    // 2. Info.plist：备份里 CFBundleExecutable 是 Cavalry 则写回；否则若 live
    //    仍指向 CavalryLauncher，修正回 Cavalry。
    let backup_plist = backup_dir.join(rel_plist);
    let backup_executable = if backup_plist.is_file() {
        plist::read_string(&backup_plist, "CFBundleExecutable")?
    } else {
        None
    };
    let live_plist = app.join(rel_plist);
    let live_executable = plist::read_string(&live_plist, "CFBundleExecutable")?;
    if backup_executable.as_deref() == Some("Cavalry") {
        let bytes = fs::read(&backup_plist)?;
        let mode = util::mode_of(&backup_plist)?;
        util::atomic_write_with_mode(&live_plist, &bytes, mode)?;
        restored.push(rel_plist.to_string_lossy().into_owned());
    } else if live_executable.as_deref() == Some(runtime::WRAPPER_EXECUTABLE_NAME) {
        plist::set_bundle_executable(app, "Cavalry")?;
    }

    // 3. 移除 vendor 原本没有的文件。
    let mut removed: Vec<String> = Vec::new();
    for rel in [
        Path::new("Contents/MacOS").join(runtime::WRAPPER_EXECUTABLE_NAME),
        Path::new("Contents/Frameworks").join(runtime::INJECTOR_DYLIB_NAME),
        Path::new("Contents/Resources").join(runtime::LANG_MARKER_NAME),
        Path::new("Contents/Resources").join(runtime::BILINGUAL_MANIFEST_NAME),
    ] {
        let target = app.join(&rel);
        if target.exists() {
            fs::remove_file(&target)?;
            removed.push(rel.to_string_lossy().into_owned());
        }
    }

    // 4. 重新 ad-hoc 重签并校验。
    cbpatch::signing::resign_and_verify(app).map_err(|error| {
        msg(format!(
            "{error}\n提示: 可重试还原，或手动从 {} 恢复文件",
            backup_dir.display()
        ))
    })?;

    Ok(RestoreOutcome {
        backup_dir: backup_dir.to_path_buf(),
        restored,
        removed,
    })
}

fn restore_outcome_json(outcome: &RestoreOutcome) -> Value {
    json!({
        "ok": true,
        "app": "", // 由调用方补充
        "backupDir": outcome.backup_dir.display().to_string(),
        "restored": outcome.restored,
        "removed": outcome.removed,
    })
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_status(state: State<GuiState>) -> std::result::Result<Value, String> {
    if !state.app_root.is_dir() {
        return Ok(json!({ "detected": false }));
    }
    let report = ops::status(&state.app_root).map_err(err_string)?;
    let latest = scan_backups(&state.backup_root)
        .into_iter()
        .next()
        .map(|(ts, _, _)| format_unix_time(ts));
    Ok(json!({
        "detected": true,
        "cavalryVersion": report.cavalry_version,
        "executable": report.executable,
        "state": report.state.as_str(),
        "lang": report.lang,
        "signing": {
            "identifier": report.signing.identifier,
            "flags": report.signing.flags,
            "signature": report.signing.signature,
        },
        "latestBackup": latest,
    }))
}

#[tauri::command]
pub fn apply_patch(state: State<GuiState>) -> std::result::Result<Value, String> {
    let dylib = ops::default_dylib_path().map_err(err_string)?;
    let lang = config_lang(&state).unwrap_or_else(|| "zh-Hans".to_string());
    let summary = ops::apply(&state.app_root, &dylib, &lang, &state.backup_root)
        .map_err(err_string)?;
    Ok(json!({
        "ok": summary.ok,
        "app": summary.app.display().to_string(),
        "stateBefore": summary.state_before.as_str(),
        "backupDir": summary.backup_dir.display().to_string(),
    }))
}

/// `backup_dir` 传空字符串表示「最新一份备份」。
#[tauri::command]
pub fn restore_backup(
    state: State<GuiState>,
    backup_dir: String,
) -> std::result::Result<Value, String> {
    let dir = if backup_dir.trim().is_empty() {
        backup::latest_backup_dir(&state.backup_root)
            .map_err(err_string)?
            .ok_or_else(|| {
                format!(
                    "在 {} 中没有找到任何备份",
                    state.backup_root.display()
                )
            })?
    } else {
        let dir = PathBuf::from(backup_dir);
        if !dir.is_dir() {
            return Err(format!("找不到备份目录: {}", dir.display()));
        }
        dir
    };
    let outcome = restore_from_dir(&state.app_root, &dir).map_err(err_string)?;
    let mut value = restore_outcome_json(&outcome);
    value["app"] = json!(state.app_root.display().to_string());
    Ok(value)
}

#[tauri::command]
pub fn list_backups(state: State<GuiState>) -> std::result::Result<Value, String> {
    let items = scan_backups(&state.backup_root)
        .into_iter()
        .map(|(ts, name, path)| {
            let is_bilingual = path
                .join("Contents")
                .join("Frameworks")
                .join(runtime::INJECTOR_DYLIB_NAME)
                .is_file();
            json!({
                "name": name,
                "path": path.display().to_string(),
                "time": format_unix_time(ts),
                "version": backup_dir_version(&name),
                "kind": if is_bilingual { "双语补丁" } else { "原始文件" },
            })
        })
        .collect::<Vec<_>>();
    Ok(Value::Array(items))
}

#[tauri::command]
pub fn get_config(state: State<GuiState>) -> std::result::Result<Value, String> {
    let config = read_config(&state)?;
    Ok(json!({
        "path": state.config_path.display().to_string(),
        "template": config.get("template").and_then(Value::as_str).unwrap_or("{zh}（{en}）"),
        "lang": config.get("lang").and_then(Value::as_str).unwrap_or("zh-Hans"),
        "fontsEnabled": config
            .get("fonts")
            .and_then(|fonts| fonts.get("enabled"))
            .and_then(Value::as_bool)
            .unwrap_or(false),
        "zhFont": config
            .get("fonts")
            .and_then(|fonts| fonts.get("zh"))
            .and_then(Value::as_str)
            .unwrap_or("MiSans"),
        "enFont": config
            .get("fonts")
            .and_then(|fonts| fonts.get("en"))
            .and_then(Value::as_str)
            .unwrap_or("Inter"),
    }))
}

#[tauri::command]
pub fn save_config(
    state: State<GuiState>,
    template: String,
    lang: String,
    fonts_enabled: bool,
) -> std::result::Result<Value, String> {
    ops::validate_lang(&lang).map_err(err_string)?;
    if !template.contains("{zh}") && !template.contains("{en}") {
        return Err("模板需包含 {zh} 或 {en} 占位符".to_string());
    }
    let mut config = read_config(&state)?;
    config["template"] = Value::String(template);
    config["lang"] = Value::String(lang);
    if config.get("fonts").and_then(Value::as_object).is_none() {
        config["fonts"] = json!({ "zh": "MiSans", "en": "Inter", "enabled": fonts_enabled });
    } else {
        let fonts = config["fonts"].as_object_mut().expect("fonts object");
        fonts
            .entry("zh".to_string())
            .or_insert_with(|| Value::String("MiSans".to_string()));
        fonts
            .entry("en".to_string())
            .or_insert_with(|| Value::String("Inter".to_string()));
        fonts.insert("enabled".to_string(), Value::Bool(fonts_enabled));
    }
    write_config(&state, &config)?;
    get_config(state)
}

#[tauri::command]
pub fn get_build_info(state: State<GuiState>) -> std::result::Result<Value, String> {
    let candidates = ops::default_dylib_candidates();
    let found = candidates.iter().find(|path| path.is_file());
    let (dylib_path, dylib_exists) = match found {
        Some(path) => (path.display().to_string(), true),
        None => (
            candidates
                .first()
                .map(|path| path.display().to_string())
                .unwrap_or_default(),
            false,
        ),
    };
    let dylib_sha12 = if dylib_exists {
        util::file_sha256(Path::new(&dylib_path))
            .ok()
            .map(|hex| hex.chars().take(12).collect::<String>())
    } else {
        None
    };
    let config = read_config(&state).ok();
    Ok(json!({
        "dylibPath": dylib_path,
        "dylibExists": dylib_exists,
        "dylibSha12": dylib_sha12,
        "configPath": state.config_path.display().to_string(),
        "configExists": state.config_path.is_file(),
        "template": config.as_ref().and_then(|c| c.get("template").and_then(Value::as_str)),
        "lang": config.as_ref().and_then(|c| c.get("lang").and_then(Value::as_str)),
        "fontsEnabled": config
            .as_ref()
            .and_then(|c| c.get("fonts"))
            .and_then(|fonts| fonts.get("enabled"))
            .and_then(Value::as_bool),
        "appVersion": env!("CARGO_PKG_VERSION"),
        "supportedLangs": ops::SUPPORTED_LANGS,
    }))
}
