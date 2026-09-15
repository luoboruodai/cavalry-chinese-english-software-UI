//! 调试辅助：把合成 fixture 二进制导出到指定目录，便于手动 codesign/otool 检查。
//! 用法: cargo run --example dump_fixture -- <dir>

use std::path::PathBuf;

fn main() {
    let dir = PathBuf::from(std::env::args().nth(1).expect("usage: dump_fixture <dir>"));
    std::fs::create_dir_all(&dir).unwrap();
    std::fs::write(
        dir.join("Cavalry"),
        cbpatch::keychain::build_synthetic_main_executable(),
    )
    .unwrap();
    std::fs::write(
        dir.join("libExtensionLayer.dylib"),
        cbpatch::keychain::build_synthetic_keychain_dylib(None, true),
    )
    .unwrap();
    println!("written to {}", dir.display());
}
