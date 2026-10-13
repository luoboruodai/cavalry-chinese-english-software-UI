# Changelog

## 未发布 · 2026-10-14 · 输入安全与 DG 测宽候选

- 修复真实宿主中的数据写回回归：QLineEdit 不再翻译提交值，移除 textChanged 改写及 Time Editor 反向模型值归一化；可编辑列表/树/表格项不做文本写回。Windows 同步输入边界，但未原生验收。
- 真实测试先复现图层名被错误写成双语，再验证修复后英文及长中文名称在保存的 `.cv` 中逐字保持。
- Lina 三条 exact 测宽 caller 共用 Canvas 字体/回退规划，并校验完整函数 SHA-256；拒绝省略循环中切断 Unicode scalar 的候选。原始宿主的长中文节点样例已真实命中。
- 修正 7 条节点输入/移除提示，补充 3 条菜单用语；新增输入 delegate 提交、2,008 组边界/宽度及摘要拒绝测试。
- 工具与宿主更新为本轮候选，保留回滚；正式文件名构建并核对最终 runtime，防止临时库名签名引起更新误报。
- **未完成：** Scene Tree 真实拖入、端口展开/连线、视口中文图层名方框、时间线该长名称缺字、全界面覆盖、2.8.0、Windows/Intel 实机。未推送、打标签或发布。


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
The current candidate has partial native macOS arm64 Cavalry 2.7.2 / Qt 6.6.3 evidence. Dependency-graph node/port drag/drop, complete UI coverage, strict per-script font selection, Cavalry 2.8.0 / Qt 6.9.2 adaptation, Windows packaging/runtime and final release acceptance remain open. The October 14 continuation verified input-name preservation and a long CJK DG title in an isolated scene on the original host. Scene-tree drop and port connections remain unaccepted; viewport-name tofu and the long timeline-name rendering are also still open. See `docs/COMPATIBILITY.md`.
