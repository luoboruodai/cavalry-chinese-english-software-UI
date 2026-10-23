//! Bounded, read-only Cavalry version markers for official Windows executables.
use std::{fs::File, io::Read, path::Path};

const VERSION_TOKENS: &[(&str, &[u8])] =
    &[("2.7.2", b"\x002.7.2\x00"), ("2.8.0", b"\x002.8.0\x00")];
const MAX_TOKEN_BYTES: usize = 7;

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
}
