//! User-initiated feedback only. No telemetry hooks, project reads, host logs or embedded SMTP keys.
use regex::Regex;
use reqwest::{blocking::Client, redirect::Policy};
use sentry_types::{
    protocol::latest::{Envelope, Event, Level},
    Dsn, Uuid,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock},
    time::Duration,
};

const MAIL_RECIPIENT: &str = "3422484681@qq.com";
const MAIL_MIN_INTERVAL_SECONDS: u64 = 60;
const MAIL_MAX_PER_DAY: u32 = 5;

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct OperationLog {
    pub time: String,
    pub text: String,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportContent {
    app: &'static str,
    app_version: &'static str,
    cavalry_version: Option<String>,
    message: String,
    logs: Vec<OperationLog>,
}
#[derive(Clone)]
enum Delivery {
    Service(Dsn),
    Mail,
    Export(String),
}
#[derive(Clone)]
struct Draft {
    id: Uuid,
    content: ReportContent,
    preview: String,
    delivery: Delivery,
}
#[derive(Default)]
struct State {
    draft: Option<Draft>,
    sending: bool,
}
#[derive(Default)]
pub struct ReportState(Mutex<State>);
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportPreview {
    pub id: String,
    pub preview: String,
    pub log_count: usize,
    pub delivery: &'static str,
    pub service_name: String,
    pub note: Option<String>,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportReceipt {
    pub id: String,
    pub delivery: &'static str,
    pub path: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailJsSession {
    pub service_id: String,
    pub template_id: String,
    pub public_key: String,
}

impl EmailJsSession {
    fn validate(&self) -> Result<(), String> {
        for (name, value, max) in [
            ("Service ID", &self.service_id, 128),
            ("Template ID", &self.template_id, 128),
            ("Public Key", &self.public_key, 256),
        ] {
            if value.is_empty()
                || value.len() > max
                || !value.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
            {
                return Err(format!("{name} 格式不正确"));
            }
        }
        Ok(())
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct MailRate {
    day: u64,
    count: u32,
    last_sent: u64,
}

fn patterns() -> &'static Vec<(Regex, &'static str)> {
    static PATTERNS: OnceLock<Vec<(Regex, &'static str)>> = OnceLock::new();
    PATTERNS.get_or_init(|| vec![
        (Regex::new(r"(?s)-----BEGIN[^\r\n]*PRIVATE KEY-----.*?-----END[^\r\n]*PRIVATE KEY-----").unwrap(), "<密钥已隐藏>"),
        (Regex::new(r"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]+").unwrap(), "Bearer <已隐藏>"),
        (Regex::new(r#"(?i)\b(authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|password|passwd|secret)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;，；]+)"#).unwrap(), "$1=<已隐藏>"),
        (Regex::new(r"\b(?:sk-[A-Za-z0-9_-]{12,}|ghp_[A-Za-z0-9]{12,}|github_pat_[A-Za-z0-9_]{12,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)").unwrap(), "<令牌已隐藏>"),
        (Regex::new(r#"(?i)https?://[^\s<>"，；]+"#).unwrap(), "<网址已隐藏>"),
        (Regex::new(r#"(?i)(?:[a-z]:\\|/(?:Users|home|Volumes|private|var|tmp|Applications)/)[^\r\n，；<>"']+"#).unwrap(), "<本机路径已隐藏>"),
        (Regex::new(r"(?i)[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}").unwrap(), "<邮箱已隐藏>"),
        (Regex::new(r"\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b").unwrap(), "<网络地址已隐藏>"),
    ])
}
pub fn redact(text: &str) -> String {
    patterns()
        .iter()
        .fold(text.to_string(), |text, (pattern, replacement)| {
            pattern.replace_all(&text, *replacement).into_owned()
        })
}
fn service_dsn(text: &str) -> Result<Dsn, String> {
    let dsn: Dsn = text.parse().map_err(|_| "反馈服务地址格式不正确")?;
    if dsn.scheme().to_string() != "https" || dsn.secret_key().is_some() {
        return Err("反馈服务必须使用 HTTPS 公共 DSN，不接受私有密钥".into());
    }
    Ok(dsn)
}
fn delivery(config_root: &Path) -> Delivery {
    let config = config_root.join("reporting.json");
    let configured = if config.exists() {
        match fs::read(&config) {
            Ok(bytes) if bytes.len() <= 8192 => {
                #[derive(Deserialize)]
                #[serde(deny_unknown_fields)]
                struct Config {
                    dsn: String,
                }
                serde_json::from_slice::<Config>(&bytes)
                    .map(|config| config.dsn)
                    .map_err(|_| "反馈服务配置无法识别，可先保存报告".to_string())
            }
            _ => Err("反馈服务配置无法读取，可先保存报告".into()),
        }
    } else if let Ok(dsn) = std::env::var("CAVALRY_REPORT_DSN") {
        Ok(dsn)
    } else {
        return Delivery::Mail;
    };
    match configured.and_then(|value| service_dsn(&value)) {
        Ok(dsn) => Delivery::Service(dsn),
        Err(message) => Delivery::Export(message),
    }
}
fn content(
    message: &str,
    logs: &[OperationLog],
    cavalry_version: Option<String>,
) -> Result<ReportContent, String> {
    if message.len() > 16_000
        || logs.len() > 200
        || logs
            .iter()
            .map(|log| log.text.len() + log.time.len())
            .sum::<usize>()
            > 1_048_576
    {
        return Err("报告内容过长，请简化说明后重试".into());
    }
    let message = redact(message.trim()).chars().take(2000).collect();
    let logs = logs
        .iter()
        .take(20)
        .map(|log| OperationLog {
            time: log
                .time
                .chars()
                .filter(|c| c.is_ascii_digit() || ['-', ':', ' '].contains(c))
                .take(32)
                .collect(),
            text: redact(&log.text).chars().take(2048).collect(),
        })
        .collect();
    let cavalry_version = cavalry_version.filter(|v| {
        v.len() < 40
            && v.chars()
                .all(|c| c.is_ascii_alphanumeric() || ['.', '-', ' '].contains(&c))
    });
    Ok(ReportContent {
        app: "Cavalry Bilingual",
        app_version: env!("CARGO_PKG_VERSION"),
        cavalry_version,
        message,
        logs,
    })
}
pub fn prepare(
    state: &ReportState,
    config_root: &Path,
    message: &str,
    logs: &[OperationLog],
    cavalry_version: Option<String>,
) -> Result<ReportPreview, String> {
    let content = content(message, logs, cavalry_version)?;
    let preview = serde_json::to_string_pretty(&content).map_err(|_| "无法生成报告预览")?;
    let delivery = delivery(config_root);
    let (method, service_name, note) = match &delivery {
        Delivery::Service(dsn) => ("service", dsn.host().to_string(), None),
        Delivery::Mail => (
            "mail",
            "EmailJS".into(),
            Some("将通过 EmailJS 外部服务发送；未配置服务不会发送邮件。".into()),
        ),
        Delivery::Export(message) => ("export", "本机报告".into(), Some(message.clone())),
    };
    let id = sentry_types::random_uuid();
    let result = ReportPreview {
        id: id.to_string(),
        preview: preview.clone(),
        log_count: content.logs.len(),
        delivery: method,
        service_name,
        note,
    };
    let mut inner = state.0.lock().map_err(|_| "反馈状态暂不可用")?;
    if inner.sending {
        return Err("报告正在处理，请稍候".into());
    }
    inner.draft = Some(Draft {
        id,
        content,
        preview,
        delivery,
    });
    Ok(result)
}
fn selected(state: &ReportState, id: &str) -> Result<Draft, String> {
    let inner = state.0.lock().map_err(|_| "反馈状态暂不可用")?;
    inner
        .draft
        .as_ref()
        .filter(|draft| draft.id.to_string() == id)
        .cloned()
        .ok_or_else(|| "报告预览已过期，请重新预览".into())
}
fn save_draft(config_root: &Path, draft: &Draft) -> Result<PathBuf, String> {
    let directory = config_root.join("error-reports");
    fs::create_dir_all(&directory).map_err(|_| "无法创建报告目录")?;
    let path = directory.join(format!("cavalry-bilingual-report-{}.json", draft.id));
    if path.exists() {
        if fs::read_to_string(&path).ok().as_deref() == Some(&draft.preview) {
            return Ok(path);
        }
        return Err("同名报告内容有变化，未覆盖文件".into());
    }
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(&path).map_err(|_| "无法保存报告")?;
    if file.write_all(draft.preview.as_bytes()).is_err() {
        drop(file);
        let _ = fs::remove_file(&path);
        return Err("保存报告失败，请检查磁盘空间".into());
    }
    Ok(path)
}
pub fn export(state: &ReportState, config_root: &Path, id: &str) -> Result<ReportReceipt, String> {
    let draft = selected(state, id)?;
    let path = save_draft(config_root, &draft)?;
    Ok(ReportReceipt {
        id: draft.id.to_string(),
        delivery: "exported",
        path: Some(path.to_string_lossy().into_owned()),
    })
}
fn envelope_bytes(draft: &Draft) -> Result<Vec<u8>, String> {
    let mut event = Event {
        event_id: draft.id,
        level: Level::Error,
        message: Some(if draft.content.message.is_empty() {
            "用户主动提交的 Cavalry Bilingual 问题反馈".into()
        } else {
            draft.content.message.clone()
        }),
        logger: Some("manual-feedback".into()),
        release: Some(format!("cavalry-bilingual@{}", env!("CARGO_PKG_VERSION")).into()),
        ..Default::default()
    };
    event.extra.insert(
        "approved_report".into(),
        serde_json::to_value(&draft.content).map_err(|_| "无法编码报告")?,
    );
    let mut envelope = Envelope::new();
    envelope.add_item(event);
    let mut bytes = Vec::new();
    envelope
        .to_writer(&mut bytes)
        .map_err(|_| "无法编码反馈协议")?;
    Ok(bytes)
}
fn submit_service(draft: &Draft, dsn: &Dsn) -> Result<(), String> {
    let client = Client::builder()
        .https_only(true)
        .redirect(Policy::none())
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|_| "无法建立安全反馈连接")?;
    submit_with_client(draft, dsn, &client)
}
fn submit_with_client(draft: &Draft, dsn: &Dsn, client: &Client) -> Result<(), String> {
    let response = client
        .post(dsn.envelope_api_url())
        .header("Content-Type", "application/x-sentry-envelope")
        .header(
            "X-Sentry-Auth",
            dsn.to_auth(Some("cavalry-bilingual/0.1.3")).to_string(),
        )
        .body(envelope_bytes(draft)?)
        .send()
        .map_err(|_| "未收到反馈服务确认，可稍后重试或保存报告")?;
    if response.status().is_success() {
        Ok(())
    } else if response.status().as_u16() == 429 {
        Err("反馈服务暂时繁忙，请稍后重试".into())
    } else {
        Err("反馈服务未接受报告，请重试或保存报告".into())
    }
}
fn mail_rate(config_root: &Path, now: u64) -> Result<MailRate, String> {
    let path = config_root.join("mail-rate.json");
    let mut rate = if path.exists() {
        if fs::symlink_metadata(&path)
            .map(|meta| meta.file_type().is_symlink())
            .unwrap_or(true)
        {
            return Err("发信频率记录不可信，请检查配置目录".into());
        }
        let bytes = fs::read(&path).map_err(|_| "无法读取发信频率记录".to_string())?;
        if bytes.len() > 1024 {
            return Err("发信频率记录格式不正确".into());
        }
        serde_json::from_slice::<MailRate>(&bytes).map_err(|_| "发信频率记录格式不正确".to_string())?
    } else {
        MailRate { day: 0, count: 0, last_sent: 0 }
    };
    let day = now / 86_400;
    if rate.day != day {
        rate.day = day;
        rate.count = 0;
        rate.last_sent = 0;
    }
    if rate.last_sent > 0 {
        let elapsed = now.saturating_sub(rate.last_sent);
        if elapsed < MAIL_MIN_INTERVAL_SECONDS {
            return Err(format!("发信过于频繁，请 {} 秒后再试", MAIL_MIN_INTERVAL_SECONDS - elapsed));
        }
    }
    if rate.count >= MAIL_MAX_PER_DAY {
        return Err(format!("已达到每天最多 {MAIL_MAX_PER_DAY} 封的发信限制，请明天再试"));
    }
    Ok(rate)
}

fn record_mail_rate(config_root: &Path, mut rate: MailRate, now: u64) -> Result<(), String> {
    rate.count = rate.count.saturating_add(1);
    rate.last_sent = now;
    let bytes = serde_json::to_vec_pretty(&rate).map_err(|_| "无法记录发信频率")?;
    cbpatch::util::atomic_write_with_mode(&config_root.join("mail-rate.json"), &bytes, Some(0o600))
        .map_err(|_| "无法记录发信频率".into())
}

fn emailjs_body(draft: &Draft, session: &EmailJsSession) -> Result<Vec<u8>, String> {
    let body = serde_json::to_vec(&json!({
        "service_id": session.service_id,
        "template_id": session.template_id,
        "user_id": session.public_key,
        "template_params": {
            "to_email": MAIL_RECIPIENT,
            "subject": "Cavalry Bilingual 问题反馈",
            "message": draft.preview,
            "report_id": draft.id.to_string(),
        },
    }))
    .map_err(|_| "无法编码邮件内容".to_string())?;
    if body.len() > 50 * 1024 {
        return Err("报告内容过大，请减少附带日志后重试".into());
    }
    Ok(body)
}

pub fn begin_emailjs(
    state: &ReportState,
    config_root: &Path,
    id: &str,
    session: EmailJsSession,
) -> Result<String, String> {
    session.validate()?;
    let draft = {
        let mut inner = state.0.lock().map_err(|_| "反馈状态暂不可用")?;
        if inner.sending {
            return Err("报告正在发送，请勿重复提交".into());
        }
        let draft = inner
            .draft
            .as_ref()
            .filter(|draft| draft.id.to_string() == id)
            .cloned()
            .ok_or("报告预览已过期，请重新预览")?;
        if !matches!(&draft.delivery, Delivery::Mail) {
            return Err("当前报告不能通过此方式发送，请重新预览".into());
        }
        inner.sending = true;
        draft
    };
    let result = (|| {
        save_draft(config_root, &draft)?;
        let now = cbpatch::util::now_unix_secs();
        let _ = mail_rate(config_root, now)?;
        String::from_utf8(emailjs_body(&draft, &session)?)
            .map_err(|_| "无法编码邮件内容".to_string())
    })();
    if result.is_err() {
        if let Ok(mut inner) = state.0.lock() {
            inner.sending = false;
        }
    }
    result
}

pub fn complete_emailjs(
    state: &ReportState,
    config_root: &Path,
    id: &str,
) -> Result<ReportReceipt, String> {
    let draft = {
        let inner = state.0.lock().map_err(|_| "反馈状态暂不可用")?;
        if !inner.sending {
            return Err("发送状态已过期，请重新预览".into());
        }
        inner
            .draft
            .as_ref()
            .filter(|draft| draft.id.to_string() == id)
            .cloned()
            .ok_or("报告预览已过期，请重新预览")?
    };
    if !matches!(&draft.delivery, Delivery::Mail) {
        return Err("当前报告不能通过此方式发送，请重新预览".into());
    }
    let result = (|| {
        let path = save_draft(config_root, &draft)?;
        let now = cbpatch::util::now_unix_secs();
        let rate = mail_rate(config_root, now)?;
        record_mail_rate(config_root, rate, now)
            .map_err(|_| "邮件已被接受，但频率记录失败；请勿重复发送".to_string())?;
        Ok(ReportReceipt {
            id: draft.id.to_string(),
            delivery: "mail-sent",
            path: Some(path.to_string_lossy().into_owned()),
        })
    })();
    if let Ok(mut inner) = state.0.lock() {
        inner.sending = false;
        if result.is_ok() {
            inner.draft = None;
        }
    }
    result
}

pub fn abort_emailjs(state: &ReportState, id: &str) -> Result<(), String> {
    let mut inner = state.0.lock().map_err(|_| "反馈状态暂不可用")?;
    let draft = inner
        .draft
        .as_ref()
        .filter(|draft| draft.id.to_string() == id)
        .ok_or("报告预览已过期，请重新预览")?;
    if !matches!(&draft.delivery, Delivery::Mail) {
        return Err("当前报告不能通过此方式发送，请重新预览".into());
    }
    inner.sending = false;
    Ok(())
}

pub fn send(state: &ReportState, _config_root: &Path, id: &str, _email_js: Option<EmailJsSession>) -> Result<ReportReceipt, String> {
    let draft = {
        let mut inner = state.0.lock().map_err(|_| "反馈状态暂不可用")?;
        if inner.sending {
            return Err("报告正在发送，请勿重复提交".into());
        }
        let draft = inner
            .draft
            .as_ref()
            .filter(|draft| draft.id.to_string() == id)
            .cloned()
            .ok_or("报告预览已过期，请重新预览")?;
        inner.sending = true;
        draft
    };
    let result = (|| match &draft.delivery {
        Delivery::Service(dsn) => {
            submit_service(&draft, dsn)?;
            Ok(ReportReceipt {
                id: draft.id.to_string(),
                delivery: "submitted",
                path: None,
            })
        }
        Delivery::Mail => {
            Err("请重新打开反馈弹窗后再发送报告".into())
        }
        Delivery::Export(message) => Err(message.clone()),
    })();
    if let Ok(mut inner) = state.0.lock() {
        inner.sending = false;
        if result.is_ok() {
            inner.draft = None;
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    fn temp() -> PathBuf {
        let p = std::env::temp_dir().join(format!("cb-report-{}", sentry_types::random_uuid()));
        fs::create_dir(&p).unwrap();
        p
    }
    #[test]
    fn redacts_common_credentials_addresses_and_paths() {
        let raw=concat!(
            "password=secret123 Bearer abc123token\napi_key='topsecret'\n",
            "/Users/", "Person Name", "/private/project.txt\n",
            "C:\\Users\\Person Name\\project.aep\nuser@example.com 192.168.1.5\n",
            "https://example.com/?token=abc\nsk-abcdefghijklmnop\n",
            "-----BEGIN ", "PRIVATE KEY-----\nprivate-data\n-----END PRIVATE KEY-----"
        );
        let safe = redact(raw);
        for value in [
            "secret123",
            "abc123token",
            "topsecret",
            "Person Name",
            "user@example.com",
            "192.168.1.5",
            "token=abc",
            "sk-abcdefghijklmnop",
            "private-data",
        ] {
            assert!(!safe.contains(value), "{value}: {safe}");
        }
    }
    #[test]
    fn accepts_only_https_public_dsn() {
        assert!(service_dsn("https://public@example.com/42").is_ok());
        assert!(service_dsn("http://public@example.com/42").is_err());
        assert!(service_dsn(concat!("https://public", ":private", "@example.com/42")).is_err());
        assert!(service_dsn("invalid").is_err());
    }
    #[test]
    fn default_desktop_delivery_is_emailjs() {
        let dir = temp();
        assert!(matches!(delivery(&dir), Delivery::Mail));
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn default_preview_is_sendable_and_uses_the_current_app_version() {
        let dir = temp();
        let state = ReportState::default();
        let preview = prepare(&state, &dir, "Windows 默认发送路径", &[], None).unwrap();
        assert_eq!(preview.delivery, "mail");
        assert_eq!(preview.service_name, "EmailJS");
        let content: serde_json::Value = serde_json::from_str(&preview.preview).unwrap();
        assert_eq!(content["appVersion"], env!("CARGO_PKG_VERSION"));
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn report_is_bounded_and_never_includes_host_or_project_files() {
        let logs = (0..30)
            .map(|i| OperationLog {
                time: i.to_string(),
                text: "操作记录".into(),
            })
            .collect::<Vec<_>>();
        let report = content("问题描述", &logs, Some("2.8.0".into())).unwrap();
        assert_eq!(report.logs.len(), 20);
        let value = serde_json::to_value(report).unwrap();
        assert_eq!(value.as_object().unwrap().len(), 5);
        assert!(value.get("platform").is_none() && value.get("architecture").is_none());
        assert!(value.get("user").is_none());
        assert!(value.get("hostname").is_none());
        assert!(content(&"x".repeat(16001), &[], None).is_err());
    }
    #[test]
    fn export_is_exactly_the_approved_preview_and_old_ids_fail() {
        let dir = temp();
        let state = ReportState::default();
        let first = prepare(&state, &dir, concat!("问题 /Users/", "person", "/private"), &[], None).unwrap();
        let receipt = export(&state, &dir, &first.id).unwrap();
        assert_eq!(
            fs::read_to_string(receipt.path.unwrap()).unwrap(),
            first.preview
        );
        let second = prepare(&state, &dir, "另一个问题", &[], None).unwrap();
        assert_ne!(first.id, second.id);
        assert!(export(&state, &dir, &first.id).is_err());
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn official_envelope_contains_only_reviewed_content() {
        let dir = temp();
        let state = ReportState::default();
        let preview = prepare(
            &state,
            &dir,
            "测试反馈",
            &[OperationLog {
                time: "2026-10-19 09:00".into(),
                text: "失败 api_key=secret123".into(),
            }],
            Some("2.8.0".into()),
        )
        .unwrap();
        let draft = selected(&state, &preview.id).unwrap();
        let bytes = envelope_bytes(&draft).unwrap();
        let body = String::from_utf8(bytes.clone()).unwrap();
        assert!(!body.contains("secret123"));
        assert!(body.contains("approved_report"));
        let envelope = Envelope::from_slice(&bytes).unwrap();
        assert_eq!(envelope.items().count(), 1);
        assert!(!body.contains("\"user\""));
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn transport_acknowledgement_and_rate_limit_are_not_confused_with_delivery() {
        use std::{
            io::{Read, Write},
            net::TcpListener,
            thread,
        };
        for status in [200, 429, 500] {
            let listener = TcpListener::bind("127.0.0.1:0").unwrap();
            let address = listener.local_addr().unwrap();
            let peer = thread::spawn(move || {
                let (mut socket, _) = listener.accept().unwrap();
                socket
                    .set_read_timeout(Some(Duration::from_secs(3)))
                    .unwrap();
                let mut request = Vec::new();
                let mut chunk = [0; 4096];
                let mut wanted = None;
                loop {
                    let n = socket.read(&mut chunk).unwrap();
                    assert!(n > 0);
                    request.extend_from_slice(&chunk[..n]);
                    if wanted.is_none() {
                        if let Some(end) = request.windows(4).position(|part| part == b"\r\n\r\n") {
                            let headers = String::from_utf8_lossy(&request[..end]);
                            let length = headers
                                .lines()
                                .find_map(|line| {
                                    line.to_ascii_lowercase()
                                        .strip_prefix("content-length:")
                                        .and_then(|v| v.trim().parse::<usize>().ok())
                                })
                                .unwrap();
                            wanted = Some(end + 4 + length);
                        }
                    }
                    if wanted.is_some_and(|length| request.len() >= length) {
                        break;
                    }
                }
                write!(
                    socket,
                    "HTTP/1.1 {status} Test\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{{}}"
                )
                .unwrap();
                String::from_utf8(request).unwrap()
            });
            let content = content("fixture password=not-for-server", &[], None).unwrap();
            let preview = serde_json::to_string_pretty(&content).unwrap();
            let dsn: Dsn = format!("http://public@{address}/42").parse().unwrap();
            let draft = Draft {
                id: sentry_types::random_uuid(),
                content,
                preview,
                delivery: Delivery::Service(dsn.clone()),
            };
            let client = Client::builder()
                .no_proxy()
                .redirect(Policy::none())
                .timeout(Duration::from_secs(3))
                .build()
                .unwrap();
            let result = submit_with_client(&draft, &dsn, &client);
            assert_eq!(result.is_ok(), status == 200);
            let request = peer.join().unwrap();
            assert!(request.starts_with("POST /api/42/envelope/"));
            assert!(request
                .to_ascii_lowercase()
                .contains("application/x-sentry-envelope"));
            assert!(request.contains("sentry_key=public"));
            assert!(!request.contains("not-for-server"));
            assert!(request.contains("approved_report"));
        }
    }
    #[test]
    fn invalid_service_configuration_never_silently_sends_elsewhere() {
        let dir = temp();
        fs::write(
            dir.join("reporting.json"),
            json!({"dsn":"http://key@example.com/42"}).to_string(),
        )
        .unwrap();
        let state = ReportState::default();
        let preview = prepare(&state, &dir, "test", &[], None).unwrap();
        assert_eq!(preview.delivery, "export");
        assert!(send(&state, &dir, &preview.id, None).is_err());
        assert!(export(&state, &dir, &preview.id).is_ok());
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn emailjs_configuration_is_strictly_validated() {
        let valid = EmailJsSession {
            service_id: "service_test".into(),
            template_id: "template_test".into(),
            public_key: "public_test".into(),
        };
        assert!(valid.validate().is_ok());
        for invalid in ["", "has space", "has\nnewline"] {
            let session = EmailJsSession {
                service_id: invalid.into(),
                template_id: "template_test".into(),
                public_key: "public_test".into(),
            };
            assert!(session.validate().is_err());
        }
    }

    #[test]
    fn emailjs_rejects_payload_over_free_plan_limit() {
        let dir = temp();
        let state = ReportState::default();
        let logs = (0..20)
            .map(|index| OperationLog {
                time: index.to_string(),
                text: "测".repeat(2048),
            })
            .collect::<Vec<_>>();
        let preview = prepare(&state, &dir, "size check", &logs, None).unwrap();
        let draft = selected(&state, &preview.id).unwrap();
        let session = EmailJsSession {
            service_id: "service_test".into(),
            template_id: "template_test".into(),
            public_key: "public_test".into(),
        };
        assert!(emailjs_body(&draft, &session).is_err());
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn mail_rate_is_persistent_and_daily_capped() {
        let dir = temp();
        let now = 1_800_000_000;
        let rate = mail_rate(&dir, now).unwrap();
        record_mail_rate(&dir, rate, now).unwrap();
        assert!(mail_rate(&dir, now + 1).is_err());
        for offset in [61, 122, 183, 244] {
            let rate = mail_rate(&dir, now + offset).unwrap();
            record_mail_rate(&dir, rate, now + offset).unwrap();
        }
        assert!(mail_rate(&dir, now + 305).is_err());
        let metadata = fs::metadata(dir.join("mail-rate.json")).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(metadata.permissions().mode() & 0o777, 0o600);
        }
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn emailjs_browser_flow_uses_reviewed_content_and_tracks_only_accepted_sends() {
        for accepted in [false, true] {
            let dir = temp();
            let state = ReportState::default();
            let preview = prepare(&state, &dir, "approved safe content", &[], None).unwrap();
            let draft = selected(&state, &preview.id).unwrap();
            let session = EmailJsSession {
                service_id: "service_test".into(),
                template_id: "template_test".into(),
                public_key: "public_test".into(),
            };
            let body = begin_emailjs(&state, &dir, &preview.id, session.clone()).unwrap();
            assert!(begin_emailjs(&state, &dir, &preview.id, session.clone()).is_err());
            let body: serde_json::Value = serde_json::from_str(&body).unwrap();
            assert_eq!(body["service_id"], "service_test");
            assert_eq!(body["template_id"], "template_test");
            assert_eq!(body["user_id"], "public_test");
            assert_eq!(body["template_params"]["to_email"], MAIL_RECIPIENT);
            assert_eq!(body["template_params"]["subject"], "Cavalry Bilingual 问题反馈");
            assert_eq!(body["template_params"]["message"], draft.preview);
            assert_eq!(body["template_params"]["report_id"], draft.id.to_string());
            assert!(body.get("attachments").is_none());
            if accepted {
                let receipt = complete_emailjs(&state, &dir, &preview.id).unwrap();
                assert_eq!(receipt.delivery, "mail-sent");
                assert!(mail_rate(&dir, cbpatch::util::now_unix_secs()).is_err());
                assert!(selected(&state, &preview.id).is_err());
            } else {
                abort_emailjs(&state, &preview.id).unwrap();
                assert!(!dir.join("mail-rate.json").exists());
                let retry = begin_emailjs(&state, &dir, &preview.id, session).unwrap();
                assert!(retry.contains("approved safe content"));
                abort_emailjs(&state, &preview.id).unwrap();
            }
            fs::remove_dir_all(dir).unwrap();
        }
    }
}
