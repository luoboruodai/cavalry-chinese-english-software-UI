# Cavalry Bilingual 0.1.0 Preview 4

**简体中文** | [English](#english)

> 这是预发布热修复版本，不是稳定版。主要修复 Windows 安装后因 `TaskDialogIndirect` 入口点缺失而无法启动的问题。附件 SHA-256 以同版 `SHA256SUMS.txt` 为准。

## 中文

### 下载附件

- `Cavalry-Bilingual_0.1.0-preview.4_macOS-universal.dmg`：macOS arm64 + x86_64。
- `Cavalry-Bilingual_0.1.0-preview.4_Windows-x64-setup.exe`：Windows x64 NSIS 安装器。
- `SHA256SUMS.txt`：附件校验值。GitHub 自动生成的 Source code 是源码快照，不是安装包。

### 本版修复

- Preview 3 的 Windows EXE 静态导入 `comctl32.dll` 的 `TaskDialogIndirect`，但 PE 资源目录为空，未声明 Common Controls v6。
- 本版在 Windows 构建中嵌入 `Microsoft.Windows.Common-Controls 6.0.0.0` manifest，使系统使用对应 common-controls 路径。
- manifest 同时使用 `asInvoker`，**不会请求管理员权限**，也不改变双语、备份、反馈或发送逻辑。
- 新增独立探针、PE 资源目录与嵌入 XML 回读检查；NSIS 解压后再次核对主程序、运行时、指南和全部 Legal 文件。

### 安装与注意事项

1. 下载对应附件并核对 `SHA256SUMS.txt`。
2. Windows 运行 `setup.exe`；macOS 将应用拖到 Applications。按包内 `INSTALL.txt` 操作。
3. **安装器仍未签名**，“未知发布者”或 SmartScreen 警告与本次入口点修复是两个不同问题，并未被隐藏或绕过。
4. 先保存工程并自行退出 Cavalry，再刷新检测并应用；需要回退时选择对应快照。

### 验收边界

- 本版已验证 Windows 目标编译、独立 manifest 探针、最终 PE 资源与 XML、新鲜 NSIS 生成、7-Zip 成员／解压／哈希和隐私检查。
- Wine／静态 PE 检查不替代 Windows 原生启动与真实 Cavalry 宿主验收；仍请 Windows 用户以本版实际启动结果为准。
- macOS 为 ad-hoc 签名、未公证；Intel 原生硬件仍未验收。
- 全界面、通用 Canvas／Graph／TrackingTool 和所有工程类型不标记为通过。

## English

This is a pre-release hotfix, not a stable release. It primarily resolves the Windows startup failure caused by a missing `TaskDialogIndirect` entry point. Use the accompanying `SHA256SUMS.txt` for attachment hashes.

### Attachments

- `Cavalry-Bilingual_0.1.0-preview.4_macOS-universal.dmg` for macOS arm64 + x86_64.
- `Cavalry-Bilingual_0.1.0-preview.4_Windows-x64-setup.exe` for Windows x64.
- `SHA256SUMS.txt` for attachment checksums. GitHub's automatic Source code archives are source snapshots, not installers.

### What changed

- Preview 3's Windows EXE imports `TaskDialogIndirect` from `comctl32.dll`, but its PE resource directory is empty and does not declare Common Controls v6.
- This release embeds a `Microsoft.Windows.Common-Controls 6.0.0.0` manifest so Windows uses the appropriate common-controls path.
- The manifest uses `asInvoker`, so it **does not request administrator privileges** and does not change bilingual, backup, feedback, or delivery behavior.
- Adds an independent probe plus PE resource/XML verification, with a second payload check after NSIS extraction covering the executable, runtime, guide, and all Legal files.

### Installation and notes

1. Download the appropriate attachment and verify it against `SHA256SUMS.txt`.
2. Run `setup.exe` on Windows, or drag the app to Applications on macOS. Follow the bundled `INSTALL.txt`.
3. **The installer remains unsigned.** An unknown-publisher or SmartScreen warning is separate from this entry-point fix and has not been hidden or bypassed.
4. Save your project and quit Cavalry yourself before refreshing detection and applying. Choose the corresponding snapshot to roll back.

### Acceptance boundaries

- Verified Windows target compilation, an independent manifest probe, final PE resources/XML, fresh NSIS generation, 7-Zip member/extraction/hash checks, and privacy scans.
- Wine and static PE checks do not replace native Windows startup or real Cavalry host acceptance. Native Windows users should confirm this build's actual startup result.
- macOS is ad-hoc signed and not notarized; native Intel hardware remains unverified.
- Full UI, general Canvas/Graph/TrackingTool, and every project type are not marked as accepted.
