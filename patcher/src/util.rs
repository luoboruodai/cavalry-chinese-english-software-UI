//! 通用工具：SHA-256（std-only 实现）、原子写入（同目录临时文件 + rename）、
//! 系统命令执行、目录遍历、时间戳。

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::error::{msg, Result};

static TMP_COUNTER: AtomicU64 = AtomicU64::new(0);

pub struct CommandOutput {
    pub success: bool,
    pub code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
}

pub fn run(program: &str, args: &[String]) -> Result<CommandOutput> {
    let output = Command::new(program).args(args).output()?;
    Ok(CommandOutput {
        success: output.status.success(),
        code: output.status.code(),
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
    })
}

/// 以「同目录临时文件 + rename 原子替换」方式写入。
/// macOS App Management 会拒绝直接 open 已签名 app 内的文件写入，
/// 但 rename 替换可行，因此 bundle 内的所有写入都必须走这里。
///
/// `mode` 为 None 时：目标已存在则保留其权限位，否则用 0o644。
pub fn atomic_write(path: &Path, bytes: &[u8]) -> Result<()> {
    atomic_write_with_mode(path, bytes, None)
}

pub fn atomic_write_with_mode(path: &Path, bytes: &[u8], mode: Option<u32>) -> Result<()> {
    let parent = path
        .parent()
        .ok_or_else(|| msg(format!("无效路径（无父目录）: {}", path.display())))?;
    let name = path
        .file_name()
        .ok_or_else(|| msg(format!("无效路径（无文件名）: {}", path.display())))?
        .to_string_lossy()
        .into_owned();
    let unique = TMP_COUNTER.fetch_add(1, Ordering::Relaxed);
    let tmp = parent.join(format!(
        ".{name}.cbpatch-{}-{unique}",
        std::process::id()
    ));
    let result = (|| -> Result<()> {
        fs::write(&tmp, bytes)?;
        let effective_mode = mode.or_else(|| permissions_mode(path));
        set_mode(&tmp, effective_mode.unwrap_or(0o644))?;
        fs::rename(&tmp, path)?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    result
}

#[cfg(unix)]
fn permissions_mode(path: &Path) -> Option<u32> {
    use std::os::unix::fs::PermissionsExt;
    fs::metadata(path).ok().map(|meta| meta.permissions().mode())
}

#[cfg(not(unix))]
fn permissions_mode(_path: &Path) -> Option<u32> {
    None
}

#[cfg(unix)]
fn set_mode(path: &Path, mode: u32) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(mode))?;
    Ok(())
}

#[cfg(not(unix))]
fn set_mode(_path: &Path, _mode: u32) -> Result<()> {
    Ok(())
}

#[cfg(unix)]
pub fn mode_of(path: &Path) -> Result<Option<u32>> {
    use std::os::unix::fs::PermissionsExt;
    Ok(Some(fs::metadata(path)?.permissions().mode()))
}

#[cfg(not(unix))]
pub fn mode_of(_path: &Path) -> Result<Option<u32>> {
    Ok(None)
}

pub fn now_unix_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

/// RFC3339 UTC 时间戳（std 无日历格式化，调用系统 `date`）。
pub fn rfc3339_now() -> Result<String> {
    let output = run("date", &["-u".to_string(), "+%Y-%m-%dT%H:%M:%SZ".to_string()])?;
    if output.success {
        Ok(output.stdout.trim().to_string())
    } else {
        Err(msg(format!(
            "生成 RFC3339 时间戳失败: {}",
            output.stderr.trim()
        )))
    }
}

/// 递归列出 root 下所有常规文件（相对路径，已排序）。
pub fn walk_relative(root: &Path) -> Result<Vec<PathBuf>> {
    let mut out = Vec::new();
    walk_relative_into(root, root, &mut out)?;
    out.sort();
    Ok(out)
}

fn walk_relative_into(base: &Path, dir: &Path, out: &mut Vec<PathBuf>) -> Result<()> {
    if !dir.is_dir() {
        return Ok(());
    }
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            walk_relative_into(base, &path, out)?;
        } else if file_type.is_file() {
            out.push(path.strip_prefix(base).unwrap().to_path_buf());
        }
    }
    Ok(())
}

pub fn sha256_hex(data: &[u8]) -> String {
    let digest = sha256(data);
    let mut hex = String::with_capacity(64);
    for byte in digest {
        hex.push_str(&format!("{byte:02x}"));
    }
    hex
}

pub fn file_sha256(path: &Path) -> Result<String> {
    Ok(sha256_hex(&fs::read(path)?))
}

