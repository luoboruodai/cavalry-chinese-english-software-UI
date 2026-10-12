//! UI commands share the same validated core as the CLI.
use crate::GuiState;
#[cfg(not(windows))]
use cbpatch::transaction;
use cbpatch::{config::Settings, ops, util};
use serde_json::{json, Value};
use std::{
    fs,
    path::{Path, PathBuf},
};
use tauri::State;

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

fn config_json(state: &GuiState, config: &Settings) -> Value {
    json!({ "path": state.config_path, "schemaVersion": config.schema_version,
        "template": config.template, "lang": config.lang,
        "zhFont": config.zh_font, "enFont": config.en_font })
}
#[tauri::command]
pub fn get_config(state: State<GuiState>) -> Result<Value, String> {
    Settings::load(&state.config_path)
        .map(|c| config_json(&state, &c))
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn save_config(
    state: State<GuiState>,
    template: String,
    lang: String,
    zh_font: String,
    en_font: String,
) -> Result<Value, String> {
    let _lock = state
        .operation
        .try_lock()
        .map_err(|_| "正在执行补丁操作，请稍后保存")?;
    let config = Settings {
        schema_version: 1,
        template,
        lang,
        zh_font: zh_font.trim().into(),
        en_font: en_font.trim().into(),
    };
    let fonts = crate::fonts::families();
    for family in [&config.zh_font, &config.en_font] {
        if !family.is_empty() && !fonts.contains(family) {
            return Err(format!(
                "未找到已安装的字体 {family}，请选择系统字体或先安装后重新打开工具"
            ));
        }
    }
    config.save(&state.config_path).map_err(|e| e.to_string())?;
    Ok(config_json(&state, &config))
}
#[tauri::command]
pub fn list_fonts() -> Vec<String> {
    crate::fonts::families()
}
#[tauri::command]
pub fn get_build_info(state: State<GuiState>) -> Value {
    json!({ "dylibPath": state.dylib_path, "dylibExists": state.dylib_path.is_file(),
        "dylibSha12": util::file_sha256(&state.dylib_path).ok().map(|s| s[..12].to_string()),
        "configPath": state.config_path, "configExists": state.config_path.is_file(),
        "appVersion": env!("CARGO_PKG_VERSION"), "supportedLangs": ["zh-Hans"] })
}
#[tauri::command]
pub async fn get_status(state: State<'_, GuiState>) -> Result<Value, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || status_info(&state))
        .await
        .map_err(|e| e.to_string())?
}
fn status_info(state: &GuiState) -> Result<Value, String> {
    if !state.app_root.is_dir() {
        return Ok(json!({ "detected": false }));
    }
    let report = ops::status(&state.app_root).map_err(|e| e.to_string())?;
    let compatibility =
        cbpatch::compatibility::inspect(&state.app_root).map_err(|e| e.to_string())?;
    let latest = scan_backups(&state.backup_root)
        .into_iter()
        .next()
        .map(|(ts, _, _)| format_unix_time(ts));
    let saved = Settings::load(&state.config_path).map_err(|e| e.to_string())?;
    let installed = Settings::load(&cbpatch::runtime::settings_path(&state.app_root)).ok();
    let manifest: Option<Value> = fs::read(cbpatch::runtime::manifest_path(&state.app_root)).ok().and_then(|bytes| serde_json::from_slice(&bytes).ok());
    let installed_hash = util::file_sha256(&cbpatch::runtime::injector_path(&state.app_root)).ok();
    let bundled_hash = util::file_sha256(&state.dylib_path).ok();
    let runtime_changed = bundled_hash.is_some() && bundled_hash != installed_hash;
    let scope_changed = manifest.as_ref().and_then(|m|m.get("assetScope")).and_then(Value::as_str) != Some("nodeStrings-v1");
    let pending = report.state == cbpatch::AppState::Ours
        && (installed.as_ref() != Some(&saved) || runtime_changed || scope_changed
            || !cbpatch::runtime::settings_path(&state.app_root).is_file());
    Ok(
        json!({ "detected": true, "cavalryVersion": report.cavalry_version, "executable": report.executable,
        "state": report.state.as_str(), "lang": report.lang, "latestBackup": latest,
        "pendingSettings": pending, "running": ops::ensure_target_not_running(&state.app_root).is_err(),
        "compatibility": compatibility, "signing": { "identifier": report.signing.identifier, "flags": report.signing.flags, "signature": report.signing.signature } }),
    )
}
async fn mutate<F>(state: GuiState, operation: F) -> Result<Value, String>
where
    F: FnOnce(&GuiState) -> Result<Value, String> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(move || {
        let _lock = state
            .operation
            .try_lock()
            .map_err(|_| "已有操作正在执行，请等待完成")?;
        operation(&state)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn apply_patch(state: State<'_, GuiState>) -> Result<Value, String> {
    mutate(state.inner().clone(), |state| {
        let config = Settings::load(&state.config_path).map_err(|e| e.to_string())?;
        let outcome = ops::apply_with_settings(&state.app_root, &state.dylib_path, &config, &state.backup_root).map_err(|e| e.to_string())?;
        Ok(json!({"ok": outcome.ok, "app": outcome.app, "stateBefore": outcome.state_before.as_str(), "backupDir": outcome.backup_dir, "assetStringsUpdated": outcome.asset_strings_updated}))
    }).await
}
#[tauri::command]
pub async fn restore_backup(
    state: State<'_, GuiState>,
    backup_dir: String,
) -> Result<Value, String> {
    mutate(state.inner().clone(), move |state| {
        let outcome = if backup_dir.is_empty() { ops::restore(&state.app_root, &state.backup_root) }
        else { ops::restore_from_dir(&state.app_root, Path::new(&backup_dir), &state.backup_root) }.map_err(|e| e.to_string())?;
        Ok(json!({"ok": true, "app": outcome.app, "backupDir": outcome.backup_dir, "restored": outcome.restored, "removed": outcome.removed}))
    }).await
}
#[tauri::command]
pub fn list_backups(state: State<GuiState>) -> Value {
    json!(scan_backups(&state.backup_root).into_iter().map(|(ts, name, path)| {
        #[cfg(not(windows))]
        let manifest = transaction::summary(&path).map(|m| m.state);
        #[cfg(windows)]
        let manifest = cbpatch::windows::backup_state(&path);
        let recoverable = manifest.is_ok();
        let kind = match manifest.as_ref().map(|m| m.as_str()) {
            Ok("ours") => "双语快照", Ok("vendor") => "注入前快照", Ok(_) => "社区补丁快照", Err(_) => "旧备份 / 清单无效",
        };
        json!({"name": name, "path": path, "time": format_unix_time(ts), "version": backup_dir_version(&name), "kind": kind, "recoverable": recoverable})
    }).collect::<Vec<_>>())
}
