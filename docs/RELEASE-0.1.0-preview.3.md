# Cavalry Bilingual 0.1.0 Preview 3

**简体中文** | [English](#english)

> 这是预发布，不是稳定版。附件用于提前试用与反馈，不代表全界面、全版本或全平台验收完成。附件的 SHA-256 以同版 `SHA256SUMS.txt` 为准。

## 中文

### 下载附件

- `Cavalry-Bilingual_0.1.0-preview.3_macOS-universal.dmg`：macOS arm64 + x86_64。
- `Cavalry-Bilingual_0.1.0-preview.3_Windows-x64-setup.exe`：Windows x64 NSIS 安装器。
- `SHA256SUMS.txt`：上述附件的校验值。GitHub 自动生成的 Source code 是源码快照，不是安装包。

### 本版亮点

- 增加并完善 Cavalry 2.8.0 / Qt 6.9.2 的独立 macOS 注入器、版本化资源与限定界面／视口双语适配；不匹配的目标继续关闭。
- 更新排版、备份、日志和状态管理；应用前快照、按快照恢复与失败回滚继续作为默认安全路径。
- 统一取消按钮和键盘焦点；低优先级说明使用右侧通知。
- 反馈报告先脱敏预览再决定发送，不包含 OS／CPU 架构字段；发送说明在进入预览时自动弹出，不再显示服务实现细节或额外信息按钮。
- 提供 macOS Universal DMG 与 Windows x64 NSIS 安装器，以及双语离线安装指南和许可文件。
- 新增公开的 Agent／维护者项目上下文，记录设计初衷、需求演变、关键堵点与解决方法。

### 安装与使用

1. 下载对应附件并核对 `SHA256SUMS.txt`。
2. macOS 将应用拖到 Applications；Windows 运行 `setup.exe`。按包内 `INSTALL.txt` 操作。
3. 先保存工程并自行退出 Cavalry，再检查排版设置、刷新检测并应用。
4. 需要回退时选择对应快照。卸载不会自动删除备份或设置，请先检查再自行处理。

### 签名与验收边界

- **macOS**：ad-hoc 签名，未公证；系统可能显示安全提示。已区分 Universal 构建、DMG 挂载／成员／签名检查与限定真实宿主证据。Rosetta 不是 Intel 原生验收。
- **Windows**：安装器未签名，需要 Windows x64 和可用的 WebView2 Runtime，可能触发 SmartScreen。交叉构建、NSIS 成员与载荷检查不等于原生 Windows、MSVC 或真实 Cavalry 宿主验收；本轮 Wine 静默安装在 90 秒超时后仍未生成目标目录，记为未完成。
- Cavalry 2.8 的进度不代表全界面、通用 Canvas／Graph／TrackingTool 或所有工程类型已经覆盖。
- 本版不启用自动遥测。反馈只有在用户检查预览并明确点击发送后才会提交。

详细矩阵见 `docs/COMPATIBILITY.md`，反馈安全见 `docs/FEEDBACK-SERVICE.md`，原生验收命令见 `docs/NATIVE-ACCEPTANCE.md`。

## English

This is a pre-release, not a stable release. The attachments are provided for early evaluation and feedback; they do not establish full-UI, all-version, or all-platform acceptance. Use the accompanying `SHA256SUMS.txt` for attachment hashes.

### Attachments

- `Cavalry-Bilingual_0.1.0-preview.3_macOS-universal.dmg` for macOS arm64 + x86_64.
- `Cavalry-Bilingual_0.1.0-preview.3_Windows-x64-setup.exe` for Windows x64.
- `SHA256SUMS.txt` for the attachment checksums. GitHub's automatic Source code archives are source snapshots, not installers.

### Highlights

- Adds and refines the dedicated macOS Cavalry 2.8.0 / Qt 6.9.2 injector, versioned resources, and selected UI/viewport bilingual presentation; unsupported targets remain closed.
- Updates typography, backups, logs, and status management while retaining pre-change snapshots, snapshot restore, and failure rollback as the default safety path.
- Unifies cancel styling and keyboard focus; supplemental explanations use right-side notifications.
- Feedback reports require a redacted preview before sending and omit OS/CPU architecture fields. The delivery explanation appears automatically on entering preview, without provider implementation details or an extra info button.
- Provides a macOS Universal DMG and Windows x64 NSIS installer, with bilingual offline installation guidance and license notices.
- Adds public project context for agents and maintainers, covering original intent, requirement evolution, difficult blockers, and solutions.

### Installation and use

1. Download the appropriate attachment and verify it against `SHA256SUMS.txt`.
2. On macOS, drag the app to Applications. On Windows, run `setup.exe`. Follow the bundled `INSTALL.txt`.
3. Save your project and quit Cavalry yourself before reviewing settings, refreshing detection, and applying.
4. Choose the corresponding snapshot to roll back. Uninstalling does not automatically remove backups or settings; review them before deleting anything yourself.

### Signing and acceptance boundaries

- **macOS**: ad-hoc signed and not notarized, so macOS may show a security warning. Universal build, DMG mount/member/signature checks, and selected real-host evidence are recorded separately. Rosetta is not native Intel acceptance.
- **Windows**: the installer is unsigned and requires Windows x64 plus a working WebView2 Runtime; SmartScreen may appear. Cross-building and NSIS member/payload checks do not establish native Windows, MSVC, or real Cavalry host acceptance. In this run, Wine silent installation timed out after 90 seconds without creating the target directory and is recorded as incomplete.
- Cavalry 2.8 progress does not establish full UI, general Canvas/Graph/TrackingTool, or every project-type coverage.
- No automatic telemetry is enabled. Feedback is submitted only after the user reviews the preview and explicitly chooses Send.

See `docs/COMPATIBILITY.md`, `docs/FEEDBACK-SERVICE.md`, and `docs/NATIVE-ACCEPTANCE.md` for the detailed evidence boundaries.