/// FIPS 180-4 SHA-256 的最小完整实现（避免引入外部 crate）。
fn sha256(data: &[u8]) -> [u8; 32] {
    const K: [u32; 64] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
        0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
        0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
        0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
        0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
        0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
        0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
        0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
        0xc67178f2,
    ];
    let mut h: [u32; 8] = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab,
        0x5be0cd19,
    ];

    let bit_len = (data.len() as u64).wrapping_mul(8);
    let mut message = data.to_vec();
    message.push(0x80);
    while message.len() % 64 != 56 {
        message.push(0);
    }
    message.extend_from_slice(&bit_len.to_be_bytes());

    for chunk in message.as_chunks::<64>().0 {
        let mut w = [0u32; 64];
        for (index, word) in w.iter_mut().take(16).enumerate() {
            *word = u32::from_be_bytes([
                chunk[index * 4],
                chunk[index * 4 + 1],
                chunk[index * 4 + 2],
                chunk[index * 4 + 3],
            ]);
        }
        for index in 16..64 {
            let s0 = w[index - 15].rotate_right(7)
                ^ w[index - 15].rotate_right(18)
                ^ (w[index - 15] >> 3);
            let s1 = w[index - 2].rotate_right(17)
                ^ w[index - 2].rotate_right(19)
                ^ (w[index - 2] >> 10);
            w[index] = w[index - 16]
                .wrapping_add(s0)
                .wrapping_add(w[index - 7])
                .wrapping_add(s1);
        }

        let (mut a, mut b, mut c, mut d, mut e, mut f, mut g, mut hh) =
            (h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7]);

        for index in 0..64 {
            let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ ((!e) & g);
            let t1 = hh
                .wrapping_add(s1)
                .wrapping_add(ch)
                .wrapping_add(K[index])
                .wrapping_add(w[index]);
            let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let t2 = s0.wrapping_add(maj);
            hh = g;
            g = f;
            f = e;
            e = d.wrapping_add(t1);
            d = c;
            c = b;
            b = a;
            a = t1.wrapping_add(t2);
        }

        h[0] = h[0].wrapping_add(a);
        h[1] = h[1].wrapping_add(b);
        h[2] = h[2].wrapping_add(c);
        h[3] = h[3].wrapping_add(d);
        h[4] = h[4].wrapping_add(e);
        h[5] = h[5].wrapping_add(f);
        h[6] = h[6].wrapping_add(g);
        h[7] = h[7].wrapping_add(hh);
    }

    let mut digest = [0u8; 32];
    for (index, word) in h.iter().enumerate() {
        digest[index * 4..index * 4 + 4].copy_from_slice(&word.to_be_bytes());
    }
    digest
}

#[cfg(test)]
mod tests {
    use super::{atomic_write, sha256_hex};

    #[test]
    fn sha256_matches_known_vectors() {
        assert_eq!(
            sha256_hex(b""),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
        assert_eq!(
            sha256_hex(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
        assert_eq!(
            sha256_hex(b"abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"),
            "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"
        );
        let million_a = vec![b'a'; 1_000_000];
        assert_eq!(
            sha256_hex(&million_a),
            "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0"
        );
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn sha256_matches_shasum_system_tool() {
        use super::run;
        let data: Vec<u8> = (0..255u8).cycle().take(10_003).collect();
        let temp = std::env::temp_dir().join(format!("cbpatch-sha-{}", std::process::id()));
        std::fs::write(&temp, &data).unwrap();
        let output = run(
            "shasum",
            &[
                "-a".to_string(),
                "256".to_string(),
                temp.to_string_lossy().into_owned(),
            ],
        )
        .unwrap();
        let _ = std::fs::remove_file(&temp);
        let system_hex = output.stdout.split_whitespace().next().unwrap().to_string();
        assert_eq!(sha256_hex(&data), system_hex);
    }

    #[test]
    fn atomic_write_replaces_and_preserves_existing_mode() {
        #[cfg(unix)]
        use std::os::unix::fs::PermissionsExt;

        let dir = std::env::temp_dir().join(format!("cbpatch-atomic-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let target = dir.join("file.txt");
        std::fs::write(&target, b"old").unwrap();
        #[cfg(unix)]
        std::fs::set_permissions(&target, std::fs::Permissions::from_mode(0o755)).unwrap();

        atomic_write(&target, b"new").unwrap();
        assert_eq!(std::fs::read(&target).unwrap(), b"new");
        #[cfg(unix)]
        assert_eq!(
            std::fs::metadata(&target).unwrap().permissions().mode() & 0o777,
            0o755
        );

        // 目标不存在时用传入 mode。
        let fresh = dir.join("fresh.sh");
        super::atomic_write_with_mode(&fresh, b"x", Some(0o755)).unwrap();
        #[cfg(unix)]
        assert_eq!(
            std::fs::metadata(&fresh).unwrap().permissions().mode() & 0o777,
            0o755
        );

        let _ = std::fs::remove_dir_all(&dir);
    }
}
