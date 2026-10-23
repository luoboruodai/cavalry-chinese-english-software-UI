//! UI commands share the same validated core as the CLI.
use crate::GuiState;
#[cfg(not(windows))]
use cbpatch::transaction;
use cbpatch::{config::Settings, ops, util};
use serde_json::{json, Value};
use std::{
    env,
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

/// The list UI must distinguish a missing/empty root from an unreadable directory.
fn scan_backups_checked(backup_root: &Path) -> Result<Vec<(u64, String, PathBuf)>, String> {
    let entries = match fs::read_dir(backup_root) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(_) => return Err("备份目录无法读取，请检查访问权限后重试".into()),
    };
    let mut items = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|_| "读取备份列表未完成，请重试")?;
        let path = entry.path();
        let metadata = fs::metadata(&path).map_err(|_| "部分备份暂时无法读取，请重新刷新")?;
        if !metadata.is_dir() { continue; }
        let name = entry.file_name().to_string_lossy().into_owned();
        if let Some(ts) = backup_dir_timestamp(&name) { items.push((ts, name, path)); }
    }
    items.sort_by(|a, b| b.0.cmp(&a.0));
    Ok(items)
}

// Existing status/deletion guards keep their conservative no-snapshot fallback.
fn scan_backups(backup_root: &Path) -> Vec<(u64, String, PathBuf)> {
    scan_backups_checked(backup_root).unwrap_or_default()
}

#[cfg(target_os = "macos")]
fn cavalry_candidates() -> Vec<PathBuf> {
    let mut roots = vec![PathBuf::from("/Applications")];
    if let Some(home) = env::var_os("HOME") {
        roots.push(PathBuf::from(home).join("Applications"));
    }
    let mut apps = Vec::new();
    for root in roots {
        let Ok(entries) = fs::read_dir(root) else { continue; };
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() || !path.join("Contents/MacOS/Cavalry").is_file() { continue; }
            let plist = path.join("Contents/Info.plist");
            if cbpatch::plist::read_string(&plist, "CFBundleIdentifier").ok().flatten().as_deref()
                != Some("com.scenegroup.cavalry") { continue; }
            apps.push(path);
        }
    }
    apps.sort();
    apps.dedup();
    apps.sort_by(|a, b| {
        let av = cbpatch::detect::cavalry_version(a).ok().flatten().unwrap_or_default();
        let bv = cbpatch::detect::cavalry_version(b).ok().flatten().unwrap_or_default();
        bv.cmp(&av).then_with(|| a.cmp(b))
    });
    apps
}

#[cfg(all(not(windows), not(target_os = "macos")))]
fn cavalry_candidates() -> Vec<PathBuf> { Vec::new() }

#[cfg(windows)]
fn cavalry_candidates() -> Vec<PathBuf> {
    let mut apps = Vec::new();
    for name in ["ProgramFiles", "ProgramW6432", "LOCALAPPDATA"] {
        if let Some(base) = env::var_os(name) {
            for suffix in ["Cavalry", "Programs/Cavalry"] {
                let path = PathBuf::from(&base).join(suffix);
                if is_cavalry_install(&path) { apps.push(path); }
            }
        }
    }
    apps.sort();
    apps.dedup();
    apps
}

fn is_cavalry_install(path: &Path) -> bool {
    #[cfg(windows)]
    {
        cbpatch::windows::is_cavalry_install(path)
    }
    #[cfg(target_os = "macos")]
    {
        path.join("Contents/MacOS/Cavalry").is_file()
            && cbpatch::plist::read_string(&path.join("Contents/Info.plist"), "CFBundleIdentifier")
                .ok().flatten().as_deref() == Some("com.scenegroup.cavalry")
    }
    #[cfg(all(not(windows), not(target_os = "macos")))]
    {
        let _ = path;
        false
    }
}

fn selected_target(state: &GuiState) -> Option<PathBuf> {
    fs::read_to_string(&state.target_path_file)
        .ok()
        .and_then(|raw| serde_json::from_str::<Value>(&raw).ok())
        .and_then(|value| value.get("path").and_then(Value::as_str).map(PathBuf::from))
}

