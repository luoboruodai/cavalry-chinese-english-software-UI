//! Versioned user settings. Invalid/newer files are never silently overwritten.
use crate::{error::msg, util, Result};
use serde::{Deserialize, Serialize};
use std::{fs, path::Path};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Settings {
    pub schema_version: u32,
    pub template: String,
    pub lang: String,
    pub zh_font: String,
    pub en_font: String,
}
impl Default for Settings {
    fn default() -> Self {
        Self {
            schema_version: 1,
            template: "{zh}（{en}）".into(),
            lang: "zh-Hans".into(),
            zh_font: String::new(),
            en_font: String::new(),
        }
    }
}
impl Settings {
    pub fn validate(&self) -> Result<()> {
        if self.schema_version != 1 {
            return Err(msg("设置格式较新或不受支持，请更新工具；原文件未改动"));
        }
        if self.lang != "zh-Hans" {
            return Err(msg("本版本仅验证简体中文 + English"));
        }
        if self.template.matches("{zh}").count() != 1 || self.template.matches("{en}").count() != 1
        {
            return Err(msg("双语模板必须各包含一次 {zh} 和 {en}"));
        }
        let literal = self.template.replace("{zh}", "").replace("{en}", "");
        if self.template.chars().count() > 80
            || literal
                .chars()
                .any(|c| c.is_control() || "{}<>%&".contains(c))
        {
            return Err(msg(
                "模板不能包含换行、未知占位符或 HTML/Qt 控制字符，且不得超过 80 字",
            ));
        }
        for font in [&self.zh_font, &self.en_font] {
            if font.chars().count() > 100
                || font.chars().any(|c| c.is_control() || "<>\";".contains(c))
            {
                return Err(msg("字体名称无效，请填写不超过 100 字的已安装字体家族名称"));
            }
        }
        Ok(())
    }
    pub fn load(path: &Path) -> Result<Self> {
        match fs::read(path) {
            Ok(bytes) => {
                let value: Self = serde_json::from_slice(&bytes)
                    .map_err(|_| msg("设置文件损坏或格式不受支持；请先备份再修复，原文件未改动"))?;
                value.validate()?;
                Ok(value)
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Self::default()),
            Err(e) => Err(e.into()),
        }
    }
    pub fn bytes(&self) -> Result<Vec<u8>> {
        self.validate()?;
        serde_json::to_vec_pretty(self).map_err(|e| msg(e.to_string()))
    }
    pub fn save(&self, path: &Path) -> Result<()> {
        let bytes = self.bytes()?;
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        // Also validate existing data: never clobber corrupt/newer settings.
        Self::load(path)?;
        util::atomic_write(path, &bytes)
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn templates_are_bilingual_and_plain_text() {
        for template in [
            "{zh}",
            "{en}",
            "{zh}{en}{en}",
            "{zh}<b>{en}</b>",
            "{zh}\n{en}",
            "{zh}%1{en}",
            "{zh}{oops}{en}",
        ] {
            assert!(
                Settings {
                    template: template.into(),
                    ..Settings::default()
                }
                .validate()
                .is_err(),
                "{template}"
            );
        }
        for template in ["{zh}（{en}）", "{en} · {zh}", "{zh} / {en}"] {
            assert!(Settings {
                template: template.into(),
                ..Settings::default()
            }
            .validate()
            .is_ok());
        }
    }
    #[test]
    fn reject_newer_schema() {
        assert!(Settings {
            schema_version: 2,
            ..Settings::default()
        }
        .validate()
        .is_err());
    }
}
