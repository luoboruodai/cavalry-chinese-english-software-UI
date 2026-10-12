//! Conservative capability gate, not a blanket promise about all versions.
#[cfg(not(windows))]
use crate::{detect, plist, Result};
use serde::Serialize;
#[cfg(not(windows))]
use std::path::Path;
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Compatibility {
    pub can_apply: bool,
    pub level: &'static str,
    pub message: String,
    pub qt_version: Option<String>,
}
#[cfg(not(windows))]
pub fn inspect(app: &Path) -> Result<Compatibility> {
    let version = detect::cavalry_version(app)?.unwrap_or_default();
    let qt_plist = app.join("Contents/Frameworks/QtCore.framework/Resources/Info.plist");
    let qt = if qt_plist.is_file() {
        plist::read_string(&qt_plist, "CFBundleVersion")?
            .or(plist::read_string(&qt_plist, "CFBundleShortVersionString")?)
    } else {
        None
    };
    let can_apply =
        cfg!(target_os = "macos") && version == "2.7.2" && qt.as_deref() == Some("6.6.3");
    Ok(Compatibility {
        can_apply,
        level: if can_apply { "candidate" } else { "blocked" },
        message: if can_apply {
            "Cavalry 2.7.2 / Qt 6.6.3：匹配当前适配目标；自绘区域及完整覆盖仍需实机验收。".into()
        } else {
            format!("尚未验证此组合（Cavalry {version} / Qt {}）。为避免损坏，不写入补丁；需要对应版本适配和回归。", qt.as_deref().unwrap_or("未识别"))
        },
        qt_version: qt,
    })
}

#[cfg(windows)]
pub use crate::windows::compatibility as inspect;
