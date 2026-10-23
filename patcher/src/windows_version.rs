//! Bounded, read-only Cavalry version markers for official Windows executables.
use std::{
    collections::VecDeque,
    fs::{self, File},
    io::Read,
    path::{Path, PathBuf},
};

const VERSION_TOKENS: &[(&str, &[u8])] =
    &[("2.7.2", b"\x002.7.2\x00"), ("2.8.0", b"\x002.8.0\x00")];
const MAX_TOKEN_BYTES: usize = 7;
const MAX_INSTALL_DEPTH: usize = 4;
const MAX_INSTALL_DIRECTORIES: usize = 256;

fn is_reparse(path: &Path) -> bool {
    let Ok(meta) = fs::symlink_metadata(path) else {
        return true;
    };
    if meta.file_type().is_symlink() {
        return true;
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if meta.file_attributes() & 0x400 != 0 {
            return true;
        }
    }
    false
}

fn regular_file(path: &Path) -> bool {
    fs::symlink_metadata(path)
        .map(|meta| meta.file_type().is_file() && !is_reparse(path))
        .unwrap_or(false)
}

pub(crate) fn is_install_root(path: &Path) -> bool {
    regular_file(&path.join("Cavalry.exe")) && regular_file(&path.join("Qt6Core.dll"))
}

/// Resolve a user-selected directory to the actual installation root. The search
/// is bounded, deterministic, and never follows links or scans a whole drive.
pub(crate) fn resolve_install_root(candidate: &Path) -> Result<PathBuf, String> {
    if !candidate.is_absolute() {
        return Err("请选择 Cavalry 安装目录的绝对路径".into());
    }
    if is_reparse(candidate) {
        return Err("Cavalry 路径不得经过符号链接或重解析点".into());
    }
    if candidate.is_file() {
        if candidate
            .file_name()
            .is_some_and(|name| name.eq_ignore_ascii_case("Cavalry.exe"))
        {
            let parent = candidate.parent().ok_or("Cavalry.exe 路径缺少安装目录")?;
            if is_install_root(parent) {
                return Ok(parent.to_path_buf());
            }
        }
        return Err("所选文件不是完整的 Cavalry.exe 安装目标".into());
    }
    if !candidate.is_dir() {
        return Err("所选 Cavalry 目录不存在".into());
    }
    if is_install_root(candidate) {
        return Ok(candidate.to_path_buf());
    }
    let mut queue = VecDeque::from([(candidate.to_path_buf(), 0_usize)]);
    let mut visited = 0_usize;
    let mut found: Option<PathBuf> = None;
    while let Some((directory, depth)) = queue.pop_front() {
        visited += 1;
        if visited > MAX_INSTALL_DIRECTORIES {
            return Err("所选目录内容过多，请直接选择 Cavalry.exe 所在目录".into());
        }
        if depth >= MAX_INSTALL_DEPTH {
            continue;
        }
        let mut entries = fs::read_dir(&directory)
            .map_err(|_| "无法读取所选 Cavalry 目录")?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|_| "无法完整读取所选 Cavalry 目录")?;
        entries.sort_by_key(|entry| entry.file_name());
        for entry in entries {
            let path = entry.path();
            if !path.is_dir() || is_reparse(&path) {
                continue;
            }
            if is_install_root(&path) {
                if found.is_some() {
                    return Err("找到多个 Cavalry 安装，请直接选择 Cavalry.exe 所在目录".into());
                }
                found = Some(path.clone());
            } else {
                queue.push_back((path, depth + 1));
            }
        }
    }
    found.ok_or_else(|| {
        "未在所选目录及其子目录找到包含 Cavalry.exe 和 Qt6Core.dll 的完整安装".into()
    })
}

