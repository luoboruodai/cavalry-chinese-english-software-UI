//! A per-target cross-process guard, shared by GUI and CLI regardless of backup location.
use crate::{error::msg, util, Result};
use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
};
pub struct OperationLock {
    path: PathBuf,
}
impl OperationLock {
    pub fn acquire(app: &Path) -> Result<Self> {
        let canonical = fs::canonicalize(app)?;
        let key = util::sha256_hex(canonical.to_string_lossy().as_bytes());
        let path = std::env::temp_dir().join(format!("cavalry-bilingual-{}.lock", &key[..24]));
        let mut file = OpenOptions::new().write(true).create_new(true).open(&path)
            .map_err(|_| msg(format!("此 Cavalry 安装已有补丁操作或上次操作意外中断。请确认没有其他工具执行后再处理锁文件：{}", path.display())))?;
        let lock = Self { path };
        writeln!(file, "{}", std::process::id())?;
        file.sync_all()?;
        Ok(lock)
    }
}
impl Drop for OperationLock {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
    }
}
