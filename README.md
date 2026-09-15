# Cavalry Bilingual / Cavalry 中英双语界面工具

把 Cavalry 2.7.2（Scene Group 出品的 2D 动画软件）的英文界面变成**中英双语同时显示**，方便对照英文教程学习。

Turns the English UI of **Cavalry 2.7.2** into a **Chinese-English bilingual display**, making it easier to follow English tutorials while learning.

> ⚠️ 仅供学习用途。本项目与 Scene Group / Cavalry 官方无关，不分发任何 Cavalry 本体文件；补丁仅在用户本机生成。
> For learning purposes only. Not affiliated with Scene Group. No Cavalry binaries are distributed — patches are built and applied locally.

## 原理 / How It Works

Cavalry 的界面文本由 Qt 运行时的翻译表驱动。本工具 fork 自 [daftAI2026/Cavalry-i18n](https://github.com/daftAI2026/Cavalry-i18n)（MIT）的注入器架构：

1. **合成器 `composer/`**：把 Qt Linguist 翻译源（`translations/pristine/*.ts`）的译文改写为双语形态（如 `文件（File）`），同样处理节点显示名（`model_display_translations.json`，299 条）
2. **构建**：重新生成翻译表 → 用 Qt 6.6.3 重编 `libCavalryTranslatorInjector.dylib`
3. **补丁器 `patcher/`（cbpatch，Rust）**：备份 → 替换注入器 → 写入语言标记 → ad-hoc 重签 → 校验；支持一键还原（restore）

## 状态 / Status

| 平台 | 状态 |
|---|---|
| macOS (Cavalry 2.7.2) | ✅ 可用（本机已端到端验证） |
| Windows | 🚧 开发中（M3） |

## 快速开始 / Quick Start（macOS）

前置：Node.js、Rust、Qt 6.6.3 SDK（`qtbase`，macOS clang_64）

```bash
export CAVALRY_QT_PREFIX=/path/to/Qt/6.6.3/macos   # 或 qt_sdk/6.6.3/macos
npm run compose        # 双语合成 → translations/working/
npm run build:macos    # 生成 dist/libCavalryTranslatorInjector.dylib

cd patcher && cargo build --release
./target/release/cbpatch status    # 查看 Cavalry 安装状态
./target/release/cbpatch apply     # 打双语补丁（自动备份，可 restore 回滚）
./target/release/cbpatch restore   # 还原英文
```

排版模板在 `composer/bilingual.config.json` 中配置（默认 `{zh}（{en}）`）。

## 目录结构 / Layout

```
composer/       双语合成器（自研）
injector/       Qt 注入器（fork 自 daftAI2026/Cavalry-i18n, MIT）
tools/          翻译表生成与构建脚本（同上来源）
languages/      语言包 JSON 数据（daftai 格式，生成的输入依赖）
translations/   pristine 翻译源真源 + working 合成产物
patcher/        cbpatch 补丁管理器 CLI（Rust, 自研）
```

## 许可 / License

- 本项目：MIT（见 [LICENSE](LICENSE)）
- `injector/`、`tools/`、`languages/` 基于 [daftAI2026/Cavalry-i18n](https://github.com/daftAI2026/Cavalry-i18n)（MIT，见 [LICENSE.daftai](LICENSE.daftai) 与 [NOTICE.md](NOTICE.md)）
- Cavalry 是 Scene Group 的商标；MiSans/Inter 字体许可见后续版本说明
