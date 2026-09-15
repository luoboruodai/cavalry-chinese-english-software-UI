//! 备份：apply 前把将被替换/新增的文件按 bundle 相对路径备份到
//! `<backup_root>/<version>-<unixtimestamp>/`；同内容（sha256 相同）跳过。

use std::fs;
use std::path::{Path, PathBuf};

use crate::error::{msg, Result};
use crate::util::{self, sha256_hex};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BackupAction {
    BackedUp,
    /// 目标备份已存在且 sha256 一致（幂等跳过）。
    SkippedIdentical,
}

pub fn create_backup_dir(backup_root: &Path, version: &str, unix_ts: u64) -> Result<PathBuf> {
    let safe_version: String = version
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '.' {
                ch
            } else {
                '_'
            }
        })
        .collect();
    // 同一秒内多次 apply 时目录会碰撞，追加递增计数后缀。
    let base_name = format!("{safe_version}-{unix_ts}");
    let mut name = base_name.clone();
    let mut counter = 2u32;
    let mut dir = backup_root.join(&name);
    while dir.exists() {
        name = format!("{base_name}-{counter}");
        dir = backup_root.join(&name);
        counter += 1;
    }
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

/// 备份 app_root 内 rel 指向的文件到 backup_dir；源文件不存在时返回 Ok(None)。
pub fn backup_file(
    backup_dir: &Path,
    app_root: &Path,
    rel: &Path,
) -> Result<Option<BackupAction>> {
    let src = app_root.join(rel);
    if !src.is_file() {
        return Ok(None);
    }
    let dst = backup_dir.join(rel);
    let src_bytes = fs::read(&src)?;
    if dst.is_file() {
        let dst_bytes = fs::read(&dst)?;
        if sha256_hex(&src_bytes) == sha256_hex(&dst_bytes) {
            return Ok(Some(BackupAction::SkippedIdentical));
        }
    }
    if let Some(parent) = dst.parent() {
        fs::create_dir_all(parent)?;
    }
    let mode = util::mode_of(&src)?;
    util::atomic_write_with_mode(&dst, &src_bytes, mode)?;
    Ok(Some(BackupAction::BackedUp))
}

/// 找最新的备份目录（目录名形如 `<version>-<unixtimestamp>` 或同秒碰撞后的
/// `<version>-<unixtimestamp>-<counter>`；version 已消毒为不含 `-`，
/// 因此从右侧解析时间戳）。
pub fn latest_backup_dir(backup_root: &Path) -> Result<Option<PathBuf>> {
    if !backup_root.is_dir() {
        return Ok(None);
    }
    let mut best: Option<(u64, PathBuf)> = None;
    for entry in fs::read_dir(backup_root)? {
        let entry = entry?;
        if !entry.path().is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        let timestamp = backup_dir_timestamp(&name);
        if let Some(timestamp) = timestamp {
            let better = best
                .as_ref()
                .map(|(best_ts, _)| timestamp > *best_ts)
                .unwrap_or(true);
            if better {
                best = Some((timestamp, entry.path()));
            }
        }
    }
    Ok(best.map(|(_, path)| path))
}

fn backup_dir_timestamp(name: &str) -> Option<u64> {
    let parts: Vec<&str> = name.split('-').collect();
    if parts.len() < 2 {
        return None;
    }
    let last = parts[parts.len() - 1].parse::<u64>().ok();
    let prev = parts[parts.len() - 2].parse::<u64>().ok();
    match (last, prev) {
        (Some(ts), _) if parts.len() == 2 => Some(ts),
        (Some(_), Some(ts)) => Some(ts),
        _ => None,
    }
}

/// 列出备份目录内所有文件（相对路径，已排序）。
pub fn list_backup_files(backup_dir: &Path) -> Result<Vec<PathBuf>> {
    util::walk_relative(backup_dir)
}

pub fn describe(action: &Option<BackupAction>) -> &'static str {
    match action {
        Some(BackupAction::BackedUp) => "backed_up",
        Some(BackupAction::SkippedIdentical) => "skipped_identical",
        None => "missing",
    }
}

pub fn ensure_backup_root(backup_root: &Path) -> Result<()> {
    fs::create_dir_all(backup_root).map_err(|error| {
        msg(format!(
            "无法创建备份目录 {}: {error}",
            backup_root.display()
        ))
    })
}
