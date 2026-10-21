# 0.1.0 Preview 3 · 2026-10-21

- 完善 Cavalry 2.8.0 / Qt 6.9.2 的独立 macOS 注入器、版本化资源与限定界面／视口双语适配；继续保留 2.7.2 路径及未知版本关闭保护。
- 更新排版草稿、备份与日志管理、状态通知、可恢复快照和失败回滚；统一取消按钮样式与键盘焦点。
- 反馈报告采用先脱敏预览、再明确发送的流程，不包含 OS／CPU 架构；发送说明复用主界面通知并在进入预览时自动弹出，移除信息按钮和实现术语。
- 提供 macOS Universal DMG 与 Windows x64 NSIS 预发布附件，以及中英文 README、离线安装指南、兼容矩阵和项目上下文。
- 修复 Windows 交叉编译的平台路径选择，以及 NSIS fallback 在编译失败时复用过期脚本的问题；安装包必须来自本次构建并包含全部许可文件。
- 新增 `AGENTS.md` 与 `docs/PROJECT-CONTEXT.md`，记录设计初衷、需求演变、关键堵点、解决方法与发布边界。
- 本版仍为预发布：macOS 未公证、Windows 未签名；原生 Windows／MSVC／真实 Windows 宿主、Intel 原生和全界面覆盖不标记为通过。

# Changelog

## 未发布 · 2026-10-20 · 2.8 视口组合提示修正

- 修复 Transform 视口“快捷键前缀＋动作说明”分别双语化后造成的生硬拼接；仅对 2.8 简体自绘配置增加 5 个组合显示，保留英文片段和全局词典，不改其他语言或 ABI。
- 真实宿主可见“以插入关键帧／以直接选择图层／以播放/停止／以平移／以启用吸附”的自然中文组合，未见重叠或原文回退。
- Canvas/Graph 合同、49 项 2.8 Python 测试和双架构静态审计通过；更新固定 Universal 入口并保留单副本、19 份备份和 29 条日志。未宣称全界面覆盖，未发布。

## 未发布 · 2026-10-20 · 2.8 App 管理修复与明确清除按钮

- 定位 macOS 26.4 `EPERM` 为 Cavalry Bilingual 的“App 管理”未授权；用户授权开启并重启工具后，真实 2.8 应用成功，17 个翻译资源和 10,473 个展示字符串更新完成，当前宿主窗口可见中英双语。
- 文件写入错误增加目标路径和权限指引；回滚跳过已一致文件，目标未改变时明确报告无需回滚，避免误写、误重签和“回滚失败”假象。
- “清除全部日志”改为带边框和表面的共享按钮，保留危险确认、取消、禁用及键盘行为；未清除真实日志。
- 52 项 patcher、23 项 GUI、644 项 UI 断言通过；Universal 固定入口更新并维持单副本。未宣称 2.8 全界面覆盖，未发布。

## 未发布 · 2026-10-20 · 行父级统一动效

- 备份与日志行以各自的 `--row-motion-progress` 统一驱动表面、阅读内容和“还原／删除／详情”动作组，避免元素各自响应或串扰相邻行。
- 保留既有 240ms cubic-out、位移/缩放幅度、稳定命中区及 reduced-motion 行为；643 项 UI 断言、三尺寸中间相位、系统 WebKit fixture 和现有原生窗口安全复核通过。
- 固定安装入口已核对为第二十四轮 Universal 构建；未执行真实数据写入、重复安装或发布。

## 未发布 · 2026-10-20 · 整体设计与动作组复验

- 备份“还原／删除”改为图标＋文字整体动作组，日志“详情”文字与箭头同步执行 240ms 位移/缩放；按钮命中区稳定，展开仅旋转箭头。
- 复审四页灰度、布局、间距和字体层级，辅助文字适度提升，保留既有奶油纸面和 Kit 几何。
- 628 项 UI 断言、四页三尺寸截图、Universal 构建和一次原生重启复验通过；未执行真实数据写入，只有一个可启动副本。

## 未发布 · 2026-10-20 · 最新构建重启验收

- 核对固定入口与最新 Universal 验收包哈希一致，签名和单副本状态通过后，正常退出并重新打开 Bilingual。
- 重启后的备份和日志原生联动均通过：主图标、状态图标和正文随卡片展开，按钮命中区不变；未修改备份、日志或设置。
- 证据：`../private-testing/2026-10-20/kit-motion-round22/FINAL-RESTART-ACCEPTANCE.md`。

