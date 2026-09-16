# DESIGN.md — Cavalry Bilingual GUI 设计规范(实现版)

> 面向下一版本的修改者(人类或 AI)。本文描述 **当前 GUI 的真实实现**,所有数值以代码为准
> (来源:`gui/ui/src/tokens.css`、`styles.css`、`App.tsx`、`sections/*.tsx`、`PaperArt.tsx`、`api.ts`、
> `gui/src-tauri/tauri.conf.json`)。与 MindMarket 参考文档(DESIGN_new.md)的差异见 §7。

## 1. 设计概览

**定位**:macOS 桌面工具(System Settings / Raycast 式三件套)× MindMarket 奶油纸质基因。

三条核心原则:
1. **单导航** — 侧栏是全站唯一"当前区"指示器;无顶部切换条、无路由库,四区 state 切换。
2. **暖色 monochrome + 双点缀色** — 奶油底 + 墨绿黑文字 + 暖灰结构线;绿 `#8ed462` 只作结构色,珊瑚 `#ff705d` 只作主按钮填充。
3. **无阴影、无渐变** — 层级全靠奶油→白的面色差与圆角;全站唯一阴影属于 Toast。

## 2. Design Tokens

### 2.1 颜色

| Token | 值 | 角色 | 允许 / 禁止 |
|---|---|---|---|
| `--color-cream-paper` | `#f5f1e4` | 页面画布、侧栏、底条 | 禁止纯白做页面底 |
| `--color-pure-white` | `#ffffff` | 顶栏、浮起卡、segmented 轨道、胶囊 | 仅 elevated 表面 |
| `--color-ink-black` | `#2c2e2a` | 全部主文字、toast 底 | 禁止纯黑大段文字 |
| `--color-stone-gray` | `#80827f` | 弱化文字、未选中侧栏、ghost 文字链 | — |
| `--color-hairline-mist` | `#ddd6c4` | **全站唯一结构线色**(暖灰) | 顶栏/侧栏/底条分割线、胶囊边框、segmented 边框、输入框、开关 off、骨架条、备份行分割线;禁止第二结构线色 |
| `--card-border` | `#ece5d3` | 白卡描边(暖调,白与奶油之间) | 仅 `.card`/`.backup-list` |
| `--color-sandstone` | `#e0dbce` | **只允许**:忙碌禁用按钮、确认条、备份行确认态 | 禁止其他用途 |
| `--color-fresh-grass` | `#8ed462` | **只允许**:logo、刷新按钮、选中态(绿条/绿图标/segmented 拇指环)、开关 on、状态点 | 禁止大面积填充与正文 |
| `--color-coral-pop` | `#ff705d` | **只允许**:主操作按钮填充 | 禁止其他任何地方 |
| `--color-sky-pop` / `--sunshine-pop` / `--pure-ink` | — | (声明但 UI 未使用;仅 PaperArt 用蓝/黄) | 插画装饰除外 |

### 2.2 字体

| 项 | 实现 |
|---|---|
| 拉丁/数字 | `'Inter Variable'`(@fontsource-variable/inter,构建内嵌 woff2) |
| CJK | `'MiSans GUI'` — MiSans 子集,`src/fonts/MiSans-{Regular,Medium}.woff2`,65.5KB / 65.7KB,仅 400/500 两档,`font-display: swap` |
| 字体栈 | `'Inter Variable', 'MiSans GUI', 'Inter', ui-sans-serif, system-ui, …`(逐字形回退,拉丁走 Inter、CJK 走 MiSans) |
| tabular-nums | body 级 `font-variant-numeric: tabular-nums`(时间戳/版本/哈希对齐) |
| 中文标题 | **禁止负字距**(CJK 会挤);30px hero 与 20px 预览标题 tracking=0 |
| 行高 | CJK 正文/说明/日志 **1.65**;紧凑展示元素(meta cell、segment、侧栏)1.4;hero 1.15 |

