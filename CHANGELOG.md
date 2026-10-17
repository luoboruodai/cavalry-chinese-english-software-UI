# Changelog

## 未发布 · 2026-10-17 · 仓库双语使用指南

- 将首屏研发记录整理为面向用户的中文 README，并新增互链的 `README.en.md`；两种语言均优先说明产品用途、平台边界、源码构建、使用与恢复流程。
- 明确 GitHub 自动 Source code 不是安装附件，本地构建为 ad-hoc 且未公证；详细研发证据继续由兼容性矩阵和本变更日志承接。本轮只改文档，不改变运行时代码、宿主或安装状态。

## 未发布 · 2026-10-16 · Scene Window placeholder 与翻译门

- 繁体/日语 `Enter a Layer name` 的额外英文后缀触发 FP-9；按同类 placeholder 约定改为纯 `輸入圖層名稱` / `レイヤー名を入力`，没有放宽检测白名单。`test:translations` 恢复 14 项通过，46 项目录和 15 项生成器保持通过。
- 首次仅更换注入器时原生仍显示旧后缀，确认 font-only 读取 app 内 source catalog。随后仅修改 app25/26 的 `sceneWindow.header.search.placeholder.UI-text`，递归比较证明非 UI 字段不变；重开均显示纯译文，旧 source、固定视口及 Canvas/Graph ready 无回归。
- v15 `f6a53f8c9d463bb33f08b942383edf6ca9501ab0e66ce771d7f74dd0e3e36630` 双架构各 441 imports、0 unresolved、同名重建一致；默认 dist 同步重建为 `f41510a23ca0825a18d0c4928fbfc413d63d68268a00a06048f9f8ab3be8c99f`，仍只在 dist，未安装或替换正式宿主。

## 未发布 · 2026-10-16 · 2.7.2 默认合同审计与构建回归

- 修复旧 `audit_macos_canvas.py` 在 2.8 常量前置时误选 2.8 UUID/调用点的问题；UUID、Canvas、viewport、Graph 和 viewport-names 现在均显式选择无 2.8 标记的默认分支，并加入 2.8 在前的反例。
- 正式 2.7.2 两架构只读合同通过：各 7 个 Canvas、2 个固定视口、3 个 Graph 测宽以及 viewport-name producer/4 个测宽点均匹配；证据为 `default-27-contract-after-v14.json`。
- 默认 `dist/libCavalryTranslatorInjector.dylib` 使用 Qt 6.6.3 重建，双架构各 441 imports、0 unresolved、`@loader_path`、ad-hoc strict 通过，SHA-256 `d3fa7a4a74610bf2304dcd6fb19d7fdd3b2a1204b58bc2146c84847d73f47a68`；仅在 dist，未安装或替换正式宿主，不记新的原生 UI 验收。

## 未发布 · 2026-10-16 · 2.8 TrackingTool 成对测宽/绘制合同

- 只为 `tool.tracking.hint.clickShape` 增加一对 exact measure/draw caller，二者共用 Canvas run planner；新增独立 measure matched/measured/fallback 诊断，不改变旧 Canvas/Graph 计数布局。Canvas 静态审计现为两架构各 8 个 draw + 1 个 measure。
- 修正候选语义：GraphicsViewportBase 在该点直接绘制 `to_string` 数值，RenderWindowGLAsync 只绘制英文字面量，均继续排除；没有为了扩大覆盖率加入这些无双语收益路径。
- 当前 46 项目录、15 项生成器、6 个 fixtures 和 8 项 Python 合同通过。v14 `431964a669f0f63d3b7eb3419e0f35c01fc0d14b879f5230025da8554b1ba546` 双架构各 441 imports、0 unresolved、`@loader_path`、ad-hoc/deep strict 及同名重建一致通过。
- app22 默认窗口中 draw/measure 均 ready=1、matched/measured/rendered/fallback=0；TrackingTool 未激活，不记原生居中或可读通过。Graph ready、旧 source、固定视口及最新日文标签无回归；Windows/Intel 与全界面仍未完成，未替换正式宿主或发布。
- app22 的 x86_64/Rosetta 复核同样取得 draw/measure 与 Graph ready=1、旧 8 个 source 和固定视口通过及最新日文标签；LLDB 明确为 x86_64，证据见 `candidate-application-v22-x86_64.json`，但不记为 Intel 原生验收。
- 最新 v14 的 app23/app24 分别补齐简体与繁体启动回归：`添加图层（Add Layers）`、`加入圖層（Add Layers）` 及各自 Align 标题可见，旧 source、固定视口和 Canvas/Graph ready 符合限定预期；matched/measured 仍为 0，不记 Tracking 原生触发。

