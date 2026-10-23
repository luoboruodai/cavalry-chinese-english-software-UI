# Windows / Intel / Cavalry 2.8 验收入口

## 本轮范围

本轮要求 Windows、Intel 原生、Cavalry 2.8.0 和界面覆盖。Scene Tree → Dependency Graph 拖入、端口展开与连接由用户明确延期，不再作为本轮门槛；不能写成通过。

交叉编译、Rosetta、Qt 离屏测试与真实宿主分别记录。当前 macOS 实验产物不解除 2.8 安装守卫；当前 Windows QPA 合同仍针对 2.7.2 / Qt 6.6.3。

## Windows x64 原生

需要 Windows x64、Visual Studio 2022 MSVC v143、CMake 4.2+、Node、Rust 与 Qt 6.6.3 MSVC x64 shared SDK。若当前安装的是 Cavalry 2.8，不能把 2.7.2 QPA 代理写入该安装。

```powershell
# 在 Windows 原生终端执行，工作目录是本仓库。
[System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
./tools/build_windows.ps1 -QtPrefix C:\Qt\6.6.3\msvc2019_64 -CavalryRoot 'C:\Program Files\Cavalry'
cargo test --lib --manifest-path patcher/Cargo.toml
npm ci --prefix gui/ui
npm test --prefix gui/ui
npm run tauri:build --prefix gui/ui -- --bundles nsis
```

CMake 现有单语 fixture 之外，新增真实双语 display、公共 Qt runtime、input/delegate 的 CTest；现有 QPA binary smoke 现同时载入 generic 产品 DLL，验证两者 metadata/工厂类型及 generic 无效激活拒绝，不创建平台、不调用宿主 hook。Release 配置保留这些测试的 `assert`，不能以编译掉断言的程序退出0算通过。

然后在保存后的合成场景中检查：原生图标启动、菜单、属性/枚举、字体回退、Preferences、视口设置弹层、中文名字编辑保存、安装/升级/还原。当前 Windows 没有启用仅在 macOS 采证的 Preferences owner 适配器，发现差异须单独定位。

> macOS 生成的 PE DLL/EXE 已在独立 Wine 前缀中运行若干离屏及 DLL 加载测试，仍未在原生 Windows 执行，不属于已验收 Windows 发布包，也不替代 MSVC 原生构建、NSIS 和宿主测试。手写交叉工具须显式匹配 Qt Release 的 `QT_NO_DEBUG`；省略时可链接成功但插件被标为 Debug，并在实际加载时拒绝。

## Windows x64 交叉构建与 NSIS 回读

在安装了 `x86_64-pc-windows-gnu` Rust 目标、MinGW、NSIS 与 Wine wrapper 的 macOS 构建机上：

```bash
npm ci --prefix gui/ui
cargo check --manifest-path gui/Cargo.toml --target x86_64-pc-windows-gnu
npm run tauri:build --prefix gui/ui -- --target x86_64-pc-windows-gnu --bundles nsis
```

`gui/ui/scripts/tauri.mjs` 只允许在 Tauri 已生成本次 `installer.nsi` 后调用交叉 NSIS fallback；脚本过旧表示编译或资源阶段未到达打包步骤，必须保留原错误并停止，不能拿旧 EXE 继续发布。生成的安装器再用 7-Zip 执行 CRC、成员与解压回读，逐项比较主程序、两个 DLL、`INSTALL.txt` 和全部 Legal 文件。即使这些检查通过，也只记为交叉构建与包体验证，不是原生 Windows 或真实 Cavalry 验收。

## Windows Common Controls v6 启动入口修复

Preview 3 的 EXE 静态导入 `comctl32.dll` 的 `TaskDialogIndirect`，但 PE Resource Directory 为空。RFD 使用该 API 显示消息对话框，Windows 默认旧版 common-controls 路径会造成入口点缺失。Preview 4 在 Windows 构建中嵌入 `asInvoker` 与 `Microsoft.Windows.Common-Controls 6.0.0.0` manifest，不请求管理员权限，也不改变发送或补丁逻辑。