fn target_app(state: &GuiState) -> PathBuf {
    selected_target(state).unwrap_or_else(cbpatch::ops::default_app_path)
}
fn bundled_injector_for_app(state: &GuiState, app_root: &Path) -> Result<PathBuf, String> {
    #[cfg(not(windows))]
    {
        cbpatch::ops::dylib_path_for_app(app_root, &state.dylib_path, &state.dylib_280_path).map_err(|error| error.to_string())
    }
    #[cfg(windows)]
    {
        let _ = app_root;
        Ok(state.dylib_path.clone())
    }
}

fn cavalry_install_json(state: &GuiState, path: &Path) -> Value {
    let version = cbpatch::detect::cavalry_version(path).ok().flatten();
    let running = ops::ensure_target_not_running(path).is_err();
    let selected = target_app(state) == path;
    json!({
        "path": path,
        "version": version.clone().unwrap_or_else(|| "未知版本".into()),
        "displayName": format!("Cavalry {}", version.unwrap_or_else(|| "未知版本".into())),
        "running": running,
        "selected": selected,
    })
}


#[tauri::command]
pub fn list_cavalry_installs(state: State<GuiState>) -> Value {
    json!(cavalry_install_list(&state))
}

fn cavalry_install_list(state: &GuiState) -> Vec<Value> {
    let mut paths = cavalry_candidates();
    if let Some(selected) = selected_target(state) {
        if !paths.contains(&selected) { paths.push(selected); }
    }
    paths.iter().map(|path| cavalry_install_json(state, path)).collect()
}

#[tauri::command]
pub fn set_target_cavalry(state: State<GuiState>, path: String) -> Result<Value, String> {
    set_target_cavalry_path(&state, &PathBuf::from(path))
}

fn set_target_cavalry_path(state: &GuiState, candidate: &Path) -> Result<Value, String> {
    #[cfg(windows)]
    let resolved = cbpatch::windows::resolve_install_root(candidate).map_err(|error| error.to_string())?;
    #[cfg(not(windows))]
    let resolved = candidate.to_path_buf();
    if !resolved.is_absolute() || !is_cavalry_install(&resolved) {
        return Err("不是可识别的 Cavalry 安装目录".into());
    }
    let payload = serde_json::to_vec_pretty(&json!({ "path": resolved })).map_err(|e| e.to_string())?;
    util::atomic_write(&state.target_path_file, &payload).map_err(|e| e.to_string())?;
    Ok(json!({ "ok": true, "path": resolved }))
}