## 未发布 · 2026-10-16 · 2.8 Graph 测宽静态合同

- 新增 2.8 两架构专属 `lina::TextView::elideTextToWidth` 函数范围、完整 SHA-256 和 3 个测宽调用点；保留 2.7 默认分支。审计同时核对 elide 符号、3 个调用点、完整函数摘要及非调用点篡改拒绝，输出仅为 `PASS_STATIC_CONTRACT_ONLY`。
- 当前 44 项目录、15 项生成器、6 个 Canvas/Graph fixtures 和 8 项 Python 合同通过；新增 `graph_measure_280` 同源 fixture，继续覆盖 2,008 组有界省略、split-scalar、bounds/advance 与未知 caller 透传。
- v13 `66798139efa26edc1934113cf5c3db9ecf2d186dafe3830012e57b5d8e106140` 双架构各 441 imports、0 unresolved、`@loader_path`、ad-hoc/deep strict 及同名重建一致通过。app21 默认日文窗口中旧 source、固定视口、Add Layers 与 Align 保持可见。
- app21 的 Graph 诊断仅为 `ready=1, measured=0, splitRejected=0, fallback=0`，没有 Graph 节点，不记原生测宽或绘制通过。其余 Canvas 候选、通用 Graph 绘制、Windows/Intel 原生与全界面覆盖仍未完成，未替换正式宿主或发布。

## 未发布 · 2026-10-16 · 2.8 限定 Canvas 静态合同

- 新增 2.8 两架构各 7 个精确 Canvas 调用点及独立只读审计；修正 x86_64 首个调用地址为真实 `call` 所在的 `0x502003`。2.8 字体桥使用 CoreText→Skia，不复制 2.7 MakeFromName；其余 `GraphicsViewportBase`、`RenderWindowGLAsync`、`TrackingTool` 候选与通用 Graph 未开放。
- 当前 41 项目录、15 项生成器及 8 项 Canvas/Python 合同通过。v12 `412197727ce0dbcd98f1138e513b0ac2bdaf0fa2505786da7c04a620e0a6d911` 双架构各 441 imports、0 unresolved、`@loader_path`、ad-hoc/deep strict 及同名重建一致通过。
- app20 默认日文主窗口的旧 8 个 source 与固定视口保持通过；Canvas 诊断仅为 `ready=1, matched=0, rendered=0, fallback=0`。模态欢迎页拦截最小文字工具触发，因此静态合同和初始化不记为原生 Canvas 渲染通过；Windows/Intel 原生与全界面覆盖仍未完成，未替换正式宿主或发布。

## 未发布 · 2026-10-16 · 2.8 三语限定 Path 与 x86_64/Rosetta

