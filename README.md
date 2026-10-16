# Cavalry Bilingual / Cavalry 中英双语界面工具

**0.1.0 开发候选版，尚未发布。当前不能保证全界面、全版本兼容。**

为 Cavalry 提供中英对照界面，并管理排版、界面字体与可恢复补丁。
A bilingual UI patch manager with previewable settings and validated snapshots.

> 与 Scene Group / Cavalry 官方无关；不分发 Cavalry、Qt 或 Skia 的宿主二进制。
> Not affiliated with Scene Group. No vendor application binaries are redistributed.

## 当前验收状态 / Validation status

**当前范围更新：** 用户已将依赖图拖入、端口展开/连接移出本轮验收门槛。正在处理 Windows/Intel 原生、2.8.0 与界面覆盖；缺少原生设备证据时不宣布完成、不替换正式宿主。操作入口见 [原生验收指南](docs/NATIVE-ACCEPTANCE.md)。

2026-10-14 的输入安全与 DG/Lina 测宽候选已在本机工具及原始 Cavalry 2.7.2 / Qt 6.6.3 上部署。原始宿主已验证图层名称不再因重命名确认而被译文写回；最新候选还在独立验收场景中观察到长中文图层名在视口与时间线可见、无方框，并保持 DG 安全省略。真实拖入/端口连接及其他遗漏仍未完成。**这不是“全界面双语已完成”或“全部版本兼容”的结论。**

| 范围 | 状态 |
|---|---|
| 工具 UI、草稿、字体、预览 | 80 项浏览器断言通过；已安装 macOS 工具的草稿/顺序/取消和运行中守卫已操作验证。 |
| 备份/应用/还原 | 26 个 Rust lib + 16 个集成测试通过；各次测试保留独立快照。 |
| macOS 注入器 | arm64 + x86_64 编译；441 个 Qt imports 在每个目标宿主 slice 中均能解析。工具新增arm64+x86_64 universal构建；Intel仍未实机验证。 |
| 2.7.2 原始宿主 | 视口固定提示与部分属性标签已验证；旧候选误写同父图标的回归已修正。最终完整验收尚未结束。 |
| Dependency Graph | 独立并排测试场景已建立；实际使用 DGView/lina。长中文节点标题、端口可见与图内移动有实测；Scene Tree 图层拖入、端口展开/连接仍未通过。视口与时间线的长中文样例在最新候选中可见，但不代表所有自绘路径已覆盖。 |
| Cavalry 2.8.0 / Qt 6.9.2 | arm64三语及x86_64/Rosetta的限定action/prefix/固定视口Path已有真实可读证据；通用Canvas/Graph、非白名单提示、全界面和Intel原生仍未完成，正式写入仍拒绝。 |
| Windows | 交叉构建产物已在 Wine 执行双语 display/input/Qt 测试及 QPA+generic 产品 DLL 加载门；不等于原生 Windows/MSVC、NSIS 或 Cavalry 宿主验收。 |

完整边界见 [兼容与覆盖矩阵](docs/COMPATIBILITY.md)。

### 2026-10-16：2.8 三语限定 Path 与 x86_64/Rosetta 已实测

