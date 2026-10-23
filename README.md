# Cavalry Bilingual

![Cavalry Bilingual：中英对照、字体排版与可恢复快照](docs/assets/social-preview.png)

**简体中文** | [English](README.en.md)

[![0.1.6](https://img.shields.io/badge/release-0.1.6-78a957)](https://github.com/luoboruodai/cavalry-chinese-english-software-UI/releases/tag/v0.1.6)
[![macOS universal](https://img.shields.io/badge/macOS-universal-2c2e2a)](https://github.com/luoboruodai/cavalry-chinese-english-software-UI/releases/tag/v0.1.6)
[![Windows x64](https://img.shields.io/badge/Windows-x64-2c2e2a)](https://github.com/luoboruodai/cavalry-chinese-english-software-UI/releases/tag/v0.1.6)
[![License](https://img.shields.io/badge/license-MIT-80827f)](LICENSE)

在保留英文原文的同时显示中文，帮助你一边使用 Cavalry，一边对照英文教程。工具还提供字体排版、可恢复补丁、备份管理和用户主动反馈。

> **当前版本：0.1.6（正式发行）。** 正式版身份不代表全界面、全版本或全平台验收完成；具体证据与限制见兼容矩阵。
> 本项目与 Scene Group / Cavalry 官方无关，不分发 Cavalry、Qt 或 Skia 的宿主二进制。

## 下载

| 平台 | 安装附件 | 当前边界 |
|---|---|---|
| macOS arm64 + x86_64 | [Universal DMG](https://github.com/luoboruodai/cavalry-chinese-english-software-UI/releases/download/v0.1.6/Cavalry-Bilingual_0.1.6_macOS-universal.dmg) | ad-hoc 签名、未公证；Intel 原生硬件仍待验证 |
| Windows x64 | [NSIS 安装器](https://github.com/luoboruodai/cavalry-chinese-english-software-UI/releases/download/v0.1.6/Cavalry-Bilingual_0.1.6_Windows-x64-setup.exe) | 未签名；交叉构建与包体验证，原生 Windows／真实宿主仍待验收 |
| 校验 | [SHA256SUMS.txt](https://github.com/luoboruodai/cavalry-chinese-english-software-UI/releases/download/v0.1.6/SHA256SUMS.txt) | 下载后核对附件 SHA-256 |

[完整发布说明](docs/RELEASE-0.1.6.md) · [兼容与覆盖矩阵](docs/COMPATIBILITY.md) · [全部版本](https://github.com/luoboruodai/cavalry-chinese-english-software-UI/releases)

GitHub 自动生成的 **Source code** 是源码快照，不是安装包。

## 主要功能

- **中英对照**：保留英文原文并显示中文，便于跟随英文教程。
- **Cavalry 2.7.2 / 2.8.0**：macOS 使用对应 Qt 合同与独立注入资源，版本或资源不匹配时保持关闭。
- **字体与排版**：调整双语顺序和中英文字体；草稿预览、保存后应用，留空跟随系统。
- **可恢复补丁与备份**：应用前创建带校验的快照，可按快照恢复；恢复前保留当前状态。
- **清晰的操作反馈**：状态、日志与低优先级说明使用统一的右侧通知，关键确认保留在弹窗内。
- **Windows 启动兼容**：嵌入 Common Controls v6 manifest，修复 `TaskDialogIndirect` 入口点缺失导致的启动失败；不请求管理员权限。
- **自定义安装目录**：未自动发现 Cavalry 时，可在状态页选择包含 `Cavalry.exe` 的 Windows 安装目录或 macOS `.app`；当前完整路径清晰可见。
- **用户主动反馈**：macOS 与 Windows 均可先预览脱敏报告，再决定发送或保存；不读取工程文件或 Cavalry 原始日志，不自动收集遥测。

## 使用流程

1. **先保存工程，再自行退出 Cavalry。** 工具不会自动保存或强制退出宿主。
2. 打开 Cavalry Bilingual，在“排版”中检查顺序与字体并保存设置。
3. 在“状态”页刷新检测；未自动发现时，用“选择路径…”指定安装目录。只在版本、资源和安全合同匹配时应用双语。
4. 重新打开 Cavalry。需要回退时，在“备份”中选择对应快照。
5. 如遇问题，在“日志”页打开“反馈问题”，检查预览后自行决定保存或发送。

macOS 更新工具后，如系统“隐私与安全性 → App 管理”中的权限被重置，请重新允许并重启工具；不要在权限拒绝时反复写入宿主。

## 当前平台状态

| 平台 / 宿主 | 已有证据 | 尚未覆盖 |
|---|---|---|
| macOS · Cavalry 2.7.2 / Qt 6.6.3 | 本机工具安装、限定真实宿主与快照流程验证 | 全界面与所有工程类型 |
| macOS · Cavalry 2.8.0 / Qt 6.9.2 | 独立 2.8 注入器与资源、限定界面／视口文案、实际应用与还原流程 | 全界面、通用 Canvas／Graph／TrackingTool 覆盖 |
| macOS universal | arm64 + x86_64 构建，x86_64 主要通过 Rosetta | Intel 原生硬件 |
| Windows x64 | PE／DLL 交叉构建、Wine 合成与加载检查、NSIS 包内容回读 | 原生 Windows、MSVC、真实 Cavalry 宿主与完整安装体验 |

详细证据分级见 [COMPATIBILITY.md](docs/COMPATIBILITY.md) 与 [NATIVE-ACCEPTANCE.md](docs/NATIVE-ACCEPTANCE.md)。静态 ABI、合成测试、Wine／Rosetta 和原生宿主验证不能互相替代。

## 从源码构建

### macOS Universal

需要 Node.js、Python 3.10+、Rust、macOS 开发工具、相应 Qt SDK，以及两个 macOS Rust 目标。

```bash
git clone https://github.com/luoboruodai/cavalry-chinese-english-software-UI.git
cd cavalry-chinese-english-software-UI
npm ci --prefix gui/ui
rustup target add aarch64-apple-darwin x86_64-apple-darwin
export CAVALRY_QT_PREFIX=/path/to/Qt/6.6.3/macos
npm run build:macos-universal
```

输出：`gui/target/universal-apple-darwin/release/bundle/macos/Cavalry Bilingual.app`。

Windows 原生构建、交叉打包与验收要求见 [Windows／原生验收指南](docs/NATIVE-ACCEPTANCE.md)。反馈功能的构建期公开配置见 [FEEDBACK-SERVICE.md](docs/FEEDBACK-SERVICE.md)；邮箱授权码与 Private Key 不应写入源码。

## 文档与参与

- [Agent／维护者项目上下文](docs/PROJECT-CONTEXT.md)：架构、设计初衷、需求演变、堵点与解决方法。
- [设计规范](DESIGN.md)：视觉 tokens、布局、动效、焦点与通知原则。
- [更新日志](CHANGELOG.md) · [0.1.6 发布说明](docs/RELEASE-0.1.6.md)
- [反馈安全说明](docs/FEEDBACK-SERVICE.md) · [兼容矩阵](docs/COMPATIBILITY.md)

提交问题前，请移除工程文件、账号、真实路径和其他私人内容。应用内反馈也必须先预览，不会因打开弹窗而自动发送。

## 许可与声明

[MIT](LICENSE)。上游与第三方声明见 [NOTICE.md](NOTICE.md) 和随包 `Legal/`。
