# Cavalry Bilingual 0.1.1

**简体中文** | [English](#english)

> 0.1.1 是正式发行版本，主要解决 Windows 自定义安装目录与反馈无法发送的问题。正式版身份不代表全界面、全版本或全平台验收完成。附件 SHA-256 以同版 `SHA256SUMS.txt` 为准。

## 中文

### 下载附件

- `Cavalry-Bilingual_0.1.1_macOS-universal.dmg`：macOS arm64 + x86_64。
- `Cavalry-Bilingual_0.1.1_Windows-x64-setup.exe`：Windows x64 NSIS 安装器。
- `SHA256SUMS.txt`：附件校验值。GitHub 自动生成的 Source code 是源码快照，不是安装包。

### 本版变化

- 状态页新增“选择路径…”：Windows 可选择其他盘中包含 `Cavalry.exe` 的安装目录，macOS 可指定有效的 Cavalry `.app`。
- 自定义目标经过识别后持久保存，刷新和后续启动仍会列入目标列表；当前完整路径可见，同版本的不同安装目录可在下拉详情中区分。
- 取消目录选择或选择无效目录不会替换已确认目标；保留原有“版本下拉框 → Tab → 切换 Cavalry”的键盘顺序。
- 修复非 macOS 被硬编码为“仅保存报告”的问题。未配置 ingestion DSN 时，macOS 与 Windows 均使用相同的 EmailJS 浏览器发送流程，并保留本地保存回退。
- 反馈仍须先检查脱敏预览；不包含工程文件或 Cavalry 原始日志，不引入 EmailJS Private Key、邮箱授权码或自动遥测。
- 保留 Preview 4 的 Windows Common Controls v6 启动修复，不请求管理员权限。

### 安装与注意事项

1. 下载对应附件并核对 `SHA256SUMS.txt`。
2. Windows 运行 `setup.exe`；macOS 将应用拖到 Applications。按包内 `INSTALL.txt` 操作。
3. **安装器仍未签名**，“未知发布者”或 SmartScreen 警告可能继续出现，未被隐藏或绕过。
4. 若未自动发现 Cavalry，在状态页选择“选择路径…”，指定安装目录并核对当前路径。
5. 先保存工程并自行退出 Cavalry，再刷新检测并应用；需要回退时选择对应快照。
6. 在“日志 → 反馈问题”中检查预览后，自行决定“发送报告”或“保存报告”。发送被服务接受不等于邮箱已展示，未收到服务确认时可先保存。

### 验收边界

- 原生 Windows 安装、WebView2 交互和真实 Cavalry 宿主仍须在对应环境验收；交叉编译、静态 PE／NSIS 检查与浏览器夹具不替代这些结论。
- macOS 为 ad-hoc 签名、未公证；Intel 原生硬件仍未验收。
- 全界面、通用 Canvas／Graph／TrackingTool 和所有工程类型不标记为通过。
- 本轮不发送真实反馈邮件；发送流程使用合成夹具与既有已授权配置，不冒充新的邮箱送达证明。

## English

Version 0.1.1 is a stable release focused on custom Windows installation paths and the Windows feedback-sending regression. This release identity does not establish full-UI, all-version, or all-platform acceptance. Use the accompanying `SHA256SUMS.txt` for attachment hashes.

### Attachments

- `Cavalry-Bilingual_0.1.1_macOS-universal.dmg` for macOS arm64 + x86_64.
- `Cavalry-Bilingual_0.1.1_Windows-x64-setup.exe` for Windows x64.
- `SHA256SUMS.txt` for attachment checksums. GitHub's automatic Source code archives are source snapshots, not installers.

### What changed

- Adds “选择路径…” to the Status page. Windows users can choose a folder containing `Cavalry.exe` on another drive; macOS users can choose a valid Cavalry `.app`.
- Valid custom targets persist, remain listed after refreshes and later launches, and show their full path. Dropdown details distinguish different directories with the same Cavalry version.
- Cancelling or rejecting an invalid directory preserves the confirmed target. The existing keyboard sequence from version dropdown to Switch remains intact.
- Fixes the non-macOS hardcoded export-only fallback. Without an ingestion DSN, macOS and Windows now use the same EmailJS browser flow, with local export retained.
- Reports still require a reviewed redacted preview. No project files, Cavalry raw logs, EmailJS Private Key, mailbox authorization code, or automatic telemetry is introduced.
- Retains Preview 4's Windows Common Controls v6 startup fix without requesting administrator privileges.

### Installation and notes

1. Download the appropriate attachment and verify it against `SHA256SUMS.txt`.
2. Run `setup.exe` on Windows, or drag the app to Applications on macOS. Follow the bundled `INSTALL.txt`.
3. **The installers remain unsigned.** Unknown-publisher or SmartScreen warnings may still appear and have not been hidden or bypassed.
4. If Cavalry is not detected, choose “选择路径…” on the Status page and verify the displayed current path.
5. Save your project and quit Cavalry yourself before refreshing detection and applying. Choose the corresponding snapshot to roll back.
6. Under “日志 → 反馈问题”, review the preview before choosing Send or Save. Provider acceptance is not proof of mailbox display; save the report if no confirmation arrives.

### Acceptance boundaries

- Native Windows installation, WebView2 interaction, and the real Cavalry host still require verification on Windows. Cross-builds, static PE/NSIS checks, and browser fixtures are not substitutes.
- macOS is ad-hoc signed and not notarized; native Intel hardware remains unverified.
- Full UI, general Canvas/Graph/TrackingTool, and every project type are not marked as accepted.
- This iteration sends no live feedback email. Synthetic fixtures and the existing owner-approved public configuration are not presented as new mailbox-delivery evidence.
