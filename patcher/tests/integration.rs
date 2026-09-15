//! 集成测试：手写 fixture app（绝不用真实 /Applications/Cavalry.app）。
//! 覆盖：状态识别三分支、备份幂等、apply→restore 后文件树与 vendor fixture 一致。

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use cbpatch::backup::{self, BackupAction};
use cbpatch::detect::{self, AppState};
use cbpatch::keychain;
use cbpatch::ops;
use cbpatch::plist;
use cbpatch::runtime::{self, INJECTOR_DYLIB_NAME, LANG_MARKER_NAME, WRAPPER_EXECUTABLE_NAME};

const VENDOR_PLIST: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>Cavalry</string>
    <key>CFBundleIdentifier</key>
    <string>com.cbpatch.fixture</string>
    <key>CFBundleShortVersionString</key>
    <string>2.7.2</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
</dict>
</plist>
"#;

struct TempDir(PathBuf);

impl TempDir {
    fn new(name: &str) -> Self {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "cbpatch-it-{name}-{}-{nanos}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&path);
        fs::create_dir_all(&path).unwrap();
        TempDir(path)
    }

    fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

/// 构造 vendor 态 fixture app（结构足够 codesign 处理）。
fn vendor_fixture(root: &Path) -> PathBuf {
    let app = root.join("Cavalry.app");
    let contents = app.join("Contents");
    fs::create_dir_all(contents.join("MacOS")).unwrap();
    fs::create_dir_all(contents.join("Frameworks")).unwrap();
    fs::create_dir_all(contents.join("Resources")).unwrap();
    fs::write(contents.join("Info.plist"), VENDOR_PLIST).unwrap();

    let executable = contents.join("MacOS/Cavalry");
    fs::write(&executable, keychain::build_synthetic_main_executable()).unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&executable, fs::Permissions::from_mode(0o755)).unwrap();
    }

    fs::write(
        contents.join("Frameworks/libExtensionLayer.dylib"),
        keychain::build_synthetic_keychain_dylib(None, true),
    )
    .unwrap();
    fs::write(contents.join("Resources/dummy.txt"), b"hello").unwrap();

    // 先做一次 ad-hoc 深签名再交给测试：同名、同内容的 ad-hoc 重签是确定性的，
    // 这样 apply→restore 周期后的二进制字节才能与 vendor 快照逐字节一致。
    cbpatch::signing::resign_adhoc_deep(&app).unwrap();
    app
}

fn write_fake_dist_dylib(root: &Path) -> PathBuf {
    let dist = root.join("dist");
    fs::create_dir_all(&dist).unwrap();
    let dylib = dist.join(INJECTOR_DYLIB_NAME);
    fs::write(&dylib, b"fake-injector-dylib").unwrap();
    dylib
}

fn is_macho(bytes: &[u8]) -> bool {
    bytes.len() >= 4
        && matches!(
            &bytes[..4],
            // MH_MAGIC_64 / FAT_MAGIC 的大小端形式
            [0xcf, 0xfa, 0xed, 0xfe]
                | [0xfe, 0xed, 0xfa, 0xcf]
                | [0xca, 0xfe, 0xba, 0xbe]
                | [0xbe, 0xba, 0xfe, 0xca]
                | [0xce, 0xfa, 0xed, 0xfe]
                | [0xfe, 0xed, 0xfa, 0xce]
        )
}

fn strip_signature_copy(bytes: &[u8]) -> Option<Vec<u8>> {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let temp = std::env::temp_dir().join(format!("cbpatch-strip-{}-{nanos}", std::process::id()));
    let run = (|| -> std::io::Result<Vec<u8>> {
        std::fs::write(&temp, bytes)?;
        let status = std::process::Command::new("codesign")
            .arg("--remove-signature")
            .arg(&temp)
            .status()?;
        if !status.success() {
            return Err(std::io::Error::other(
                "codesign --remove-signature failed",
            ));
        }
        std::fs::read(&temp)
    })();
    let _ = std::fs::remove_file(&temp);
    run.ok()
}

