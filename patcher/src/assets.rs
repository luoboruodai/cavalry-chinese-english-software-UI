//! Display-only node strings. Match by immutable nodeType; never replace node IDs, attribute keys or definitions.
use crate::{config::Settings, error::msg, Result};
use serde_json::Value;
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
};
const EN: &str = include_str!("../../languages/en/nodeStrings.json");
const ZH: &str = include_str!("../../languages/zh-Hans/nodeStrings.json");
const FIELDS: &[&str] = &[
    "niceName",
    "nodeInfo",
    "attributes",
    "enums",
    "tabs",
    "blendMode",
    "notifications",
    "presets",
];
pub fn path(app: &Path) -> PathBuf {
    #[cfg(windows)]
    {
        app.join("assets/Definitions/nodeStrings.json")
    }
    #[cfg(not(windows))]
    {
        app.join("Contents/assets/Definitions/nodeStrings.json")
    }
}
pub fn sample_english() -> &'static str {
    EN
}
// Some official node types have several partial records (e.g. strength label vs label+help).
// Bind by nodeType AND the record's field set; never match by array position or merge distinct roles.
fn record_key(value: &Value) -> Result<String> {
    let kind = value
        .get("nodeType")
        .and_then(Value::as_str)
        .ok_or_else(|| msg("nodeStrings 缺少 nodeType"))?;
    let mut fields = value
        .as_object()
        .ok_or_else(|| msg("节点文字记录不是对象"))?
        .keys()
        .collect::<Vec<_>>();
    fields.sort();
    serde_json::to_string(&(kind, fields)).map_err(|e| msg(e.to_string()))
}
fn index(value: &Value) -> Result<HashMap<String, Value>> {
    let rows = value
        .as_array()
        .ok_or_else(|| msg("nodeStrings 必须是数组"))?;
    let mut out = HashMap::new();
    for row in rows {
        if row.get("type").and_then(Value::as_str) != Some("nodeStrings") {
            continue;
        }
        let records: Vec<&Value> = if let Some(value) = row.get("value") {
            vec![value]
        } else if let Some(values) = row.get("values").and_then(Value::as_array) {
            values.iter().collect()
        } else {
            return Err(msg("nodeStrings 缺少 value/values"));
        };
        for value in records {
            let key = record_key(value)?;
            if out.insert(key, value.clone()).is_some() {
                return Err(msg("nodeStrings 同一结构的记录重复，不猜测覆盖顺序"));
            }
        }
    }
    Ok(out)
}
fn format(pattern: &str, en: &str, zh: &str) -> String {
    let mut out = String::new();
    let mut at = 0;
    while at < pattern.len() {
        let tail = &pattern[at..];
        if tail.starts_with("{zh}") {
            out.push_str(zh);
            at += 4;
        } else if tail.starts_with("{en}") {
            out.push_str(en);
            at += 4;
        } else {
            let c = tail.chars().next().unwrap();
            out.push(c);
            at += c.len_utf8();
        }
    }
    out
}
fn has_cjk(value: &str) -> bool {
    value
        .chars()
        .any(|c| ('\u{3400}'..='\u{9fff}').contains(&c))
}
fn chinese_part(live: &str, source: &str, pattern: &str) -> Option<String> {
    let (left, right) = pattern.split_once("{zh}")?;
    let prefix = left.replace("{en}", source);
    let suffix = right.replace("{en}", source);
    let value = live.strip_prefix(&prefix)?.strip_suffix(&suffix)?;
    if has_cjk(value) {
        Some(value.to_owned())
    } else {
        None
    }
}
fn merge(
    current: &mut Value,
    en: &Value,
    zh: &Value,
    pattern: &str,
    previous: &str,
    count: &mut usize,
) -> Result<()> {
    match (current, en, zh) {
        (Value::String(live), Value::String(source), Value::String(chinese)) => {
            if !has_cjk(chinese) && !has_cjk(live) {
                return Ok(());
            }
            let mut local = None;
            for known in [
                previous,
                pattern,
                "{zh}（{en}）",
                "{en}（{zh}）",
                "{zh} ({en})",
                "{en} ({zh})",
            ] {
                if let Some(value) = chinese_part(live, source, known) {
                    local = Some(value);
                    break;
                }
            }
            let local = if let Some(value) = local {
                value
            } else if live == source {
                chinese.clone()
            } else if has_cjk(live) {
                live.clone()
            }
            // preserve an already-installed Chinese translation, even if wording differs
            else {
                return Err(msg(
                    "nodeStrings 的已知展示字段为未知非中文内容；未覆盖自定义语言包",
                ));
            };
            if source == &local || !has_cjk(&local) {
                return Ok(());
            }
            if source.contains("{}")
                || source.contains("{:")
                || ["%s", "%d", "%f", "%n"]
                    .iter()
                    .any(|token| source.contains(token))
            {
                return Err(msg("展示文字含未适配的格式化参数，不会直接复制参数槽"));
            }
            let next = format(pattern, source, &local);
            if *live != next {
                *live = next;
                *count += 1;
            }
        }
        (Value::Object(live), Value::Object(source), Value::Object(chinese)) => {
            for (key, value) in live {
                if let (Some(en), Some(zh)) = (source.get(key), chinese.get(key)) {
                    merge(value, en, zh, pattern, previous, count)?;
                }
            }
        }
        (Value::Array(live), Value::Array(source), Value::Array(chinese)) => {
            if live.len() != source.len() || source.len() != chinese.len() {
                return Err(msg("nodeStrings 展示数组长度不匹配，不猜测枚举顺序"));
            }
            for ((value, en), zh) in live.iter_mut().zip(source).zip(chinese) {
                merge(value, en, zh, pattern, previous, count)?;
            }
        }
        (live, en, zh) if live.is_number() || live.is_boolean() || live.is_null() => {
            if live != en || en != zh {
                return Err(msg("语言包试图修改非文字节点数据"));
            }
        }
        _ => return Err(msg("nodeStrings 展示字段结构不匹配")),
    }
    Ok(())
}
pub fn compose(input: &[u8], settings: &Settings, previous: &Settings) -> Result<(Vec<u8>, usize)> {
    settings.validate()?;
    let english: Value = serde_json::from_str(EN).map_err(|e| msg(e.to_string()))?;
    let chinese: Value = serde_json::from_str(ZH).map_err(|e| msg(e.to_string()))?;
    let english = index(&english)?;
    let chinese = index(&chinese)?;
    let mut current: Value =
        serde_json::from_slice(input).map_err(|_| msg("宿主 nodeStrings 不是合法 JSON"))?;
    index(&current)?; // validate ownership and duplicate identities before mutation
    let mut count = 0;
    let mut apply_record = |value: &mut Value| -> Result<()> {
        let kind = value["nodeType"].as_str().unwrap().to_owned();
        let key = record_key(value)?;
        // Installed language packs may omit an optional field (e.g. basicShape.niceName).
        // Still translate existing stable fields if exactly ONE catalog record is a superset.
        // Do not add fields, match arrays by position, or guess between partial records.
        let matched = if english.contains_key(&key) && chinese.contains_key(&key) {
            Some(key)
        } else {
            let keys = value.as_object().unwrap().keys().collect::<Vec<_>>();
            let candidates = english.iter().filter(|(key, en)| {
                en["nodeType"].as_str() == Some(kind.as_str()) &&
                keys.iter().all(|field| en.get(*field).is_some()) &&
                chinese.get(*key).map(|zh| keys.iter().all(|field| zh.get(*field).is_some())).unwrap_or(false)
            }).map(|(key, _)| key.clone()).collect::<Vec<_>>();
            if candidates.len() == 1 { Some(candidates[0].clone()) } else { None }
        };
        let Some(key) = matched else { return Ok(()); };
        let (en, zh) = (&english[&key], &chinese[&key]);
        for key in FIELDS {
            if let (Some(live), Some(en), Some(zh)) = (value.get_mut(key), en.get(key), zh.get(key))
            {
                merge(
                    live,
                    en,
                    zh,
                    &settings.template,
                    &previous.template,
                    &mut count,
                )
                .map_err(|e| msg(format!("{kind}.{key}: {e}")))?;
            }
        }
        Ok(())
    };
    for row in current.as_array_mut().unwrap() {
        if row.get("type").and_then(Value::as_str) != Some("nodeStrings") {
            continue;
        }
        if let Some(values) = row.get_mut("values").and_then(Value::as_array_mut) {
            for value in values {
                apply_record(value)?;
            }
        } else {
            apply_record(row.get_mut("value").unwrap())?;
        }
    }
    if count == 0 {
        return Ok((input.to_vec(), 0));
    }
    let bytes = serde_json::to_vec_pretty(&current).map_err(|e| msg(e.to_string()))?;
    Ok((bytes, count))
}
pub fn prepare(app: &Path, settings: &Settings) -> Result<(Vec<u8>, usize)> {
    let previous = Settings::load(&crate::runtime::settings_path(app))?;
    compose(&fs::read(path(app))?, settings, &previous)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn keyed_labels_are_bilingual_without_changing_identities() {
        let (result, count) =
            compose(ZH.as_bytes(), &Settings::default(), &Settings::default()).unwrap();
        assert!(count > 4000);
        let before: Value = serde_json::from_str(ZH).unwrap();
        let after: Value = serde_json::from_slice(&result).unwrap();
        for (a, b) in before
            .as_array()
            .unwrap()
            .iter()
            .zip(after.as_array().unwrap())
        {
            assert_eq!(a["value"]["nodeType"], b["value"]["nodeType"]);
            assert_eq!(a["type"], b["type"]);
            assert_eq!(
                a["value"]["attributes"]
                    .as_object()
                    .map(|o| o.keys().collect::<Vec<_>>()),
                b["value"]["attributes"]
                    .as_object()
                    .map(|o| o.keys().collect::<Vec<_>>())
            );
        }
        let indexed = index(&after).unwrap();
        assert_eq!(
            indexed
                .values()
                .find(|row| row["nodeType"] == "transform")
                .unwrap()["attributes"]["position"][0],
            "位置（Position）"
        );
        let (same, n) = compose(&result, &Settings::default(), &Settings::default()).unwrap();
        assert_eq!(n, 0);
        assert_eq!(same, result);
        let custom = Settings {
            template: "{en} / {zh}".into(),
            ..Default::default()
        };
        let (changed, _) = compose(&result, &custom, &Settings::default()).unwrap();
        assert_eq!(
            index(&serde_json::from_slice(&changed).unwrap())
                .unwrap()
                .values()
                .find(|row| row["nodeType"] == "transform")
                .unwrap()["attributes"]["position"][0],
            "Position / 位置"
        );
    }
    #[test]
    fn omitted_optional_field_does_not_silently_skip_existing_labels() {
        let input = r#"[{"type":"nodeStrings","value":{"nodeType":"basicShape","nodeInfo":"基本图形，如矩形、椭圆或多边形。","attributes":{"generator":"基本体类型"}}}]"#;
        let (result, n) = compose(input.as_bytes(), &Settings::default(), &Settings::default()).unwrap();
        let value: Value = serde_json::from_slice(&result).unwrap();
        assert_eq!(n, 2);
        assert_eq!(value[0]["value"]["attributes"]["generator"], "基本体类型（Primitive Type）");
        assert!(value[0]["value"].get("niceName").is_none());
        let (same,n) = compose(&result, &Settings::default(), &Settings::default()).unwrap();
        assert_eq!(n,0); assert_eq!(same,result);
    }
    #[test]
    fn ambiguous_partial_record_is_not_guessed() {
        // behaviour has separate scalar and [label, help] strength records.
        let input = br#"[{"type":"nodeStrings","value":{"nodeType":"behaviour","attributes":{"strength":"Strength"}}}]"#;
        let (result,n)=compose(input,&Settings::default(),&Settings::default()).unwrap();
        assert_eq!(n,0); assert_eq!(result,input);
    }
    #[test]
    fn unknown_user_nodes_preserved_and_known_drift_rejected() {
        let input=br#"[{"type":"nodeStrings","value":{"nodeType":"userFixture","attributes":{"id":"user-provided content"}}}]"#;
        assert_eq!(
            compose(input, &Settings::default(), &Settings::default())
                .unwrap()
                .0,
            input
        );
        let mut value: Value = serde_json::from_str(EN).unwrap();
        value[0]["value"]["attributes"]["hidden"] = Value::String("custom override".into());
        assert!(compose(
            &serde_json::to_vec(&value).unwrap(),
            &Settings::default(),
            &Settings::default()
        )
        .is_err());
    }
}
