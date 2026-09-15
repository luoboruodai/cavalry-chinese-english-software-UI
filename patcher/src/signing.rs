//! codesign 封装：签名摘要探测 + ad-hoc 重签 + 校验。

use std::path::Path;

use crate::error::{msg, Result};
use crate::util::run;

#[derive(Debug, Clone, Default)]
pub struct SigningSummary {
    pub identifier: Option<String>,
    pub flags: Option<String>,
    pub signature: Option<String>,
}

/// 解析 `codesign -dv` 输出（该命令把结果写到 stderr）。
pub fn inspect(app_root: &Path) -> SigningSummary {
    let output = match run(
        "codesign",
        &["-dv".to_string(), app_root.display().to_string()],
    ) {
        Ok(output) => output,
        Err(_) => return SigningSummary::default(),
    };
    parse_summary(&format!("{}\n{}", output.stderr, output.stdout))
}

fn parse_summary(text: &str) -> SigningSummary {
    let mut summary = SigningSummary::default();
    for line in text.lines() {
        if let Some(value) = line.strip_prefix("Identifier=") {
            summary.identifier = Some(value.trim().to_string());
        } else if let Some(value) = line.strip_prefix("Signature=") {
            summary.signature = Some(value.trim().to_string());
        } else if let Some(index) = line.find("flags=") {
            // flags 出现在 `CodeDirectory ...` 行中间，取到下一个空白为止。
            let value = line[index + "flags=".len()..]
                .split_whitespace()
                .next()
                .unwrap_or("");
            if !value.is_empty() {
                summary.flags = Some(value.to_string());
            }
        }
    }
    summary
}

/// `codesign --force --sign - --deep --timestamp=none <app>`
pub fn resign_adhoc_deep(app_root: &Path) -> Result<()> {
    let output = run(
        "codesign",
        &[
            "--force".to_string(),
            "--sign".to_string(),
            "-".to_string(),
            "--deep".to_string(),
            "--timestamp=none".to_string(),
            app_root.display().to_string(),
        ],
    )?;
    if output.success {
        Ok(())
    } else {
        Err(msg(format!(
            "codesign 重签失败（{}）: {}",
            app_root.display(),
            output.stderr.trim()
        )))
    }
}

/// `codesign --verify --no-strict <app>`
pub fn verify_no_strict(app_root: &Path) -> Result<()> {
    let output = run(
        "codesign",
        &[
            "--verify".to_string(),
            "--no-strict".to_string(),
            app_root.display().to_string(),
        ],
    )?;
    if output.success {
        Ok(())
    } else {
        Err(msg(format!(
            "codesign 校验失败（{}）: {}",
            app_root.display(),
            output.stderr.trim()
        )))
    }
}

pub fn resign_and_verify(app_root: &Path) -> Result<()> {
    resign_adhoc_deep(app_root)?;
    verify_no_strict(app_root)
}

#[cfg(test)]
mod tests {
    use super::parse_summary;

    #[test]
    fn parses_codesign_dv_output() {
        let text = "Executable=/Applications/Cavalry.app/Contents/MacOS/CavalryLauncher\n\
                    Identifier=com.scenegroup.cavalry\n\
                    Format=app bundle with generic\n\
                    CodeDirectory v=20100 size=199 flags=0x2(adhoc) hashes=1+3 location=embedded\n\
                    Signature=adhoc\n\
                    TeamIdentifier=not set\n";
        let summary = parse_summary(text);
        assert_eq!(summary.identifier.as_deref(), Some("com.scenegroup.cavalry"));
        assert_eq!(summary.flags.as_deref(), Some("0x2(adhoc)"));
        assert_eq!(summary.signature.as_deref(), Some("adhoc"));
    }
}
