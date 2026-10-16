# 兼容性、覆盖范围与验收矩阵

> 0.1.0 仍是开发候选。已编译、静态 ABI 检查、合成测试和原生宿主交互必须分别记录；条目数不是全界面覆盖率。

## 当前验收调整：跨平台与2.8迁移（2026-10-14）

用户已明确延期 **Scene Tree→Dependency Graph 拖入、端口展开/连接**：本轮不验收，不再阻止完成；历史“仍未通过”保留事实，但不再作为当前门槛。Windows/Intel原生、2.8适配及全界面覆盖仍需完成。

- 工具新增 universal-apple-darwin 构建入口，生成 arm64+x86_64 工具包；x86_64 Qt fixture 在本机Rosetta运行通过，不能记成Intel硬件实测。
- Windows补接双语翻译后的共享Qt字体/宽度策略；新增真实双语display、公共Qt/input测试。已交叉编译链接Windows x64 DLL及测试EXE；Wine离屏display/input/Qt与产品generic+QPA加载门（含两组反例）通过，原生Windows/NSIS/宿主未运行。
- 2.8.0/Qt6.9.2专用候选双架构编译与目标导入检查通过；隔离欢迎页已见双语，但停在登录。正式安装器不放行；旧私有ABI的UUID不匹配仍被拒绝。
- 2.8语言文件迁为17个原生source catalog、10473个UI-text项，包含ICU复数；有大量缺译与歧义。`tools/audit_cavalry_28.py` 不写宿主，可导出审阅试稿，不宣称全覆盖。简体新增66个独立ICU消息候选覆盖72处引用；三语原始schema双语试稿保留非UI元数据与模型默认名。

可复现命令与原生验收边界见 [原生验收入口](NATIVE-ACCEPTANCE.md)。本轮全部门槛未齐前不替换正式2.7.2宿主、不发布。

## 2.8 arm64/x86_64 静态合同与三语候选（2026-10-16）