```bash
python3 tools/test_windows_comctl32.py
x86_64-w64-mingw32-objdump -p gui/target/x86_64-pc-windows-gnu/release/cavalry-bilingual.exe
```

探针检查同源 manifest 的 `GetProcAddress`，最终还必须确认 EXE 的 Resource Directory 非空、嵌入 XML 包含 v6 与 `asInvoker`，并在 NSIS 解压后的主程序上复核。未签名安装器仍会出现“未知发布者”警告，这与入口点修复是两件事。Wine／静态 PE 检查不替代 Windows 原生启动与真实宿主验收。

## Windows 版本识别与 CI

官方 `Cavalry.exe` 可能只有图标、manifest 等资源而没有 `VS_VERSION_INFO`。0.1.2 不再把这种情况直接报成“未知版本”：有界流式扫描只接受唯一的 NUL 分隔受支持版本标记，重复、相似或冲突标记均拒绝。GUI 列表同时改用 Windows 检测，不再读取 macOS plist。Qt 版本、部署身份和写入安全门保持原要求。

`.github/workflows/ci.yml` 在原生 Windows 与 macOS runner 上执行 UI、patcher 和 GUI Rust 测试；macOS 追加目录、生成器、翻译与隐私检查。CI 中的 EmailJS 使用浏览器路由夹具，不发送真实邮件。原生 CI 结果与真实用户网络、WebView2、GPU 和 Cavalry 宿主验收分别记录。

0.1.3 另修复报告通知只在弹窗入场初期测量一次造成的 18px 纵向偏移。通知现在在后续帧及弹窗 transitionstart／end／cancel 重新计算 offset；CI 直接校验最终 offset 与动作命中，不仅比较静态截图。

## Windows 嵌套安装路径

0.1.4 的自定义路径不再只检查当前层级。选择父目录时，会在最多 4 层、256 个目录内按稳定顺序查找同时包含 `Cavalry.exe` 与 `Qt6Core.dll` 的安装根，并持久保存解析后的真实路径。直接选择安装目录或 `Cavalry.exe` 也可识别；多个有效安装、缺失 Qt、符号链接／重解析点、过深或过大目录均明确失败，不做全盘扫描或任意猜测。Windows CI 另覆盖嵌套目录 apply→状态确认→restore，验证路径结果能进入实际部署合同。

## Windows 首次配置与自动发现

0.1.5 在写入 `target-cavalry.json` 前先创建配置父目录，修复首次使用时的 os error 3。自动发现在默认目录和嵌套解析之外，还读取运行中的 Cavalry 与 MSI 开始菜单快捷方式，随后仍要求完整安装结构。Windows 2.8.0 / Qt 6.9.2 会显示真实版本与“仅支持 2.7.2 / Qt 6.6.3”的明确原因，不再显示为未检测到；当前 2.8 QPA／私有 ABI 合同未获验证，不会写入。

## Intel Mac 原生

```bash
uname -m
sysctl -n machdep.cpu.brand_string
sysctl -in sysctl.proc_translated
# Intel 硬件应识别为 Intel；若 proc_translated=1 则是 Rosetta，不计原生。
export CAVALRY_QT_PREFIX=/path/to/Qt/6.6.3/macos
CB_TEST_ARCH=x86_64 bash tools/test_qt_runtime.sh
cargo test --manifest-path patcher/Cargo.toml
npm run build:macos-universal
```

`build:macos-universal` 需要安装 Rust 的 `aarch64-apple-darwin` 和 `x86_64-apple-darwin` 标准库。最终工具位于 `gui/target/universal-apple-darwin/release/bundle/macos/`；不能拿原 `gui/target/release/` 的 arm64 单架构包当 Intel 包。

