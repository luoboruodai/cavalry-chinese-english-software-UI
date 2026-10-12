//! Desktop shell. Paths are resolved at startup, never baked into release binaries.
pub mod commands;
mod fonts;
use std::{
    path::PathBuf,
    sync::{Arc, Mutex},
};
use tauri::Manager;

#[derive(Clone)]
pub struct GuiState {
    pub app_root: PathBuf,
    pub backup_root: PathBuf,
    pub config_path: PathBuf,
    pub dylib_path: PathBuf,
    pub operation: Arc<Mutex<()>>,
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let backup_root = cbpatch::ops::default_backup_root()?;
            let config_path = backup_root.parent().unwrap().join("settings.json");
            let dylib_path = app
                .path()
                .resource_dir()?
                .join("runtime")
                .join(cbpatch::runtime::INJECTOR_DYLIB_NAME);
            #[cfg(debug_assertions)]
            let dylib_path = if !dylib_path.is_file() {
                cbpatch::ops::default_dylib_path().unwrap_or(dylib_path)
            } else {
                dylib_path
            };
            app.manage(GuiState {
                app_root: PathBuf::from(cbpatch::ops::DEFAULT_APP),
                backup_root,
                config_path,
                dylib_path,
                operation: Arc::new(Mutex::new(())),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_status,
            commands::apply_patch,
            commands::restore_backup,
            commands::list_backups,
            commands::get_config,
            commands::save_config,
            commands::get_build_info,
            commands::list_fonts,
        ])
        .run(tauri::generate_context!("src-tauri/tauri.conf.json"))
        .expect("error while running Cavalry Bilingual");
}
