//! Real Windows system boundary. File transactions live in a platform-neutral, fixture-tested module.
use crate::{
    backup,
    compatibility::Compatibility,
    config::Settings,
    detect::{AppState, StatusReport},
    error::msg,
    operation_lock::OperationLock,
    ops::{ApplySummary, RestoreSummary},
    signing::SigningSummary,
    util, windows_deployment as deployment, Result,
};
use std::{
    collections::HashSet,
    ffi::OsString,
    fs,
    os::windows::ffi::{OsStrExt, OsStringExt},
    path::{Path, PathBuf},
    ptr,
};
use windows_sys::Win32::{
    Foundation::*,
    Storage::FileSystem::*,
    System::{Diagnostics::ToolHelp::*, Threading::*},
};
fn wide(path: &Path) -> Vec<u16> {
    path.as_os_str().encode_wide().chain(Some(0)).collect()
}
pub fn is_cavalry_install(path: &Path) -> bool {
    crate::windows_version::is_install_root(path)
}
pub fn resolve_install_root(path: &Path) -> Result<PathBuf> {
    crate::windows_version::resolve_install_root(path).map_err(|error| msg(error))
}
pub fn default_app_path() -> PathBuf {
    if let Some(running) = running_app_path() {
        return running;
    }
    for name in ["ProgramFiles", "ProgramW6432", "LOCALAPPDATA"] {
        if let Some(base) = std::env::var_os(name) {
            for suffix in ["Cavalry", "Programs/Cavalry"] {
                let root = PathBuf::from(&base).join(suffix);
                if root.join("Cavalry.exe").is_file() {
                    return root;
                }
            }
        }
    }
    PathBuf::from(std::env::var_os("ProgramFiles").unwrap_or_else(|| "C:\\Program Files".into()))
        .join("Cavalry")
}

/// Prefer the exact Cavalry installation that is already running. This keeps
/// refresh/apply/restore useful for per-user or custom Windows installs that
/// are not under one of the conventional Program Files locations.
///
/// Process enumeration order is not stable. Collect every readable Cavalry
/// process and choose the most recently created one instead of returning the
/// first arbitrary 2.7/2.8 instance. If one process is inaccessible, keep
/// scanning rather than turning a permission failure into "not detected".
fn running_app_path() -> Option<PathBuf> {
    unsafe {
        let handle = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if handle == INVALID_HANDLE_VALUE {
            return None;
        }
        let snapshot = Handle(handle);
        let mut entry: PROCESSENTRY32W = std::mem::zeroed();
        entry.dwSize = std::mem::size_of_val(&entry) as u32;
        let mut candidates: Vec<(u64, PathBuf)> = Vec::new();
        let mut seen = HashSet::new();
        let mut present = Process32FirstW(snapshot.0, &mut entry);
        while present != 0 {
            let end = entry
                .szExeFile
                .iter()
                .position(|c| *c == 0)
                .unwrap_or(entry.szExeFile.len());
            if String::from_utf16_lossy(&entry.szExeFile[..end])
                .eq_ignore_ascii_case("Cavalry.exe")
            {
                if let Some((root, created)) = process_root(entry.th32ProcessID) {
                    let key = root.to_string_lossy().to_ascii_lowercase();
                    if seen.insert(key) {
                        candidates.push((created, root));
                    }
                }
            }
            present = Process32NextW(snapshot.0, &mut entry);
        }
        candidates.sort_by(|left, right| right.0.cmp(&left.0));
        candidates.into_iter().next().map(|(_, root)| root)
    }
}

