//! apply / restore / status 编排。所有 app 根路径、备份根路径均为参数注入，
//! 测试可传 fixture 路径，绝不写死真实 /Applications。

#[cfg(not(windows))]
use std::fs;
use std::path::{Path, PathBuf};

#[cfg(not(windows))]
use crate::backup;
#[cfg(not(windows))]
use crate::detect;
use crate::detect::AppState;
use crate::error::{msg, Result};
use crate::json::Json;
#[cfg(not(windows))]
use crate::keychain;
#[cfg(not(windows))]
use crate::plist;
use crate::runtime;
#[cfg(not(windows))]
use crate::signing;
use crate::util;

pub const DEFAULT_APP: &str = "/Applications/Cavalry.app";
pub const SUPPORTED_LANGS: [&str; 1] = ["zh-Hans"];

pub fn default_app_path() -> PathBuf {
    #[cfg(windows)]
    {
        crate::windows::default_app_path()
    }
    #[cfg(not(windows))]
    {
        PathBuf::from(DEFAULT_APP)
    }
}
pub fn default_backup_root() -> Result<PathBuf> {
    #[cfg(windows)]
    {
        let root = std::env::var_os("LOCALAPPDATA").ok_or_else(|| msg("无法确定 LOCALAPPDATA"))?;
        Ok(PathBuf::from(root).join("CavalryBilingual/backups"))
    }
    #[cfg(not(windows))]
    {
        let home = std::env::var_os("HOME").ok_or_else(|| msg("无法确定 HOME"))?;
        Ok(PathBuf::from(home).join(".cavalry-bilingual/backups"))
    }
}

/// Resolve installed resources first; development paths are debug-only.
pub fn default_dylib_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(
                dir.join("../Resources/runtime")
                    .join(runtime::INJECTOR_DYLIB_NAME),
            );
            candidates.push(dir.join("runtime").join(runtime::INJECTOR_DYLIB_NAME));
        }
    }
    #[cfg(debug_assertions)]
    candidates.push(
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../dist")
            .join(runtime::INJECTOR_DYLIB_NAME),
    );
    candidates
}

pub fn default_dylib_path() -> Result<PathBuf> {
    let candidates = default_dylib_candidates();
    candidates
        .iter()
        .find(|path| path.is_file())
        .cloned()
        .ok_or_else(|| {
            msg(format!(
                "找不到默认注入 dylib，请用 --dylib 指定。已检查: {}",
                candidates
                    .iter()
                    .map(|path| path.display().to_string())
                    .collect::<Vec<_>>()
                    .join(", ")
            ))
        })
}

pub fn validate_lang(lang: &str) -> Result<()> {
    if SUPPORTED_LANGS.contains(&lang) {
        Ok(())
    } else {
        Err(msg(format!(
            "不支持的语言: {lang}（可选: {}）",
            SUPPORTED_LANGS.join(", ")
        )))
    }
}

pub fn ensure_cavalry_not_running() -> Result<()> {
    for process in ["Cavalry", "CavalryLauncher"] {
        let output = util::run("pgrep", &["-x".to_string(), process.to_string()])?;
        if output.success {
            return Err(msg(
                "检测到 Cavalry 正在运行。请先退出 Cavalry（保存好工作）再执行此操作。",
            ));
        }
    }
    Ok(())
}

#[cfg(not(windows))]
pub fn status(app: &Path) -> Result<detect::StatusReport> {
    if !app.is_dir() {
        return Err(msg(format!("找不到应用: {}", app.display())));
    }
    detect::collect_status(app)
}

#[derive(Debug, Clone)]
pub struct ApplySummary {
    pub ok: bool,
    pub app: PathBuf,
    pub state_before: AppState,
    pub backup_dir: PathBuf,
    pub asset_strings_updated: usize,
}

impl ApplySummary {
    pub fn to_json(&self) -> Json {
        Json::Obj(vec![
            ("ok".to_string(), Json::Bool(self.ok)),
            (
                "assetStringsUpdated".into(),
                Json::Int(self.asset_strings_updated as i64),
            ),
            ("app".to_string(), Json::str(self.app.display().to_string())),
            (
                "state_before".to_string(),
                Json::str(self.state_before.as_str()),
            ),
            (
                "backupDir".to_string(),
                Json::str(self.backup_dir.display().to_string()),
            ),
        ])
    }
}