- 新增 9 个真实主工作区缺译字段、4 个 Add Layers 字段及 1 个 Align 标题字段，简体上下文候选共 69 条；17 份 source 审阅稿的非 UI 元数据及 447 个默认名称字段保持一致。当前目录测试 46 项通过；缺译仍有 2,406 条，不能按候选数量冒充全界面覆盖。
- 繁体、日文、简体 arm64 默认工具下，5 个 action 与 3 个 prefix 均为 8/8 成功、0 回退，固定视口 rendered=1/fallback=0，并取得整行可读截图。日文 persisted Soft Selection 的非白名单提示仍有乱码；诊断计数不能单独作为整页通过依据。
- app13 的 v10 x86_64/Rosetta 候选同样通过上述限定动态与画面验收，SHA-256 `8efd1a15bc8e13e67cc3cb7438867ae6c7b7fcb2d1953a6322f4756ed0adc3c2`，同名重建一致。`/usr/bin/arch -x86_64` 会清除 `DYLD_*`，必须在子 shell 内重新设置注入变量。该结果不是 Intel 原生验收，通用 Canvas/Graph 仍关闭。
- app14/v11 已加入 Soft Selection 的 5 个 action source，静态 producer 绑定与双架构审计通过，默认 8 个旧 source 继续成功；但模态欢迎页阻止 Mesh 激活，新 source 未触发，原生乱码修复仍待复验，不能写成已完成。
- app15/16/17 的默认主窗口已分别显示 `レイヤーを追加（Add Layers）`、`添加图层（Add Layers）`、`加入圖層（Add Layers）`。四个精确 Add Layers 字段均为对应文本，三语各 17 份 catalog 非 UI 字段一致；这是单一标签的三语真实通过，不是全界面覆盖。
- `align.title` 也已取得三语真实显示通过：app16原本已是 `对齐（Align）`，app19显示 `對齊（Align）`，app18显示 `整列（Align）`；这是另一单标签的三语真实通过，不是全界面覆盖。
- app20/v12 已为 2.8 两架构核对 3 库 UUID 和 7 个限定 Canvas 调用点；v12 同名重建一致。默认日文主窗口的旧 source 与固定视口无回归，但 Canvas 只有 `ready=1`，`matched/rendered/fallback=0`；模态欢迎页拦截最小文字工具触发，故没有原生 Canvas 可读通过。`GraphicsViewportBase` 已确认是 `to_string` 数值文本，`RenderWindowGLAsync` 是英文字面量，二者继续排除。
- app21/v13 已为 2.8 两架构核对 elide 符号、3 个 Graph 测宽调用点、完整函数摘要及篡改拒绝；v13 同名重建一致。默认日文窗口中 Graph 只有 `ready=1`，`measured/splitRejected/fallback=0`；没有 Graph 节点，不能记为原生测宽或绘制通过。最新 Add Layers/Align、旧 source 与固定视口保持可见。
- app22/v14 已为 TrackingTool 的 `tool.tracking.hint.clickShape` 加入成对 measure/draw 合同，两架构各验证 8 个 draw 和 1 个 measure；当前 46 项目录、15 项生成器、6 个 fixtures 和 8 项 Python 合同通过，v14 同名重建一致。默认窗口中 draw/measure 均 ready=1、matched/measured/rendered/fallback=0；TrackingTool 未激活，不能记为原生居中或可读通过。Graph ready、旧 source、固定视口和最新日文标签无回归。x86_64/Rosetta 下也取得相同 ready 与旧路径证据，见 `candidate-application-v22-x86_64.json`；这不是 Intel 原生验收。
- 最新 v14 的简体与繁体启动回归也已补齐：app23 显示 `添加图层（Add Layers）`、`对齐（Align）`，app24 显示 `加入圖層（Add Layers）`、`對齊（Align）`；两者旧 source、固定视口、Canvas/Graph ready 均符合限定预期，matched/measured 仍为 0。证据为 `candidate-application-v23.json` 和 `candidate-application-v24.json`，不记 Tracking 原生触发。
- Scene Window 的 `Enter a Layer name` 已按同类 placeholder 约定改为纯 `輸入圖層名稱` / `レイヤー名を入力`，翻译门恢复通过且没有放宽 FP-9 白名单。首次只换注入器时原生仍是旧文案，随后确认 font-only 必须同步 app 内 source catalog；app25/26 仅该 `UI-text` 改变，非 UI 字段不变，重开均显示纯译文，证据为 `candidate-application-v25.json` 和 `candidate-application-v26.json`。v15 同名重建一致，默认 dist 也已同步重建。
- 2.7.2 默认路径已修复旧审计误选 2.8 UUID 的问题，并完成两架构只读 Canvas/viewport/Graph/viewport-name 合同复核；默认 dist 注入器也用 Qt 6.6.3 重建，双架构各 441 imports、0 unresolved。产物仅在 dist，未安装或替换正式宿主，不记新的原生 UI 验收。
- 用户已明确延期 2.8 合法登录与 Save As，后续发现问题再处理；这两项不记通过。Windows/Intel 原生、原生 Canvas/Graph/Tracking 画面、非白名单提示和全界面缺译仍未完成，不替换正式宿主或发布。

