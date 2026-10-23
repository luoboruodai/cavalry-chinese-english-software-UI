//! Windows QPA deployment contract. No elevation, no network and no process killing.
//! The proxy and original vendor DLL remain separate; the original is activated first on recovery.
use crate::{backup, config::Settings, error::msg, util, Result};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Component, Path, PathBuf},
};
const META: &str = "windows-snapshot.json";
const QPA: &str = "qwindows.dll";
const VENDOR: &str = "cavalry-i18n-qpa/vendor-qwindows.dll";
const MANIFEST: &str = "cavalry-i18n-qpa/manifest.json";
const GENERIC: &str = "generic/cavalryi18n.dll";
const MARKER: &str = "cavalry-i18n-lang.txt";
const SETTINGS: &str = "cavalry-bilingual-settings.json";
const OWNER: &str = "cavalry-bilingual.json";
const ASSETS: &str = "assets/Definitions/nodeStrings.json";
const FILES: &[&str] = &[
    QPA, VENDOR, MANIFEST, GENERIC, MARKER, SETTINGS, OWNER, ASSETS,
];
pub(crate) const REVIEWED_VENDOR: &str =
    "e039d39a6b99a26a358a85660147941112a4c9df3a62b5e19a8ae9ed75be3f01";
#[derive(Clone, Debug)]
pub(crate) struct Identity {
    pub version: String,
    pub qt_version: String,
    pub executable_hash: String,
    pub qt_hash: String,
}
#[derive(Clone)]
pub(crate) struct Artifacts {
    pub proxy: PathBuf,
    pub generic: PathBuf,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct QpaManifest {
    schema_version: u32,
    phase: String,
    cavalry_version: String,
    cavalry_executable_sha256: String,
    qt_version: String,
    architecture: String,
    vendor_qwindows_sha256: String,
    proxy_qwindows_sha256: String,
    generic_plugin_sha256: String,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Snapshot {
    schema_version: u32,
    pub version: String,
    pub state: String,
    target_id: String,
    executable_hash: String,
    qt_hash: String,
    files: Vec<Entry>,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Entry {
    path: String,
    hash: Option<String>,
}
fn target_id(root: &Path) -> Result<String> {
    Ok(util::sha256_hex(
        fs::canonicalize(root)?.to_string_lossy().as_bytes(),
    ))
}
fn safe(root: &Path, rel: &str) -> Result<PathBuf> {
    if !FILES.contains(&rel)
        || Path::new(rel)
            .components()
            .any(|p| !matches!(p, Component::Normal(_)))
    {
        return Err(msg("Windows 快照路径不在补丁白名单内"));
    }
    let mut path = root.to_path_buf();
    for part in Path::new(rel).components() {
        path.push(part);
        if let Ok(meta) = fs::symlink_metadata(&path) {
            if meta.file_type().is_symlink() {
                return Err(msg("Windows 补丁路径不得经过符号链接"));
            }
            #[cfg(windows)]
            {
                use std::os::windows::fs::MetadataExt;
                if meta.file_attributes() & 0x400 != 0 {
                    return Err(msg("Windows 补丁路径不得经过重解析点"));
                }
            }
        }
    }
    Ok(path)
}
fn read(root: &Path, rel: &str) -> Result<Vec<u8>> {
    Ok(fs::read(safe(root, rel)?)?)
}
fn write(root: &Path, rel: &str, bytes: &[u8]) -> Result<()> {
    let dst = safe(root, rel)?;
    fs::create_dir_all(dst.parent().unwrap())?;
    util::atomic_write(&dst, bytes)
}
fn parse_json<T: serde::de::DeserializeOwned>(bytes: &[u8]) -> Result<T> {
    serde_json::from_slice(bytes).map_err(|_| msg("Windows 补丁清单损坏或版本不受支持"))
}
fn bytes<T: Serialize>(value: &T) -> Result<Vec<u8>> {
    serde_json::to_vec_pretty(value).map_err(|e| msg(e.to_string()))
}
fn validate_identity(id: &Identity) -> Result<()> {
    if id.version != "2.7.2" || id.qt_version != "6.6.3" {
        return Err(msg("尚未验证此 Windows Cavalry / Qt 版本；不会写入补丁"));
    }
    Ok(())
}
fn manifest(root: &Path, id: &Identity, vendor: &str) -> Result<QpaManifest> {
    let m: QpaManifest = parse_json(&read(root, MANIFEST)?)?;
    if m.schema_version != 1
        || !["prepared", "active", "restoring"].contains(&m.phase.as_str())
        || m.cavalry_version != id.version
        || m.qt_version != id.qt_version
        || m.architecture != "x86_64"
        || m.cavalry_executable_sha256 != id.executable_hash
        || m.vendor_qwindows_sha256 != vendor
    {
        return Err(msg("Windows 运行时身份不匹配，可能已升级或被其他补丁更改"));
    }
    if util::sha256_hex(&read(root, VENDOR)?) != vendor {
        return Err(msg("原厂 qwindows.dll 恢复副本校验失败"));
    }
    Ok(m)
}
pub(crate) fn inspect(root: &Path, id: &Identity) -> Result<&'static str> {
    inspect_with_vendor(root, id, REVIEWED_VENDOR)
}
fn inspect_with_vendor(root: &Path, id: &Identity, vendor: &str) -> Result<&'static str> {
    validate_identity(id)?;
    let current = util::sha256_hex(&read(root, QPA)?);
    if !root.join(MANIFEST).exists() {
        if current != vendor {
            return Err(msg("不是已审核的原厂 qwindows.dll；拒绝覆盖未知平台插件"));
        }
        if FILES.iter().skip(1).filter(|rel| **rel != ASSETS).any(|rel| root.join(rel).exists()) {
            return Err(msg("存在无有效清单的同名运行时文件，需先人工检查"));
        }
        return Ok("vendor");
    }
    let m = manifest(root, id, vendor)?;
    if current != vendor && current != m.proxy_qwindows_sha256 {
        return Err(msg("Windows 平台插件已漂移，拒绝写入"));
    }
    if m.phase != "active" || current == vendor {
        return Err(msg("上次 Windows 操作未完成，请从已验证备份恢复"));
    }
    if util::sha256_hex(&read(root, GENERIC)?) != m.generic_plugin_sha256 {
        return Err(msg("Windows 翻译 DLL 校验失败"));
    }
    Ok(if root.join(OWNER).is_file() {
        "ours"
    } else {
        "daftai"
    })
}
fn capture(root: &Path, id: &Identity, backup_root: &Path, state: &str) -> Result<PathBuf> {
    let mut entries = Vec::new();
    for rel in FILES {
        let path = safe(root, rel)?;
        if path.exists() && !path.is_file() {
            return Err(msg("Windows 补丁目标不是普通文件"));
        }
        entries.push(Entry {
            path: (*rel).into(),
            hash: if path.is_file() {
                Some(util::file_sha256(&path)?)
            } else {
                None
            },
        });
    }
    let dir = backup::create_backup_dir(backup_root, &id.version, util::now_unix_secs())?;
    for entry in &entries {
        if entry.hash.is_some() {
            backup::backup_file(&dir, root, Path::new(&entry.path))?;
        }
    }
    let snapshot = Snapshot {
        schema_version: 2,
        version: id.version.clone(),
        state: state.into(),
        target_id: target_id(root)?,
        executable_hash: id.executable_hash.clone(),
        qt_hash: id.qt_hash.clone(),
        files: entries,
    };
    util::atomic_write(&dir.join(META), &bytes(&snapshot)?)?;
    load(&dir)?;
    Ok(dir)
}
pub(crate) fn summary(dir: &Path) -> Result<Snapshot> {
    let path = dir.join(META);
    if fs::symlink_metadata(&path)?.file_type().is_symlink() {
        return Err(msg("快照清单不得为符号链接"));
    }
    let snapshot: Snapshot = parse_json(&fs::read(path)?)?;
    if snapshot.schema_version != 2 || snapshot.files.len() != FILES.len() {
        return Err(msg("Windows 快照格式不受支持"));
    }
    Ok(snapshot)
}
fn load(dir: &Path) -> Result<Snapshot> {
    let snapshot = summary(dir)?;
    let mut seen = std::collections::HashSet::new();
    for entry in &snapshot.files {
        let path = safe(dir, &entry.path)?;
        if !seen.insert(&entry.path) {
            return Err(msg("快照包含重复文件"));
        }
        match &entry.hash {
            Some(hash) if path.is_file() && util::file_sha256(&path)? == *hash => (),
            None if !path.exists() => (),
            _ => return Err(msg("Windows 快照完整性校验失败；未写入应用")),
        }
    }
    Ok(snapshot)
}
fn restore_files(
    root: &Path,
    id: &Identity,
    dir: &Path,
    vendor: &str,
) -> Result<(Vec<String>, Vec<String>)> {
    let snapshot = load(dir)?;
    if snapshot.target_id != target_id(root)?
        || snapshot.version != id.version
        || snapshot.executable_hash != id.executable_hash
        || snapshot.qt_hash != id.qt_hash
    {
        return Err(msg("快照不属于此安装或宿主已升级，禁止跨版本恢复"));
    }
    let stock = if dir.join(VENDOR).is_file() {
        read(dir, VENDOR)?
    } else {
        read(dir, QPA)?
    };
    if util::sha256_hex(&stock) != vendor {
        return Err(msg("缺少可信的原厂平台插件，停止恢复"));
    }
    // Validate destination and read EVERY input before touching the app.
    let mut plan = Vec::new();
    for entry in &snapshot.files {
        safe(root, &entry.path)?;
        let content = if entry.hash.is_some() {
            Some(read(dir, &entry.path)?)
        } else {
            None
        };
        plan.push((entry.path.clone(), content));
    }
    write(root, QPA, &stock)?; // keep native launch usable throughout recovery
    let mut restored = Vec::new();
    let mut removed = Vec::new();
    for (rel, content) in plan.iter().filter(|(rel, _)| rel != QPA) {
        if let Some(data) = content {
            write(root, rel, data)?;
            restored.push(rel.clone());
        } else if root.join(rel).exists() {
            fs::remove_file(safe(root, rel)?)?;
            removed.push(rel.clone());
        }
    }
    let target = plan
        .iter()
        .find(|(rel, _)| rel == QPA)
        .and_then(|(_, bytes)| bytes.as_ref())
        .ok_or_else(|| msg("快照缺少平台插件"))?;
    write(root, QPA, target)?;
    restored.push(QPA.into());
    Ok((restored, removed))
}
fn valid_dll(data: &[u8]) -> bool {
    if data.len() < 0x40 || &data[..2] != b"MZ" {
        return false;
    }
    let at = u32::from_le_bytes(data[0x3c..0x40].try_into().unwrap()) as usize;
    at.checked_add(24).is_some_and(|end| end <= data.len())
        && &data[at..at + 4] == b"PE\0\0"
        && u16::from_le_bytes(data[at + 4..at + 6].try_into().unwrap()) == 0x8664
        && u16::from_le_bytes(data[at + 22..at + 24].try_into().unwrap()) & 0x2000 != 0
}
pub(crate) fn apply(
    root: &Path,
    id: &Identity,
    artifacts: &Artifacts,
    settings: &Settings,
    backup_root: &Path,
) -> Result<(PathBuf, String)> {
    apply_with_vendor(root, id, artifacts, settings, backup_root, REVIEWED_VENDOR)
}
fn apply_with_vendor(
    root: &Path,
    id: &Identity,
    artifacts: &Artifacts,
    settings: &Settings,
    backup_root: &Path,
    vendor: &str,
) -> Result<(PathBuf, String)> {
    settings.validate()?;
    let state = inspect_with_vendor(root, id, vendor)?;
    let proxy = fs::read(&artifacts.proxy)?;
    let generic = fs::read(&artifacts.generic)?;
    if !valid_dll(&proxy) || !valid_dll(&generic) {
        return Err(msg(
            "需要有效的 x64 Windows 注入器 DLL，不会使用 macOS 或其他架构的文件",
        ));
    }
    let stock = read(root, if state == "vendor" { QPA } else { VENDOR })?;
    let previous = Settings::load(&root.join(SETTINGS))?;
    let (asset_bytes, _) = crate::assets::compose(&read(root, ASSETS)?, settings, &previous)?;
    let snapshot = capture(root, id, backup_root, state)?;
    let mut m = QpaManifest {
        schema_version: 1,
        phase: "prepared".into(),
        cavalry_version: id.version.clone(),
        cavalry_executable_sha256: id.executable_hash.clone(),
        qt_version: id.qt_version.clone(),
        architecture: "x86_64".into(),
        vendor_qwindows_sha256: vendor.into(),
        proxy_qwindows_sha256: util::sha256_hex(&proxy),
        generic_plugin_sha256: util::sha256_hex(&generic),
    };
    let result = (|| -> Result<()> {
        write(root, VENDOR, &stock)?;
        write(root, MANIFEST, &bytes(&m)?)?;
        write(root, GENERIC, &generic)?;
        write(root, SETTINGS, &settings.bytes()?)?;
        write(root, ASSETS, &asset_bytes)?;
        write(root, MARKER, b"zh-Hans\n")?;
        write(
            root,
            OWNER,
            &bytes(
                &serde_json::json!({"version":env!("CARGO_PKG_VERSION"),"lang":"zh-Hans","installedAtUnix":util::now_unix_secs(),"assetScope":"nodeStrings-v1","runtimeSha256":util::sha256_hex(&generic)}),
            )?,
        )?;
        m.phase = "active".into();
        write(root, MANIFEST, &bytes(&m)?)?;
        write(root, QPA, &proxy)?; // activation is LAST, after the recovery DLL and verified payload exist
        inspect_with_vendor(root, id, vendor)?;
        Ok(())
    })();
    if let Err(error) = result {
        let rollback = restore_files(root, id, &snapshot, vendor);
        return Err(msg(format!(
            "Windows 应用失败：{error}；回滚{}；备份：{}。若是权限错误，请确认安装目录权限后重试。",
            if rollback.is_ok() {
                "完成"
            } else {
                "失败，请保留备份并人工恢复"
            },
            snapshot.display()
        )));
    }
    Ok((snapshot, state.into()))
}
pub(crate) fn restore(
    root: &Path,
    id: &Identity,
    dir: &Path,
    backup_root: &Path,
) -> Result<(Vec<String>, Vec<String>)> {
    restore_with_vendor(root, id, dir, backup_root, REVIEWED_VENDOR)
}
fn restore_with_vendor(
    root: &Path,
    id: &Identity,
    dir: &Path,
    backup_root: &Path,
    vendor: &str,
) -> Result<(Vec<String>, Vec<String>)> {
    let dir = fs::canonicalize(dir)?;
    let backup_root = fs::canonicalize(backup_root)?;
    if dir.parent() != Some(backup_root.as_path()) {
        return Err(msg("只能恢复当前备份库中的快照"));
    }
    let snapshot = load(&dir)?;
    if snapshot.target_id != target_id(root)?
        || snapshot.version != id.version
        || snapshot.executable_hash != id.executable_hash
        || snapshot.qt_hash != id.qt_hash
    {
        return Err(msg("快照不属于此安装版本"));
    }
    let safety = capture(root, id, &backup_root, "pre-restore")?;
    match restore_files(root, id, &dir, vendor) {
        Ok(result) => Ok(result),
        Err(error) => {
            let rollback = restore_files(root, id, &safety, vendor);
            Err(msg(format!(
                "Windows 恢复失败：{error}；回滚{}，安全快照：{}",
                if rollback.is_ok() { "完成" } else { "失败" },
                safety.display()
            )))
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    struct Fixture {
        base: PathBuf,
        root: PathBuf,
        backups: PathBuf,
        artifacts: Artifacts,
        id: Identity,
        vendor: String,
    }
    impl Fixture {
        fn new() -> Self {
            let base = std::env::temp_dir().join(format!(
                "cb-win-fixture-{}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ));
            let root = base.join("Cavalry");
            fs::create_dir_all(&root).unwrap();
            fs::create_dir_all(root.join("assets/Definitions")).unwrap();
            fs::write(root.join(ASSETS), crate::assets::sample_english()).unwrap();
            let backups = base.join("backups");
            let stock = b"synthetic reviewed vendor fixture";
            fs::write(root.join(QPA), stock).unwrap();
            let artifacts = Artifacts {
                proxy: base.join("proxy.dll"),
                generic: base.join("generic.dll"),
            };
            let mut pe = vec![0; 160];
            pe[..2].copy_from_slice(b"MZ");
            pe[0x3c..0x40].copy_from_slice(&64u32.to_le_bytes());
            pe[64..68].copy_from_slice(b"PE\0\0");
            pe[68..70].copy_from_slice(&0x8664u16.to_le_bytes());
            pe[86..88].copy_from_slice(&0x2000u16.to_le_bytes());
            fs::write(&artifacts.proxy, &pe).unwrap();
            pe[150] = 1;
            fs::write(&artifacts.generic, pe).unwrap();
            Self {
                base,
                root,
                backups,
                artifacts,
                id: Identity {
                    version: "2.7.2".into(),
                    qt_version: "6.6.3".into(),
                    executable_hash: "test-executable".into(),
                    qt_hash: "test-qt".into(),
                },
                vendor: util::sha256_hex(stock),
            }
        }
        fn apply(&self, settings: &Settings) -> Result<(PathBuf, String)> {
            apply_with_vendor(
                &self.root,
                &self.id,
                &self.artifacts,
                settings,
                &self.backups,
                &self.vendor,
            )
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.base);
        }
    }
    #[test]
    fn windows_apply_reapply_and_restore_preserve_each_state() {
        let f = Fixture::new();
        let (first, state) = f.apply(&Settings::default()).unwrap();
        assert_eq!(state, "vendor");
        assert_eq!(
            inspect_with_vendor(&f.root, &f.id, &f.vendor).unwrap(),
            "ours"
        );
        let changed = Settings {
            template: "{en} / {zh}".into(),
            ..Default::default()
        };
        let (second, _) = f.apply(&changed).unwrap();
        restore_with_vendor(&f.root, &f.id, &second, &f.backups, &f.vendor).unwrap();
        assert_eq!(
            Settings::load(&f.root.join(SETTINGS)).unwrap().template,
            "{zh}（{en}）"
        );
        restore_with_vendor(&f.root, &f.id, &first, &f.backups, &f.vendor).unwrap();
        assert_eq!(
            inspect_with_vendor(&f.root, &f.id, &f.vendor).unwrap(),
            "vendor"
        );
        assert!(!f.root.join(GENERIC).exists());
        assert!(!f.root.join(VENDOR).exists());
    }
    #[test]
    fn windows_nested_install_root_applies_and_restores() {
        let mut f = Fixture::new();
        let nested = f.base.join("Program Files/Cavalry/New Folder");
        fs::create_dir_all(nested.parent().unwrap()).unwrap();
        fs::rename(&f.root, &nested).unwrap();
        f.root = nested.clone();
        let (backup, state) = f.apply(&Settings::default()).unwrap();
        assert_eq!(state, "vendor");
        assert_eq!(inspect_with_vendor(&nested, &f.id, &f.vendor).unwrap(), "ours");
        restore_with_vendor(&nested, &f.id, &backup, &f.backups, &f.vendor).unwrap();
        assert_eq!(inspect_with_vendor(&nested, &f.id, &f.vendor).unwrap(), "vendor");
        assert!(!nested.join(GENERIC).exists());
    }
    #[test]
    fn windows_unknown_vendor_and_bad_artifact_fail_before_backup() {
        let f = Fixture::new();
        fs::write(&f.artifacts.proxy, b"bad dll").unwrap();
        assert!(f.apply(&Settings::default()).is_err());
        assert!(!f.backups.exists());
        fs::write(f.root.join(QPA), b"unknown third party").unwrap();
        assert!(f.apply(&Settings::default()).is_err());
        assert!(!f.backups.exists());
    }
    #[test]
    fn windows_corrupted_backup_or_upgrade_cannot_restore() {
        let f = Fixture::new();
        let (dir, _) = f.apply(&Settings::default()).unwrap();
        let before = read(&f.root, QPA).unwrap();
        let mut id = f.id.clone();
        id.executable_hash = "upgraded".into();
        assert!(restore_with_vendor(&f.root, &id, &dir, &f.backups, &f.vendor).is_err());
        assert_eq!(before, read(&f.root, QPA).unwrap());
        fs::write(dir.join(QPA), b"tampered").unwrap();
        assert!(restore_with_vendor(&f.root, &f.id, &dir, &f.backups, &f.vendor).is_err());
        assert_eq!(before, read(&f.root, QPA).unwrap());
    }
    #[test]
    fn windows_manifest_drift_blocks_reapply() {
        let f = Fixture::new();
        f.apply(&Settings::default()).unwrap();
        fs::write(f.root.join(GENERIC), b"drift").unwrap();
        assert!(f.apply(&Settings::default()).is_err());
    }
}