| 范围 | 已验证 | 未通过 / 边界 |
|---|---|---|
| 主工作区词条 | 新增9个精确字段、4个Add Layers字段及1个Align标题字段，当前目录46项通过；17份审阅稿仅这些 `UI-text` 与上一稿不同，非 UI 元数据及447个默认名称字段一致 | 简体上下文候选69条，缺译仍有2,406条；不是界面覆盖率，其他动态文本未补齐 |
| 2.8 arm64 ABI | 三库 UUID、6个符号偏移、2个固定视口调用点及 prefix/action 两个独立 `setupToolHelp` 调用点静态审计通过；v9 注入器双架构各441 imports、0 unresolved，ad-hoc/deep strict通过 | 通用 Canvas/Graph 未放宽；Windows/Intel 未实测，不替换正式宿主或安装守卫 |
| 2.8 x86_64 ABI / Rosetta | app13 v10独立合同与双架构静态审计通过；动态8/8成功、0回退，固定视口 rendered=1/fallback=0，整行可读；同名重建一致 | 仅Rosetta，不是Intel原生；`arch` 会清除 `DYLD_*`，必须在子shell内重设注入变量；通用Canvas/Graph与非白名单提示未覆盖 |
| 字体与 Path | 三语arm64默认工具下各5个action、3个prefix均为8/8成功、0回退并取得整行可读截图；固定视口 recognized/rendered=1、fallback=0 | 仅限已审计source与固定视口，不是全视口/全界面；日文Soft Selection的非白名单提示仍乱码，非空Path和计数不能代替可见验收 |
| Soft Selection 定点扩展 | app14/v11新增5个action source；静态producer绑定与双架构静态审计通过，默认8个旧source继续通过 | 模态欢迎页阻止Mesh激活，新source未触发；原生乱码修复未验收，其他工具和全界面仍未覆盖 |
| Add Layers 标签 | 四个精确字段分别为 `レイヤーを追加（Add Layers）`、`添加图层（Add Layers）`、`加入圖層（Add Layers）`；三语各17份catalog非UI字段一致，app15/16/17默认窗口均显示对应双语文本 | 单一标签的三语真实通过，不是全界面覆盖；其他动态文本未补齐 |
| Align 标题 | `align.title` 分别为 `对齐（Align）`、`對齊（Align）`、`整列（Align）`；app16/19/18默认窗口均有对应双语文本，其他非UI字段不变 | 另一单标签的三语真实通过，不是全界面覆盖；其他动态文本未补齐 |
| 2.8 限定 Canvas | app20/v12在两架构各核对3库UUID和7个精确调用点；441 imports/slice、0 unresolved及同名重建一致通过 | 默认窗口仅 `ready=1, matched=0, rendered=0, fallback=0`，不记原生通过。GraphicsViewportBase是to_string数值、RenderWindowGLAsync是英文字面量，均无双语收益并继续排除 |
| 2.8 Graph 测宽 | app21/v13在两架构核对elide符号、3个测宽点、完整函数摘要及篡改拒绝；同名重建一致 | 默认窗口仅 `ready=1, measured=0, splitRejected=0, fallback=0`；无Graph节点，不记原生测宽/绘制通过；通用Graph绘制未验收 |
| 2.8 TrackingTool 成对合同 | app22/v14在两架构各核对8个draw和1个measure；当前46项目录、15项生成器、6个fixtures和8项Python合同通过，同名重建一致；x86_64/Rosetta也取得ready与旧路径证据 | draw/measure均ready=1、matched/measured/rendered/fallback=0；TrackingTool未激活，不记原生居中或可读通过；Rosetta不是Intel原生 |
| 三语 v14 启动回归 | app23简体、app24繁体均取得旧8个source、固定视口及Canvas/Graph ready；最新Add Layers/Align可见，证据为candidate-application-v23/v24 | matched/measured仍为0，与日文/x86_64一样不记Tracking原生触发；不是全界面覆盖 |
| Scene Window placeholder | app25/26仅 `sceneWindow.header.search.placeholder.UI-text` 改变，非UI字段一致；重开分别显示纯 `輸入圖層名稱` / `レイヤー名を入力`，旧source、固定视口及Canvas/Graph ready无回归 | 首次只换注入器仍显示旧后缀，font-only必须同步source catalog；这是单字段原生通过，不是全界面覆盖 |
| Graph Editor 底部 Align | `graphEditor.footer.label.align` 当前值已为 `對齊:（Align:）`；同一app25开启Qt后原生显示该完整文本，见 `native-ui-v25-hant-align-qt-enabled.jpg` | font-only下 `Align:` 是既有英文回退，不是新缺译；无需修改字段 |
| 颜色名称语义 | Gray与Gray Asparagus、Alice Blue等颜色名同表，并有ColorNameProxyModel/ColorNameCompleterDelegate；`gray-semantic-audit-v1.json` 保留证据 | 实际catalog和生成表无精确UI字段，Gray按颜色名称保留原文，不为覆盖率强行补译 |
| source/font-only 隔离 | 繁体、日文、简体三个隔离候选及x86_64 app13均取得上述限定真实渲染证据 | 用户已明确延期2.8合法登录、中文名称保存/另存及用户值回归；不记通过且不再阻塞当前工作，其他动态文本和Soft Selection提示仍未补齐 |
| 2.7.2 对照验收 | 当前实例 Save As 后，25个节点、15条连接语义比较为0处不一致，原始文件哈希未变，用户值和名称保持原文 | 仅适用于2.7.2对照，不能代替2.8验收；2.8对应保存回归已按用户要求延期 |

## 资源与宿主证据补充（2026-10-14）

- 官方未修改2.8原版已在私有HOME进入主界面，并新建保存了合成矩形场景；这仅证明原版可运行，不是双语候选主界面通过。
- 不加载注入库、仅替换最新简体source资源（含ICU候选）的隔离副本已显示双语欢迎/登录页，并观察到双语Preferences标签（Viewport / Rendering、Autosave、Performance等）。未复制凭据、未登录；这不能代替主工作区全界面和另存回归。
- 最新离线简体原始schema试稿：7,306处唯一精确复用＋55处上下文候选＋72处ICU候选，3,040处保留英文。审计缺译2,415处，32/34处歧义已按文件/字段/原文消歧，另2处为保留原文的默认名称；214处厂商标记不翻译。三语各447处默认名称逐项不变，简体其中409处原本可译的字段被名称保护保留。精确复用数量低于旧稿是因为修复默认名称漏保护，不是UI验收覆盖率下降或回归通过。繁体/日语各72处ICU仍待译。
- ICU结构与macOS系统ICU 198个双语格式化用例通过，不等于Cavalry真实日志/对话框或Windows ICU执行通过。此前隔离副本曾加载ICU试稿并显示欢迎/Preferences页面。2026-10-15 在确认该精确副本正常退出后，将本轮默认名称保护和55条上下文修复的新简体试稿更新到其17份source资源；备份、ad-hoc签名及deep/strict检查通过。在独立HOME、无DYLD注入下重启，双语欢迎/Canva登录等待页可见；55条候选的真实菜单/Preferences显示和主工作区仍未逐项验证。

