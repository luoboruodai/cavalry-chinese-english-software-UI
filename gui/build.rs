//! 本 crate 的 Cargo.toml 位于 gui/(而非 src-tauri/),tauri-build 2.x 从
//! crate 根目录发现 tauri.conf.json,因此 gui/tauri.conf.json 是指向
//! src-tauri/tauri.conf.json 的符号链接(真源在 src-tauri/,Tauri CLI 也读它)。
//! capabilities 通过下面的 glob 显式指向 src-tauri/capabilities/。

fn main() {
    println!("cargo:rerun-if-changed=src-tauri/tauri.conf.json");
    println!("cargo:rerun-if-changed=src-tauri/capabilities");
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .capabilities_path_pattern("src-tauri/capabilities/**/*.json"),
    )
    .expect("failed to run tauri-build");
}
