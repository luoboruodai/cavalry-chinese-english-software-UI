//! Desktop shell. Paths are resolved at startup, never baked into release binaries.
pub mod commands;
mod fonts;
mod backup_actions;
mod updates;
mod reporting;
use std::{
    path::PathBuf,
    sync::{Arc, Mutex},
};
use tauri::Manager;

#[derive(Clone)]
pub struct GuiState {
    pub backup_root: PathBuf,
    pub config_path: PathBuf,
    pub dylib_path: PathBuf,
    pub dylib_280_path: PathBuf,
    pub target_path_file: PathBuf,
    pub operation: Arc<Mutex<()>>,
    pub downloads: Arc<updates::DownloadState>,
    pub reports: Arc<reporting::ReportState>,
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let backup_root = cbpatch::ops::default_backup_root()?;
            let config_root = backup_root.parent().unwrap().to_path_buf();
            let config_path = config_root.join("settings.json");
            let target_path_file = config_root.join("target-cavalry.json");
            let dylib_path = app
                .path()
                .resource_dir()?
                .join("runtime")
                .join(cbpatch::runtime::INJECTOR_DYLIB_NAME);
            #[cfg(not(windows))]
            let dylib_280_path = app
                .path()
                .resource_dir()?
                .join("runtime")
                .join(cbpatch::runtime::INJECTOR_DYLIB_NAME_280);
            #[cfg(windows)]
            let dylib_280_path = PathBuf::new();
            #[cfg(debug_assertions)]
            let dylib_path = if !dylib_path.is_file() {
                cbpatch::ops::default_dylib_path().unwrap_or(dylib_path)
            } else {
                dylib_path
            };
            #[cfg(all(debug_assertions, not(windows)))]
            let dylib_280_path = if !dylib_280_path.is_file() {
                PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../dist").join(cbpatch::runtime::INJECTOR_DYLIB_NAME_280)
            } else {
                dylib_280_path
            };
            app.manage(GuiState {
                backup_root,
                config_path,
                dylib_path,
                dylib_280_path,
                target_path_file,
                operation: Arc::new(Mutex::new(())),
                downloads: Arc::new(updates::DownloadState::default()),
                reports: Arc::new(reporting::ReportState::default()),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_status,
            commands::apply_patch,
            commands::restore_backup,
            commands::list_backups,
            commands::delete_backup,
            commands::get_config,
            commands::save_config,
            commands::get_build_info,
            commands::list_fonts,
            commands::list_cavalry_installs,
            commands::set_target_cavalry,
            commands::check_cavalry_update,
            commands::download_cavalry_update,
            commands::cancel_cavalry_download,
            commands::reveal_cavalry_download,
            commands::prepare_error_report,
            commands::export_error_report,
            commands::send_error_report,
            commands::begin_emailjs_send,
            commands::complete_emailjs_send,
            commands::abort_emailjs_send,
        ])
        .run(tauri::generate_context!("src-tauri/tauri.conf.json"))
        .expect("error while running Cavalry Bilingual");
}