### 上下文与默认名称修复的验证边界

目录自动化34项通过；三语各17份目录只修改`UI-text`，非UI字段一致。新候选不修改已保存场景，不改2.8私有ABI或正式版本守卫。资源已在精确测试副本正常退出后应用；后续仍需合法登录、主界面与场景另存的原生验证，不能用静态字段比对替代。

## 版本与平台

| 组合 | 当前状态 |
|---|---|
| macOS arm64 · Cavalry 2.7.2 / Qt 6.6.3 | 写入守卫匹配；原始安装目录上已启动、打开场景并做部分交互验证。下表明确通过与待验收的表面，不代表全部功能支持。 |
| macOS x86_64 · Cavalry 2.7.2 / Qt 6.6.3 | 注入器及工具 universal 构建、宿主 Qt 导出检查通过；x86_64 fixture 仅在Rosetta运行，Intel硬件/宿主未实测。 |
| 2.7.2 默认路径回归 | 修正旧审计误选2.8 UUID/调用点；两架构只读Canvas/viewport/Graph/viewport-name合同通过，默认dist构建各441 imports、0 unresolved | 仅在dist，未安装或替换正式宿主，不记新的原生UI验收 |
| Cavalry 2.8.0 / Qt 6.9.2 | 2026-10-14重新读取官方包，确认Qt6.9.2与新语言格式；专用候选已编译并在隔离欢迎页启动。主界面/私有ABI/新catalog迁移尚未完成，正式写入仍拒绝。 |
| Windows x64 | Rust事务/目标check、交叉构建与Wine离屏/双产品DLL加载门通过；原生MSVC/NSIS、安装器和真实宿主未验收。 |
| 其他 Cavalry/Qt 组合 | 未验证即拒绝自动注入。不会仅扩大版本范围字符串。 |

## 2026-10-14 最后续验：设置布局与枚举显示

| 范围 | 已验证行为 | 剩余边界 |
|---|---|---|
| 视口设置齿轮弹层 | 真宿主看到 Viewport Quality、Display Color Space、Auto (Monitor)、Except during Playback 完整显示；同一候选的几何表显示标签宽度不小于文本 sizeHint | 只匹配已确认标签集合及 PopOverView/GraphicsViewportWindow；不是所有弹层全适配 |
| Preferences | 已见关闭（Off）、格式化（Pretty）、性能（Performance）、视口/渲染和完整缩减缓存按钮；缓存 QLabel 几何宽度≥sizeHint | 未逐个改变设置值；不声称所有配置组合已测 |
| Off 数据安全 | 当前索引保持0，真实 autoSaveSubFolders 仍为 enum 0；已核实该控件的整数索引提交路径；共享父容器多行 fixture 保持其他行不变 | 未对普通 Off/其他三项日期格式做全局替换；Windows 未启用此 owner 适配器 |
| 部署与清理 | 新 runtime 与本机工具、安装宿主字节一致；正常退出后备份更新；测试 Mini-Map 恢复关闭；诊断捕获已结束 | ad-hoc 签名、未公证；无 push/tag/Release |
| DG 与数据 | 80个节点/55条连接与名称语义保持，端口操作未得到成功证据 | 拖入、端口展开/连接仍未通过，需独立定位而非重复同一手势 |

测试按影响复用：本轮Qt增至6组（含settings fixture），生成器10项、三语校验通过；上一轮未受影响的Rust事务与GUI 80断言不机械重跑。双架构441个Qt imports均在目标宿主解析，Intel原生仍未验收。

## 2026-10-14 后续校验与展示资源边界

| 当前要求 | 本轮证据 | 结论 / 剩余项 |
|---|---|---|
| 独立 checkout 可执行翻译校验 | 从无参考仓库的临时目录生成字典并执行真实 CLI；缺失文件、空表、错误占位符、畸形/转义条目均有反例测试 | 三语已声明 JSON 资产与运行时词典通过；不是全界面覆盖率 |
| 原始 niceName 与英文身份一致 | 简体语言包恢复 299 个身份字段；已知宿主展示标题单独从模型展示词典投影；Rust 验证全部 299 个标题保持双语，未知节点和场景名保持不变 | 不放宽白名单，不清洗既有用户场景 |
| Preferences 旧布局修复的正式宿主复查 | 当前已安装候选中 Pretty、Reminders、Default、Clears Focus 完整可见；中段精确文本为 `Viewport/ Rendering` | 新增空格别名仅进入本地候选；Autosave Folders 的 Off、视口设置弹层的裁切仍需继续核对 |
| DG 真实拖入与端口连接 | 独立副本试过 Scene Tree 拖入、输出端口菜单、点击连接；按 nodeId 和无序连接集合比较，80 节点与55连接保持不变 | 没有新增连线/节点证据，仍未通过；锁屏后停止操作 |

