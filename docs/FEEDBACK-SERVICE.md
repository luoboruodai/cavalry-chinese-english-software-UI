# User-initiated feedback / 用户主动反馈

## Integrated components

The desktop manager uses `sentry-types = 0.49.3` and `reqwest = 0.13.5` for its
optional HTTPS ingestion DSN. The EmailJS request is made by the Tauri browser view. It does not
install a panic hook, session tracker, profiler, replay, or automatic log
collector.

Mailbox delivery uses the official EmailJS `POST /api/v1.0/email/send` endpoint
from the Tauri browser view, not from the Rust HTTP client. Rust still owns the
approved draft, local report file, and persistent send-rate checks. The desktop
UI supplies only the public browser configuration
`VITE_EMAILJS_SERVICE_ID`, `VITE_EMAILJS_TEMPLATE_ID`, and
`VITE_EMAILJS_PUBLIC_KEY`. No local Mail application, AppleScript, SMTP client,
EmailJS Private Key, mailbox password, SMTP authorization code, OAuth token, or
public unauthenticated mail relay is embedded in Bilingual.

Tauri CSP allows the exact `https://api.emailjs.com` origin in `connect-src`;
other external HTTPS origins remain blocked.

Primary references:

- https://www.emailjs.com/docs/rest-api/send/
- https://help.mail.qq.com/detail/0/1023/

## What is sent

1. The user writes a description and may opt out of recent manager-operation
   records.
2. Rust produces a bounded preview: tool and Cavalry versions, description,
   and at most 20 manager-operation entries. It does not include OS or CPU
   architecture fields.
3. Common paths, email addresses, bearer tokens, password/API-key forms, private
   key blocks and IPv4 addresses are redacted. This is not a guarantee that every
   possible secret is recognized; the user must inspect the preview.
4. The approved draft remains in memory. Send uses its ID and exact reviewed
   content, not newly fetched logs. No project, screenshot, environment dump,
   hostname, user identity, or Cavalry raw log is collected.
5. EmailJS receives a JSON body bounded to 50 KB. Its template has a fixed
   recipient and these parameters only: `to_email`, `subject`, `message`, and
   `report_id`. The report is embedded as text; there is no attachment and no
   user-controlled email header.
6. The EmailJS template enables **Do not save private data**, so template
   parameter values are not retained in EmailJS History. EmailJS and the mailbox
   provider still process the message for delivery.

## External mailbox configuration

The EmailJS SMTP service holds the mailbox connection and SMTP authorization
code in EmailJS Dashboard. The current template uses a fixed subject variable,
fixed recipient, a plain-text report body, and the report ID. The service test
message confirms the Dashboard SMTP configuration; it is separate from the
Bilingual application's first real report.

Required build-time public configuration:

```bash
export VITE_EMAILJS_SERVICE_ID="your-service-id"
export VITE_EMAILJS_TEMPLATE_ID="your-template-id"
export VITE_EMAILJS_PUBLIC_KEY="your-public-browser-key"
```

The Public Key is for the browser API. The non-browser API permission and
**Use Private Key (recommended)** setting are left unchanged; no EmailJS
Private Key is required by this browser-view flow. Never substitute the EmailJS
Private Key or `accessToken`. The QQ/163 SMTP authorization code belongs only in EmailJS
Dashboard and must not be written into source, logs, chat, or the application
bundle.

## Rate limits and abuse resistance

- One accepted EmailJS send per 60 seconds and at most 5 per UTC day, persisted
  in `mail-rate.json` with mode `0600`. Failed, cancelled, unauthorized, or
  rate-limited attempts do not count as accepted sends.
- Each approved report has a UUID included as `report_id`. There is no automatic
  retry loop and no claim of server-side idempotency. If the response is
  uncertain, the user should inspect EmailJS/mailbox state before deliberately
  trying again.
- EmailJS/provider `429` and `Retry-After` are reported honestly. Provider quotas
  and server-side EmailJS limits still apply; the local limiter is not a defence
  against a user who deliberately modifies their own client or extracts the
  public browser configuration.
- No SQL database exists in this path, so there is no SQL query or SQL injection
  surface. There is no Bilingual password form to brute-force. Mailbox login,
  MFA, and SMTP authorization codes stay with EmailJS and the mailbox provider.

## Delivery truth

A successful EmailJS response means EmailJS accepted the send request. It is not
a guarantee that the recipient's mailbox accepted or displayed the message.
Verify the first live message in the provider's Sent Items and, where possible,
the recipient mailbox. Do not describe a 2xx response as guaranteed delivery.

## Optional ingestion DSN

The existing Sentry-compatible ingestion path is unchanged. A maintainer can put
an HTTPS **public ingestion DSN** in `reporting.json` or `CAVALRY_REPORT_DSN`.
Private-key DSNs and plain HTTP are rejected, redirects are disabled, and server
quotas/rate limits must be configured by the owner. A successful HTTP response
means ingestion acceptance, not an email notification.

Without a DSN, the app offers the EmailJS flow and local JSON export. Do not
deploy a public unauthenticated generic mail relay.

## Local verification

- Rust tests cover redaction, exact preview/export equality, fixed recipient,
  EmailJS configuration validation, the 50 KB request cap, persistent frequency
  caps, and 200/429 responses using synthetic loopback fixtures.
- UI fixtures cover provider selection, preview, opt-out, external configuration,
  rate limiting, and export. They do not contact a real mailbox.
- A live first send requires the owner-approved EmailJS service/template and an
  explicitly authorized report and recipient. Fixtures and the Dashboard SMTP
  test must not be presented as the application's live delivery.