再按与 Windows 相同的合成场景验收可见界面、保存/还原与错误路径。Apple Silicon 上运行 x86_64 fixture 已有独立记录，但不是这里要求的 Intel 硬件验收。

## Cavalry 2.8.0 / Qt 6.9.2

已读取官方 2.8.0 安装包。旧的 `assets/Definitions/nodeStrings.json` 已不存在；新文件为 `assets/Definitions/Translation/*_en-GB.source.json`，可见文字在 `UI-text`，旁有 `notes` / `dontTranslate` 元数据，并出现 ICU plural/select 消息。

```bash
npm run test:catalog28
npm run audit:catalog28 -- \
  --assets '/path/to/Cavalry.app/Contents/assets' \
  --language zh-Hans \
  --report /path/to/private-tests/catalog-migration.json
```

审计输出复用候选、冲突、缺译、结构校验后的ICU候选及仍待审项，不修改宿主，**不是通过率**。不能将 `notes`、模型身份、未翻译的原文计为已翻译界面。带分支的 ICU 消息使用 `icu_message_contract.py` 校验参数、类型、分支、offset、格式与复数 `#`，不能用旧 `%1` / `{0}` 正则假装验证通过。简体66个独立消息覆盖72处引用，繁体/日语对应消息暂未翻译。

导出实验稿（不是安装命令）：

```bash
npm run audit:catalog28 -- \
  --assets '/path/to/Cavalry.app/Contents/assets' \
  --language zh-Hans \
  --report /path/to/private-tests/catalog-migration.json \
  --source-draft-dir /path/to/private-tests/source-review
```

原始schema试稿保留 `en-GB` 宿主语言以保持英文复数规则，正文形如 `1 小时（1 hour）`；`notes` / ID / `dontTranslate` 与模型默认名不改。只对明确候选做双语拼接，缺译与歧义保留英文。导出器拒绝源目录、其父/子目录和任何 `.app` 内路径，不能直接当安装器使用。只有明确隔离的实验副本才可手动试验；正式安装守卫不变。已有 `--draft-dir` 则仍输出单语locale审阅稿，两种稿件不能混淆为可安装语言包。

官方原版已进入主界面并保存合成场景。2026-10-15，另一个仅替换17份新格式source资源、未载入注入库的隔离副本更新了含默认名称保护及55条上下文候选的新简体试稿；保留资源备份、ad-hoc签名/strict验证，通过独立HOME且无DYLD注入启动，显示双语欢迎/Canva登录等待页。后者仍停在自身登录流程，尚不能完成名称保存/主界面覆盖验证；不能搬用原版凭据或将原版UI证据记到双语副本。

2026-10-16 又补充9个主工作区精确字段，使简体上下文候选增至64条。2.8 arm64 与 x86_64 已分别核对三库 UUID、6个符号偏移、2个固定视口调用点以及 prefix/action 两个独立 `setupToolHelp` 调用点；v10 `libCavalryTranslatorInjector-qt692-v10.dylib` 双架构各441 imports、0 unresolved，ad-hoc/deep strict通过。默认2.7.2路径不放宽，通用Canvas/Graph继续关闭。可用以下命令复核静态合同（不是渲染验收）：

```bash
python3 tools/audit_cavalry_28_tool_path.py --app '/path/to/Cavalry 2.8 Font Acceptance.app' --arch arm64
python3 tools/audit_cavalry_28_tool_path.py --app '/path/to/Cavalry 2.8 Font Acceptance.app' --arch x86_64
```

真实2.8库的CoreText→Skia字体与完整双语 `Viewport Quality: Full` 非空GetPath已通过；扩展后的三语 action/prefix/视口逐 glyph 探针也已执行。2026-10-16，繁体、日文、简体三个隔离候选依次启动并复核同一v9哈希与签名。默认工具下，三语各有5个action、3个prefix的8/8成功、0回退和整行可读截图，固定视口均为recognized/rendered=1、fallback=0；证据位于私有 `main-workspace-continuation/` 的 `native-ui-v10-hant.jpg`、`native-ui-v11-jp-clean.jpg`、`native-ui-v12-hans.jpg` 及对应诊断文本。该结论仅限这些已审计source和固定视口，不是全视口或全界面通过。