/// 快照/对比用的归一化内容：Mach-O 文件去签名后比较（ad-hoc 重签不幂等，
/// 去签名可精确还原签名前的代码字节），其余文件原样比较。
fn normalized_content(path: &Path) -> Vec<u8> {
    let bytes = fs::read(path).unwrap();
    if is_macho(&bytes) {
        if let Some(stripped) = strip_signature_copy(&bytes) {
            return stripped;
        }
    }
    bytes
}

/// 文件树快照（排除 codesign 生成的 _CodeSignature，它属于重签元数据而非 bundle 内容）。
fn snapshot_tree(root: &Path) -> BTreeMap<String, Vec<u8>> {
    cbpatch::util::walk_relative(root)
        .unwrap()
        .into_iter()
        .filter(|rel| {
            !rel
                .components()
                .any(|component| component.as_os_str() == "_CodeSignature")
        })
        .map(|rel| {
            (
                rel.to_string_lossy().into_owned(),
                normalized_content(&root.join(&rel)),
            )
        })
        .collect()
}

fn assert_tree_eq(expected: &BTreeMap<String, Vec<u8>>, actual: &BTreeMap<String, Vec<u8>>) {
    let mut problems: Vec<String> = Vec::new();
    for (path, bytes) in expected {
        match actual.get(path) {
            None => problems.push(format!("缺少文件: {path}")),
            Some(actual_bytes) if actual_bytes != bytes => problems.push(format!(
                "内容不同: {path}（{} vs {} 字节）",
                bytes.len(),
                actual_bytes.len()
            )),
            _ => {}
        }
    }
    for path in actual.keys() {
        if !expected.contains_key(path) {
            problems.push(format!("多出文件: {path}"));
        }
    }
    assert!(
        problems.is_empty(),
        "文件树不一致:\n  {}",
        problems.join("\n  ")
    );
}

#[test]
fn status_recognizes_vendor_daftai_and_ours() {
    let temp = TempDir::new("states");
    let app = vendor_fixture(temp.path());

    // vendor：无 CavalryLauncher。
    assert_eq!(detect::classify(&app), AppState::Vendor);
    let report = ops::status(&app).unwrap();
    assert_eq!(report.state, AppState::Vendor);
    assert_eq!(report.state.as_str(), "vendor");
    assert_eq!(report.cavalry_version.as_deref(), Some("2.7.2"));
    assert_eq!(report.executable.as_deref(), Some("Cavalry"));
    assert_eq!(report.lang, None);
    let json = report.to_json().to_string();
    assert!(json.contains("\"state\":\"vendor\""));
    assert!(json.contains("\"lang\":null"));

    // daftai：有 CavalryLauncher + cavalry-i18n-lang.txt，无我们的 marker。
    fs::write(app.join("Contents/MacOS").join(WRAPPER_EXECUTABLE_NAME), b"wrapper").unwrap();
    fs::write(
        app.join("Contents/Resources").join(LANG_MARKER_NAME),
        b"zh-Hans\n",
    )
    .unwrap();
    assert_eq!(detect::classify(&app), AppState::Daftai);
    let report = ops::status(&app).unwrap();
    assert_eq!(report.state.as_str(), "daftai");
    assert_eq!(report.lang.as_deref(), Some("zh-Hans"));

    // ours：存在 cavalry-bilingual.json。
    fs::write(
        app.join("Contents/Resources/cavalry-bilingual.json"),
        b"{}",
    )
    .unwrap();
    assert_eq!(detect::classify(&app), AppState::Ours);
    assert_eq!(ops::status(&app).unwrap().state.as_str(), "ours");
}