/// Official Cavalry executables need not carry VS_VERSION_INFO. Accept only one
/// exact NUL-delimited supported release token; ambiguous or similar text fails closed.
pub(crate) fn embedded_cavalry_version(path: &Path) -> Option<String> {
    let mut file = File::open(path).ok()?;
    let mut buffer = [0_u8; 64 * 1024];
    let mut carry = Vec::new();
    let mut found: Option<&str> = None;
    loop {
        let read = file.read(&mut buffer).ok()?;
        if read == 0 {
            break;
        }
        let mut window = carry;
        window.extend_from_slice(&buffer[..read]);
        for (version, token) in VERSION_TOKENS {
            for candidate in window.windows(token.len()) {
                if candidate == *token {
                    if found.is_some() {
                        return None;
                    }
                    found = Some(version);
                }
            }
        }
        let carry_len = (MAX_TOKEN_BYTES - 1).min(window.len());
        carry = window[window.len() - carry_len..].to_vec();
    }
    found.map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        fs,
        path::PathBuf,
        sync::atomic::{AtomicU64, Ordering},
        time::{SystemTime, UNIX_EPOCH},
    };
    static NEXT_FIXTURE: AtomicU64 = AtomicU64::new(0);

    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let nonce = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let sequence = NEXT_FIXTURE.fetch_add(1, Ordering::Relaxed);
            let path = std::env::temp_dir().join(format!(
                "cb-windows-version-{}-{nonce}-{sequence}",
                std::process::id()
            ));
            fs::create_dir(&path).unwrap();
            Self(path)
        }
        fn executable(&self, bytes: &[u8]) -> PathBuf {
            let path = self.0.join("Cavalry.exe");
            fs::write(&path, bytes).unwrap();
            path
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn reads_each_supported_nul_delimited_release() {
        for version in ["2.7.2", "2.8.0"] {
            let fixture = Fixture::new();
            let bytes = format!("MZ\0sentry-release\0\0{version}\0/.crashdb\0");
            assert_eq!(
                embedded_cavalry_version(&fixture.executable(bytes.as_bytes())).as_deref(),
                Some(version)
            );
        }
    }

    #[test]
    fn reads_a_token_split_across_io_buffers() {
        let fixture = Fixture::new();
        let mut bytes = vec![b'M', b'Z'];
        bytes.resize(65_530, 0);
        bytes.extend_from_slice(b"\x002.7.2\x00payload");
        assert_eq!(
            embedded_cavalry_version(&fixture.executable(&bytes)).as_deref(),
            Some("2.7.2")
        );
    }

    #[test]
    fn rejects_similar_missing_and_ambiguous_versions() {
        for bytes in [
            b"MZ\x002.7.20\x00".as_slice(),
            b"MZ\x002.7.2\x00payload\x002.7.2\x00".as_slice(),
            b"MZ\x002.7.2\x00payload\x002.8.0\x00".as_slice(),
            b"MZ no supported release".as_slice(),
        ] {
            let fixture = Fixture::new();
            assert_eq!(embedded_cavalry_version(&fixture.executable(bytes)), None);
        }
    }

    fn write_install(root: &Path) {
        fs::create_dir_all(root).unwrap();
        fs::write(
            root.join("Cavalry.exe"),
            b"MZ\x00sentry-release\x00\x002.8.0\x00/.crashdb\x00",
        )
        .unwrap();
        fs::write(root.join("Qt6Core.dll"), b"fixture").unwrap();
    }

    #[test]
    fn resolves_direct_nested_and_executable_paths() {
        let fixture = Fixture::new();
        let parent = fixture.0.join("Program Files");
        let install = parent.join("Cavalry/New Folder");
        write_install(&install);
        assert_eq!(resolve_install_root(&parent).unwrap(), install);
        assert_eq!(resolve_install_root(&install).unwrap(), install);
        assert_eq!(
            resolve_install_root(&install.join("Cavalry.exe")).unwrap(),
            install
        );
    }

    #[test]
    fn rejects_multiple_or_incomplete_installs() {
        let fixture = Fixture::new();
        let first = fixture.0.join("first");
        let second = fixture.0.join("second");
        write_install(&first);
        write_install(&second);
        assert!(resolve_install_root(&fixture.0).is_err());
        let incomplete = fixture.0.join("incomplete");
        fs::create_dir(&incomplete).unwrap();
        fs::write(incomplete.join("Cavalry.exe"), b"fixture").unwrap();
        fs::write(incomplete.join("CavalryPlayer.exe"), b"fixture").unwrap();
        assert!(resolve_install_root(&incomplete).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn does_not_follow_directory_links() {
        let fixture = Fixture::new();
        let actual = fixture.0.join("actual");
        write_install(&actual);
        let linked = fixture.0.join("linked");
        std::os::unix::fs::symlink(&actual, &linked).unwrap();
        assert!(resolve_install_root(&linked).is_err());
    }
}
