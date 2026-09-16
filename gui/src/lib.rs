//! Cavalry Bilingual GUI —— cbpatch（Cavalry.app 双语注入器管理库）的
//! Tauri v2 图形壳。核心逻辑全部在 cbpatch::ops，本 crate 只做序列化与窗口。
//!
//! 布局说明：Cargo.toml 在 gui/（bin + lib），Tauri 配置在 gui/src-tauri/
//! （Tauri CLI 要求 tauri.conf.json 与可构建的 Cargo.toml 同目录，故 src-tauri/
//! 内另有一个依赖本 lib 的薄壳 bin crate）。

pub mod commands;

use std::path::PathBuf;

use cbpatch::ops;

/// 前端共享的只读路径状态（app 根 / 备份根 / composer 配置路径）。
pub struct GuiState {
    pub app_root: PathBuf,
    pub backup_root: PathBuf,
    pub config_path: PathBuf,
}

impl GuiState {
    pub fn new() -> Self {
        let backup_root = ops::default_backup_root()
            .unwrap_or_else(|_| std::env::temp_dir().join("cavalry-bilingual-backups"));
        let config_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("composer")
            .join("bilingual.config.json");
        Self {
            app_root: PathBuf::from(ops::DEFAULT_APP),
            backup_root,
            config_path,
        }
    }
}

pub fn run() {
    tauri::Builder::default()
        .manage(GuiState::new())
        .invoke_handler(tauri::generate_handler![
            commands::get_status,
            commands::apply_patch,
            commands::restore_backup,
            commands::list_backups,
            commands::get_config,
            commands::save_config,
            commands::get_build_info,
        ])
        .run(tauri::generate_context!("src-tauri/tauri.conf.json"))
        .expect("error while running Cavalry Bilingual");
}