#[test]
fn backup_is_idempotent_for_identical_content() {
    let temp = TempDir::new("backup");
    let app = vendor_fixture(temp.path());
    let backup_dir = temp.path().join("backups/2.7.2-1");

    let rel = Path::new("Contents/Resources/dummy.txt");
    let first = backup::backup_file(&backup_dir, &app, rel).unwrap();
    assert_eq!(first, Some(BackupAction::BackedUp));

    let second = backup::backup_file(&backup_dir, &app, rel).unwrap();
    assert_eq!(second, Some(BackupAction::SkippedIdentical));

    let backed_up = fs::read(backup_dir.join(rel)).unwrap();
    assert_eq!(backed_up, fs::read(app.join(rel)).unwrap());

    // 源文件缺失时返回 None。
    let missing = backup::backup_file(&backup_dir, &app, Path::new("Contents/Resources/nope"))
        .unwrap();
    assert_eq!(missing, None);
}

#[test]
fn latest_backup_dir_picks_newest_timestamp() {
    let temp = TempDir::new("latest");
    let root = temp.path().join("backups");
    fs::create_dir_all(root.join("2.7.2-100")).unwrap();
    fs::create_dir_all(root.join("2.7.2-300")).unwrap();
    fs::create_dir_all(root.join("2.7.2-200")).unwrap();
    fs::create_dir_all(root.join("2.7.2-50-7")).unwrap(); // 同秒碰撞后缀，时间戳仍是 50
    fs::write(root.join("not-a-backup"), b"x").unwrap();

    let latest = backup::latest_backup_dir(&root).unwrap().unwrap();
    assert_eq!(latest.file_name().unwrap(), "2.7.2-300");
}

#[test]
fn apply_then_restore_returns_tree_to_vendor_fixture() {
    let temp = TempDir::new("cycle");
    let app = vendor_fixture(temp.path());
    let pristine = snapshot_tree(&app);
    let signed_vendor_extension =
        fs::read(app.join("Contents/Frameworks/libExtensionLayer.dylib")).unwrap();
    let dylib = write_fake_dist_dylib(temp.path());
    let backup_root = temp.path().join("backups");

    // apply：vendor → ours。
    let summary = ops::apply(&app, &dylib, "zh-Hans", &backup_root).unwrap();
    assert!(summary.ok);
    assert_eq!(summary.state_before, AppState::Vendor);
    assert!(summary.backup_dir.starts_with(&backup_root));

    assert_eq!(detect::classify(&app), AppState::Ours);
    assert_eq!(
        fs::read_to_string(app.join("Contents/Resources").join(LANG_MARKER_NAME)).unwrap(),
        "zh-Hans\n"
    );
    assert_eq!(
        fs::read(app.join("Contents/Frameworks").join(INJECTOR_DYLIB_NAME)).unwrap(),
        b"fake-injector-dylib"
    );
    assert_eq!(
        plist::read_string(&app.join("Contents/Info.plist"), "CFBundleExecutable")
            .unwrap()
            .as_deref(),
        Some(WRAPPER_EXECUTABLE_NAME)
    );
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mode = fs::metadata(app.join("Contents/MacOS").join(WRAPPER_EXECUTABLE_NAME))
            .unwrap()
            .permissions()
            .mode()
            & 0o111;
        assert_ne!(mode, 0, "wrapper 必须是可执行的");
    }
    let manifest =
        fs::read_to_string(app.join("Contents/Resources/cavalry-bilingual.json")).unwrap();
    assert!(manifest.contains("\"lang\":\"zh-Hans\""));
    assert!(manifest.contains("\"version\":"));
    assert!(manifest.contains("\"installedAt\":"));

    // keychain 补丁应已生效：文件相对签名后的 vendor 基线发生变化，
    // 且再次打补丁时 20 个调用点全部识别为「已补丁」（幂等）。
    let after_apply_extension =
        fs::read(app.join("Contents/Frameworks/libExtensionLayer.dylib")).unwrap();
    assert_ne!(after_apply_extension, signed_vendor_extension);
    let (_, reapplied) = keychain::patch_keychain_query_attributes_bytes(&after_apply_extension)
        .expect("对已补丁文件再次解析应成功");
    assert_eq!(reapplied.patched_callsites, 0);
    assert_eq!(reapplied.already_patched_callsites, 20);

    // 备份里应包含 vendor 原文件（Info.plist 的 executable 仍是 Cavalry）。
    let backed_up_plist = plist::read_string(
        &summary.backup_dir.join("Contents/Info.plist"),
        "CFBundleExecutable",
    )
    .unwrap();
    assert_eq!(backed_up_plist.as_deref(), Some("Cavalry"));

    // restore：文件树应与 vendor fixture 完全一致（忽略 _CodeSignature）。
    let restore = ops::restore(&app, &backup_root).unwrap();
    assert!(restore.ok);
    assert!(restore
        .removed
        .iter()
        .any(|path| path.ends_with(WRAPPER_EXECUTABLE_NAME)));
    assert!(restore
        .removed
        .iter()
        .any(|path| path.ends_with(LANG_MARKER_NAME)));
    assert!(restore
        .restored
        .iter()
        .any(|path| path == "Contents/Frameworks/libExtensionLayer.dylib"));

    let after = snapshot_tree(&app);
    assert_tree_eq(&pristine, &after);

    // 语义级验证：restore 后 keychain 补丁已回退（20 个调用点重新可打补丁）。
    let restored_extension =
        fs::read(app.join("Contents/Frameworks/libExtensionLayer.dylib")).unwrap();
    let (_, restore_report) =
        keychain::patch_keychain_query_attributes_bytes(&restored_extension)
            .expect("restore 后的 vendor 文件应可重新解析");
    assert_eq!(restore_report.patched_callsites, 20);
    assert_eq!(restore_report.already_patched_callsites, 0);

    assert_eq!(detect::classify(&app), AppState::Vendor);
    assert_eq!(
        plist::read_string(&app.join("Contents/Info.plist"), "CFBundleExecutable")
            .unwrap()
            .as_deref(),
        Some("Cavalry")
    );
}

