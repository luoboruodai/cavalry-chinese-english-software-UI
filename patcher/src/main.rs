//! cbpatch 薄 CLI：手动解析参数，不引 clap。stdout 只输出 JSON，错误走 stderr。

use std::path::PathBuf;
use std::process::ExitCode;

use cbpatch::error::{msg, Result};
use cbpatch::json::Json;
use cbpatch::ops;

const USAGE: &str = "用法:\n  \
    cbpatch status [--app <path>]\n  \
    cbpatch apply [--dylib <path>] [--app <path>] [--lang en|zh-Hans|zh-Hant|ja_JP]\n  \
    cbpatch restore [--app <path>]";

#[derive(Default)]
struct Flags {
    app: Option<PathBuf>,
    dylib: Option<PathBuf>,
    lang: Option<String>,
}

fn parse_flags(args: &[String]) -> Result<Flags> {
    let mut flags = Flags::default();
    let mut index = 0;
    while index < args.len() {
        let flag = args[index].as_str();
        let take_value = |index: &mut usize| -> Result<String> {
            *index += 1;
            args.get(*index)
                .cloned()
                .ok_or_else(|| msg(format!("参数 {flag} 缺少值")))
        };
        match flag {
            "--app" => flags.app = Some(PathBuf::from(take_value(&mut index)?)),
            "--dylib" => flags.dylib = Some(PathBuf::from(take_value(&mut index)?)),
            "--lang" => flags.lang = Some(take_value(&mut index)?),
            other => return Err(msg(format!("未知参数: {other}\n{USAGE}"))),
        }
        index += 1;
    }
    Ok(flags)
}

fn resolve_app(flags: &Flags) -> PathBuf {
    flags
        .app
        .clone()
        .unwrap_or_else(|| PathBuf::from(ops::DEFAULT_APP))
}

fn dispatch(args: Vec<String>) -> Result<Json> {
    let Some(command) = args.first() else {
        return Err(msg(USAGE));
    };
    let flags = parse_flags(&args[1..])?;
    let app = resolve_app(&flags);
    match command.as_str() {
        "status" => Ok(ops::status(&app)?.to_json()),
        "apply" => {
            let dylib = match flags.dylib {
                Some(path) => path,
                None => ops::default_dylib_path()?,
            };
            let lang = flags.lang.unwrap_or_else(|| "zh-Hans".to_string());
            let backup_root = ops::default_backup_root()?;
            Ok(ops::apply(&app, &dylib, &lang, &backup_root)?.to_json())
        }
        "restore" => {
            let backup_root = ops::default_backup_root()?;
            Ok(ops::restore(&app, &backup_root)?.to_json())
        }
        other => Err(msg(format!("未知命令: {other}\n{USAGE}"))),
    }
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match dispatch(args) {
        Ok(json) => {
            println!("{json}");
            ExitCode::SUCCESS
        }
        Err(error) => {
            eprintln!("错误: {error}");
            ExitCode::FAILURE
        }
    }
}