#[derive(Debug, Clone)]
pub struct RestoreSummary {
    pub ok: bool,
    pub app: PathBuf,
    pub backup_dir: PathBuf,
    pub restored: Vec<String>,
    pub removed: Vec<String>,
}

impl RestoreSummary {
    pub fn to_json(&self) -> Json {
        Json::Obj(vec![
            ("ok".to_string(), Json::Bool(self.ok)),
            ("app".to_string(), Json::str(self.app.display().to_string())),
            (
                "backupDir".to_string(),
                Json::str(self.backup_dir.display().to_string()),
            ),
            (
                "restored".to_string(),
                Json::Arr(self.restored.iter().cloned().map(Json::Str).collect()),
            ),
            (
                "removed".to_string(),
                Json::Arr(self.removed.iter().cloned().map(Json::Str).collect()),
            ),
        ])
    }
}

/// Guard the target installation, not unrelated fixture installations.
#[cfg(not(windows))]
pub fn ensure_target_not_running(app: &Path) -> Result<()> {
    let root = fs::canonicalize(app)?;
    for name in ["Cavalry", "CavalryLauncher"] {
        let processes = util::run("pgrep", &["-x".into(), name.into()])?;
        if !processes.success && processes.code != Some(1) {
            return Err(msg("无法检测 Cavalry 进程，操作已停止"));
        }
        for pid in processes.stdout.split_whitespace() {
            let process = util::run(
                "ps",
                &[
                    "-ww".into(),
                    "-p".into(),
                    pid.into(),
                    "-o".into(),
                    "comm=".into(),
                ],
            )?;
            if !process.success {
                continue;
            } // process exited
            let executable = PathBuf::from(process.stdout.trim());
            let executable = fs::canonicalize(&executable).unwrap_or(executable);
            if executable.starts_with(&root) || !executable.is_absolute() {
                return Err(msg(
                    "目标 Cavalry 正在运行。请保存工作并自行退出后重试；工具不会强制关闭。",
                ));
            }
        }
    }
    Ok(())
}

pub fn apply(app: &Path, dylib: &Path, lang: &str, backup_root: &Path) -> Result<ApplySummary> {
    let settings = crate::config::Settings {
        lang: lang.into(),
        ..Default::default()
    };
    apply_with_settings(app, dylib, &settings, backup_root)
}