## 未发布 · 2026-10-20 · 表单内容联动修复

- 修复备份/日志“外框交互、内部元素不交互”：主图标、状态图标和正文与表面同步执行 `4px→0` 水平展开，保留 Kit 的 240ms cubic-out 和稳定操作命中区。
- 保留主图标底色、透明日志详情和既有 reveal/focus/reduced-motion 契约；625 项 UI 断言、三尺寸连续帧和 Universal 构建通过。
- 固定入口已更新且只保留一个可启动副本；已仅重启当前 Bilingual 一次并完成原生联动复验，未修改真实用户数据。

## 未发布 · 2026-10-20 · 原生验收与单入口完成

- 现有 Tauri 原生窗口完成状态、排版、备份、日志四页安全验收：取消确认、刷新、日志展开/收起、字体选单和焦点行为通过。
- 备份数量与首条快照不变，日志未清空，字体默认选择未改变；未执行真实补丁、还原、删除、清空、保存、下载或发送。
- 仅保留 `/Applications/Cavalry Bilingual.app` 一个可启动副本，旧构建副本清理，签名和最新 hash 核对通过；持续 Kit 动效目标完成当前验收。

## 未发布 · 2026-10-20 · WebKit 键盘退出修复

- 修复键盘打开弹窗时 `transition:none` 同时屏蔽退出属性的问题：closing 显式恢复 opacity/transform 与 backdrop transition-property，键盘路径也有完整 240ms 退出。
- 系统 WebKit 非持久化复验覆盖列表、焦点、空态和关闭；JS 键盘路径与 Cocoa NSEvent 指针路径均验证关闭连续变化且 inert 生效，未把 fixture 冒充完整 Tauri 用户工程验收。
- 619 项 UI 断言和 Universal 固定入口验证通过；未新开 Cavalry 工程或修改真实用户数据。

## 未发布 · 2026-10-20 · 空状态与动效覆盖审计

- 备份/日志空状态补齐 Kit 的 450ms 有限入场，减少动效不播放，布局与数据不变。
- 完成列表、空态、共享控件、刷新、弹窗和通知的逐项覆盖审计，保留右侧通知的产品语义差异。
- 616 项 UI 断言、空态连续帧和 Universal 固定入口验证通过；原生真实指针验收仍单独保留。

## 未发布 · 2026-10-20 · 共享控件与刷新反馈

- 共享按钮、导航、轻量动作、分段选择、选单和披露箭头统一为 Kit 的 240ms cubic-out，保留通知独立节奏。
- 刷新按钮新增每次点击可重入的 380ms 有限旋转，结束后停止，减少动效不播放。
- 615 项 UI 断言、共享控件连续帧和 Universal 固定入口验证通过；未新开 Cavalry 工程或修改真实用户数据。

## 未发布 · 2026-10-20 · Kit 时间模型与弹窗全阶段

- 按 Kit 源码修正列表行真实时间：336ms 行相位、45.5ms 错峰、240ms hover 和精确 cubic-out；共享内容/表面入场，99% 输入就绪与视觉停稳分离，修复离散 pointer-events 提前切换。
- 确认、反馈和更新弹窗加入统一 380ms 入场／240ms 退场；退出中 inert 防重复操作，busy 与减少动效规则保留。
- 612 项 UI 断言、reveal/hover/modal 连续帧曲线和固定 Universal 入口验证通过；未新开 Cavalry 工程或修改真实用户数据。

## 未发布 · 2026-10-20 · 集合行焦点与有限入场回归

- 修复键盘焦点 `1.5px` 描边在 Chromium 被取整、实际没有增强的问题：改用不增加布局尺寸的内在描边，保留稳定命中区。
- 补齐 Kit 式分行入场和焦点/减少动效验收；480ms 入场期间动作锁定，测试等待真实终态，避免把可见误判为可操作。
- 603 项 UI 断言、50 项 patcher 测试、23 项 GUI 测试、三尺寸中间帧和 25 张视觉证据通过；Universal 固定入口已更新，未打开新 Cavalry 工程或修改真实用户数据。

## 未发布 · 2026-10-20 · 状态一致性与Kit动效对齐

