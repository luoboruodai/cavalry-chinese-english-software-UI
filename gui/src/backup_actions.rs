//! Deletion is restricted to one direct snapshot directory; recycling never edits Cavalry.
use std::{fs, path::{Path, PathBuf}};

pub(crate) fn validated_backup(root: &Path, candidate: &Path) -> Result<PathBuf, String> {
    let canonical_root = root.canonicalize().map_err(|_| "备份目录不可用")?;
    let metadata = fs::symlink_metadata(candidate).map_err(|_| "备份已不存在，请刷新列表")?;
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        return Err("只能删除备份目录，不能删除链接或文件".into());
    }
    let canonical = candidate.canonicalize().map_err(|_| "备份路径不可用")?;
    if canonical.parent() != Some(canonical_root.as_path()) {
        return Err("只能删除备份根目录下的单个快照".into());
    }
    Ok(canonical)
}

pub(crate) fn recycle_backup(root: &Path, candidate: &Path) -> Result<(), String> {
    let path = validated_backup(root, candidate)?;
    trash::delete(&path).map_err(|_| "未能移入废纸篓，请刷新后重试".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};
    static NEXT: AtomicU64 = AtomicU64::new(0);
    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!("cb-backup-boundary-{}-{}", std::process::id(), NEXT.fetch_add(1, Ordering::Relaxed)));
            fs::create_dir_all(path.join("backups")).unwrap();
            Self(path)
        }
        fn root(&self) -> PathBuf { self.0.join("backups") }
    }
    impl Drop for Fixture { fn drop(&mut self) { let _ = fs::remove_dir_all(&self.0); } }

    #[test]
    fn accepts_direct_snapshot_even_without_a_manifest() {
        let fixture = Fixture::new();
        let snapshot = fixture.root().join("2.7.2-1792250187");
        fs::create_dir(&snapshot).unwrap();
        assert_eq!(validated_backup(&fixture.root(), &snapshot).unwrap(), snapshot.canonicalize().unwrap());
    }
    #[test]
    fn refuses_root_nested_outside_and_missing_paths() {
        let fixture = Fixture::new();
        let nested = fixture.root().join("snapshot/Contents");
        fs::create_dir_all(&nested).unwrap();
        let outsider = fixture.0.join("outside");
        fs::create_dir(&outsider).unwrap();
        for path in [fixture.root(), nested, outsider, fixture.root().join("missing")] {
            assert!(validated_backup(&fixture.root(), &path).is_err());
        }
    }
    #[test]
    fn refuses_files() {
        let fixture = Fixture::new();
        let path = fixture.root().join("2.7.2-1792250187");
        fs::write(&path, b"not a directory").unwrap();
        assert!(validated_backup(&fixture.root(), &path).is_err());
    }
    #[cfg(target_os = "macos")]
    #[test]
    fn recycles_only_a_synthetic_snapshot_and_keeps_its_sibling() {
        let fixture = Fixture::new();
        let snapshot = fixture.root().join(format!("cb-synthetic-backup-{}", std::process::id()));
        let sibling = fixture.root().join("keep-sibling");
        fs::create_dir(&snapshot).unwrap();
        fs::write(snapshot.join("fixture.txt"), b"synthetic test data, not a user backup").unwrap();
        fs::create_dir(&sibling).unwrap();
        recycle_backup(&fixture.root(), &snapshot).unwrap();
        assert!(!snapshot.exists());
        assert!(sibling.is_dir());
    }

    #[cfg(unix)]
    #[test]
    fn refuses_symlinks_inside_or_outside_the_root() {
        let fixture = Fixture::new();
        let snapshot = fixture.root().join("snapshot");
        fs::create_dir(&snapshot).unwrap();
        let outside = fixture.0.join("outside");
        fs::create_dir(&outside).unwrap();
        for (name, target) in [("inside-link", snapshot), ("outside-link", outside)] {
            let link = fixture.root().join(name);
            std::os::unix::fs::symlink(target, &link).unwrap();
            assert!(validated_backup(&fixture.root(), &link).is_err());
        }
    }
}