日文 persisted Soft Selection 工作区中的非白名单提示仍显示连续 `?`，见 `native-ui-v11-jp.jpg`；干净HOME只用于对齐默认工具复核上述限定路径。非空Path与8/8计数曾和可见乱码并存，必须同时检查真实整行，不能只凭计数签收。用户于2026-10-16明确要求跳过2.8合法登录与原生Save/Save As，后续发现问题再处理；这两项是用户明确延期，不是通过，也不再阻塞当前工作。原始输入与只读比较脚本保留，未创建roundtrip输出。

app13 已补充2.8 x86_64/Rosetta 的真实限定 Path 验收：v10 SHA-256 `8efd1a15bc8e13e67cc3cb7438867ae6c7b7fcb2d1953a6322f4756ed0adc3c2`，8个source各translated=1/fallback=0，固定视口 rendered=1/fallback=0，整行可读。证据为 `native-ui-v13-v10-x86_64.jpg`、`vendor-contract-v13-v10-x86_64-lldb.txt`、`native-viewport-diagnostics-v13-v10-x86_64-retry.txt` 和 `candidate-application-v13.json`；同名重建字节一致。`/usr/bin/arch -x86_64` 会清除 `DYLD_*`，必须在arch子shell内重新设置 `DYLD_INSERT_LIBRARIES`，早期未加载结果不得归因于dylib。Rosetta不等于Intel原生硬件验收；通用Canvas/Graph、非白名单提示和全界面覆盖仍未完成。不得用离线探针、静态审计或其他工具状态的局部证据扩大覆盖结论，也不得升级正式宿主来掩盖缺口。

app14/v11 已定点加入 Soft Selection 的5个action source（含edge句号变体），2.8诊断扩展为13个source/34个uint64。静态反汇编证明 `setupToolHelp` 遍历当前工具帮助项并复用既有action调用点；39项目录、15项生成器、8项Canvas/Python合同和双架构静态审计通过，默认8个旧source在真实窗口中继续成功。**当前模态欢迎页阻止Mesh激活，新source未触发，Soft Selection原生乱码修复仍待复验。** `candidate-application-v14.json` 保留该边界，不把静态producer证据写成可见验收。

app15/16/17 已分别验证日文、简体、繁体 Add Layers 的真实显示：四个精确字段（dgView/menu.window/quickAdd/sceneWindow）分别为 `レイヤーを追加（Add Layers）`、`添加图层（Add Layers）`、`加入圖層（Add Layers）`，三语各17份catalog非UI字段保持一致，app14到日文草稿只改变这四个UI-text路径。默认主窗口实际显示对应双语文本，证据为 `native-ui-v15-jp-add-layers.jpg`、`native-ui-v16-hans-add-layers.jpg`、`native-ui-v17-hant-add-layers.jpg` 和对应manifest。这是单一标签的三语原生通过，不是全界面覆盖；三语上下文候选总数现为68条。

`align.title` 也已取得三语真实显示通过：app16原本已是 `对齐（Align）`，app19显示 `對齊（Align）`，app18显示 `整列（Align）`；证据为 `native-ui-v16-hans-add-layers.jpg`、`native-ui-v19-hant-align.jpg`、`native-ui-v18-jp-align.jpg`。app14到日文/繁体草稿仅改变该精确字段。这是另一单标签的三语原生通过，不是全界面覆盖；上下文候选总数现为69条。