- 修复应用后仍提示待更新的问题：改为比较移除签名后的Mach-O内容哈希，避免重签把同一运行时误判为已变化；最终评估`pendingSettings=false`。
- 主状态页可见操作小字全部迁移到右侧通知，保留无障碍原因说明和禁用保护。
- 按Kit真实`shrink2`与`row_action_offset`重做列表交互：表面左右内缩展开，图标负偏移归零并轻微放大，按钮与危险热区不动，不再缩放边框或变浅绿。
- 590项UI断言、50项patcher测试、23项GUI测试和三尺寸渲染通过，Universal包及固定安装入口已更新；未再打开新工程或修改原始数据。

## 未发布 · 2026-10-20 · 2.8资源路径与列表交互修复

- 修复2.8资源目录检查错误，实际使用`Contents/Resources/runtime/cavalry-28-assets`；解决安装后仍提示缺少注入器的问题，并增加路径回归测试。
- 缺运行时和运行中提示改为右侧通知，移除原位置可见错误块；无障碍说明与安全禁用保持不变。
- 备份/日志悬停不再变浅绿，保留Kit式表面舒展和边框反馈；操作图标/详情箭头随整体交互，按钮与危险热区不移动，详情按钮取消浅绿底。
- 572项UI断言、49项patcher测试和三尺寸渲染通过，Universal包及固定安装入口已更新；未再打开新工程或修改原始数据。

## 未发布 · 2026-10-19 · Cavalry 2.8兼容与多文件汉化

- 精确支持Cavalry 2.8.0 / Qt 6.9.2并保留2.7.2 / Qt 6.6.3；独立2.8注入器通过两架构各445个Qt导入检查及Tool-path/Canvas/Graph静态合同。
- 接入17个2.8原生翻译资源，共10473个UI文本；应用前逐个校验，24项版本化快照支持完整还原，不再复用2.7单文件资源。
- 缺少对应运行时或资源继续阻止写入；兼容性提示显示实际版本/Qt，移除不支持版本的重复可见小字及排版底部分界线。
- 554项UI断言、48项patcher测试、23项GUI测试、49项目录合同测试和6项Canvas fixture通过；隔离副本完成应用/还原，固定安装入口已更新。
- 原生验证限于隔离欢迎页和文件/签名闭环，未宣称全界面翻译或原始权限问题已复现修复；未修改原始工程或执行真实危险操作。

## 未发布 · 2026-10-19 · 浅色通知与集合行动效

- 右侧通知改为浅奶油底与语义色，同批按100ms逐条滑入，最多叠放3条；修复堆栈裁切和旧逻辑允许4条的问题，保留暂停、关闭、刷新去重及减少动效。
- 排版保存、恢复默认与取消草稿给出符合实际结果的通知；持续错误和禁用原因仍留在操作现场。
- 备份/日志更新图标计数并移除重复小字，卡面以轻微横向舒展借鉴Kit；文字和还原/删除热区保持稳定。
- 反馈弹窗精简选填/重复提示，保留字符计数、隐私与脱敏预览边界。
- 543项UI断言、21张三尺寸/状态截图、Universal构建及原生关键页面核对通过；原生hover时序和宿主Qt符号审计未覆盖，不执行真实危险操作。

## 未发布 · 2026-10-19 · 选单方向、集合列表与日志重设计

- 改善选单自动翻转：按实际内容与可用空间优先向下，箭头与实际方向一致；修复键盘高亮滚动牵动页面的问题，保留保存栏/工具栏避让。
- 备份改为独立浅色圆角卡行，重排时间/版本/类型/快照ID与右操作，普通悬停和危险动作反馈分离且热区稳定。
- 日志重排页头反馈、计数/本机说明/清除工具行、空状态与摘要行；完整原文可键盘聚焦滚动，详情/收起对应真实状态。
- 统一有限交互反馈与键盘/减少动效分支，无新动画依赖或真实数据操作。
- 最终516项UI断言、33张三尺寸/状态截图、Universal构建通过；原生已看到新备份外观，用户并发操作后停止自动点击，其余原生交互留待实测。

## 未发布 · 2026-10-19 · 文字灰度与键盘反馈统一

- 增强未选中语言选项、恢复默认和查看备份的常态文字对比，区分可用轻量动作与真正禁用控件。
- 统一文字动作的悬停/键盘焦点反馈，保持透明底与稳定尺寸；删除操作的键盘焦点补齐危险色和淡底。
- 保留已有选择、禁用语义与减少动效设置，不改变业务或真实用户数据。
- 420项UI断言、三尺寸渲染、Universal构建及原生键盘焦点有据可查；更新固定安装入口，旧包和构建包归档为ZIP，不增加可启动副本。