#[tauri::command]
pub async fn check_cavalry_update() -> Result<crate::updates::ReleaseInfo, String> {
    tauri::async_runtime::spawn_blocking(crate::updates::check_release).await.map_err(|_| "版本检查任务未完成".to_string())?
}
#[tauri::command]
pub async fn download_cavalry_update(app: tauri::AppHandle, state: State<'_, GuiState>, version: String) -> Result<crate::updates::DownloadResult, String> {
    use tauri::Emitter;
    let downloads = state.downloads.clone();
    tauri::async_runtime::spawn_blocking(move || crate::updates::download_release(&downloads, &version, |progress| { let _ = app.emit("cavalry-download-progress", progress); })).await.map_err(|_| "下载任务未完成".to_string())?
}
#[tauri::command]
pub fn cancel_cavalry_download(state: State<'_, GuiState>) { state.downloads.cancel(); }
#[tauri::command]
pub fn reveal_cavalry_download(path: String) -> Result<(), String> { crate::updates::reveal_download(Path::new(&path)) }
#[tauri::command]
pub fn prepare_error_report(state: State<'_, GuiState>, message: String, logs: Vec<crate::reporting::OperationLog>, cavalry_version: Option<String>) -> Result<crate::reporting::ReportPreview, String> {
    crate::reporting::prepare(&state.reports, state.backup_root.parent().ok_or("配置目录不可用")?, &message, &logs, cavalry_version)
}
#[tauri::command]
pub fn export_error_report(state: State<'_, GuiState>, report_id: String) -> Result<crate::reporting::ReportReceipt, String> {
    crate::reporting::export(&state.reports, state.backup_root.parent().ok_or("配置目录不可用")?, &report_id)
}
#[tauri::command]
pub async fn send_error_report(state: State<'_, GuiState>, report_id: String, email_js: Option<crate::reporting::EmailJsSession>) -> Result<crate::reporting::ReportReceipt, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || crate::reporting::send(&state.reports, state.backup_root.parent().ok_or("配置目录不可用")?, &report_id, email_js)).await.map_err(|_| "报告处理任务未完成".to_string())?
}
#[tauri::command]
pub async fn begin_emailjs_send(state: State<'_, GuiState>, report_id: String, email_js: crate::reporting::EmailJsSession) -> Result<String, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || crate::reporting::begin_emailjs(&state.reports, state.backup_root.parent().ok_or("配置目录不可用")?, &report_id, email_js)).await.map_err(|_| "EmailJS 发送准备任务未完成".to_string())?
}
#[tauri::command]
pub async fn complete_emailjs_send(state: State<'_, GuiState>, report_id: String) -> Result<crate::reporting::ReportReceipt, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || crate::reporting::complete_emailjs(&state.reports, state.backup_root.parent().ok_or("配置目录不可用")?, &report_id)).await.map_err(|_| "EmailJS 发送完成任务未完成".to_string())?
}
#[tauri::command]
pub fn abort_emailjs_send(state: State<'_, GuiState>, report_id: String) -> Result<(), String> {
    crate::reporting::abort_emailjs(&state.reports, &report_id)
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
    #[cfg(not(windows))]
    let cavalry_28_assets = cbpatch::ops::default_cavalry_28_assets_path().ok();
    #[cfg(windows)]
    let cavalry_28_assets: Option<PathBuf> = None;
    json!({ "dylibPath": state.dylib_path, "dylibExists": state.dylib_path.is_file(),
        "dylibSha12": util::file_sha256(&state.dylib_path).ok().map(|s| s[..12].to_string()),
        "dylib280Path": state.dylib_280_path, "dylib280Exists": state.dylib_280_path.is_file(),
        "dylib280Sha12": util::file_sha256(&state.dylib_280_path).ok().map(|s| s[..12].to_string()),
        "cavalry280AssetsPath": cavalry_28_assets.as_ref().map(|path| path.display().to_string()),
        "cavalry280AssetsExists": cavalry_28_assets.as_ref().is_some_and(|path| path.is_dir()),
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
    // Resolve on every refresh instead of only at GUI startup. Users often
    // open the tool before Cavalry, and macOS may have multiple versioned
    // Cavalry bundles installed side by side.
    let app_root = target_app(state);
    if !app_root.is_dir() {
        return Ok(json!({
            "detected": false,
            "appPath": app_root,
        }));
    }
    let report = ops::status(&app_root).map_err(|e| e.to_string())?;
    let compatibility =
        cbpatch::compatibility::inspect(&app_root).map_err(|e| e.to_string())?;
    let latest = scan_backups(&state.backup_root)
        .into_iter()
        .next()
        .map(|(ts, _, _)| format_unix_time(ts));
    let saved = Settings::load(&state.config_path).map_err(|e| e.to_string())?;
    let installed = Settings::load(&cbpatch::runtime::settings_path(&app_root)).ok();
    let manifest: Option<Value> = fs::read(cbpatch::runtime::manifest_path(&app_root))
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok());
    let installed_hash = util::normalized_binary_sha256(&cbpatch::runtime::injector_path(&app_root)).ok();
    let bundled_path = bundled_injector_for_app(state, &app_root)?;
    let bundled_hash = util::normalized_binary_sha256(&bundled_path).ok();
    let runtime_changed = bundled_hash.is_some() && bundled_hash != installed_hash;
    let expected_scope = if report.cavalry_version.as_deref() == Some("2.8.0") { "cavalry-28-translation-v1" } else { "nodeStrings-v1" };
    let scope_changed = manifest
        .as_ref()
        .and_then(|m| m.get("assetScope"))
        .and_then(Value::as_str)
        != Some(expected_scope);
    let pending = report.state == cbpatch::AppState::Ours
        && (installed.as_ref() != Some(&saved)
            || runtime_changed
            || scope_changed
            || !cbpatch::runtime::settings_path(&app_root).is_file());
    Ok(json!({
        "detected": true,
        "appPath": app_root,
        "cavalryVersion": report.cavalry_version,
        "executable": report.executable,
        "state": report.state.as_str(),
        "lang": report.lang,
        "latestBackup": latest,
        "pendingSettings": pending,
        "running": ops::ensure_target_not_running(&app_root).is_err(),
        "compatibility": compatibility,
        "signing": {
            "identifier": report.signing.identifier,
            "flags": report.signing.flags,
            "signature": report.signing.signature
        }
    }))
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
        let app_root = target_app(state);
        let dylib = bundled_injector_for_app(state, &app_root)?;
        if !dylib.is_file() {
            return Err(format!("缺少当前 Cavalry 版本对应的注入器：{}。请重新安装完整工具包；不会修改目标。", dylib.display()));
        }
        let outcome = ops::apply_with_settings(&app_root, &dylib, &config, &state.backup_root).map_err(|e| e.to_string())?;
        Ok(json!({"ok": outcome.ok, "app": outcome.app, "stateBefore": outcome.state_before.as_str(), "backupDir": outcome.backup_dir, "assetStringsUpdated": outcome.asset_strings_updated}))
    }).await
}
#[tauri::command]
pub async fn restore_backup(
    state: State<'_, GuiState>,
    backup_dir: String,
) -> Result<Value, String> {
    mutate(state.inner().clone(), move |state| {
        let app_root = target_app(state);
        let outcome = if backup_dir.is_empty() { ops::restore(&app_root, &state.backup_root) }
        else { ops::restore_from_dir(&app_root, Path::new(&backup_dir), &state.backup_root) }.map_err(|e| e.to_string())?;
        Ok(json!({"ok": true, "app": outcome.app, "backupDir": outcome.backup_dir, "restored": outcome.restored, "removed": outcome.removed}))
    }).await
}
#[tauri::command]
pub fn list_backups(state: State<GuiState>) -> Result<Value, String> {
    Ok(json!(scan_backups_checked(&state.backup_root)?.into_iter().map(|(ts, name, path)| {
        #[cfg(not(windows))]
        let manifest = transaction::summary(&path).map(|m| m.state);
        #[cfg(windows)]
        let manifest = cbpatch::windows::backup_state(&path);
        let recoverable = manifest.is_ok();
        let kind = match manifest.as_ref().map(|m| m.as_str()) {
            Ok("ours") => "双语快照", Ok("vendor") => "注入前快照", Ok(_) => "社区补丁快照", Err(_) => "旧备份 / 清单无效",
        };
        json!({"name": name, "path": path, "time": format_unix_time(ts), "version": backup_dir_version(&name), "kind": kind, "recoverable": recoverable})
    }).collect::<Vec<_>>()))
}


