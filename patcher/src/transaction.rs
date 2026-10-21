//! Manifested snapshots of patch-owned files; restore validates all bytes before writing.
//! Application signatures are recreated (not the vendor signing identity).
use crate::{backup, detect, error::msg, util, Result};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Component, Path},
};

pub const MANIFEST: &str = "snapshot.json";
pub const BASE_FILES: &[&str] = &[
    "Contents/Info.plist",
    "Contents/Frameworks/libExtensionLayer.dylib",
    "Contents/MacOS/CavalryLauncher",
    "Contents/Frameworks/libCavalryTranslatorInjector.dylib",
    "Contents/Resources/cavalry-i18n-lang.txt",
    "Contents/Resources/cavalry-bilingual.json",
    "Contents/Resources/cavalry-bilingual-settings.json",
    "Contents/assets/Definitions/nodeStrings.json",
];

fn files_for_version(version: &str) -> Vec<String> {
    let mut files: Vec<String> = BASE_FILES.iter().map(|path| (*path).to_string()).collect();
    if version == "2.8.0" {
        files.retain(|path| path != "Contents/assets/Definitions/nodeStrings.json");
        files.extend(crate::assets::CAVALRY_280_OVERLAY_FILES.iter().map(|relative| format!("Contents/assets/{relative}")));
    }
    files
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Snapshot {
    schema: u32,
    pub version: String,
    pub state: String,
    target_id: String,
    files: Vec<Entry>,
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Entry {
    path: String,
    sha256: Option<String>,
    mode: Option<u32>,
}
fn checked_path(root: &Path, rel: &str, version: &str) -> Result<std::path::PathBuf> {
    if !files_for_version(version).iter().any(|allowed| allowed == rel)
        || Path::new(rel)
            .components()
            .any(|x| !matches!(x, Component::Normal(_)))
    {
        return Err(msg("备份含有不允许的文件路径"));
    }
    let mut path = root.to_path_buf();
    for part in Path::new(rel).components() {
        path.push(part);
        if fs::symlink_metadata(&path)
            .map(|m| m.file_type().is_symlink())
            .unwrap_or(false)
        {
            return Err(msg("补丁文件路径不得经过符号链接"));
        }
    }
    Ok(path)
}
pub fn capture(app: &Path, root: &Path) -> Result<std::path::PathBuf> {
    let version = detect::cavalry_version(app)?.ok_or_else(|| msg("无法识别目标版本"))?;
    let files = files_for_version(&version);
    backup::ensure_backup_root(root)?;
    let mut entries = Vec::new();
    // Preflight every target before creating/writing the snapshot.
    for rel in &files {
        let src = checked_path(app, rel, &version)?;
        if src.exists() && !src.is_file() {
            return Err(msg("补丁目标不是普通文件"));
        }
        entries.push(Entry {
            path: rel.to_string(),
            sha256: if src.is_file() {
                Some(util::file_sha256(&src)?)
            } else {
                None
            },
            mode: util::mode_of(&src).ok().flatten(),
        });
    }
    let dir = backup::create_backup_dir(root, &version, util::now_unix_secs())?;
    for entry in &entries {
        if entry.sha256.is_some() {
            backup::backup_file(&dir, app, Path::new(&entry.path))?;
        }
    }
    let snapshot = Snapshot {
        schema: 2,
        version,
        state: detect::classify(app).as_str().into(),
        target_id: util::sha256_hex(fs::canonicalize(app)?.to_string_lossy().as_bytes()),
        files: entries,
    };
    util::atomic_write(
        &dir.join(MANIFEST),
        &serde_json::to_vec_pretty(&snapshot).map_err(|e| msg(e.to_string()))?,
    )?;
    load(&dir)?;
    Ok(dir)
}
/// Cheap list metadata only. Integrity is always checked by load() before restore.
pub fn summary(dir: &Path) -> Result<Snapshot> {
    let snapshot = checked_manifest(dir)?;
    if snapshot.schema != 2 || snapshot.files.len() != files_for_version(&snapshot.version).len() {
        return Err(msg("快照清单格式不受支持"));
    }
    Ok(snapshot)
}

pub fn load(dir: &Path) -> Result<Snapshot> {
    let meta = checked_manifest(dir)?;
    if meta.schema != 2 || meta.files.len() != files_for_version(&meta.version).len() {
        return Err(msg("备份格式不受支持或内容不完整"));
    }
    let mut seen = std::collections::HashSet::new();
    for entry in &meta.files {
        let path = checked_path(dir, &entry.path, &meta.version)?;
        if !seen.insert(&entry.path) {
            return Err(msg("备份含重复文件"));
        }
        if let Some(hash) = &entry.sha256 {
            if !path.is_file() || util::file_sha256(&path)? != *hash {
                return Err(msg("备份校验失败：内容丢失或已被修改，未写入应用"));
            }
        } else if path.exists() {
            return Err(msg("备份不存在标记与实际文件不一致"));
        }
    }
    Ok(meta)
}
fn checked_manifest(dir: &Path) -> Result<Snapshot> {
    let path = dir.join(MANIFEST);
    if fs::symlink_metadata(&path)
        .map_err(|_| msg("旧备份没有校验清单，不能自动还原；请保留备份并按兼容性文档人工核对"))?
        .file_type()
        .is_symlink()
    {
        return Err(msg("备份清单不得为链接"));
    }
    serde_json::from_slice(&fs::read(path)?)
        .map_err(|_| msg("备份清单损坏，或为无校验清单的旧备份；请保留原文件，不会自动执行"))
}
pub fn restore_files(app: &Path, dir: &Path) -> Result<(Vec<String>, Vec<String>)> {
    let snapshot = load(dir)?;
    if snapshot.target_id != util::sha256_hex(fs::canonicalize(app)?.to_string_lossy().as_bytes()) {
        return Err(msg("备份属于其他安装位置，拒绝覆盖当前应用"));
    }
    if detect::cavalry_version(app)?.as_deref() != Some(&snapshot.version) {
        return Err(msg("备份与当前 Cavalry 版本不同，拒绝跨版本覆盖"));
    }
    let mut bytes = Vec::new();
    for entry in &snapshot.files {
        checked_path(app, &entry.path, &snapshot.version)?;
        bytes.push(if entry.sha256.is_some() {
            Some(fs::read(dir.join(&entry.path))?)
        } else {
            None
        });
    }
    let (mut restored, mut removed) = (vec![], vec![]);
    for (entry, content) in snapshot.files.iter().zip(bytes) {
        let target = app.join(&entry.path);
        if let Some(content) = content {
            let already_matches = target.is_file()
                && util::mode_of(&target).ok().flatten() == entry.mode
                && fs::read(&target)
                    .map(|current| current == content)
                    .unwrap_or(false);
            if already_matches {
                continue;
            }
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent)
                    .map_err(|error| util::io_context("创建恢复目录", &target, error))?;
            }
            util::atomic_write_with_mode(&target, &content, entry.mode)?;
            restored.push(entry.path.clone());
        } else if target.exists() {
            fs::remove_file(&target)
                .map_err(|error| util::io_context("移除补丁文件", &target, error))?;
            removed.push(entry.path.clone());
        }
    }
    Ok((restored, removed))
}

#[cfg(test)]
mod tests {
    use super::files_for_version;

    #[test]
    fn cavalry_28_snapshot_covers_overlay_without_reusing_27_catalog() {
        let legacy = files_for_version("2.7.2");
        let current = files_for_version("2.8.0");
        assert_eq!(legacy.len(), 8);
        assert_eq!(current.len(), 24);
        assert!(!current.iter().any(|path| path == "Contents/assets/Definitions/nodeStrings.json"));
        assert!(current.iter().any(|path| path == "Contents/assets/Definitions/Translation/nodeStrings_zh-CN.translation.json"));
        assert!(current.iter().any(|path| path == "Contents/assets/Learn/Guides/Translation/strings_zh-CN.translation.json"));
    }
}
