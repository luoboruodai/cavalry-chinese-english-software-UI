# Cavalry Bilingual

**简体中文** | [English](README.en.md)

Cavalry 的中英双语界面工具：在保留英文原文的同时显示中文，帮助用户在跟随英文教程时理解界面，并提供字体排版、可恢复补丁和备份管理。

> **0.1.0 开发候选。** 当前提供 `0.1.0 Preview 1` 预发布附件；它不是稳定版，也不能保证全界面、全版本或全平台兼容。
> 与 Scene Group / Cavalry 官方无关；不分发 Cavalry、Qt 或 Skia 的宿主二进制。

## 当前平台状态

| 平台 / 宿主 | 当前状态 |
|---|---|
| macOS arm64 · Cavalry 2.7.2 / Qt 6.6.3 | 工具已在本机安装并完成部分真实宿主验证；仍不是全界面验收。 |
| macOS universal | 工具与注入器可构建 arm64 + x86_64；x86_64 测试主要通过 Rosetta，Intel 原生硬件仍待验证。 |
| Cavalry 2.8.0 / Qt 6.9.2 | 隔离副本已取得限定词条、Path 和固定视口证据；正式写入仍拒绝，通用 Canvas/Graph、TrackingTool 和全界面覆盖未完成。 |
| Windows x64 | 当前提供交叉构建的便携 ZIP；原生 Windows、MSVC、NSIS 和真实 Cavalry 宿主仍未验收，本轮 Wine 复验未完成。 |

详细边界见 [兼容与覆盖矩阵](docs/COMPATIBILITY.md)。Rosetta、Wine、静态 ABI 检查、合成测试和真实宿主验证是不同证据，不能互相替代。

## 主要功能

- **中英对照**：界面标签保留英文原文，便于对照官方或英文教程。
- **排版与字体**：调整双语顺序和中英文字体，保存前可预览；空字体表示跟随系统。
- **可恢复补丁**：应用前建立带校验的快照，支持按快照恢复。
- **输入安全**：用户输入值、图层自定义名称、路径、表达式、端口 ID 和连接数据保持原文，只处理 UI 展示字段。
- **未知版本保护**：版本、Qt ABI、UUID 或调用点不符合已验证合同时保持关闭，而不是强行注入。

## 获取与安装

### 0.1.0 Preview 1 预发布

- [macOS universal DMG](https://github.com/luoboruodai/cavalry-chinese-english-software-UI/releases/download/v0.1.0-preview.1/Cavalry-Bilingual_0.1.0-preview.1_macOS-universal.dmg)：ad-hoc 签名，未公证。
- [Windows x64 便携 ZIP](https://github.com/luoboruodai/cavalry-chinese-english-software-UI/releases/download/v0.1.0-preview.1/Cavalry-Bilingual_0.1.0-preview.1_Windows-x64-portable.zip)：不是 NSIS 安装器，未签名，原生 Windows 未验收。
- [SHA256SUMS.txt](https://github.com/luoboruodai/cavalry-chinese-english-software-UI/releases/download/v0.1.0-preview.1/SHA256SUMS.txt) 与 [预发布说明](docs/RELEASE-0.1.0-preview.1.md)。

GitHub 自动生成的 **Source code** 仅用于审查和构建源码，不是安装包。

### 从源码构建 macOS universal 工具

需要 Node.js、Python 3.10+、Rust、macOS 开发工具、Qt 6.6.3 SDK，以及 Rust 的两个 macOS 目标标准库。

```bash
git clone https://github.com/luoboruodai/cavalry-chinese-english-software-UI.git
cd cavalry-chinese-english-software-UI

npm ci --prefix gui/ui
rustup target add aarch64-apple-darwin x86_64-apple-darwin
export CAVALRY_QT_PREFIX=/path/to/Qt/6.6.3/macos
npm run build:macos-universal
```

构建结果位于：

```text
gui/target/universal-apple-darwin/release/bundle/macos/Cavalry Bilingual.app
```

本地构建使用 ad-hoc 签名，未公证；不要把它描述为已公证的分发包。Windows 原生构建入口和验收要求见 [原生验收指南](docs/NATIVE-ACCEPTANCE.md)。

## 使用流程

1. **先保存工程，再自行退出 Cavalry。** 工具不会自动保存或强制退出宿主。
2. 打开 Cavalry Bilingual，在“排版与字体”中调整顺序和字体，检查预览并保存设置。
3. 在状态页刷新检测。只有宿主版本、资源和安全合同匹配时，工具才允许应用。
4. 应用后重新打开 Cavalry。
5. 需要回退时选择对应快照。“恢复”是恢复到该快照，**不一定等于恢复成原厂英文状态**；恢复前也会保留当前状态。

没有完整校验清单的旧备份只读展示，不应自动恢复。不要在 Cavalry 运行期间直接覆盖宿主文件。

## 测试与审计

```bash
npm test --prefix gui/ui
cargo test --manifest-path patcher/Cargo.toml
bash tools/test_qt_runtime.sh
npm run test:generator
npm run test:translations
npm run audit:translations
npm run test:catalog28
npm run test:macos-canvas
```

`bash tools/test_qt_runtime.sh` 需要正确设置 `CAVALRY_QT_PREFIX`。字典条数、编译成功和合成测试都不等于真实界面覆盖率；发布前还需执行候选文件、Git 索引/历史和最终归档的隐私检查。

## 项目结构

- `gui/`：Tauri + React 工具界面、草稿设置和状态展示。
- `patcher/`：Rust 补丁守卫、版本配置、备份校验及恢复事务。
- `injector/`：Qt 运行时翻译和受精确 ABI 合同保护的自绘适配。
- `translations/pristine/`：翻译真源；模型身份、用户名称和 ID 不被译文替换。
- `tools/`、`tests/`：构建、字典生成、审计及合成合同测试。

## 更多文档

- [更新日志](CHANGELOG.md)
- [兼容与覆盖矩阵](docs/COMPATIBILITY.md)
- [Windows / Intel / Cavalry 2.8 原生验收指南](docs/NATIVE-ACCEPTANCE.md)

## 许可

本项目采用 [MIT License](LICENSE)。上游 `daftAI2026/Cavalry-i18n` 衍生部分的版权和 MIT 声明保留在 [LICENSE.daftai](LICENSE.daftai) 与 [NOTICE.md](NOTICE.md)。

GUI 使用系统字体，不因用户选择本机字体而复制或分发字体文件。
