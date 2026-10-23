//! Official Cavalry downloads are checked first, streamed with feedback, and never installed.
use regex::Regex;
use reqwest::{blocking::Client, redirect::Policy, Url};
use semver::Version;
use serde::{Deserialize, Serialize};
use std::{
    fs::{self, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::atomic::{AtomicBool, Ordering},
    time::{Duration, Instant},
};

pub const RELEASE_SOURCE: &str = "https://cavalry.studio/docs/";
pub const DOWNLOAD_SOURCE: &str = "https://cavalry.studio/downloads/latest/Cavalry.dmg";
const MAX_PAGE_BYTES: u64 = 1_048_576;
const MAX_DOWNLOAD_BYTES: u64 = 1_073_741_824;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseInfo {
    pub version: String,
    pub notes_url: String,
    pub source_url: String,
    pub checked_at: u64,
    pub download_supported: bool,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub phase: &'static str,
    pub downloaded: u64,
    pub total: Option<u64>,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadResult {
    pub status: &'static str,
    pub path: Option<String>,
    pub version: String,
}
#[derive(Default)]
pub struct DownloadState {
    running: AtomicBool,
    cancelled: AtomicBool,
}
struct DownloadGuard<'a>(&'a DownloadState);
impl Drop for DownloadGuard<'_> {
    fn drop(&mut self) {
        self.0.running.store(false, Ordering::SeqCst);
    }
}
impl DownloadState {
    fn begin(&self) -> Result<DownloadGuard<'_>, String> {
        self.running
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .map_err(|_| "已有下载正在进行，请等待或先取消")?;
        self.cancelled.store(false, Ordering::SeqCst);
        Ok(DownloadGuard(self))
    }
    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::SeqCst);
    }
}

pub(crate) fn official_client() -> Result<Client, String> {
    Client::builder()
        .https_only(true)
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(20))
        .user_agent("Cavalry-Bilingual/0.1.3 update-check")
        .redirect(Policy::custom(|attempt| {
            if attempt.previous().len() < 5
                && attempt.url().scheme() == "https"
                && attempt.url().host_str() == Some("cavalry.studio")
            {
                attempt.follow()
            } else {
                attempt.error("下载地址不在已验证的官网范围内")
            }
        }))
        .build()
        .map_err(|_| "无法初始化安全连接".into())
}
fn normalized_version(text: &str) -> Result<Version, String> {
    let normalized = if text.matches('.').count() == 1 {
        format!("{text}.0")
    } else {
        text.to_string()
    };
    Version::parse(&normalized).map_err(|_| "官网版本信息无法识别，请稍后再试".into())
}
pub(crate) fn parse_release(html: &str) -> Result<ReleaseInfo, String> {
    let start = html
        .find("Latest version:")
        .ok_or("官网暂未提供可识别的版本信息")?;
    let fragment: String = html[start..].chars().take(4096).collect();
    let version_re =
        Regex::new(r"(?s)Latest version:\s*(?:<[^>]*>\s*)*([0-9]+\.[0-9]+(?:\.[0-9]+)?)").unwrap();
    let captures = version_re
        .captures(&fragment)
        .ok_or("官网版本信息无法识别")?;
    let mut version = normalized_version(&captures[1])?;
    let link_re =
        Regex::new(r#"href=["']?([^\s"'>]+/([0-9]+)-([0-9]+)-([0-9]+)-release-notes/)"#).unwrap();
    let notes = link_re
        .captures(&fragment)
        .ok_or("官网发行说明缺失，暂不提供下载")?;
    let detailed = Version::new(
        notes[2].parse().unwrap_or(0),
        notes[3].parse().unwrap_or(0),
        notes[4].parse().unwrap_or(0),
    );
    if detailed.major != version.major || detailed.minor != version.minor {
        return Err("官网版本与发行说明不一致，请稍后再试".into());
    }
    if captures[1].matches('.').count() == 2 && version != detailed {
        return Err("官网补丁版本与发行说明不一致，请稍后再试".into());
    }
    version = detailed;
    let notes_url = Url::parse(RELEASE_SOURCE)
        .unwrap()
        .join(&notes[1])
        .map_err(|_| "发行说明地址无效")?;
    if notes_url.scheme() != "https"
        || notes_url.host_str() != Some("cavalry.studio")
        || !notes_url
            .path()
            .starts_with("/docs/tech-info/release-notes/")
    {
        return Err("发行说明不是已验证的官网地址".into());
    }
    Ok(ReleaseInfo {
        version: version.to_string(),
        notes_url: notes_url.to_string(),
        source_url: RELEASE_SOURCE.into(),
        checked_at: cbpatch::util::now_unix_secs(),
        download_supported: cfg!(target_os = "macos"),
    })
}
pub fn check_release() -> Result<ReleaseInfo, String> {
    let response = official_client()?
        .get(RELEASE_SOURCE)
        .send()
        .and_then(|response| response.error_for_status())
        .map_err(|_| "暂时无法连接官网，请检查网络后重试")?;
    let mut html = String::new();
    response
        .take(MAX_PAGE_BYTES + 1)
        .read_to_string(&mut html)
        .map_err(|_| "读取官网版本信息失败，请重试")?;
    if html.len() as u64 > MAX_PAGE_BYTES {
        return Err("官网返回的版本页面过大，暂不处理".into());
    }
    parse_release(&html)
}

fn write_download<R: Read, W: Write>(
    mut reader: R,
    mut writer: W,
    total: Option<u64>,
    cancelled: &AtomicBool,
    mut progress: impl FnMut(DownloadProgress),
) -> Result<bool, String> {
    let mut buf = [0_u8; 64 * 1024];
    let mut received = 0;
    let start = Instant::now();
    let mut notified = Instant::now();
    progress(DownloadProgress {
        phase: "downloading",
        downloaded: 0,
        total,
    });
    loop {
        if cancelled.load(Ordering::SeqCst) {
            return Ok(false);
        }
        let n = match reader.read(&mut buf) {
            Ok(n) => n,
            Err(_) if cancelled.load(Ordering::SeqCst) => return Ok(false),
            Err(_) => return Err("下载连接中断，未完成的文件已移除，可重试".into()),
        };
        if cancelled.load(Ordering::SeqCst) {
            return Ok(false);
        }
        if n == 0 {
            break;
        }
        received += n as u64;
        if received > MAX_DOWNLOAD_BYTES || start.elapsed() > Duration::from_secs(1800) {
            return Err("下载超出本次安全范围，请通过官网手动下载".into());
        }
        writer
            .write_all(&buf[..n])
            .map_err(|_| "写入下载文件失败，请检查磁盘空间")?;
        if notified.elapsed() > Duration::from_millis(120) {
            progress(DownloadProgress {
                phase: "downloading",
                downloaded: received,
                total,
            });
            notified = Instant::now();
        }
    }
    if received == 0 || total.is_some_and(|expected| expected != received) {
        return Err("安装包未完整下载，请重试".into());
    }
    writer.flush().map_err(|_| "保存下载文件失败")?;
    progress(DownloadProgress {
        phase: "verifying",
        downloaded: received,
        total,
    });
    Ok(true)
}
struct PartialFile(PathBuf);
impl Drop for PartialFile {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.0);
    }
}
fn unused_destination(directory: &Path, version: &str) -> PathBuf {
    let base = directory.join(format!("Cavalry-{version}.dmg"));
    if !base.exists() {
        return base;
    }
    for n in 2.. {
        let candidate = directory.join(format!("Cavalry-{version}-{n}.dmg"));
        if !candidate.exists() {
            return candidate;
        }
    }
    unreachable!()
}