## 未发布 · 2026-10-19 · 可读反馈报告预览

- 报告预览改为问题说明、环境信息和完整操作记录分组；原始数据可展开核对，未知格式完整显示，不遗漏待发送信息。
- 长预览支持键盘滚动，服务连接说明与底部动作保持可见；描述字数与保存位置披露使用统一交互规范。
- 发送继续使用原后端草稿ID，未改变收集、脱敏、服务或邮件流程；本轮没有真实提交或新增接收端。
- 387项前端断言和Universal构建通过；最终应用仍只保留一个安装入口。

## 未发布 · 2026-10-19 · 检测与版本切换反馈

- 检测失败、未安装和旧结果未刷新独立显示，提供当前页重新检测，未确认状态不允许应用或还原。
- 目标切换新增稳定且可读的工作态、防重复提交与相关操作锁定；失败保留选择和旧摘要，支持明确的手动重试。
- 修复保存目标失效时首个可用版本不能切换的问题；检测失败仍可选择其他已识别版本。
- 最终构建352项UI断言、Universal构建通过；真实目标/宿主未被测试切换或修改。

## 未发布 · 2026-10-19 · 读取与失败状态统一

- 配置、备份、字体读取统一加载/失败/重试反馈，不再以无限加载或空数据掩盖读取错误。
- 备份接口如实返回目录读取错误；刷新失败保留上次列表并提示可能过期，目录缺失仍作为合法空状态。
- 字体重试保留排版草稿和原选择，恢复后返回控件；错误诊断仍保存在本机日志。
- 311项UI断言、23项Rust测试、Universal构建与WindowsGNU交叉检查通过；未由此完成Windows原生或真实报错服务验收。

## 未发布 · 2026-10-19 · 短窗焦点与持久失败反馈

- 修复Tab聚焦字体框被粘性保存栏遮挡的问题，按真实操作栏高度预留滚动空间。
- 下拉列表服从内容与操作栏边界，字段滚出可见范围时关闭，不提交查询；长字体名保留完整值。
- 保存失败原因持续显示在固定操作区，长错误支持局部键盘滚动，保留草稿与重试。
- 280项前端断言及Universal构建通过；本轮未改后端或诱发真实用户保存失败。

## 未发布 · 2026-10-19 · 响应式布局与交互精修

- 宽窗口将字体/排版设置与预览并排，窄窗口保留单列及可读导航标签，减少识别与滚动负担。
- 修复空集合样式选择器错配，统一空备份/空日志标题、说明与留白；日志详情点击高度提升至36px。
- 状态页应用、最近还原复用共享确认框；失败保留重试，取消/忙碌反馈与备份一致。
- 反馈进入预览时聚焦内容标题，返回编辑/完成后也恢复明确焦点；模板键盘选择即时，指针保留短过渡。
- 240项前端断言与Universal构建通过；后端未改动。未扩大真实宿主或Windows原生验收范围。

## 未发布 · 2026-10-19 · 统一交互、官网更新与主动反馈

- 移除状态页技术细节块；保留版本/进程安全限制。版本与字体共用单字段搜索选择框，统一键盘、选中、焦点和弹层状态。
- 统一四区表面、列表行、灰度、按钮和悬停；备份/日志使用紧凑集合布局，危险动作保持稳定目标，确认框统一焦点与按钮层级。
- “软件更新”立即展示检查结果；比较官网与本机最高版本，真实有新版才出现提示点。新增可观察的下载进度、后台显示、取消、失败重试、非覆盖保存和完成位置入口。
- 报错改为主动反馈：描述问题、选择是否附带本工具记录、先预览脱敏内容，再明确发送或本地保存；不读取工程或宿主原始日志，不在弹窗展示邮箱。
- 集成 MIT 许可的官方 Sentry 协议组件及显式 HTTPS 传输。真实接收服务仍需配置公共 DSN；无服务时提供诚实标明的系统邮件/导出，不内置私有凭据，不自动上报。
- 190 项 UI assertions、20 项 Rust tests、macOS Universal 构建及 Windows GNU 交叉检查通过；真实报错服务和邮箱送达、Windows/Intel 原生验收未由此完成。

