# Changelog

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
The current candidate has partial native macOS arm64 Cavalry 2.7.2 / Qt 6.6.3 evidence. Dependency-graph node/port drag/drop, complete UI coverage, strict per-script font selection, Cavalry 2.8.0 / Qt 6.9.2 adaptation, Windows packaging/runtime and final release acceptance remain open. User project switching interrupted final native acceptance; the live project was left untouched. See `docs/COMPATIBILITY.md`.