- 繁体、日文、简体 arm64 默认工具下，5 个 action 与 3 个 prefix 均为 8/8 成功、0 回退，固定视口 rendered=1/fallback=0，并取得整行可读截图；日文 persisted Soft Selection 的非白名单提示仍乱码，不以诊断计数冒充全界面通过。
- 新增 2.8 x86_64 独立三库 UUID、符号偏移、prefix/action 与固定视口合同，双架构统一使用 CoreText→Skia 字体桥，通用 Canvas/Graph 继续关闭。`audit_cavalry_28_tool_path.py --arch` 与双架构篡改/分支反例同步加入，目录测试增至 39 项。
- app13 v10 在 Rosetta 下取得相同 8/8 与整行可读证据，SHA-256 `8efd1a15bc8e13e67cc3cb7438867ae6c7b7fcb2d1953a6322f4756ed0adc3c2`，同名重建一致。`/usr/bin/arch -x86_64` 会清除 `DYLD_*`，启动入口改为在子 shell 内重新设置注入变量；这不是 Intel 原生验收。
- app14/v11 定点新增 Soft Selection 的 5 个 action source（含 edge 句号变体），2.8 诊断扩展为 13 个 source/34 个 uint64；静态 producer 绑定、双架构审计和默认 8 个旧 source 的真实绘制通过。模态欢迎页阻止 Mesh 激活，新 source 未触发，原生乱码修复仍待复验，未宣称完成。
- app15/16/17 已在默认主窗口分别显示 `レイヤーを追加（Add Layers）`、`添加图层（Add Layers）`、`加入圖層（Add Layers）`；四个精确 Add Layers 字段均为对应文本，三语各 17 份 catalog 非 UI 字段一致。该结果是单一标签的三语真实通过，不是全界面覆盖。
- `align.title` 也已取得三语真实显示通过：app16原本已是 `对齐（Align）`，app19显示 `對齊（Align）`，app18显示 `整列（Align）`；这是另一单标签的三语真实通过，不是全界面覆盖。
- 用户明确延期 2.8 合法登录与 Save As，不记通过且不再阻塞当前工作。Windows/Intel 原生、非白名单提示、通用 Canvas/Graph 与全界面缺译仍未完成，未替换正式宿主或发布。

## 未发布 · 2026-10-16 · 2.7.2 对照验收

- 当前2.7.2实例已完成 Save As 对照：25个节点、15条连接，0处不一致，原始文件哈希未变，用户值和名称保持原文。该结果只用于2.7.2对照，不能代替2.8验收。

## 未发布 · 2026-10-16 · 2.8 主工作区词条与 arm64 字体合同

- 新增 9 个真实主工作区缺译字段，简体上下文候选共 64 条；17 份 source 审阅稿的非 UI 元数据与 447 个默认名称字段保持不变。目录测试 38 项通过；缺译仍为 2,406 条，不能据此宣称全界面覆盖。
- 新增 2.8 arm64 专用 fail-closed 合同：校验三库 UUID、6 个符号偏移、2 个固定视口调用点以及 prefix/action 两个独立 `setupToolHelp` 调用点；支持经 CoreText 创建 CJK 字体。新增独立静态审计与反例，默认 2.7.2 和 x86_64 路径不放宽，通用 Canvas/Graph 继续关闭。
- 新 v9 注入器将 5 个 action 与 `S + click Motion Path`、`Hold S`、`Space + click + drag` 三条 prefix 分开计数，修复旧候选 prefix 误走 action 调用链的问题。繁体、日文、简体三个隔离候选已应用最新 17 份对应 source catalogs 和 v9，ad-hoc/deep strict 通过但未启动；真实整行渲染、合法登录与 Save/Save As 仍未验收，未发布。

## 未发布 · 2.8 上下文译稿与默认名称保护续修

- 新增 55 条精确资源文件/字段/原文绑定的简体 UI 候选：32 条消歧、12 条偏好设置、11 条菜单；保留厂商 `dontTranslate`，不把同名按钮、数学运算和球体背面当作同一语义。
- 修复分组节点 `values[…].info` 默认名称漏保护；只保护名称，不一并禁止说明 tooltip 翻译。旧简体资源试稿中 350 处默认名称被写为双语，新试稿已恢复原文；这是静态候选修复，不是用户场景已损坏或保存回归通过的结论。
- 新增来源变化、字段消失、上下文泄漏、占位符丢失、语言缺译及模型默认名称回归，目录测试共 34 项通过。三语 51 份目录的非 UI 元数据以及每语 447 处默认名称比对通过。
- 2026-10-15 将新试稿的 17 份 source 资源写入**已正常退出的隔离 2.8 副本**，备份原资源并完成 ad-hoc 签名/strict 验证；以独立 HOME、无 DYLD 注入重启，双语欢迎/登录等待页可见。未替换正式安装、未发布；登录、主界面、中文名称另存及 Windows/Intel 原生门槛仍待完成。