字号阶梯(只有这几档):11 label/tooltip/底条/chip · 12 meta/toast/日志/时间戳/ghost 链 · 13 正文小/侧栏/文字链/主按钮 · 14 正文/meta value · 15 wordmark/区标题 · 20 预览卡标题 · 30 状态页状态句。字重仅 400/500。

**MiSans 再生成**(字符集脚本已入仓 `gui/ui/scripts/build-charset.py`;/tmp 副本易失,以仓库为准):
1. 下载 `https://hyperos.mi.com/font-download/MiSans.zip`(免费商用),取 `ttf/MiSans-Regular.ttf`、`MiSans-Medium.ttf`;
2. `cd tools-local && ./uv-bin/uv venv font-venv && ./uv-bin/uv pip install --python font-venv/bin/python fonttools brotli`;
3. `python3 gui/ui/scripts/build-charset.py` → 输出 charset.txt(扫描 ui/src 全部源码的 CJK/全角标点 + 6 样张 + cbpatch 后端错误串 + 常用字兜底,约 586 字);
4. `pyftsubset MiSans-$W.ttf --text-file=charset.txt --flavor=woff2 --layout-features='*' --no-hinting --desubroutinize --output-file=gui/ui/src/fonts/MiSans-$W.woff2`。

### 2.3 圆角(全站仅允许这些值)

| 值 | 用于 |
|---|---|
| 50px | pill 按钮、状态胶囊、segmented 拇指 |
| 26px | 状态摘要卡、排版预览卡 |
| 24px | 其他全部白卡(`.card`、`.backup-list`) |
| 12px | 侧栏项、segmented 轨道、开关轨道 |
| 10px | chip、输入框、确认条、toast、备份行、工具栏 logo |
| 8px | tooltip |

### 2.4 间距(`:root` 变量,全站强制)

| 变量 | 值 | 语义 |
|---|---|---|
| `--gap-title-desc` | 6px | 区标题 → 区描述 |
| `--gap-desc-card` | 16px | 区描述 → 首个卡 |
| `--gap-card-card` | 12px | 卡 → 卡 |
| `--gap-card-actions` | 16px | 卡 → 后续无卡操作区 |
| `--gap-actions-details` | 12px | 操作区 → 技术细节链接 |

卡 padding 16;卡内区块 12–16;技术细节展开行距 8;日志行距 10;内容区 padding 16(<700px 为 12)。

## 3. 布局结构