#[test]
fn reapply_on_ours_state_is_idempotent() {
    let temp = TempDir::new("reapply");
    let app = vendor_fixture(temp.path());
    let dylib = write_fake_dist_dylib(temp.path());
    let backup_root = temp.path().join("backups");

    let first = ops::apply(&app, &dylib, "zh-Hans", &backup_root).unwrap();
    let second = ops::apply(&app, &dylib, "zh-Hant", &backup_root).unwrap();
    assert_eq!(second.state_before, AppState::Ours);
    assert_ne!(first.backup_dir, second.backup_dir);

    // 语言 marker 已切换。
    assert_eq!(
        fs::read_to_string(app.join("Contents/Resources").join(LANG_MARKER_NAME)).unwrap(),
        "zh-Hant\n"
    );
}

#[test]
fn apply_on_daftai_state_preserves_wrapper_and_restore_fixes_executable() {
    let temp = TempDir::new("daftai");
    let app = vendor_fixture(temp.path());

    // 构造 daftai 态：launcher（内容保持 daftai 版）+ 语言 marker，无我们的 manifest。
    let daftai_wrapper = b"#!/bin/sh\n# daftai wrapper original\nexec \"$(dirname \"$0\")/Cavalry\" \"$@\"\n";
    fs::write(
        app.join("Contents/MacOS").join(WRAPPER_EXECUTABLE_NAME),
        daftai_wrapper,
    )
    .unwrap();
    fs::write(
        app.join("Contents/Resources").join(LANG_MARKER_NAME),
        b"zh-Hant\n",
    )
    .unwrap();
    plist::set_bundle_executable(&app, WRAPPER_EXECUTABLE_NAME).unwrap();
    cbpatch::signing::resign_adhoc_deep(&app).unwrap();
    assert_eq!(detect::classify(&app), AppState::Daftai);

    let dylib = write_fake_dist_dylib(temp.path());
    let backup_root = temp.path().join("backups");

    let summary = ops::apply(&app, &dylib, "zh-Hans", &backup_root).unwrap();
    assert_eq!(summary.state_before, AppState::Daftai);
    assert_eq!(detect::classify(&app), AppState::Ours);

    // daftai 的 wrapper 与 Info.plist 不被改写。
    assert_eq!(
        fs::read(app.join("Contents/MacOS").join(WRAPPER_EXECUTABLE_NAME)).unwrap(),
        daftai_wrapper
    );
    assert_eq!(
        plist::read_string(&app.join("Contents/Info.plist"), "CFBundleExecutable")
            .unwrap()
            .as_deref(),
        Some(WRAPPER_EXECUTABLE_NAME)
    );
    assert_eq!(
        fs::read_to_string(app.join("Contents/Resources").join(LANG_MARKER_NAME)).unwrap(),
        "zh-Hans\n"
    );

    // restore：备份里没有 Info.plist（daftai 态未备份），走 executable 修正分支。
    let restore = ops::restore(&app, &backup_root).unwrap();
    assert!(restore.ok);
    assert_eq!(detect::classify(&app), AppState::Vendor);
    assert_eq!(
        plist::read_string(&app.join("Contents/Info.plist"), "CFBundleExecutable")
            .unwrap()
            .as_deref(),
        Some("Cavalry")
    );
    assert!(!app
        .join("Contents/MacOS")
        .join(WRAPPER_EXECUTABLE_NAME)
        .exists());
}