## 未发布 · 2026-10-14 · Windows DLL 加载与2.8资源试验

- 复用并扩展现有 QPA 二进制 smoke，核对产品 generic/QPA 两个 DLL 的 IID/key、动态加载、工厂类型和无效激活拒绝；Wine 下正例及两组错误 DLL 反例通过。修正私有交叉构建遗漏 `QT_NO_DEBUG` 导致的 Qt Debug/Release 拒载；不将仿真写成原生 Windows 验收。
- 2.8 审计新增 en-GB source-schema 双语资源试稿；保留元数据与模型名称，只投影 `UI-text`；拒绝直接导出到 `.app` 或源资源目录。隔离副本不加载注入库也已显示双语欢迎页，主界面仍待该副本合法登录。
- 新增简体 66 个独立 ICU 翻译候选（72 处引用）与参数/分支/#/offset/格式合同校验；macOS ICU 198 个双语格式化用例通过。三语 17 份资源的非 UI 字段一致性检查通过。繁体/日语 ICU 仍为待译，未记通过。
- 未替换正式工具/宿主，2.8 私有 ABI 与正式版本守卫不变；Windows/Intel 原生、完整2.8界面与安装器仍未验收，未发布。

## 未发布 · 2026-10-14 · 跨平台与2.8迁移准备

- 用户将DG拖入/端口展开与连接移出本轮验收门槛；不将延期写成通过。
- 修复Windows双语分支遗漏共享Qt字体回退/控件宽度处理，新增产品模式下的display/input测试，Release断言保持启用。Windows运行验收仍待真实设备。
- 增加macOS universal工具构建入口与x86_64 Qt测试选项；Rosetta结果单独标注，不冒充Intel原生。
- 修复Qt6.9.2在Apple Clang arm64上的ACLE声明编译问题，隔离2.8候选完成启动；正式版本守卫不变。
- 新增2.8原生UI-text catalog只读迁移审计，区分复用候选、歧义、缺译、dontTranslate和ICU消息；不声称所有文本已覆盖。
- 补充实测2.8欢迎页匿名使用数据选项标签；不改变勾选状态。按已观察设置与厂商notes修正10项三语技术用语；移除构建产物内的绝对宿主RPATH，只保留相对加载路径。全部门槛未完成前不替换正式本机宿主，不发布。

## 未发布 · 2026-10-14 · 设置面板真实宿主续修

- 修复视口设置 PopOverView 中标签和双语下拉值被父容器裁切，按限定设置布局传播宽度并限制在当前屏幕内；不影响普通工具栏。
- 修复 Preferences 缓存 GroupButton 的内部文字宽度，校正 Performance/Pretty/Minimise Cache 技术用语，三语同步。
- Autosave Folders 的 Off 仅在已验证宿主与同一 HBox 行、固定四项索引 schema 中翻译；用真实共享父容器的 fixture 防止把 QObject 父子关系误当行布局。
- macOS 2.7.2 实测已看到关闭（Off）、格式化（Pretty）、性能（Performance）、完整缓存按钮与视口弹层；自动保存原始枚举值未改变。
- 同步本机工具/宿主候选并保留快照；结束诊断捕获、恢复普通启动。DG拖入/端口连接、Windows/Intel/2.8.0和全覆盖仍未验收，不发布。

## 未发布 · 2026-10-14 · 自足校验与原始词典身份修复

- 补齐 Python 翻译反模式检测器及规则配置，独立 checkout 不再因缺少参考仓库模块而崩溃。
- 拒绝缺失/空白 TS 与 generated 表；用 XML 解析 TS 属性和数字实体，完整读取转义 C++ 字符串，并校验两种运行时输入的占位符。
- 原始简体语言包的 299 个 niceName 保持英文，安装时单独使用已有展示词典保留双语标题；重复展示 source、身份字段漂移被拒绝，用户场景与未知节点不做标题投影。
- 新增隔离 checkout、反例变异和模型身份回归；没有修改翻译白名单来使测试通过。
- 补充宿主 Preferences 实测的 `Viewport/ Rendering` 精确空格变体（三语）。
- 本轮候选尚未部署到正在运行的 Cavalry；Mac 锁屏后停止 UI 操作。拖入、端口连接、全覆盖及其他平台仍未验收，不发布。