/// Read one process path and its creation time. The latter is used only to
/// make multiple simultaneously running Cavalry versions deterministic.
fn process_root(pid: u32) -> Option<(PathBuf, u64)> {
    unsafe {
        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if process.is_null() {
            return None;
        }
        let process = Handle(process);
        let mut buffer = vec![0u16; 32768];
        let mut size = buffer.len() as u32;
        if QueryFullProcessImageNameW(process.0, 0, buffer.as_mut_ptr(), &mut size) == 0 {
            return None;
        }
        let executable = PathBuf::from(OsString::from_wide(&buffer[..size as usize]));
        let root = executable.parent()?.to_path_buf();
        if !root.join("Cavalry.exe").is_file() {
            return None;
        }
        let mut creation = FILETIME { dwLowDateTime: 0, dwHighDateTime: 0 };
        let mut exit = FILETIME { dwLowDateTime: 0, dwHighDateTime: 0 };
        let mut kernel = FILETIME { dwLowDateTime: 0, dwHighDateTime: 0 };
        let mut user = FILETIME { dwLowDateTime: 0, dwHighDateTime: 0 };
        let created = if GetProcessTimes(process.0, &mut creation, &mut exit, &mut kernel, &mut user) != 0 {
            (u64::from(creation.dwHighDateTime) << 32) | u64::from(creation.dwLowDateTime)
        } else {
            0
        };
        Some((fs::canonicalize(&root).ok().unwrap_or(root), created))
    }
}
pub fn product_version(path: &Path) -> Result<[u16; 4]> {
    let name = wide(path);
    let mut handle = 0;
    unsafe {
        let size = GetFileVersionInfoSizeW(name.as_ptr(), &mut handle);
        if size == 0 || size > 8 * 1024 * 1024 {
            return Err(msg("无法读取 Windows 文件版本信息"));
        }
        let mut data = vec![0u8; size as usize];
        if GetFileVersionInfoW(name.as_ptr(), 0, size, data.as_mut_ptr().cast()) == 0 {
            return Err(std::io::Error::last_os_error().into());
        }
        let query = [b'\\' as u16, 0];
        let mut value = ptr::null_mut();
        let mut length = 0;
        if VerQueryValueW(
            data.as_ptr().cast(),
            query.as_ptr(),
            &mut value,
            &mut length,
        ) == 0
            || value.is_null()
            || (length as usize) < std::mem::size_of::<VS_FIXEDFILEINFO>()
        {
            return Err(msg("Windows 版本资源不完整"));
        }
        let info = ptr::read_unaligned(value as *const VS_FIXEDFILEINFO);
        if info.dwSignature != 0xfeef04bd {
            return Err(msg("Windows 版本资源签名不正确"));
        }
        Ok([
            (info.dwProductVersionMS >> 16) as u16,
            info.dwProductVersionMS as u16,
            (info.dwProductVersionLS >> 16) as u16,
            info.dwProductVersionLS as u16,
        ])
    }
}
fn version3(value: [u16; 4]) -> String {
    format!("{}.{}.{}", value[0], value[1], value[2])
}
fn cavalry_version(executable: &Path) -> Result<String> {
    if let Ok(version) = product_version(executable) {
        return Ok(version3(version));
    }
    crate::windows_version::embedded_cavalry_version(executable)
        .ok_or_else(|| msg("无法识别 Cavalry 版本：文件版本资源缺失，且未找到唯一受支持版本标记"))
}
fn identity(root: &Path) -> Result<deployment::Identity> {
    let exe = root.join("Cavalry.exe");
    let qt = root.join("Qt6Core.dll");
    let version = cavalry_version(&exe)?;
    let qt_version = product_version(&qt)?;
    if qt_version[3] != 0 {
        return Err(msg("尚未验证此 Qt 构建号"));
    }
    Ok(deployment::Identity {
        version,
        qt_version: version3(qt_version),
        executable_hash: util::file_sha256(&exe)?,
        qt_hash: util::file_sha256(&qt)?,
    })
}
struct Handle(HANDLE);
impl Drop for Handle {
    fn drop(&mut self) {
        unsafe {
            CloseHandle(self.0);
        }
    }
}
pub fn ensure_not_running(root: &Path) -> Result<()> {
    let root = fs::canonicalize(root)?;
    unsafe {
        let handle = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if handle == INVALID_HANDLE_VALUE {
            return Err(std::io::Error::last_os_error().into());
        }
        let snapshot = Handle(handle);
        let mut entry: PROCESSENTRY32W = std::mem::zeroed();
        entry.dwSize = std::mem::size_of_val(&entry) as u32;
        let mut present = Process32FirstW(snapshot.0, &mut entry);
        while present != 0 {
            let end = entry
                .szExeFile
                .iter()
                .position(|c| *c == 0)
                .unwrap_or(entry.szExeFile.len());
            if String::from_utf16_lossy(&entry.szExeFile[..end]).eq_ignore_ascii_case("Cavalry.exe")
            {
                let process =
                    OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, entry.th32ProcessID);
                if process.is_null() {
                    return Err(msg(
                        "检测到 Cavalry 进程但无法核对路径，请保存并退出所有 Cavalry 后重试",
                    ));
                }
                let process = Handle(process);
                let mut buffer = vec![0u16; 32768];
                let mut size = buffer.len() as u32;
                if QueryFullProcessImageNameW(process.0, 0, buffer.as_mut_ptr(), &mut size) == 0 {
                    return Err(msg("无法核对运行中的 Cavalry 路径，操作已停止"));
                }
                let path = PathBuf::from(OsString::from_wide(&buffer[..size as usize]));
                if fs::canonicalize(&path)?.starts_with(&root) {
                    return Err(msg("目标 Cavalry 正在运行，请保存工程并自行退出后重试"));
                }
            }
            present = Process32NextW(snapshot.0, &mut entry);
        }
        if GetLastError() != ERROR_NO_MORE_FILES {
            return Err(msg("Windows 进程枚举未完整完成，操作已停止"));
        }
    }
    Ok(())
}
pub fn compatibility(root: &Path) -> Result<Compatibility> {
    match identity(root) {
        Ok(id) => {
            let state = deployment::inspect(root, &id);
            Ok(Compatibility {
                can_apply: state.is_ok(),
                level: if state.is_ok() {
                    "candidate"
                } else {
                    "blocked"
                },
                qt_version: Some(id.qt_version),
                message: state
                    .map(|_| {
                        "Windows x64 / Cavalry 2.7.2 / Qt 6.6.3 身份匹配；仍需 Windows 实机验收。"
                            .into()
                    })
                    .unwrap_or_else(|e| e.to_string()),
            })
        }
        Err(e) => Ok(Compatibility {
            can_apply: false,
            level: "blocked",
            qt_version: None,
            message: e.to_string(),
        }),
    }
}
pub fn status(root: &Path) -> Result<StatusReport> {
    let version = cavalry_version(&root.join("Cavalry.exe")).ok();
    let state = identity(root)
        .and_then(|id| deployment::inspect(root, &id))
        .map(|state| match state {
            "ours" => AppState::Ours,
            "daftai" => AppState::Daftai,
            _ => AppState::Vendor,
        })
        .unwrap_or(AppState::Incomplete);
    Ok(StatusReport {
        cavalry_version: version,
        executable: Some("Cavalry.exe".into()),
        state,
        lang: fs::read_to_string(root.join("cavalry-i18n-lang.txt"))
            .ok()
            .map(|s| s.trim().into()),
        signing: SigningSummary::default(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn gui_version_lookup_uses_windows_executable_not_macos_plist() {
        let root = std::env::temp_dir().join(format!("cb-gui-windows-version-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir(&root).unwrap();
        fs::write(root.join("Cavalry.exe"), b"MZ\x00sentry-release\x00\x002.7.2\x00/.crashdb\x00").unwrap();
        assert_eq!(crate::detect::cavalry_version(&root).unwrap().as_deref(), Some("2.7.2"));
        fs::remove_dir_all(root).unwrap();
    }
}
pub fn apply(
    root: &Path,
    generic: &Path,
    settings: &Settings,
    backup_root: &Path,
) -> Result<ApplySummary> {
    let _lock = OperationLock::acquire(root)?;
    ensure_not_running(root)?;
    let id = identity(root)?;
    let runtime = generic
        .parent()
        .and_then(|p| p.parent())
        .ok_or_else(|| msg("Windows 注入器资源路径无效"))?;
    let artifacts = deployment::Artifacts {
        generic: generic.into(),
        proxy: runtime.join("qpa/qwindows.dll"),
    };
    let (_, asset_strings_updated) = crate::assets::prepare(root, settings)?;
    let (backup_dir, state) = deployment::apply(root, &id, &artifacts, settings, backup_root)?;
    Ok(ApplySummary {
        ok: true,
        app: root.into(),
        backup_dir,
        asset_strings_updated,
        state_before: match state.as_str() {
            "ours" => AppState::Ours,
            "daftai" => AppState::Daftai,
            _ => AppState::Vendor,
        },
    })
}
pub fn restore(root: &Path, dir: &Path, backup_root: &Path) -> Result<RestoreSummary> {
    let _lock = OperationLock::acquire(root)?;
    ensure_not_running(root)?;
    let id = identity(root)?;
    let (restored, removed) = deployment::restore(root, &id, dir, backup_root)?;
    Ok(RestoreSummary {
        ok: true,
        app: root.into(),
        backup_dir: dir.into(),
        restored,
        removed,
    })
}
pub fn restore_latest(root: &Path, backup_root: &Path) -> Result<RestoreSummary> {
    let dir = backup::latest_backup_dir(backup_root)?.ok_or_else(|| msg("没有 Windows 快照"))?;
    restore(root, &dir, backup_root)
}
pub fn backup_state(dir: &Path) -> Result<String> {
    Ok(deployment::summary(dir)?.state)
}
pub fn families() -> Vec<String> {
    use windows_sys::Win32::Graphics::Gdi::*;
    unsafe extern "system" fn collect(
        font: *const LOGFONTW,
        _metrics: *const TEXTMETRICW,
        _kind: u32,
        data: isize,
    ) -> i32 {
        if !font.is_null() {
            let font = unsafe { &*font };
            let size = font.lfFaceName.iter().position(|c| *c == 0).unwrap_or(32);
            let family = String::from_utf16_lossy(&font.lfFaceName[..size]);
            if !family.is_empty() && !family.starts_with('@') {
                unsafe { &mut *(data as *mut Vec<String>) }.push(family);
            }
        }
        1
    }
    let mut families = Vec::<String>::new();
    unsafe {
        let dc = GetDC(ptr::null_mut());
        if dc.is_null() {
            return families;
        }
        let mut query: LOGFONTW = std::mem::zeroed();
        query.lfCharSet = DEFAULT_CHARSET;
        EnumFontFamiliesExW(
            dc,
            &query,
            Some(collect),
            &mut families as *mut Vec<String> as isize,
            0,
        );
        ReleaseDC(ptr::null_mut(), dc);
    }
    families.sort();
    families.dedup();
    families
}
pub fn replace_file(source: &Path, target: &Path) -> Result<()> {
    if unsafe {
        MoveFileExW(
            wide(source).as_ptr(),
            wide(target).as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    } == 0
    {
        return Err(std::io::Error::last_os_error().into());
    }
    Ok(())
}
