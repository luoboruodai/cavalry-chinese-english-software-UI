//! Info.plist 读写：统一走 /usr/libexec/PlistBuddy（系统工具，能处理 XML 与二进制 plist）。
//! 写入策略：在目标同目录 staging 出副本 → PlistBuddy 改副本 → 读回字节 →
//! 原子 rename 进 bundle（直接写已签名 bundle 内文件会被 macOS App Management 拒绝）。

use std::fs;
use std::path::Path;

use crate::error::{msg, Result};
use crate::util::{self, run};

const PLIST_BUDDY: &str = "/usr/libexec/PlistBuddy";

pub fn read_string(plist_path: &Path, key: &str) -> Result<Option<String>> {
    if !plist_path.exists() {
        return Err(msg(format!(
            "找不到 plist 文件: {}",
            plist_path.display()
        )));
    }
    let output = run(
        PLIST_BUDDY,
        &[
            "-c".to_string(),
            format!("Print :{key}"),
            plist_path.display().to_string(),
        ],
    )?;
    if output.success {
        Ok(Some(output.stdout.trim_end().to_string()))
    } else if output.stdout.contains("Does Not Exist")
        || output.stderr.contains("Does Not Exist")
    {
        Ok(None)
    } else {
        Err(msg(format!(
            "PlistBuddy 读取 {key} 失败（{}）: {}",
            plist_path.display(),
            output.stderr.trim()
        )))
    }
}

pub fn set_string(plist_path: &Path, key: &str, value: &str) -> Result<()> {
    let set_output = run(
        PLIST_BUDDY,
        &[
            "-c".to_string(),
            format!("Set :{key} {value}"),
            plist_path.display().to_string(),
        ],
    )?;
    if set_output.success {
        return Ok(());
    }
    // key 不存在时 Set 失败，回退 Add。
    let add_output = run(
        PLIST_BUDDY,
        &[
            "-c".to_string(),
            format!("Add :{key} string {value}"),
            plist_path.display().to_string(),
        ],
    )?;
    if add_output.success {
        Ok(())
    } else {
        Err(msg(format!(
            "PlistBuddy 写入 {key} 失败（{}）: Set: {}；Add: {}",
            plist_path.display(),
            set_output.stderr.trim(),
            add_output.stderr.trim()
        )))
    }
}

/// 将 app 的 Contents/Info.plist 的 CFBundleExecutable 改为指定值（原子替换进 bundle）。
pub fn set_bundle_executable(app_root: &Path, executable: &str) -> Result<()> {
    let plist_path = app_root.join("Contents/Info.plist");
    if read_string(&plist_path, "CFBundleExecutable")?.as_deref() == Some(executable) {
        return Ok(());
    }
    let parent = plist_path
        .parent()
        .ok_or_else(|| msg(format!("无效 plist 路径: {}", plist_path.display())))?;
    let staging = parent.join(format!(".cbpatch-plist-edit-{}", std::process::id()));
    fs::create_dir_all(&staging)?;
    let staged = staging.join("Info.plist");
    let result = (|| -> Result<()> {
        fs::copy(&plist_path, &staged)?;
        set_string(&staged, "CFBundleExecutable", executable)?;
        let bytes = fs::read(&staged)?;
        util::atomic_write(&plist_path, &bytes)?;
        Ok(())
    })();
    let _ = fs::remove_dir_all(&staging);
    result
}
