# languages/
> L2 | 父级: ../CLAUDE.md

成员清单
en/: 英文基线语言包，作为 38 个 JSON surface 的 source truth 与 structure parity 参照，并吸收已核实的 Windows 2.7.2 平台节点。
zh-Hans/: 简体中文语言包，覆盖 38 个 JSON surface，翻译用户可见说明/属性/枚举与 Windows 平台增量，并保留 API/type/ID/niceName 等模型身份字段。
zh-Hant/: 繁体中文语言包，覆盖 38 个 JSON surface，保持繁体术语、Windows 平台增量、技术字段与模型 niceName 原样、简繁纯度。
ja_JP/: 日文语言包，覆盖 38 个 JSON surface，遵守カタカナ优先，翻译 Windows 平台增量并保持 API 技术字段与模型 niceName 原样、零混合语言原则。

依赖边界:
JSON 语言包不承载代码逻辑；本分支宿主资源组合由 `patcher/src/assets.rs` 按 nodeType 与字段集合匹配，只修改其已声明展示字段。原始包用于身份/结构与质量校验；三语 Qt/injector 来源为 `translations/pristine/`，不得将 tools 派生副本当真源。`Learn/Guides/strings.json` 的 `value` 保存三语内容，但 `language` 保持 `en`，因为当前目标宿主把它当固定 catalog 加载槽位而非内容语言。`niceName` 是 Time Editor 与图层模型复用的身份词，必须与 `en/` 保持一致；被 Time Editor 复用的动态属性数据也保持英文，Qt 显示层由 TS/injector 翻译；需给已知宿主 nodeStrings 加双语类型标题时，patcher 从独立 `translations/pristine/model_display_translations.json` 做展示投影，禁止把译名重新写进原始语言包，亦不处理用户场景。已核实的平台增量必须同步写入 English 与三语包；尚未知的安装端节点由 patch overlay 原样保留。质量由 `tools/validate_translations.py` 与 §P5 detector 守门，不得通过改 whitelist 掩盖漏翻。

法则: 结构同构·字段分层·Guide 固定 en 槽位·niceName 英文·三语同步·禁止半翻译

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