新候选的源码/隔离测试和正在运行的旧宿主状态分开记录；本轮不替换运行中的宿主、不推送或发布。

## 2026-10-14 原始宿主续验：输入安全与 DG 测宽

本轮在原始 **macOS arm64 / Cavalry 2.7.2 / Qt 6.6.3**、独立合成场景中执行；不将下列结果扩大为全界面、Intel 或 Windows 通过。

| 当前要求 | 本轮证据 | 结论 / 剩余项 |
|---|---|---|
| 保护用户当前工程 | 切换仍出现未保存提示后取消；另存私有恢复副本，核对原场景文件 SHA-256 未变，再切到独立场景 | 本轮没有覆盖/丢弃原工程；不根据未保存提示猜测用户没有保存 |
| 防止图层名称被翻译写回 | 修复前：仅进入名称编辑再确认，保存的测试 `.cv` 名称变成双语。修复后：同一路径保存仍是原始英文；粘贴的长中文混合名称也逐字保留 | **原始宿主已复现并回归通过**；全部 QLineEdit 仅翻译 placeholder，移除 textChanged 值改写及 Time Editor 反向模型写回。Windows 同源边界已改，未原生执行 |
| 类型标签与用户内容分离 | DG 类型标签可见 `矩形图案（Rectangle Pattern）`，主名称读取用户 niceName／ID | 类型标签有真实可见证据；不翻译用户名称、路径、表达式、端口 ID 或连接数据。英语用户名称不计作 UI 漏译 |
| DG/Lina UTF-8 省略与测宽 | 实际长中文节点名可见且正常省略；只读诊断显示 ready=1、measured=48、splitRejected=40，证明真实调用命中 | **该样例通过**；计数是累计调用次数，不是覆盖率。三条 exact caller、全函数 SHA-256 与 UUID 防火墙保留；复杂字体/缩放/布局仍未全验 |
| 节点拖动 | 在已有节点上真实拖动后位置改变，名称与类型标签仍可见 | 仅图内节点移动通过，**不等于 Scene Tree 拖入通过** |
| 图层拖入、端口与连线 | 本轮从图层行多个区域尝试拖入，没有形成新增节点证据。一次诊断只观察到源 Press/Move，未命中 QDrag::exec / DG drop。端口菜单及连接未验收成功 | **仍未通过**；不将 Tab 创建或预存节点冒充拖放。诊断器已移除/分离，未保留产品事件 hook |
| 视口、时间线中的中文图层名 | 最新候选在原始 2.7.2 arm64 独立场景中观察到长中文图层名在视口与时间线可见、无方框；仅覆盖已核对的 viewport-name producer/measure caller 合同 | **已测范围通过**；不是全 Canvas 覆盖，不代表其他节点类型、缩放、字号或未知版本通过 |
| 节点操作与菜单用语 | 修正 7 条输入/图移除提示，补充 Copy Layer / Copy Layers / Rect Pattern Shape | 词典及生成器通过；不能据此宣称所有动态菜单与系统对话框已补齐 |
| 本机工具与宿主产物 | 保留每轮可回滚快照；本机工具和宿主更新为同一输入安全候选；正式 runtime 文件名构建，避免临时文件名派生签名造成误报更新 | 最终哈希和运行路径在私有交接中核对；v0.1.0 仍是验证候选，未正式发布 |

本轮回归：**38 项 Rust、80 项 UI、6 项生成器测试**；Qt **4,519 entries / 4,506 bilingual entries / 40 非零 glyph**、精确属性标签 fixture、新增 **14 组输入及 delegate 提交**用例；UTF-8/Canvas/Lina、2,008 组合宽度边界、4 项摘要拒绝测试通过。两架构编译及各 **429 个 Qt 导入**检查通过；减少的导入来自删除输入值写回链。ASan/UBSan 与 x86_64/Rosetta 的合成测试通过，**不是 Intel 原生宿主验收**。

全界面覆盖、2.8.0 / Qt 6.9.2、Windows/Intel 真实运行及正式发布门槛仍未通过。未 push、tag 或 Release。

## 原始 2.7.2 宿主验收与回归

