//! cbpatch: Cavalry.app 双语注入器管理库。
//!
//! 核心逻辑全部在本 lib 中实现（零外部 crate，纯 std + 系统命令），
//! 便于后续 Tauri GUI 直接复用；`main.rs` 只是薄 CLI 壳。

pub mod backup;
pub mod detect;
pub mod error;
pub mod json;
pub mod keychain;
pub mod ops;
pub mod plist;
pub mod runtime;
pub mod signing;
pub mod util;

pub use detect::AppState;
pub use error::{Error, Result};