## 未发布 · 2026-10-19 · 界面反馈第二轮

- 三条行内绿色提示改为沿用深色样式的浮层通知，支持关闭、自动收起和重复状态去重；不再挤占状态页布局。
- 中文、英文字体各合并为一个可搜索选择框，支持键盘选择、Escape 取消、系统默认和无结果提示；切页保留草稿并重置内容滚动位置。
- 去除恢复默认、备份还原等操作的视觉下划线；备份改为独立快照卡行，新增确认后移至系统回收区域的删除操作，仅允许当前备份目录的直接子项。
- 日志重新分配记录数与动作区，新增“清除全部日志”及确认/持久化空状态；诊断详情默认折叠，发送报告的收件人与提示集中到操作确认。
- 修正成功错误报告因文件路径含有 `error-reports` 而误标失败的问题；保留原始诊断与真实回滚失败警告。
- 152 项 UI 断言、5 项备份边界/合成回收 Rust 测试通过；Windows GNU 交叉检查通过。原生 Windows 与 Intel 硬件验收不包含在本轮结论内。

## 未发布 · 2026-10-19 · Cavalry 目标切换、更新下载与错误报告

- 状态页新增“当前注入目标”面板，可从本机已安装的 Cavalry 版本中选择下一次补丁目标；“应用更新”改为“应用双语”。
- 新增“软件更新”：从 Cavalry 官方 `https://cavalry.studio/downloads/latest/Cavalry.dmg` 下载到 Downloads，不覆盖现有安装，便于并存测试。
- 日志页新增“发送错误报告”：本地生成脱敏报告并打开 `3422484681@qq.com` 邮件草稿，用户确认后手动发送；客户端不内置邮件服务密钥，不自动上传原始日志。
- 顶栏改用与 macOS app bundle 相同的 CB 图标资源；排版字体字段增加本机字体下拉选择；技术细节、备份入口的视觉下划线移除。
- Rust GUI 命令与 mock API 已同步扩展；UI 测试现覆盖版本目标、软件更新、字体下拉和错误报告入口。

## 未发布 · 2026-10-18 · 当前界面精修

- 以现有奶油纸张、浅绿状态、MiSans/系统字体、CB 标识和 PaperArt 插画为基线，重新整理桌面工具的视觉层级；没有引入其他项目的黑白、渐变或全新组件体系。
- 顶栏、侧栏和内容区重新统一间距、边框和焦点状态；保留现有导航、状态胶囊、刷新入口与四个工作区，不改变交互契约。
- 状态页强化“已应用”摘要卡、指标层级和通知堆栈；主操作、还原操作、备份入口及技术细节的优先级更清晰。
- 排版页将双语顺序、字体设置和预览分成一致的面板层级，改善分段控件、输入焦点、预览窗口和固定保存栏在小窗口下的可读性。
- 备份与日志页增加更稳定的行高、分隔和时间线标记；保留原有还原确认、日志文本和可访问性目标。
- 当前工作树 UI 测试：80 项断言通过；截图覆盖状态、排版、备份、日志四区及 880×620、760×540、1280×800 三种窗口尺寸。

## 未发布 · 2026-10-18 · 正式 Cavalry 2.8 自绘路径乱码修复

- 根据当前 2.8 bilingual source candidate 对正式 app 的两份翻译源资源做了结构保持的 UI 资源更新：`appStrings_en-GB.source.json` 仅更新 1,911 个 `UI-text` 字段，`nodeStrings_en-GB.source.json` 仅更新 5,217 个 `UI-text` 字段；递归比较确认 0 个非 UI 字段变化。原文件已备份，证据见 `private-testing/2026-10-18/formal-2.8-before-source-update/evidence.json`。
- 正式 2.8 欢迎/登录等待页已真实显示 bilingual `Web Proxy` 等新增资源文字；工作区全量资源动态复验待登录回调完成后继续。
- 新增 `tools/update_cavalry_28_source_resources.py` 与 3 项 Python 测试：默认只做结构审计，`--apply` 必须提供 backup root；只允许 `UI-text` 叶子变化，自动备份两份 source 资源并输出 hash/manifest，避免以后手工替换正式 2.8 资源。
- 修复 Python 测试发现方式：2.8 audit tests 自带 tools path bootstrap，普通 `python3 -m unittest discover -s tests -p "test_*.py"` 现在 73 项全部通过，不再要求调用者额外设置 `PYTHONPATH`。
- 新增 2 项 macOS 2.8 observed-text 静态 guard，锁定 v6 QRect hook、dyld dynamic interpose、Hiragino Sans GB 默认 Path 字体和 60 秒合同重试；普通 Python 全量测试现为 75 项通过。