窗口 880×620(min 700×460,`hiddenTitle: true` 隐藏原生标题、背景 #f5f1e4)。自上而下:

1. **顶栏 44px** 白底 + 1px hairline:左 = 20px 绿底圆角(10px)CB logo + "Cavalry Bilingual" 15px/500;右 = 状态胶囊(白 pill + 1px hairline + 8px 状态点 + 12px 文字)+ 28px 绿色圆形刷新按钮。
2. **主体行**:侧栏 + 内容区(flex:1)。
3. **底条 22px** 奶油底 + 顶部 1px hairline:左 "v0.2.0"、右 "仅供学习用途 · 与 Scene Group 无关",11px #80827f。

侧栏 190px:四项(状态/排版/备份/日志)= 16px 实心几何图标(圆/方/三角/菱形)+ 13px 文字,行高 36px、项间距 4px。

内容区:可滚动;`.view` width 100% / **max-width 720px** / `margin: auto`(内容矮于视口时**垂直居中**,超出回顶部对齐滚动);每区结构 = 区标题行(15px/500 + 右侧可选操作)→ 6px → 12px #80827f 描述 → 卡片区。

响应式断点:

| 断点 | 行为 |
|---|---|
| ≥880px | 现状布局;侧栏文字+图标;侧栏 tooltip 隐藏 |
| 700–879px | 侧栏收窄 64px 纯图标列(tooltip 显示区名) |
| <700px | 侧栏仍保持 64px 图标列(单导航,无顶部切换条);内容卡全宽、padding 12 |
| 高度 <540px | 顶栏收缩 36px;内容区滚动;底条不变 |

## 4. 组件目录

**状态胶囊** — 白底 pill + `0 0 0 1px` hairline + 8px 圆点(已应用=绿 / 未应用·未检测=灰)+ 12px #2c2e2a;刷新中圆点 opacity 呼吸(`dot-pulse` 1s)。

**侧栏项** — 36px 行高、半径 12;未选中 #80827f(图标 `color: inherit` 严格同文字色);hover 浮白卡 150ms;选中 = 白卡 + 左侧 2px 绿条(`::before` scaleY 滑动 180ms,无布局位移)+ 图标转绿。

**内容卡** — 白底 + 1px `--card-border` + 24px(摘要/预览卡 26px)圆角 + 无阴影。

**珊瑚主按钮** — pill 50、padding 8/18、13px/500 白字、6px 白点;hover `brightness(0.96)`、active `scale(0.97)`、focus-visible 2px 绿描边外环;忙碌 = 砂岩底 #80827f 字 + 圆点转旋转环(0.7s)。

**ghost 文字链(.inline-link)** — 12px #80827f + 1px 同色 border-bottom;hover 转 #2c2e2a(150ms)。"查看备份 →"、备份行"还原"、技术细节均用它。

**segmented** — 白轨道 + 1px hairline、半径 12、padding 4;选中 = 滑动白拇指(50px 圆角 + `0 0 0 2px` 绿环,`translateX` 200ms)。宽度参数化:`--segments`(容器内联变量,模板选择器 3、区切换 4 已删);拇指宽 `(100% - 8px) / var(--segments)`,位移 `4px + 索引 × 段宽`(transform 百分比相对拇指自身宽)。文字 12px,未选中 #80827f、选中 #2c2e2a,始终在拇指上层。

**iOS 开关** — 40×24、轨道 off=`#ddd6c4`/on=绿;knob 18px 白圆滑动 `cubic-bezier(0.3,1.2,0.4,1)` 220ms。

**技术细节 ghost 折叠** — "技术细节" 12px #80827f 文字链 + chevron(展开旋转 90°);展开区无卡无底色直接落奶油底,三行 label #80827f + **等宽 12px** 值(签名标识/dylib 摘要/最新备份),行间 8px。

**备份行** — min-height 34px、半径 10、行间 1px hairline;hover 奶油底高亮 150ms;左 12px 时间戳(tabular)+ 版本 chip(奶油底 10px 圆角 11px 字)+ 类型;右"还原"文字链;行内确认 = 整行变砂岩底条(12px 文字 + 确认/取消)。

**日志行** — 12px tabular 时间戳 + 12px 内容(多行悬挂缩进),行距 10;底部说明 12px #80827f,与条目间 1px hairline(margin/padding-top 12)。

**Toast** — #2c2e2a 底、10px 圆角、白字两行(12px/500 标题"已完成/失败" + 12px 内容);**全站唯一阴影** `0 8px 24px rgba(0,0,0,.12)`;右上角滑入 200ms,3.5s 自动消失,最多堆叠 4 条。应用/还原/保存配置的成功与失败全部走 toast。

**骨架屏** — 14px 砂岩…(实为 `#ddd6c4`)条、10px 圆角、opacity 呼吸 1.1s 交错 150ms;**禁止渐变 shimmer**。status 首载未返回时占位于摘要卡。

**tooltip** — `[data-tip]::after`:11px 白字 #2c2e2a 底、8px 圆角、150ms 延迟淡入;用于刷新按钮与窄侧栏图标列(≥880px 侧栏 tooltip 关闭)。

**EmptyState** — PaperArt idle 变体 72px + 13px #80827f 文字,居中;用于备份空态与日志空态。

**PaperArt 插画**(`src/PaperArt.tsx`,纯手写 SVG、无图标库/渐变)—— 圆角色(眼+笑弧/闭眼+平嘴)+ 斜杆双三角旗 + 四角星 + 圆点,#2c2e2a 粗轮廓。`applied`=绿角色+珊瑚/蓝旗+黄星;`idle`=全灰调。位置:状态摘要卡右侧 140px(随状态切换变体);空态 72px。

**确认条** — 砂岩底条、10px 圆角、12px 文字 + 确认(#2c2e2a 文字链)/取消(ghost);高度用 `grid-template-rows: 0fr→1fr` 展开 200ms;忙碌时文字换"正在…"且隐藏按钮。

## 5. 交互与动效总表

所有过渡 150–250ms ease,无阴影无渐变。区切换 = 内容区 fade + translateY(6px) 180ms(`.view` key 重挂载);segmented 拇指滑动 200ms;侧栏绿条滑动 180ms;开关 knob 弹性 220ms(cubic-bezier(0.3,1.2,0.4,1));列表 hover 高亮 150ms;capsule 绿点呼吸 1s;确认条展开 200ms;toast 滑入 200ms。

## 6. 数据与工程

- **Mock 模式**(`api.ts`):检测 `__TAURI_INTERNALS__` 缺失即返回内置 fixture(状态 ours/2.7.2、备份 3 条、config `{zh}（{en}）`、build_info 含 dylib sha12),导出 `isMock`;App 在 mock 下种子 4 条日志。普通浏览器打开即完整渲染。
- **Hash 深链**(`App.tsx`):初始区读 `location.hash`(#status/#type/#backup/#log),`hashchange` 同步,`setView` 用 `replaceState` 回写;供截图脚本定位。
- **截图管线**:`cd gui/ui && npm run shot`(build → vite preview :5199 → Playwright chromium,三档 viewport 880×620 / 760×540 / 1280×800 × 四区 = **12 张** → `gui/feedback_auto/<section>_<w>x<h>.png`;fonts.ready + 700ms 后截图)。chromium 走 `PLAYWRIGHT_DOWNLOAD_HOST=https://cdn.npmmirror.com/binaries/playwright` 镜像。
- **Tauri 命令**(7 个,`gui/src/commands.rs`):`get_status`(未装返回 detected:false)、`apply_patch`(语言取 composer config)、`restore_backup`(空串=最新;任选目录还原的流程在 GUI 侧用 cbpatch 原语复刻)、`list_backups`、`get_config`、`save_config`(校验 lang/占位符,原子写)、`get_build_info`(dylib 存在+sha256 前 12 位+config 摘要)。
- **窗口**:`hiddenTitle: true`(原生标题隐藏,工具栏承担标题职责);`tauri.conf.json` 是唯一真源。

## 7. 修改指南

| 想改什么 | 下手处 |
|---|---|
| 颜色 | `tokens.css` 变量(注意 §2.1 的允许/禁止约束) |
| 间距节奏 | `styles.css :root` 的 `--gap-*` 五个变量 |
| 新增一个区 | 三处:`App.tsx` NAV_ITEMS + `viewFromHash` 白名单 + `sections/X.tsx`(套 SectionHeader + `.view` gap 布局) |
| 改文案/加文案 | 改后重跑 `python3 gui/ui/scripts/build-charset.py` 并重做 MiSans 子集,否则新汉字缺字形 |
| 验证 | `npm run shot` 重出 12 张自查;真机 `npm run tauri:build` 后 `open` |

**与 MindMarket 参考(DESIGN_new.md)的差异清单**(本实现的取舍,改前请对照决策):
- 卡片圆角 24/26px,非参考的 50px(50 只保留给 pill);无 63.75px 插画容器。
- 无黄色 #f5e211 footer 横带 → 22px 奶油细条;无浮起 pill 导航 → 44px 工具栏 + 侧栏。
- 无 53/81/140px display 标题 → 30px 状态句 + 20px 卡标题为最大字号。
- 结构线色 #d5d5d4(冷)→ **#ddd6c4(暖)**,并新增卡边框 #ece5d3(参考文档没有)。
- 字体为 Inter Variable + MiSans GUI 双字体混排(参考只有 Inter);行高 1.65(参考 1.5);中文标题零负字距。
- 绿/珊瑚/砂岩的用途被收紧为"仅结构/仅主按钮/仅禁用与确认条"(参考中绿可作 nav 描边大面)。
- 布局为桌面三件套 + 720px 限宽居中(参考为全出血编辑排版),密度 compact。