pub fn download_release(
    state: &DownloadState,
    requested_version: &str,
    progress: impl FnMut(DownloadProgress),
) -> Result<DownloadResult, String> {
    let _guard = state.begin()?;
    if !cfg!(target_os = "macos") {
        return Err("此安装包仅适用于 macOS；Windows 请使用官网安装包".into());
    }
    let release = match check_release() {
        Ok(release) => release,
        Err(_) if state.cancelled.load(Ordering::SeqCst) => {
            return Ok(DownloadResult {
                status: "cancelled",
                path: None,
                version: requested_version.into(),
            })
        }
        Err(message) => return Err(message),
    };
    if release.version != requested_version {
        return Err("官网版本已变化，请重新检查后再下载".into());
    }
    let cancelled = || DownloadResult {
        status: "cancelled",
        path: None,
        version: release.version.clone(),
    };
    if state.cancelled.load(Ordering::SeqCst) {
        return Ok(cancelled());
    }
    let home = std::env::var_os("HOME").ok_or("无法确定下载目录")?;
    let downloads = PathBuf::from(home).join("Downloads");
    fs::create_dir_all(&downloads).map_err(|_| "无法创建下载目录")?;
    let partial_path = downloads.join(format!(".Cavalry-{}.download", sentry_types::random_uuid()));
    let file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&partial_path)
        .map_err(|_| "无法在下载目录创建文件")?;
    let partial = PartialFile(partial_path);
    let response = match official_client()?
        .get(DOWNLOAD_SOURCE)
        .send()
        .and_then(|response| response.error_for_status())
    {
        Ok(response) => response,
        Err(_) if state.cancelled.load(Ordering::SeqCst) => return Ok(cancelled()),
        Err(_) => return Err("无法下载官网安装包，请检查网络后重试".into()),
    };
    let total = response.content_length();
    if total.is_some_and(|size| size > MAX_DOWNLOAD_BYTES) {
        return Err("官网安装包超出本次下载范围，请通过官网手动下载".into());
    }
    if !write_download(response, file, total, &state.cancelled, progress)? {
        return Ok(cancelled());
    }
    if state.cancelled.load(Ordering::SeqCst) {
        return Ok(cancelled());
    }
    #[cfg(target_os = "macos")]
    {
        let result = cbpatch::util::run(
            "hdiutil",
            &["verify".into(), partial.0.to_string_lossy().into_owned()],
        )
        .map_err(|_| "无法验证安装包，下载未保留")?;
        if !result.success {
            return Err("安装包校验未通过，下载未保留，请重试".into());
        }
    }
    if state.cancelled.load(Ordering::SeqCst) {
        return Ok(cancelled());
    }
    let destination = unused_destination(&downloads, &release.version);
    // A concurrent file cannot be overwritten; the completed partial is on the same volume.
    fs::hard_link(&partial.0, &destination)
        .map_err(|_| "无法保留安装包，可能有同名文件，请重试")?;
    Ok(DownloadResult {
        status: "downloaded",
        path: Some(destination.to_string_lossy().into_owned()),
        version: release.version,
    })
}