- 修复 2.8 `SkTextUtils::GetPath` 白名单自绘文字在正式宿主中出现乱码的问题：简体中文默认 CJK Path 字体改为已取得真实可读证据的 `Hiragino Sans GB`；用户显式指定字体仍优先，覆盖不足时继续 fail-closed。
- 将 2.8 Core/ExtensionLayer 合同配置重试从 5 秒延长为有界 60 秒，并从真实 Qt 应用安装阶段再次启动重试，覆盖登录交接后延迟加载的 vendor images；没有放宽 UUID、符号、调用点或未知 caller 合同。
- 正式 `/Applications/Cavalry 2.8.app` 保留原始完整备份后，`Info.plist` 增加 `LSEnvironment`，使登录交接重新启动的子进程继续加载固定双架构 Qt 6.9.2 injector；应用保持用户授权的 ad-hoc、无 hardened runtime 测试状态。
- 固定 injector `libCavalryTranslatorInjector-qt692-fixed.dylib`：441 个 Qt imports、0 unresolved、arm64/x86_64，SHA-256 `22352aebc625a94011065ff5e5dfbbd784d168eca7f5da828afb442ac1021cce`。
- 正式 2.8 当前工作区真实可见：菜单与 viewport/tool-path 中的 `S + 单击运动路径（S + click Motion Path）`、`视口质量：完整（Viewport Quality: Full）` 可读；诊断为 configured/vendor/renderer=true、8/8 canonical、8 CJK path success、viewport rendered=1、fallback=0。该证据只覆盖当前窄 whitelist，不代表全界面、Save As、DG 拖放或 Windows/Intel 验收。
- Windows 宿主发现现在收集全部可读取的 `Cavalry.exe` 进程，按最近创建时间选择目标，跳过无权限/路径读取失败的进程，不再因为进程枚举顺序随机命中旧版本。GUI 状态检测增加 8 秒前端超时，刷新不会永久停在“检测中”。
- 继续补齐 2.8 当前工作区已实测的 parentless/custom-painted 空状态字符串：Attribute 搜索、Scene Window 图层搜索、Dependency Graph 搜索、Attribute Editor 空状态与 Scene Window 空状态现在走 2.8 精确文字映射；v3 injector 已构建，静态合同与 10 项 Canvas/Graph 合同通过。登录后的正式工作区复验待现有登录回调完成后继续，不把静态结果写成动态全覆盖。
- 基于当前 GUI/patcher 修复重新生成 Windows x64 NSIS 交叉构建：`Cavalry Bilingual_0.1.0_x64-setup.exe`，4,457,103 bytes，SHA-256 `9b6a3c35e5410c62c951d58349b4f77e81da603634ba191556d1736c737aeda4`；EXE、generic DLL、QPA DLL 均与当前 dist 产物 hash 一致。仍未写成原生 Windows/MSVC/Cavalry 宿主验收。
- v4 injector 为残余 2.8 `QPainter::drawText(QRect,...)` 空状态绘制增加了窄适配入口，静态构建、2.8 双架构合同和 10 项 Canvas/Graph 回归通过；当前已登录工作区仍保留 v3 进程以避免再次中断用户会话，v4 的正式工作区动态复验待下次用户登录/重启窗口。
- v5 在同一入口增加 macOS `dyld_dynamic_interpose` 的运行时补偿路径，目标是支持已加载正式 2.8 进程的后续修复；已构建为 `libCavalryTranslatorInjector-qt692-fixed-v5.dylib`（SHA-256 `36e44645568cac4d2b741e178fd9030cc1a3e05880a7b5d6aaa24c931a54989b`），但尚未把 dlopen 后的动态 QRect 绘制写成通过。当前登录工作区仍由 v3 保持。
- v6 收紧 custom-painted empty-state 匹配，允许 `Select layers...` / `Use the Create menu...` 包含换行或附加空白时仍命中精确 2.8 literal；v6 SHA-256 `f1d5fa7f80dbb6914fbb776e8001067b448af072f349c367e144cff149bfa5a6`，静态合同和 10 项 Canvas/Graph 回归通过。当前工作区不重启，v6 只作为下一次正式启动版本。
- v7 进一步覆盖 `QPainter::drawText(QRectF, QString, QTextOption)` 入口，处理另一类居中/换行空状态绘制；v7 SHA-256 `9588ec8a0f93f6e724117b6223809cda9093058f575a4ae997870b6b244d9cc8`，静态合同、2 项 observed-text guard 和 10 项 Canvas/Graph 回归通过。当前正式进程不切换到 v7。
- v12 修复此前仍漏掉的 `QPainter::drawText(QRectF, int, QString, QRectF*)` 入口；为避免新增 hook 递归，三条矩形文本入口现在都从 QtGui 已加载 Mach-O 的原始 `LC_SYMTAB`/`nlist_64` 导出地址转发，不依赖会被 `__interpose` 重定向的 `dlsym`。v12 双架构各 445 Qt imports、0 unresolved，SHA-256 `a0cc64f60a585b4696f62b3acc33e96765be3e5aef087a97715b610657e3bd9f`，ad-hoc/deep strict 通过。
- v12 在 Qt 6.9.2 Cocoa widget harness 中真实执行 `QPainter::drawText(QRectF, int, QString, QRectF*)`，截图显示 `选择图层以查看其设置（Select layers to see their settings）`；证据为 `private-testing/2026-10-18/2.8-current-restart/rectf-int-hook-v12-harness.json`。隔离正式 2.8 v12 副本也真实启动并显示双语欢迎页；非隔离正式 app 的工作区重启当前停在 `CavalryApp::start -> initialiseProjectDescription -> loadProjectSettings`，因此不把这次结果写成正式工作区动态验收。