app20/v12 新增限定2.8 Canvas合同：arm64与x86_64各核对3库UUID和7个精确调用点，2.8字体桥使用CoreText→Skia；当前41项目录、15项生成器及8项Canvas/Python合同通过。v12 SHA-256 `412197727ce0dbcd98f1138e513b0ac2bdaf0fa2505786da7c04a620e0a6d911`，双架构各441 imports、0 unresolved、`@loader_path`、ad-hoc/deep strict及同名重建一致通过。可用以下命令复核静态合同，结果仅为 `PASS_STATIC_CONTRACT_ONLY`：

```bash
python3 tools/audit_cavalry_28_canvas.py --app '/path/to/Cavalry 2.8 Font Acceptance 14.app' --arch arm64
python3 tools/audit_cavalry_28_canvas.py --app '/path/to/Cavalry 2.8 Font Acceptance 14.app' --arch x86_64
```

默认日文主窗口的旧8个source和固定视口保持通过，证据为 `native-ui-v20-jp-canvas.jpg` 与 `native-diagnostics-v20-jp-canvas-final.txt`；但Canvas仅为 `ready=1, matched=0, rendered=0, fallback=0`。模态欢迎页拦截最小文字工具触发，私有合成场景的启动参数也未载入，没有实际命中或可读Canvas行，因此不记动态通过；完整边界见 `candidate-application-v20.json`。

候选语义已逐项收敛：`GraphicsViewportBase` 在该点直接绘制 `to_string` 数值，没有双语来源收益，继续排除；`RenderWindowGLAsync` 只绘制英文字面量 `Waiting for frame...`，font-only Hook不会翻译它，也继续排除。`TrackingTool` 则由 `TextRegistry::textForKey("tool.tracking.hint.clickShape")` 提供明确本地化文本，同一字符串/字体先测宽再绘制。精确偏移、字节、目标和语义见 `abi28-canvas-remaining-candidates-v1.json`。

app21/v13 新增2.8 Graph测宽静态合同：arm64 elide范围为 `0x567054+0x598`，x86_64为 `0x5ffda0+0x640`；两架构均核对elide符号、3个测宽调用点、完整函数摘要和非调用点篡改拒绝。v13 SHA-256 `66798139efa26edc1934113cf5c3db9ecf2d186dafe3830012e57b5d8e106140`，双架构各441 imports、0 unresolved、`@loader_path`、ad-hoc/deep strict及同名重建一致通过。可用 `python3 tools/audit_cavalry_28_graph.py --app '/path/to/Cavalry 2.8 Font Acceptance 18.app' --arch arm64` 或 `--arch x86_64` 复核，结果仅为 `PASS_STATIC_CONTRACT_ONLY`。

默认日文窗口中Graph仅为 `ready=1, measured=0, splitRejected=0, fallback=0`，没有Graph节点，不能记为原生测宽或绘制通过；旧8个source、固定视口、Add Layers与Align保持可见。证据为 `abi28-graph-audit-{arch}-v13-source.json`、`native-ui-v21-jp-graph.jpg`、`native-diagnostics-v21-jp-graph.txt` 和 `candidate-application-v21.json`。

app22/v14 为TrackingTool加入成对measure/draw合同，两架构各核对8个draw和1个measure；测宽与绘制共用run planner，独立measure诊断不改旧计数布局。当前46项目录、15项生成器、6个fixtures及8项Python合同通过。v14 SHA-256 `431964a669f0f63d3b7eb3419e0f35c01fc0d14b879f5230025da8554b1ba546`，双架构各441 imports、0 unresolved、`@loader_path`、ad-hoc/deep strict及同名重建一致通过。默认窗口中draw/measure均ready=1、matched/measured/rendered/fallback=0，TrackingTool未激活，不记原生居中或可读通过；Graph ready、旧source、固定视口及最新日文标签无回归。x86_64/Rosetta另经LLDB确认架构，draw/measure与Graph也均ready=1，旧source和固定视口通过，证据为 `native-ui-v22-jp-tracking-x86_64.jpg`、`native-diagnostics-v22-jp-tracking-x86_64.txt` 和 `candidate-application-v22-x86_64.json`；Rosetta仍不是Intel原生。通用Graph绘制、原生TrackingTool画面、Windows/Intel原生与全界面覆盖仍未完成。