### 2026-10-16：2.7.2 当前实例 Save As 对照验收

- 先保存私有恢复副本，再打开已有合成场景并另存为 `cb-acceptance-roundtrip-20261016.cv`；语义比较25个节点、15条连接，0处不一致，原始文件哈希未变。该结果证明当前2.7.2实例的保存路径与用户值保持，不能替代2.8验收。

### 2026-10-14 续修：2.8 原生资源试稿与 ICU

- `audit:catalog28` 可额外导出 **en-GB 原始 schema 的双语实验稿**，只改展示 `UI-text`，保留 `notes`、ID、`dontTranslate` 和受保护的节点默认名称；拒绝把试稿直接导出到宿主 `.app`。这不是安装功能。
- 简体新增 66 个独立 ICU 消息候选，对应 72 处目录引用；结构检查保护参数、分支、复数 `#`、格式与 offset。macOS ICU 实际格式化 198 个 0/1/2 双语用例通过。繁体/日语 ICU 暂保留英文，未冒充已完成。
- 仅使用资源实验稿、**不加载注入库**的隔离 2.8 副本已显示双语欢迎页；仍需该副本的合法登录，不能把官方原版进入主界面算成双语副本通过。本轮静态简体候选仍有 2,415 项缺译；原 34 项复用歧义中 32 项已按字段消歧，余下 2 项为保留英文的模型默认名称，尚未全覆盖。
- 新增 55 条按“资源文件＋字段＋原文”绑定的简体 UI 候选（32 条歧义、12 条 Preferences、11 条菜单），不添加全局同名覆盖。原文漂移、字段消失、重复记录和占位符丢失会使审计失败；缺少繁体/日语的条目不会冒充已译。
- 默认名称保护同时覆盖单节点 `value.info` 与分组节点 `values[…].info` 的名称，`niceName` 保留；说明 tooltip 仍可翻译。三语各 447 处默认名称字段及 17 份目录非 UI 元数据比对通过，目录测试 34 项通过。2026-10-15 已在正常退出后把新简体试稿应用于隔离 2.8 副本的 17 份 source 资源，保留旧资源备份并完成 ad-hoc 签名/strict 验证；独立 HOME、无 DYLD 注入启动后双语欢迎/Canva 登录等待页可见。仍不代表中文名称保存/另存或主工作区验收。

### 2026-10-14 续修：语言资产校验与展示名边界

- 翻译校验器及规则依赖已纳入仓库，不再需要同级参考仓库或额外 `PYTHONPATH`。缺失/空运行时词典、畸形条目及占位符漂移都拒绝通过；含转义引号的 C++ 词条不再被跳过。
- 简体原始语言包的 299 个 `niceName` 恢复英文身份字段；补丁在匹配已知宿主展示资源时，从 `translations/pristine/model_display_translations.json` 投影双语标题。保留已有译名、模型 key 与用户场景名称，不放宽白名单。
- 补充 Preferences 的精确 `Viewport/ Rendering` 空格变体。该别名属于新本地候选，不能把先前已安装 runtime 的截图当成它的宿主验收。
- 校验结果只说明已声明语言资产的完整性，不代表 Cavalry 全界面覆盖。DG交互已由用户延期；跨平台与完整界面门槛仍未完成。


### 2026-10-14 设置面板续修

