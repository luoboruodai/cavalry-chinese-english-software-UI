#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! GUI 二进制入口：薄壳，全部逻辑在 lib。

fn main() {
    cavalry_bilingual_gui::run();
}