最新v14的简体与繁体启动回归也已补齐：app23默认窗口可见 `添加图层（Add Layers）`、`对齐（Align）`，app24可见 `加入圖層（Add Layers）`、`對齊（Align）`；两者旧8个source均为8/8、固定视口为1/1/1/0，Canvas draw/measure和Graph均ready=1、matched/measured=0。证据为 `native-ui-v23-hans-tracking.jpg`、`native-ui-v24-hant-tracking.jpg`、`native-diagnostics-v23-hans-tracking.txt`、`native-diagnostics-v24-hant-tracking.txt`、`candidate-application-v23.json` 和 `candidate-application-v24.json`。与日文/x86_64一样，只记启动与旧路径通过，不记Tracking原生触发。

Scene Window placeholder也已修正并原生复验：繁体/日语 `Enter a Layer name` 的额外英文后缀触发FP-9，已按同类placeholder约定改为纯 `輸入圖層名稱` / `レイヤー名を入力`，没有放宽检测白名单。首次只换注入器时原生仍显示旧文案，确认font-only读取app内source catalog；随后仅更新app25/26的 `sceneWindow.header.search.placeholder.UI-text`，递归比较证明非UI字段不变。app25/26重开均显示纯译文，旧source、固定视口和Canvas/Graph ready无回归，证据为 `source-placeholder/verification.json`、`native-ui-v25-hant-placeholder.jpg`、`native-ui-v26-jp-placeholder.jpg`、`candidate-application-v25.json` 和 `candidate-application-v26.json`。v15 SHA-256为 `f6a53f8c9d463bb33f08b942383edf6ca9501ab0e66ce771d7f74dd0e3e36630`，同名重建一致。

底部 `graphEditor.footer.label.align` 也不是新缺译：其当前值为 `對齊:（Align:）`。font-only下显示 `Align:`，同一app25开启Qt翻译后原生显示完整 `對齊:（Align:）`，证据为 `native-ui-v25-hant-align-qt-enabled.jpg`。这是font-only英文回退与Qt启用状态的差别，无需修改字段。

默认窗口的Gray经目录与二进制语义核对属于颜色名称：Gray与Gray Asparagus、Alice Blue等颜色名同表，并存在ColorNameProxyModel/ColorNameCompleterDelegate；实际catalog和生成表没有精确UI字段。因此不为覆盖率强行补译，证据为 `gray-semantic-audit-v1.json`。

作为对照，当前2.7.2实例的Save As验收已完成：25个节点、15条连接，0处不一致，原始文件哈希未变，用户值与名称保持原文。该结果只用于2.7.2对照，不能代替2.8验收。

共享代码另做了2.7.2默认路径回归：旧 `audit_macos_canvas.py` 曾误选排在前面的2.8 UUID，现已显式选择无2.8标记的默认分支并加入反例。正式2.7.2两架构各7个Canvas、2个固定视口、3个Graph测宽及viewport-name producer/4个测宽点均通过，见 `default-27-contract-after-v14.json`。默认dist注入器使用Qt6.6.3重建，双架构各441 imports、0 unresolved、`@loader_path`、ad-hoc strict通过，当前SHA-256 `f41510a23ca0825a18d0c4928fbfc413d63d68268a00a06048f9f8ab3be8c99f`，见 `default-build-after-v15.json`；仅在dist，未安装或替换正式宿主，不记新的原生UI验收。

## 覆盖与交付

- 原始语言资产检查、最终产物身份和逐界面宿主证据是不同门槛。
- 系统文件对话框、用户文本/路径/表达式、第三方插件自定义文字应单列，不强制写译文进用户值。
- 最终原生环境、2.8 迁移及界面门槛完成后，才替换用户约定的本地安装入口；保留回滚、正常退出、核对最终包，再按授权进入发布流程。