#[cfg(not(windows))]
pub fn apply_with_settings(
    app: &Path,
    dylib: &Path,
    settings: &crate::config::Settings,
    backup_root: &Path,
) -> Result<ApplySummary> {
    settings.validate()?;
    let _lock = crate::operation_lock::OperationLock::acquire(app)?;
    ensure_target_not_running(app)?;
    let compatibility = crate::compatibility::inspect(app)?;
    if !compatibility.can_apply {
        return Err(msg(compatibility.message));
    }
    let injector_bytes = fs::read(dylib)?;
    if injector_bytes.len() < 32
        || !matches!(
            &injector_bytes[..4],
            [0xcf, 0xfa, 0xed, 0xfe]
                | [0xfe, 0xed, 0xfa, 0xcf]
                | [0xca, 0xfe, 0xba, 0xbe]
                | [0xca, 0xfe, 0xba, 0xbf]
        )
    {
        return Err(msg(
            "注入器不是有效的 macOS Mach-O 文件，请重新构建或安装完整工具包",
        ));
    }
    let config_bytes = settings.bytes()?;
    let (asset_bytes, asset_strings_updated) = crate::assets::prepare(app, settings)?;
    let state_before = detect::classify(app);
    let backup_dir = crate::transaction::capture(app, backup_root)?;
    let result = (|| -> Result<()> {
        ensure_target_not_running(app)?;
        if state_before == AppState::Vendor {
            keychain::patch_app_keychain_dylib(app)?;
        }
        runtime::install_launch_wrapper(app)?;
        plist::set_bundle_executable(app, runtime::WRAPPER_EXECUTABLE_NAME)?;
        util::atomic_write(
            &app.join("Contents/Frameworks")
                .join(runtime::INJECTOR_DYLIB_NAME),
            &injector_bytes,
        )?;
        util::atomic_write(
            &app.join("Contents/Resources")
                .join(runtime::LANG_MARKER_NAME),
            &runtime::language_marker_bytes(&settings.lang),
        )?;
        util::atomic_write(
            &app.join("Contents/Resources/cavalry-bilingual-settings.json"),
            &config_bytes,
        )?;
        util::atomic_write(&crate::assets::path(app), &asset_bytes)?;
        let mut manifest = runtime::bilingual_manifest_json(
            env!("CARGO_PKG_VERSION"),
            &settings.lang,
            &util::rfc3339_now()?,
        );
        if let Json::Obj(ref mut fields) = manifest {
            fields.push(("assetScope".into(), Json::str("nodeStrings-v1")));
            fields.push((
                "runtimeSha256".into(),
                Json::str(util::sha256_hex(&injector_bytes)),
            ));
        }
        util::atomic_write(
            &app.join("Contents/Resources")
                .join(runtime::BILINGUAL_MANIFEST_NAME),
            manifest.render().as_bytes(),
        )?;
        signing::resign_and_verify(app)
    })();
    if let Err(error) = result {
        let rollback = crate::transaction::restore_files(app, &backup_dir)
            .and_then(|_| signing::resign_and_verify(app));
        return Err(msg(format!(
            "应用失败：{error}；回滚{}。备份：{}",
            if rollback.is_ok() {
                "已完成（签名为 ad-hoc）".into()
            } else {
                format!("失败：{}，请保留备份并手动恢复", rollback.unwrap_err())
            },
            backup_dir.display()
        )));
    }
    Ok(ApplySummary {
        ok: true,
        app: app.into(),
        state_before,
        backup_dir,
        asset_strings_updated,
    })
}

#[cfg(not(windows))]
pub fn restore(app: &Path, backup_root: &Path) -> Result<RestoreSummary> {
    let dir = backup::latest_backup_dir(backup_root)?.ok_or_else(|| msg("没有可用备份"))?;
    restore_from_dir(app, &dir, backup_root)
}

#[cfg(not(windows))]
pub fn restore_from_dir(app: &Path, dir: &Path, backup_root: &Path) -> Result<RestoreSummary> {
    let _lock = crate::operation_lock::OperationLock::acquire(app)?;
    ensure_target_not_running(app)?;
    let root = fs::canonicalize(backup_root)?;
    let dir = fs::canonicalize(dir)?;
    if dir.parent() != Some(root.as_path()) {
        return Err(msg("只能还原当前备份库内的备份"));
    }
    let snapshot = crate::transaction::load(&dir)?;
    if detect::cavalry_version(app)?.as_deref() != Some(&snapshot.version) {
        return Err(msg("不允许跨 Cavalry 版本还原"));
    }
    // A restore is itself recoverable; keep the pre-restore snapshot.
    let safety = crate::transaction::capture(app, backup_root)?;
    let result = crate::transaction::restore_files(app, &dir).and_then(|outcome| {
        signing::resign_and_verify(app)?;
        Ok(outcome)
    });
    match result {
        Ok((restored, removed)) => Ok(RestoreSummary {
            ok: true,
            app: app.into(),
            backup_dir: dir,
            restored,
            removed,
        }),
        Err(error) => {
            let rollback = crate::transaction::restore_files(app, &safety)
                .and_then(|_| signing::resign_and_verify(app));
            Err(msg(format!(
                "还原失败：{error}；回滚{}；安全备份：{}",
                if rollback.is_ok() {
                    "完成"
                } else {
                    "失败，请手动恢复"
                },
                safety.display()
            )))
        }
    }
}

#[cfg(windows)]
pub use crate::windows::{
    apply as apply_with_settings, ensure_not_running as ensure_target_not_running,
    restore as restore_from_dir, restore_latest as restore, status,
};
