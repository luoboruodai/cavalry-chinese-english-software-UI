# Cavalry Bilingual 0.1.4

**简体中文** | [English](#english)

> 0.1.4 是正式补丁版本，修复 Windows 版本识别并加入原生 Windows／macOS CI。正式版身份不代表全界面、全版本或所有用户环境验收完成。附件 SHA-256 以同版 `SHA256SUMS.txt` 为准。

## 中文

### 下载附件

- `Cavalry-Bilingual_0.1.4_macOS-universal.dmg`：macOS arm64 + x86_64。
- `Cavalry-Bilingual_0.1.4_Windows-x64-setup.exe`：Windows x64 NSIS 安装器。
- `SHA256SUMS.txt`：附件校验值。GitHub 自动生成的 Source code 是源码快照，不是安装包。

### 本版变化

- 修复 Windows 已检测到 Cavalry 却显示“未知版本”：官方 `Cavalry.exe` 可能没有 `VS_VERSION_INFO`，现使用唯一 NUL 分隔的受支持版本标记；重复、相似或冲突标记继续拒绝。
- 修复 Windows 安装列表误用 macOS plist 检测的问题。自定义安装目录、Qt 版本、哈希与部署安全门不放宽。
- 反馈保留先脱敏预览、再 EmailJS 发送或本地保存的流程。Windows 原生 CI 验证默认预览可发送及当前版本号；浏览器测试实际覆盖 begin → fetch → complete／abort、失败草稿保留、取消、限流和脱敏。
- 修复报告“发送说明”在弹窗从下方进入时纵向偏移 18px 的问题；过渡开始、结束、取消和后续帧都会重新计算通知位置。
- Windows 自定义路径现在会从所选目录向下定位实际安装根：支持父目录与 `New Folder` 等嵌套目录，保存解析后的真实路径，不再错误回落到 `C:\Program Files\Cavalry`。
- 路径搜索限制为 4 层／256 个目录，要求同时存在 `Cavalry.exe` 与 `Qt6Core.dll`；多个匹配、缺少 Qt、符号链接、重解析点及过深或过大目录均明确拒绝。新增嵌套目录 apply→状态确认→restore 验证。
- 新增 GitHub Actions Windows／macOS 测试矩阵。CI 不发送真实邮件，也不代替用户网络、WebView2 或真实 Cavalry 宿主验收。
- 保留 Common Controls v6 启动修复，不请求管理员权限。

### 安装与注意事项

1. 下载对应附件并核对 `SHA256SUMS.txt`。
2. Windows 运行 `setup.exe`；macOS 将应用拖到 Applications。按包内 `INSTALL.txt` 操作。
3. **安装器仍未签名／未公证**，系统安全提示可能继续出现，未被隐藏或绕过。
4. 若未自动发现 Cavalry，在状态页选择“选择路径…”，指定安装目录并核对当前路径与版本。
5. 先保存工程并自行退出 Cavalry，再刷新检测并应用；需要回退时选择对应快照。
6. 在“日志 → 反馈问题”中检查预览后，自行决定“发送报告”或“保存报告”。服务接受不等于邮箱已展示；失败时可保留报告。

### 验收边界

- CI 在原生 Windows 与 macOS runner 上执行测试，但不覆盖所有用户 GPU、网络、WebView2 或真实 Cavalry 工程。
- macOS 为 ad-hoc 签名、未公证；Intel 原生硬件仍未验收。
- Windows 安装包为未签名交叉构建；原生 Windows 安装与真实宿主仍需对应环境验收。
- 全界面、通用 Canvas／Graph／TrackingTool 和所有工程类型不标记为通过。

## English

Version 0.1.4 is a stable patch release that fixes Windows version detection and adds native Windows/macOS CI. Its release identity does not establish full-UI, all-version, or every-user-environment acceptance. Use the accompanying `SHA256SUMS.txt` for attachment hashes.

### Attachments

- `Cavalry-Bilingual_0.1.4_macOS-universal.dmg` for macOS arm64 + x86_64.
- `Cavalry-Bilingual_0.1.4_Windows-x64-setup.exe` for Windows x64.
- `SHA256SUMS.txt` for attachment checksums. GitHub's automatic Source code archives are source snapshots, not installers.

### What changed

- Fixes Cavalry being detected while its version remained unknown. Official executables may omit `VS_VERSION_INFO`; a bounded reader now accepts only one exact NUL-delimited supported release token and rejects duplicate, similar, or conflicting markers.
- Fixes the Windows install list incorrectly using the macOS plist detector. Custom paths, Qt checks, hashes, and deployment guards remain closed to unknown targets.
- Keeps reviewed redacted previews before EmailJS send or local export. Native Windows CI checks the default sendable preview and current app version; browser tests cover begin → fetch → complete/abort, draft retention, cancellation, rate limits, and redaction.
- Fixes the report-delivery toast retaining an 18px vertical offset from the modal entry animation; offsets now update on later frames and transition start/end/cancel.
- Resolves Windows custom paths to the actual install root beneath the selected directory, including `New Folder` nesting, and persists that resolved path instead of falling back to `C:\Program Files\Cavalry`.
- Bounds the search to 4 levels / 256 directories and requires both `Cavalry.exe` and `Qt6Core.dll`. Multiple matches, missing Qt, links, reparse points, and excessive directories fail closed. Adds nested install apply → status → restore coverage.
- Adds a GitHub Actions Windows/macOS matrix. CI sends no live email and does not replace user-network, WebView2, or real-host acceptance.
- Retains the Common Controls v6 startup fix without requesting elevation.

### Installation and notes

1. Download the appropriate attachment and verify it against `SHA256SUMS.txt`.
2. Run `setup.exe` on Windows, or drag the app to Applications on macOS. Follow the bundled `INSTALL.txt`.
3. **The installers remain unsigned / not notarized.** System security warnings may remain and have not been hidden or bypassed.
4. If Cavalry is not detected, choose “选择路径…” on the Status page and verify the displayed path and version.
5. Save your project and quit Cavalry yourself before refreshing and applying. Choose the corresponding snapshot to roll back.
6. Under “日志 → 反馈问题”, review the preview before choosing Send or Save. Provider acceptance is not proof of mailbox display; keep the report if sending fails.

### Acceptance boundaries

- CI runs on native Windows and macOS runners but does not cover every user's GPU, network, WebView2, or real Cavalry project.
- macOS is ad-hoc signed and not notarized; native Intel hardware remains unverified.
- The Windows package is an unsigned cross-build; native Windows installation and the real host still require their own acceptance.
- Full UI, general Canvas/Graph/TrackingTool, and every project type are not marked as accepted.