- 视口齿轮弹层已在 macOS 2.7.2 真实宿主复测：标签和长下拉值完整可见。只调整已确认的 PopOverView/GraphicsViewportWindow 设置布局，保持原有事件、数值和模态行为。
- Preferences 的 `Minimise Cache` 使用真实 GroupButton 内部 QLabel 宽度，而非只处理 QPushButton；`Performance` / `Pretty` 改为“性能” / “格式化”，保留英文。
- `Autosave Folders` 的 `Off` 已显示“关闭（Off）”。以已验证宿主、同一 HBox 行和固定四项索引 schema 限定；保持 currentIndex、UserRole 与保存的枚举值不变，不对所有 Off 做全局替换。
- 最新 runtime 与工具资源已同步到本机安装路径；诊断捕获会话已结束，宿主恢复普通启动。依赖图拖入/端口连接和其他平台仍未通过。

## 本轮修复 / Changes

- 主属性标签必须与经合同核对的指针匹配；图标、提示小标签和数值编辑器不再被一起改写。
- 名称列在绘制后请求有限宽度，保留数值编辑空间；过长名称使用完整 tooltip，保留原始帮助。
- 稳定 nodeType 的唯一字段超集匹配修复可选字段省略引起的整条漏译，不改变结构或模型 key。
- 按已有词典补齐 299 个节点类型 niceName，加入 26 个限定于 Effects 菜单的标题，不翻译用户脚本名称。
- 补充属性面板无选择提示、固定长提示换行，避免文字工具按钮无限抬高整个窗口的最小宽度。
- 草稿保存/取消/默认、结构化预览、本机中英字体、可搬移资源和校验快照沿用已有回归。
- 新增经 UUID、函数摘要与精确 caller 守卫的视口/时间线图层名字体路径；最新 2.7.2 arm64 宿主样例中长中文名称无方框，未知版本继续 fail-closed。
- 窗口中仍存在动态消息、系统对话框、第三方界面及未核对自绘区域的英文/截断；继续逐项验收。
- 在最终验收期间检测到用户切换工程后停止自动宿主操作，不关闭或保存新工程。

## 使用流程 / Usage

1. 在“排版与字体”中调整双语顺序与字体，检查预览，点击“保存设置”。空字体表示跟随系统。
2. **先保存工程，再自行退出 Cavalry。** 工具不会自动保存或强制退出宿主。
3. 状态页刷新检测；只有匹配适配目标且资源完整时才允许应用。应用后重新打开 Cavalry。
4. “备份”恢复到选中快照的状态，**不等同于一律还原英文**。还原动作本身也会保留操作前快照。
5. 旧版本没有完整校验清单的备份只读展示，不能安全地自动恢复；不要删除它们。损坏设置不会被默认值静默覆盖。

用户输入值、图层自定义名称、路径和表达式保持原文；仅其 UI 标签/placeholder 双语化。字体只影响支持的 UI 渲染路径，不修改工程文本图层。自绘文字与第三方脚本尚未全部覆盖。

## 本地构建 / Local build

需要 Node.js、Python 3.10+（标准库）、Rust、macOS 开发工具与匹配的 Qt 6.6.3 SDK。Intel分发包使用 `npm run build:macos-universal`，不要分发仅arm64的默认构建。

```bash
export CAVALRY_QT_PREFIX=/path/to/Qt/6.6.3/macos
npm run build:macos
npm ci --prefix gui/ui
npm test --prefix gui/ui
cargo test --manifest-path patcher/Cargo.toml
bash tools/test_qt_runtime.sh
npm run test:generator
npm run test:translations
npm run audit:translations
npm run test:macos-canvas
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

`npm run audit:translations` 先从 pristine 生成运行时词典，再写入 `build/translation-audit.json` 和 `build/translation-audit.md`；报告不进入源码发布包。`npm run test:translations` 会在没有参考仓库的临时目录中验证真实 CLI 与拒绝路径。

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
