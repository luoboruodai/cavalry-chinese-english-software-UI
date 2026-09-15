//! 安装状态识别（纯文件系统探测，可单测）。

use std::fs;
use std::path::Path;

use crate::json::Json;
use crate::plist;
use crate::Result;
use crate::runtime::{BILINGUAL_MANIFEST_NAME, LANG_MARKER_NAME, WRAPPER_EXECUTABLE_NAME};
use crate::signing::SigningSummary;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AppState {
    /// 无 CavalryLauncher，原厂状态。
    Vendor,
    /// 有 CavalryLauncher 且存在 cavalry-i18n-lang.txt，但无本工具 marker。
    Daftai,
    /// 存在本工具的 cavalry-bilingual.json。
    Ours,
}

impl AppState {
    pub fn as_str(&self) -> &'static str {
        match self {
            AppState::Vendor => "vendor",
            AppState::Daftai => "daftai",
            AppState::Ours => "ours",
        }
    }
}

/// 三分支状态识别。
pub fn classify(app_root: &Path) -> AppState {
    let contents = app_root.join("Contents");
    if contents.join("Resources").join(BILINGUAL_MANIFEST_NAME).exists() {
        return AppState::Ours;
    }
    if contents.join("MacOS").join(WRAPPER_EXECUTABLE_NAME).exists()
        && contents
            .join("Resources")
            .join(LANG_MARKER_NAME)
            .exists()
    {
        return AppState::Daftai;
    }
    AppState::Vendor
}

pub fn cavalry_version(app_root: &Path) -> Result<Option<String>> {
    plist::read_string(
        &app_root.join("Contents/Info.plist"),
        "CFBundleShortVersionString",
    )
}

pub fn bundle_executable(app_root: &Path) -> Result<Option<String>> {
    plist::read_string(&app_root.join("Contents/Info.plist"), "CFBundleExecutable")
}

pub fn language_marker(app_root: &Path) -> Option<String> {
    let path = app_root
        .join("Contents")
        .join("Resources")
        .join(LANG_MARKER_NAME);
    fs::read_to_string(path)
        .ok()
        .map(|content| content.trim().to_string())
}

#[derive(Debug, Clone)]
pub struct StatusReport {
    pub cavalry_version: Option<String>,
    pub executable: Option<String>,
    pub state: AppState,
    pub lang: Option<String>,
    pub signing: SigningSummary,
}

impl StatusReport {
    pub fn to_json(&self) -> Json {
        Json::Obj(vec![
            (
                "cavalryVersion".to_string(),
                Json::opt_str(self.cavalry_version.clone()),
            ),
            (
                "executable".to_string(),
                Json::opt_str(self.executable.clone()),
            ),
            (
                "state".to_string(),
                Json::str(self.state.as_str()),
            ),
            ("lang".to_string(), Json::opt_str(self.lang.clone())),
            (
                "signing".to_string(),
                Json::Obj(vec![
                    (
                        "identifier".to_string(),
                        Json::opt_str(self.signing.identifier.clone()),
                    ),
                    (
                        "flags".to_string(),
                        Json::opt_str(self.signing.flags.clone()),
                    ),
                    (
                        "signature".to_string(),
                        Json::opt_str(self.signing.signature.clone()),
                    ),
                ]),
            ),
        ])
    }
}

pub fn collect_status(app_root: &Path) -> Result<StatusReport> {
    Ok(StatusReport {
        cavalry_version: cavalry_version(app_root)?,
        executable: bundle_executable(app_root)?,
        state: classify(app_root),
        lang: language_marker(app_root),
        signing: crate::signing::inspect(app_root),
    })
}