#[cfg(target_os = "macos")]
#[test]
fn launch_wrapper_routes_dyld_and_lang() {
    // 与参考实现同一思路：SIP 会剥掉 DYLD_*，测试副本里替换成中性变量名验证逻辑。
    let temp = TempDir::new("wrapper");
    let app = vendor_fixture(temp.path());
    let macos = app.join("Contents/MacOS");
    let frameworks = app.join("Contents/Frameworks");
    let resources = app.join("Contents/Resources");

    let wrapper_path = macos.join(WRAPPER_EXECUTABLE_NAME);
    let fixture_wrapper =
        runtime::build_launch_wrapper().replace("DYLD_INSERT_LIBRARIES", "CAVALRY_TEST_DYLD");
    fs::write(&wrapper_path, fixture_wrapper).unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&wrapper_path, fs::Permissions::from_mode(0o755)).unwrap();
    }

    let cavalry = macos.join("Cavalry");
    fs::write(
        &cavalry,
        "#!/bin/sh\nprintf '%s\\n%s\\n' \"${CAVALRY_TEST_DYLD-}\" \"${CAVALRY_I18N_LANG-}\"\n",
    )
    .unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&cavalry, fs::Permissions::from_mode(0o755)).unwrap();
    }

    fs::write(resources.join(LANG_MARKER_NAME), "zh-Hans\n").unwrap();
    let injector = frameworks.join(INJECTOR_DYLIB_NAME);
    fs::write(&injector, b"injector").unwrap();

    let inherited = "/external/first.dylib:/external/second.dylib";
    let run = |dyld: &str, lang: &str| -> String {
        let output = std::process::Command::new(&wrapper_path)
            .env("HOME", temp.path())
            .env("CAVALRY_TEST_DYLD", dyld)
            .env("CAVALRY_I18N_LANG", lang)
            .output()
            .unwrap();
        assert!(output.status.success());
        String::from_utf8(output.stdout).unwrap()
    };

    // 非 en + injector 存在 → 注入 + 语言；外部 DYLD 保留且去重。
    let out = run(
        &format!("{}:{inherited}:{}", injector.display(), injector.display()),
        "caller-value",
    );
    assert_eq!(
        out,
        format!("{}:{inherited}\nzh-Hans\n", injector.display())
    );

    // en（marker 缺失）→ 不注入、不传语言，外部 DYLD 原样保留。
    fs::remove_file(resources.join(LANG_MARKER_NAME)).unwrap();
    let out = run(inherited, "external-value");
    assert_eq!(out, format!("{inherited}\n\n"));
}
