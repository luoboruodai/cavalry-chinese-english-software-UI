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
    Ok(compatibility_for(&version, qt.as_deref()))
}

#[cfg(not(windows))]
fn compatibility_for(version: &str, qt: Option<&str>) -> Compatibility {
    let target_27 = version == "2.7.2" && qt == Some("6.6.3");
    let target_28 = version == "2.8.0" && qt == Some("6.9.2");
    let can_apply = cfg!(target_os = "macos") && (target_27 || target_28);
    Compatibility {
        can_apply,
        level: if can_apply { "candidate" } else { "blocked" },
        message: if target_28 {
            "Cavalry 2.8.0 / Qt 6.9.2：匹配2.8适配目标；使用独立2.8注入器，自绘区域及完整覆盖仍需实机验收。".into()
        } else if target_27 {
            "Cavalry 2.7.2 / Qt 6.6.3：匹配当前适配目标；自绘区域及完整覆盖仍需实机验收。".into()
        } else {
            format!("尚未验证此组合（Cavalry {version} / Qt {}）。为避免损坏，不写入补丁；需要对应版本适配和回归。", qt.unwrap_or("未识别"))
        },
        qt_version: qt.map(str::to_owned),
    }
}

#[cfg(windows)]
pub use crate::windows::compatibility as inspect;

#[cfg(all(test, not(windows)))]
mod tests {
    use super::compatibility_for;

    #[test]
    fn accepts_only_exact_supported_targets() {
        assert!(compatibility_for("2.7.2", Some("6.6.3")).can_apply);
        assert!(compatibility_for("2.8.0", Some("6.9.2")).can_apply);
        assert!(!compatibility_for("2.8.0", Some("6.6.3")).can_apply);
        assert!(!compatibility_for("2.7.2", Some("6.9.2")).can_apply);
        assert!(!compatibility_for("2.8.1", Some("6.9.2")).can_apply);
        assert!(!compatibility_for("2.8.0", None).can_apply);
    }
}