#[tauri::command]
pub async fn delete_backup(state: State<'_, GuiState>, backup_dir: String) -> Result<Value, String> {
    mutate(state.inner().clone(), move |state| {
        let requested = Path::new(&backup_dir);
        if !scan_backups(&state.backup_root).iter().any(|(_, _, path)| path == requested) {
            return Err("备份已不在当前列表，请刷新后重试".into());
        }
        crate::backup_actions::recycle_backup(&state.backup_root, requested)?;
        Ok(json!({"ok": true, "backupDir": backup_dir}))
    }).await
}

#[cfg(test)]
mod backup_read_tests {
    use super::*;
    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!("cb-backup-read-{}", sentry_types::random_uuid()));
            fs::create_dir(&path).unwrap(); Self(path)
        }
    }
    impl Drop for Fixture { fn drop(&mut self) { let _ = fs::remove_dir_all(&self.0); } }
    #[test]
    fn missing_and_empty_roots_are_legitimately_empty() {
        let fixture = Fixture::new();
        assert!(scan_backups_checked(&fixture.0.join("not-created")).unwrap().is_empty());
        assert!(scan_backups_checked(&fixture.0).unwrap().is_empty());
    }
    #[test]
    fn invalid_root_is_an_error_not_an_empty_list() {
        let fixture = Fixture::new(); let file = fixture.0.join("backups"); fs::write(&file, b"not a directory").unwrap();
        assert!(scan_backups_checked(&file).is_err());
        assert!(scan_backups(&file).is_empty());
    }
    #[test]
    fn readable_snapshot_list_preserves_order_and_ignores_files() {
        let fixture = Fixture::new();
        fs::create_dir(fixture.0.join("2.7.2-1750000001")).unwrap();
        fs::create_dir(fixture.0.join("2.7.2-1750000002")).unwrap();
        fs::write(fixture.0.join("2.7.2-1750000003"), b"file not snapshot").unwrap();
        let rows = scan_backups_checked(&fixture.0).unwrap();
        assert_eq!(rows.len(), 2); assert!(rows[0].0 > rows[1].0);
    }
}