| 表面 / 行为 | 本轮处理 | 证据及边界 |
|---|---|---|
| 工具四个页面、预览、圆角、热区 | 保留项目视觉系统；4/8/16/24 间距、12/8 嵌套圆角、独立草稿 | 80 项浏览器断言通过；已安装 macOS 工具的字体草稿、双语顺序、取消恢复和运行中禁用写入已操作验证。 |
| 中英字体 | 本机字体家族选择、Qt 回退、已核对 Canvas 调用点的分段字体 | Qt glyph 样例及 Canvas 合成测试通过。普通 Qt 仍是家族回退顺序，不保证所有路径严格逐语言选字体。 |
| 属性行 | 匹配精确主 QLabel 指针（+0xd0），再读取完整标签（+0xb0）；不改同一行的图标标签；排队调整名称列且名称列请求不超过半行 | 原始宿主独立矩形场景观察到 Position/Rotation 完整双语且图标不再被替换。超长标签仍可省略，完整名称与原说明在 tooltip 中；所有控件宽度组合及真实悬停仍待补验。 |
| 属性记录漏译 | 对稳定 nodeType 允许唯一的字段超集匹配，处理语言包省略可选 niceName 的情况 | 新测试证明 Primitive Type 不再因 niceName 缺失而被整条跳过；不补字段、不修改 key、不猜测多个候选。 |
| 节点类型名称 | 用独立展示词典投影 299 个节点类型标题，原始语言包 niceName 保持英文身份字段 | 原始应用此次更新 5,655 个展示字符串；结构/幂等测试通过。最终节点视觉覆盖仍待逐项验收。 |
| Create > Effects | 增补现场发现的 26 个标题；限定在 Effects 菜单，不进入全局 source-only 翻译 | 编译/词典/上下文排除测试通过；并非第三方插件全部内容已翻译。 |
| 无选择空状态、长说明 | 补充 Select layers to see their settings；在 widget 上对固定提示换行 | 原始宿主空白/独立测试场景可见中文与英文；不影响导出图像或用户文本。 |
| 工具栏最小宽度 | 不再因每个文字 QToolButton 自动扩张而抬高整窗最小宽度 | Qt 回归通过；复杂窗口组合仍有截断，不标为全面自适应。 |
| 时间线字形 | 七个精确 Canvas UI 调用点 + 2.7.2 viewport-name producer/measure caller 的 CJK 字体处理 | 原始独立场景的长中文样例可见、无方框；未覆盖全部节点类型、缩放和字号。 |
| 视口固定提示 | 五条固定提示 + 五条工具 action 的独立 Path 合同与启动期初始化 | 原始宿主已观察 Active Camera、Viewport Quality 和五条操作提示双语；颜色/对比度及其他工具仍需补验。 |
| Dependency Graph | 准备并排独立场景；真实创建节点并观察渲染 | 当前窗口是 DGView/lina；二进制中存在的旧 FlowGraphNode 不是当前窗口的运行证据。长中文节点标题、端口可见和图内移动已观察；Scene Tree 图层拖入、端口展开/连接**仍未通过验收**。未将未命中的旧 Graph hook 留在产品。 |
| 全部菜单、对话框、选项、脚本 | 继续按具体表面补译，不改用户输入、文件名、ID、脚本正文 | **没有全覆盖结论**；原生系统文件对话框、动态消息、第三方界面等仍有英文。 |

## 修正旧候选结论

`fc52a97` 曾仅凭较宽隔离窗口宣称属性截断已修复。后续原始宿主窄窗口暴露出同父图标被误改写的回归；本轮修复了主标签身份判断和布局行为。旧截图、通过计数或进程启动成功不能代替修复后最终验收。

上轮 `4908ace` 的结论不自动适用于后续产物。本轮按顶部续验表执行，保留原始宿主更新前快照，所有二进制写入均在正常退出并确认进程不存在后进行。

## 发布门槛

- 中文/混合标题、界面布局与输入值保持需核对；DG 拖入、端口展开/连接已由用户延期，不作为本轮门槛。
- 补齐动态界面和系统对话框清单；不得用词典条数冒充覆盖率。
- 2.8.0 / Qt 6.9.2 需要独立适配、符号检查与宿主回归，不是移除守卫。
- Windows 及 Intel 的原生构建、安装/升级/还原和宿主测试仍待完成。
- 旧无校验清单备份暂不自动迁移；不能猜测恢复其内容。
- 当前源码与候选产物隐私扫描分开执行；旧提交中的个人路径尚未清理，不改写或强推历史。
- 最终提交及安装包冻结并达到上述门槛前，不创建正式 v0.1.0 tag / Release。