## 未发布 · 2026-10-14 · 输入安全与 DG 测宽候选

- 修复真实宿主中的数据写回回归：QLineEdit 不再翻译提交值，移除 textChanged 改写及 Time Editor 反向模型值归一化；可编辑列表/树/表格项不做文本写回。Windows 同步输入边界，但未原生验收。
- 真实测试先复现图层名被错误写成双语，再验证修复后英文及长中文名称在保存的 `.cv` 中逐字保持。
- Lina 三条 exact 测宽 caller 共用 Canvas 字体/回退规划，并校验完整函数 SHA-256；拒绝省略循环中切断 Unicode scalar 的候选。原始宿主的长中文节点样例已真实命中。
- 新增受 UUID、producer 摘要和精确 caller 守卫保护的视口/时间线图层名字体路径；原始 2.7.2 arm64 独立场景中长中文样例可见且无方框，未知版本继续回退。
- 修正 7 条节点输入/移除提示，补充 3 条菜单用语；新增输入 delegate 提交、2,008 组边界/宽度及摘要拒绝测试。
- 工具与宿主更新为本轮候选，保留回滚；正式文件名构建并核对最终 runtime，防止临时库名签名引起更新误报。
- **未完成：** Scene Tree 真实拖入、端口展开/连线、全界面覆盖、2.8.0、Windows/Intel 实机。视口/时间线长中文样例已在最新候选中通过，但不扩大为全自绘路径通过。未推送、打标签或发布。


## 0.1.0 — unreleased candidate / 未发布候选

以用户指定的首个公开版本 0.1.0 为目标统一元数据。历史 GUI 中的内部 0.2.0 不是已发布 tag；未移动任何公开版本标签。

### Changed
- Reworked desktop spacing, preview hierarchy, nested radii, focus and target areas.
- Replaced the nonfunctional font toggle with installed-family settings and an explicit fallback limitation.
- Added draft/save/cancel/defaults and persistent local operation logs.
- Resolve bundled injector resources without developer source paths; apply runtime configuration at host startup.

### Fixed in the current continuation
- Restrict attribute labels to the exact primary QLabel; preserve sibling connection icons and numeric editors.
- Bound name-column width changes and retain full names/vendor help in tooltips.
- Translate known node records with omitted optional fields only when the catalog match is unambiguous.
- Fill 299 untranslated node-type display names from the existing reviewed catalog; scope 26 additional effect titles to the Effects menu.
- Translate the no-selection hint and wrap fixed empty-state text on widget surfaces.

### Earlier fixes
- Restore validated snapshots without deleting their recovered bilingual files.
- Restore complete bilingual `AttrControlRow` labels from the verified Cavalry 2.7.2 row source, re-read recycled rows, and keep the original numeric editors untouched.
- Render the verified viewport Path whitelist through the bilingual CJK-safe font path; unknown callers still fall back to Cavalry's original English renderer.
- Validate settings, placeholders, Qt versions, backup integrity and target boundaries before writes.
- Preserve drafts on failed writes; guard simultaneous operations and unsupported versions.
- Enable CJK font fallback in supported Qt UI drawing paths; correct the Glyphs translation.

### Not yet accepted
The current candidate has partial native macOS arm64 Cavalry 2.7.2 / Qt 6.6.3 evidence. Dependency-graph node/port drag/drop, complete UI coverage, strict per-script font selection, Cavalry 2.8.0 / Qt 6.9.2 adaptation, Windows packaging/runtime and final release acceptance remain open. The October 14 continuation verified input-name preservation, a long CJK DG title, and a long CJK layer name rendered without tofu in the viewport and timeline of an isolated scene on the original host. Scene-tree drop and port connections remain unaccepted. See `docs/COMPATIBILITY.md`.
