# Cavalry Bilingual / Cavalry 中英双语界面工具

**0.1.0 开发候选版，尚未发布。当前不能保证全界面、全版本兼容。**

为 Cavalry 提供中英对照界面，并管理排版、界面字体与可恢复补丁。
A bilingual UI patch manager with previewable settings and validated snapshots.

> 与 Scene Group / Cavalry 官方无关；不分发 Cavalry、Qt 或 Skia 的宿主二进制。
> Not affiliated with Scene Group. No vendor application binaries are redistributed.

## 当前验收状态 / Validation status

| 范围 | 状态 |
|---|---|
| GUI：状态、排版、备份、日志 | TypeScript 与浏览器交互回归通过；保留奶油纸质视觉系统 |
| macOS 补丁事务 | 合成 app 的单元/集成/故障恢复测试；不等同于真实 Cavalry 验收 |
| Qt 6.6.3 字体、双语格式与普通控件 | 隔离 Qt harness 验证，无缺字样例、保留占位符 |
| macOS GUI 包 | Apple Silicon 本机构建；ad-hoc 签名，未公证；当前源码/索引/包扫描与资源 hash 通过，历史扫描仍有初始提交中的 1 条旧个人路径，未改写历史 |
| macOS 注入器 | arm64 + x86_64 编译；并不意味着 Intel 宿主实测通过 |
| Cavalry 2.7.2 隔离候选 | **最新隔离 clone 已通过指定修复回归**：视口固定提示中英双语；属性行在切换图层后显示完整 `位置 (Position)` / `旋转 (Rotation)`；clone 已停止并还原 |
| Cavalry 2.7.2 原始宿主 | 只完成修复前候选的一次授权验收并已还原；修复后再次写入 `/Applications/Cavalry.app` 需单独明确授权 |
| 其他 Cavalry / Qt 版本 | **未验证，阻止注入**，不靠移除版本守卫冒充兼容 |
| Windows | 后端事务与 x64 Rust check/fixture 已验证；本机缺 MSVC linker、Windows Qt/QPA、NSIS 与宿主，**不可发布** |

完整边界见 [兼容与覆盖矩阵](docs/COMPATIBILITY.md)。

## 本轮修复 / Changes

- 排版设置采用独立草稿；保存失败保留输入，取消与恢复默认都不会偷偷写入宿主。
- 预览按菜单、属性、图层分组；统一间距、内外圆角、键盘焦点、36–40 px 热区及减少动效。
- 移除原来的无效“字体差异化”开关，提供本机字体家族选择。英文字体为首选、中文字体为回退；不是强制逐字符分字体。
- 注入器在启动时读取已应用的模板，避免 GUI 改了设置而已编译字典仍是旧顺序。
- 修复 AttrControlRow 已经被宿主省略的双语标签：在 2.7.2 合同成立时恢复完整显示副本，并让行复用时重新读取，避免 `Position...` / `Rotation...` 截断或旧标签串行污染。
- 视口固定 Path 文本只在两处已核对调用点启用；隔离候选实测 `Active Camera`、`Viewport Quality` 与 5 条工具提示均有中英显示。
- 对稳定的 `nodeType` + 展示字段结构更新节点词典；第二轮隔离真实 Cavalry 2.7.2 bundle 更新 5,337 条，恢复后 hash 一致。
- 配置写入用户数据目录；运行时资源随 `.app` 携带，不依赖开发机源码目录。
- 快照记录补丁涉及文件的存在/缺失、权限和 SHA-256；还原不会再删除刚恢复的双语运行时。
- 还原前验证目录边界、目标位置、版本和完整性；操作失败尝试回滚，并保留快照。签名恢复为 ad-hoc，不伪装原厂签名。
- 日志本地保留最近 200 条。不会上传字体、用户工程或日志。

## 使用流程 / Usage

1. 在“排版与字体”中调整双语顺序与字体，检查预览，点击“保存设置”。空字体表示跟随系统。
2. **先保存工程，再自行退出 Cavalry。** 工具不会自动保存或强制退出宿主。
3. 状态页刷新检测；只有匹配适配目标且资源完整时才允许应用。应用后重新打开 Cavalry。
4. “备份”恢复到选中快照的状态，**不等同于一律还原英文**。还原动作本身也会保留操作前快照。
5. 旧版本没有完整校验清单的备份只读展示，不能安全地自动恢复；不要删除它们。损坏设置不会被默认值静默覆盖。

字体只影响支持的 UI 渲染路径，不修改工程文本图层。自绘文字与第三方脚本尚未全部覆盖。

## 本地构建 / Local build

需要 Node.js、Rust、macOS 开发工具与匹配的 Qt 6.6.3 SDK。

```bash
export CAVALRY_QT_PREFIX=/path/to/Qt/6.6.3/macos
npm run build:macos
npm ci --prefix gui/ui
npm test --prefix gui/ui
cargo test --manifest-path patcher/Cargo.toml
bash tools/test_qt_runtime.sh
npm run tauri:build --prefix gui/ui -- --bundles app
```

发布构建还应为 Rust 和 C++ 启用源码路径重映射，并运行产物隐私检查。当前仓库历史扫描仍会报告初始提交 `6125ef5` 中 `gui/ui/scripts/build-charset.py` 的旧个人路径；本轮不 force-push 或改写历史，因此这不是“历史扫描通过”。
`tools/prepare_runtime.js` 从 pristine 生成**单语原始字典**，运行时再按模板合成双语。
`composer/` 保留为离线工具，不再决定 GUI 用户的运行时模板。

```bash
python3 tools/audit_translations.py
python3 tools/audit_release.py self-test
python3 tools/audit_release.py source
python3 tools/audit_release.py index
python3 tools/audit_release.py history
python3 tools/audit_release.py package /path/to/Cavalry-Bilingual.app
```

字典审计衡量目录完整性，**不把字典条数当作软件界面覆盖率**。打包成功、合成测试通过也不代替安装器、真实宿主及另一平台验收。

## 架构 / Layout

- `gui/`：Tauri + React，独立用户设置、可恢复错误反馈与只读检测。
- `patcher/`：补丁守卫、版本化配置、备份校验、应用与还原事务。
- `injector/`：Qt 运行时翻译及受保护的私有 ABI 自绘适配器。
- `translations/pristine/`：原始翻译真源；模型名字只作展示，不替换用户数据或 ID。
- `tests/`、`tools/`：隔离 Qt 测试、字典/隐私审计与构建脚本。

## 许可 / License

本项目 MIT。上游 `daftAI2026/Cavalry-i18n` 衍生部分的版权和 MIT 声明保留在 `LICENSE.daftai`、`NOTICE.md`。
GUI 当前使用系统字体；不因选择本机字体而复制或分发字体文件。历史 MiSans/Inter 素材不进入当前 GUI 产物。
