//! apply / restore / status 编排。所有 app 根路径、备份根路径均为参数注入，
//! 测试可传 fixture 路径，绝不写死真实 /Applications。

use std::fs;
use std::path::{Path, PathBuf};

use crate::backup::{self, BackupAction};
use crate::detect::{self, AppState};
use crate::error::{msg, Result};
use crate::json::Json;
use crate::keychain;
use crate::plist;
use crate::runtime;
use crate::signing;
use crate::util;

pub const DEFAULT_APP: &str = "/Applications/Cavalry.app";
pub const SUPPORTED_LANGS: [&str; 4] = ["en", "zh-Hans", "zh-Hant", "ja_JP"];

pub fn default_backup_root() -> Result<PathBuf> {
    let home = std::env::var_os("HOME")
        .ok_or_else(|| msg("无法确定 HOME 目录，请设置 HOME 环境变量"))?;
    Ok(PathBuf::from(home).join(".cavalry-bilingual/backups"))
}

/// 默认注入 dylib 解析：编译期锚定 crate 根（CARGO_MANIFEST_DIR/../dist），
/// 再退化到 exe 祖先目录中的 dist/（开发期 target/debug 下同样可达）。
pub fn default_dylib_candidates() -> Vec<PathBuf> {
    let mut candidates = vec![
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("dist")
            .join(runtime::INJECTOR_DYLIB_NAME),
    ];
    if let Ok(exe) = std::env::current_exe() {
        for ancestor in exe.ancestors().skip(1).take(5) {
            candidates.push(ancestor.join("dist").join(runtime::INJECTOR_DYLIB_NAME));
        }
    }
    candidates.dedup();
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
}

impl ApplySummary {
    pub fn to_json(&self) -> Json {
        Json::Obj(vec![
            ("ok".to_string(), Json::Bool(self.ok)),
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

fn backup_one(
    backup_dir: &Path,
    app: &Path,
    rel: &Path,
    log: &mut Vec<(PathBuf, Option<BackupAction>)>,
) -> Result<()> {
    let action = backup::backup_file(backup_dir, app, rel)?;
    if action.is_some() {
        log.push((rel.to_path_buf(), action));
    }
    Ok(())
}

/// 注入双语运行时。流程见命令规格：pgrep 守卫 → 备份 →（vendor 态）keychain 补丁 +
/// wrapper + Info.plist → 复制 dylib + 写 marker/manifest → ad-hoc 重签并校验。
pub fn apply(app: &Path, dylib: &Path, lang: &str, backup_root: &Path) -> Result<ApplySummary> {
    ensure_cavalry_not_running()?;
    validate_lang(lang)?;
    if !app.is_dir() {
        return Err(msg(format!("找不到应用: {}", app.display())));
    }
    if !dylib.is_file() {
        return Err(msg(format!(
            "找不到注入 dylib: {}，请用 --dylib 指定",
            dylib.display()
        )));
    }

    let state_before = detect::classify(app);
    let version = detect::cavalry_version(app)?
        .unwrap_or_else(|| "unknown".to_string());
    backup::ensure_backup_root(backup_root)?;
    let backup_dir = backup::create_backup_dir(backup_root, &version, util::now_unix_secs())?;

    let rel_injector = Path::new("Contents/Frameworks").join(runtime::INJECTOR_DYLIB_NAME);
    let rel_marker = Path::new("Contents/Resources").join(runtime::LANG_MARKER_NAME);
    let rel_plist = Path::new("Contents/Info.plist");
    let rel_extension = Path::new("Contents/Frameworks/libExtensionLayer.dylib");

    let mut backup_log: Vec<(PathBuf, Option<BackupAction>)> = Vec::new();
    backup_one(&backup_dir, app, &rel_injector, &mut backup_log)?;
    backup_one(&backup_dir, app, &rel_marker, &mut backup_log)?;
    if state_before == AppState::Vendor {
        backup_one(&backup_dir, app, rel_plist, &mut backup_log)?;
        backup_one(&backup_dir, app, rel_extension, &mut backup_log)?;
    }

    if state_before == AppState::Vendor {
        keychain::patch_app_keychain_dylib(app)?;
        runtime::install_launch_wrapper(app)?;
        plist::set_bundle_executable(app, runtime::WRAPPER_EXECUTABLE_NAME)?;
    }

    let injector_bytes = fs::read(dylib)?;
    util::atomic_write(&app.join(&rel_injector), &injector_bytes)?;
    util::atomic_write(
        &app.join(&rel_marker),
        runtime::language_marker_bytes(lang).as_slice(),
    )?;
    let installed_at = util::rfc3339_now()?;
    let manifest = runtime::bilingual_manifest_json(
        env!("CARGO_PKG_VERSION"),
        lang,
        &installed_at,
    );
    let rel_manifest = Path::new("Contents/Resources").join(runtime::BILINGUAL_MANIFEST_NAME);
    util::atomic_write(&app.join(&rel_manifest), manifest.render().as_bytes())?;

    signing::resign_and_verify(app).map_err(|error| {
        msg(format!(
            "{error}\n提示: 可运行 `cbpatch restore` 恢复到最近一次备份状态"
        ))
    })?;

    Ok(ApplySummary {
        ok: true,
        app: app.to_path_buf(),
        state_before,
        backup_dir,
    })
}

/// 从最新备份恢复：备份文件按相对路径原子写回 → Info.plist 的可执行名修正 →
/// 移除本工具（及 vendor 原本没有）的四个文件 → 重签并校验。
pub fn restore(app: &Path, backup_root: &Path) -> Result<RestoreSummary> {
    ensure_cavalry_not_running()?;
    if !app.is_dir() {
        return Err(msg(format!("找不到应用: {}", app.display())));
    }
    let backup_dir = backup::latest_backup_dir(backup_root)?
        .ok_or_else(|| msg(format!("在 {} 中没有找到任何备份", backup_root.display())))?;

    let rel_plist = Path::new("Contents/Info.plist");
    let mut restored: Vec<String> = Vec::new();

    // 1. 备份文件按相对路径写回（Info.plist 单独在第 2 步条件处理）。
    for rel in backup::list_backup_files(&backup_dir)? {
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

    // 2. Info.plist：备份里 CFBundleExecutable 是 Cavalry 则写回；
    //    否则若 live 仍指向 CavalryLauncher（备份来自 daftai 态），
    //    修正回 Cavalry，否则删除 launcher 后 bundle 将无法启动。
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
        rel_injector_path(),
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
    signing::resign_and_verify(app).map_err(|error| {
        msg(format!(
            "{error}\n提示: 可运行 `cbpatch restore` 重试，或手动从 {} 恢复文件",
            backup_dir.display()
        ))
    })?;

    Ok(RestoreSummary {
        ok: true,
        app: app.to_path_buf(),
        backup_dir,
        restored,
        removed,
    })
}

fn rel_injector_path() -> PathBuf {
    Path::new("Contents/Frameworks").join(runtime::INJECTOR_DYLIB_NAME)
}