pub fn reveal_download(path: &Path) -> Result<(), String> {
    let downloads = PathBuf::from(std::env::var_os("HOME").ok_or("无法确定下载目录")?)
        .join("Downloads")
        .canonicalize()
        .map_err(|_| "下载目录不存在")?;
    let canonical = path.canonicalize().map_err(|_| "下载文件已移动或删除")?;
    if canonical.parent() != Some(downloads.as_path())
        || canonical.extension().and_then(|v| v.to_str()) != Some("dmg")
        || !canonical.is_file()
    {
        return Err("只能打开本次下载所在目录".into());
    }
    let result = cbpatch::util::run(
        "open",
        &["-R".into(), canonical.to_string_lossy().into_owned()],
    )
    .map_err(|_| "无法打开下载位置")?;
    if result.success {
        Ok(())
    } else {
        Err("无法打开下载位置".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    const DOCS: &str = r#"<p>Latest version: <strong>2.8</strong></p><a href=/docs/tech-info/release-notes/2.8/2-8-0-release-notes/>2.8 Release Notes</a>"#;
    #[test]
    fn reads_current_official_markup_and_normalizes_patch() {
        let r = parse_release(DOCS).unwrap();
        assert_eq!(r.version, "2.8.0");
        assert_eq!(
            r.notes_url,
            "https://cavalry.studio/docs/tech-info/release-notes/2.8/2-8-0-release-notes/"
        );
    }
    #[test]
    fn reads_quoted_and_patch_specific_versions() {
        let page = DOCS
            .replace("<strong>2.8</strong>", "<!-- -->2.8.1")
            .replace("2-8-0-release", "2-8-1-release")
            .replace("href=/docs/", "href=\"/docs/")
            .replace("release-notes/>", "release-notes/\">");
        assert_eq!(parse_release(&page).unwrap().version, "2.8.1");
    }
    #[test]
    fn fails_closed_on_missing_conflicting_or_external_release() {
        for page in [
            "maintenance".into(),
            DOCS.replace("2-8-0-release", "2-9-0-release"),
            DOCS.replace("href=/docs/", "href=https://example.invalid/docs/"),
        ] {
            assert!(parse_release(&page).is_err());
        }
    }
    #[test]
    fn cancellation_does_not_write_or_mark_complete() {
        let flag = AtomicBool::new(true);
        let mut out = Vec::new();
        assert!(!write_download(&b"fixture"[..], &mut out, Some(7), &flag, |_| {}).unwrap());
        assert!(out.is_empty());
    }
    #[test]
    fn streams_synthetic_bytes_and_checks_length() {
        let mut out = Vec::new();
        let mut events = Vec::new();
        assert!(write_download(
            &b"fixture"[..],
            &mut out,
            Some(7),
            &AtomicBool::new(false),
            |p| events.push(p)
        )
        .unwrap());
        assert_eq!(out, b"fixture");
        assert_eq!(events.last().unwrap().phase, "verifying");
        assert!(write_download(
            &b"short"[..],
            Vec::new(),
            Some(9),
            &AtomicBool::new(false),
            |_| {}
        )
        .is_err());
    }
    #[test]
    fn prevents_parallel_downloads_and_releases_guard() {
        let s = DownloadState::default();
        let first = s.begin().unwrap();
        assert!(s.begin().is_err());
        drop(first);
        assert!(s.begin().is_ok());
    }
    #[test]
    fn partial_cleanup_only_removes_its_owned_file() {
        let dir = std::env::temp_dir().join(format!("cb-partial-{}", sentry_types::random_uuid()));
        fs::create_dir(&dir).unwrap();
        let owned = dir.join("owned.download");
        let other = dir.join("keep.dmg");
        fs::write(&owned, b"partial").unwrap();
        fs::write(&other, b"keep").unwrap();
        drop(PartialFile(owned.clone()));
        assert!(!owned.exists());
        assert_eq!(fs::read(&other).unwrap(), b"keep");
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn protects_existing_downloads() {
        let dir = std::env::temp_dir().join(format!("cb-update-{}", sentry_types::random_uuid()));
        fs::create_dir(&dir).unwrap();
        let original = dir.join("Cavalry-2.8.0.dmg");
        fs::File::create(&original).unwrap();
        assert_eq!(
            unused_destination(&dir, "2.8.0"),
            dir.join("Cavalry-2.8.0-2.dmg")
        );
        fs::remove_dir_all(dir).unwrap();
    }
}
