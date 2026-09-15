//! 极简 JSON 发射器（std-only），用于 CLI stdout 输出。
//! 只负责序列化已知形状的结构，不做解析。

use std::fmt;

#[derive(Debug, Clone, PartialEq)]
pub enum Json {
    Null,
    Bool(bool),
    Int(i64),
    Str(String),
    Arr(Vec<Json>),
    Obj(Vec<(String, Json)>),
}

impl Json {
    pub fn str(value: impl Into<String>) -> Self {
        Json::Str(value.into())
    }

    pub fn opt_str(value: Option<String>) -> Self {
        match value {
            Some(text) => Json::Str(text),
            None => Json::Null,
        }
    }

    pub fn render(&self) -> String {
        let mut out = String::new();
        self.write(&mut out);
        out
    }

    fn write(&self, out: &mut String) {
        match self {
            Json::Null => out.push_str("null"),
            Json::Bool(true) => out.push_str("true"),
            Json::Bool(false) => out.push_str("false"),
            Json::Int(value) => out.push_str(&value.to_string()),
            Json::Str(text) => escape_into(out, text),
            Json::Arr(items) => {
                out.push('[');
                for (index, item) in items.iter().enumerate() {
                    if index > 0 {
                        out.push(',');
                    }
                    item.write(out);
                }
                out.push(']');
            }
            Json::Obj(entries) => {
                out.push('{');
                for (index, (key, value)) in entries.iter().enumerate() {
                    if index > 0 {
                        out.push(',');
                    }
                    escape_into(out, key);
                    out.push(':');
                    value.write(out);
                }
                out.push('}');
            }
        }
    }
}

impl fmt::Display for Json {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.render())
    }
}

fn escape_into(out: &mut String, text: &str) {
    out.push('"');
    for ch in text.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => {
                out.push_str(&format!("\\u{:04x}", c as u32));
            }
            c => out.push(c),
        }
    }
    out.push('"');
}

#[cfg(test)]
mod tests {
    use super::Json;

    #[test]
    fn escapes_control_characters() {
        let value = Json::Obj(vec![
            ("key".to_string(), Json::Str("a\"b\\c\nd\te".to_string())),
            ("empty".to_string(), Json::Null),
        ]);
        assert_eq!(
            value.render(),
            "{\"key\":\"a\\\"b\\\\c\\nd\\te\",\"empty\":null}"
        );
    }

    #[test]
    fn renders_nested_arrays_and_ints() {
        let value = Json::Arr(vec![
            Json::Int(1),
            Json::Bool(true),
            Json::Arr(vec![Json::str("x")]),
        ]);
        assert_eq!(value.render(), "[1,true,[\"x\"]]");
    }
}