## 0.1.0 Preview 2 · 2026-10-17 · Windows NSIS 安装器

- 新增 Windows x64 `setup.exe`，包含 GUI、generic/QPA DLL、双语 `INSTALL.txt` 和 Legal 文件；`prepare:resources` 负责生成 ignored 打包副本，公开真源仍在 `docs/` 与根目录许可文件。
- 通过 7-Zip 直接核对 NSIS 成员和解压后文件：主程序为 PE x64 GUI，指南、许可和 runtime 字节一致；安装器本身隐私扫描 0 标记。
- macOS DMG 更新为 Preview 2 指南并重新通过挂载、签名、架构、成员和隐私检查。
- Windows 静默安装未完成且未生成目标目录，未记通过；原生 Windows、MSVC、真实宿主和 Intel 原生仍未验收。Preview 1 的便携 ZIP 保留为历史，当前主安装入口改为 EXE。

## 0.1.0 Preview 1 · 2026-10-17 · 首个预发布附件

- 提供 macOS universal DMG 与 Windows x64 便携 ZIP；附件、哈希、安装指南及未覆盖范围见 `docs/RELEASE-0.1.0-preview.1.md`。这是预发布，不是稳定版或全平台验收结论。
- macOS GUI 使用路径重映射重建，挂载后的 DMG 通过签名、架构、成员和隐私检查；仍为 ad-hoc 且未公证。
- Windows 两个入口补充 release 下的 GUI subsystem，主程序从 console 改为 PE x64 GUI；ZIP 含当前 generic/QPA DLL、双语指南和许可，不是 NSIS 安装器，未签名。
- Windows 本轮 Wine 复验因 wineserver 崩溃/超时停止，未记通过；原生 Windows、MSVC、安装器、真实宿主和 Intel 原生仍未验收。

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
- Fixed GUI host discovery: macOS now follows the running official Cavalry bundle (including versioned names such as `Cavalry 2.7.app`), re-resolves the target on every refresh/apply/restore, Windows uses its platform default install path, and the status details expose the path that was actually checked.
- Windows host discovery now also prefers the exact running `Cavalry.exe` path, covering per-user and custom installation locations.
- Fixed cross-target Tauri resource staging: Windows builds now stage the Windows DLLs based on the requested target/config instead of the macOS host platform, preventing a cross-built installer from reusing the wrong runtime set.
- Added a macOS cross-build fallback that compiles Tauri's generated NSIS script through the existing Wine wrapper when `makensis.exe` is unavailable on the host.
- Added a bounded post-launch retry for the 2.8 self-drawn text-path contract so delayed `libCore`/`libExtensionLayer` loading can be rechecked without weakening the fail-closed ABI guard.
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
