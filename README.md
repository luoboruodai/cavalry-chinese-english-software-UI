# Cavalry Bilingual / Cavalry 中英双语界面工具

**0.1.0 开发候选版，尚未发布。当前不能保证全界面、全版本兼容。**

为 Cavalry 提供中英对照界面，并管理排版、界面字体与可恢复补丁。
A bilingual UI patch manager with previewable settings and validated snapshots.

> 与 Scene Group / Cavalry 官方无关；不分发 Cavalry、Qt 或 Skia 的宿主二进制。
> Not affiliated with Scene Group. No vendor application binaries are redistributed.

## 当前验收状态 / Validation status

本轮已将最新项目候选安装到 macOS 的 Cavalry Bilingual，并在原始 Cavalry 2.7.2 / Qt 6.6.3 上验证了部分表面。**这不是“全界面双语已完成”或“全部版本兼容”的结论。**

| 范围 | 状态 |
|---|---|
| 工具 UI、草稿、字体、预览 | 80 项浏览器断言通过；已安装 macOS 工具的草稿/顺序/取消和运行中守卫已操作验证。 |
| 备份/应用/还原 | 22 个 Rust lib + 16 个集成测试通过；各次测试保留独立快照。 |
| macOS 注入器 | arm64 + x86_64 编译；431 个 Qt imports 在每个目标宿主 slice 中均能解析。Intel 未实机验证。 |
| 2.7.2 原始宿主 | 视口固定提示与部分属性标签已验证；旧候选误写同父图标的回归已修正。最终完整验收尚未结束。 |
| Dependency Graph | 独立并排测试场景已建立；实际使用 DGView/lina。图层拖入、节点/端口连接未完成，不标通过。 |
| Cavalry 2.8.0 / Qt 6.9.2 | 已从官方安装包核实版本与 ABI 变化；尚未适配，写入前拒绝，未用旧偏移强行注入。 |
| Windows | Rust check/事务 fixture 通过；Qt/QPA、NSIS、安装器及真实宿主未验收，不发布 Windows 已验证包。 |

完整边界见 [兼容与覆盖矩阵](docs/COMPATIBILITY.md)。

## 本轮修复 / Changes

- 主属性标签必须与经合同核对的指针匹配；图标、提示小标签和数值编辑器不再被一起改写。
- 名称列在绘制后请求有限宽度，保留数值编辑空间；过长名称使用完整 tooltip，保留原始帮助。
- 稳定 nodeType 的唯一字段超集匹配修复可选字段省略引起的整条漏译，不改变结构或模型 key。
- 按已有词典补齐 299 个节点类型 niceName，加入 26 个限定于 Effects 菜单的标题，不翻译用户脚本名称。
- 补充属性面板无选择提示、固定长提示换行，避免文字工具按钮无限抬高整个窗口的最小宽度。
- 草稿保存/取消/默认、结构化预览、本机中英字体、可搬移资源和校验快照沿用已有回归。
- 窗口中仍存在动态消息、系统对话框、第三方界面及自绘区域的英文/截断；继续逐项验收。
- 在最终验收期间检测到用户切换工程后停止自动宿主操作，不关闭或保存新工程。

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