#[cfg(test)]
mod target_selection_tests {
    use super::*;
    use std::sync::{Arc, Mutex};
    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!("cb-target-selection-{}", sentry_types::random_uuid()));
            fs::create_dir(&path).unwrap();
            fs::create_dir(path.join("backups")).unwrap();
            Self(path)
        }
        fn state(&self) -> GuiState {
            GuiState {
                backup_root: self.0.join("backups"),
                config_path: self.0.join("settings.json"),
                dylib_path: self.0.join("legacy-runtime"),
                dylib_280_path: self.0.join("280-runtime"),
                target_path_file: self.0.join("target-cavalry.json"),
                operation: Arc::new(Mutex::new(())),
                downloads: Arc::new(crate::updates::DownloadState::default()),
                reports: Arc::new(crate::reporting::ReportState::default()),
            }
        }
        #[cfg(target_os = "macos")]
        fn custom_app(&self) -> PathBuf {
            let app = self.0.join("其他盘/Cavalry Custom.app");
            fs::create_dir_all(app.join("Contents/MacOS")).unwrap();
            fs::write(app.join("Contents/MacOS/Cavalry"), b"fixture").unwrap();
            fs::write(app.join("Contents/Info.plist"), br#"<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>com.scenegroup.cavalry</string><key>CFBundleShortVersionString</key><string>2.7.2</string></dict></plist>"#).unwrap();
            app
        }
        #[cfg(windows)]
        fn custom_app(&self) -> PathBuf {
            let app = self.0.join("OtherDrive/Cavalry");
            fs::create_dir_all(&app).unwrap();
            fs::write(app.join("Cavalry.exe"), b"fixture").unwrap();
            fs::write(app.join("Qt6Core.dll"), b"fixture").unwrap();
            app
        }
    }
    impl Drop for Fixture { fn drop(&mut self) { let _ = fs::remove_dir_all(&self.0); } }
    #[test]
    fn custom_target_is_persisted_listed_and_invalid_input_preserves_it() {
        let fixture = Fixture::new();
        let app = fixture.custom_app();
        let state = fixture.state();
        set_target_cavalry_path(&state, &app).unwrap();
        assert_eq!(target_app(&state), app);
        let installs = cavalry_install_list(&state);
        assert!(installs.iter().any(|item| item["path"].as_str() == Some(app.to_string_lossy().as_ref()) && item["selected"].as_bool() == Some(true)));
        let before = fs::read(&state.target_path_file).unwrap();
        assert!(set_target_cavalry_path(&state, &fixture.0.join("missing")).is_err());
        assert_eq!(fs::read(&state.target_path_file).unwrap(), before);
    }
    #[cfg(windows)]
    #[test]
    fn nested_target_is_resolved_to_the_actual_install_root() {
        let fixture = Fixture::new();
        let parent = fixture.0.join("OtherDrive/Program Files");
        let app = parent.join("Cavalry/New Folder");
        fs::create_dir_all(&app).unwrap();
        fs::write(app.join("Cavalry.exe"), b"MZ\x00sentry-release\x00\x002.8.0\x00/.crashdb\x00").unwrap();
        fs::write(app.join("Qt6Core.dll"), b"fixture").unwrap();
        let state = fixture.state();
        set_target_cavalry_path(&state, &parent).unwrap();
        assert_eq!(target_app(&state), app);
        let has_selected = |installs: &Vec<Value>| installs.iter().any(|item| item["path"].as_str().map(PathBuf::from).as_ref() == Some(&app) && item["selected"].as_bool() == Some(true));
        let installs = cavalry_install_list(&state);
        assert!(has_selected(&installs), "nested install missing or not selected: {installs:?}");
        fs::remove_file(app.join("Qt6Core.dll")).unwrap();
        let installs = cavalry_install_list(&state);
        assert!(has_selected(&installs), "incomplete saved target must remain visible instead of falling back to the default");
    }
}
