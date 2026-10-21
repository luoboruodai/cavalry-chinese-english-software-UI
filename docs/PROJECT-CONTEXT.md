# Cavalry Bilingual — Project context for agents and maintainers

**Current public snapshot:** `0.1.1`, 2026-10-21. This is the stable release; its release identity is not a full-coverage claim.

This document is the compact public handoff. It preserves the original intent, current architecture, requirement evolution, difficult failure modes, and the checks that matter. A machine-local ignored `PROJECT.md` may contain additional private evidence and exact local paths; it is not required to understand the repository and must never be uploaded.

## 1. Original intent and product shape

The project began with a practical learning problem: Cavalry users following English tutorials should see Chinese explanations without losing the original English labels. The design therefore uses **Chinese + English together**, not a language switch that hides the source text.

Three constraints remain foundational:

1. **Translate presentation, never user content.** Editable values, layer names, paths, expressions, IDs, and connections must remain unchanged.
2. **Make every mutation recoverable.** Version/resource guards, snapshots, atomic writes, and rollback are product features, not optional hardening.
3. **Keep the manager calm and readable.** The desktop UI uses a cream-paper surface, warm-gray structure, green status accents, and coral only for primary actions. Technical detail is progressive disclosure, not a wall of tiny text.

The current Tauri manager is not the Cavalry host. It detects supported installations, manages typography/settings, applies or restores verified resources, shows operation logs, and prepares optional feedback reports.

## 2. Current public capabilities

- Chinese-English presentation for supported Cavalry surfaces.
- macOS Cavalry 2.7.2 / Qt 6.6.3 and 2.8.0 / Qt 6.9.2 paths with separate injection resources.
- Typography order and font drafts, preview before save, system-font fallback.
- Snapshot creation, verified restore, backup management, and local operation logs.
- Universal macOS manager build and Windows x64 NSIS package.
- Native installation-directory selection for Windows folders containing `Cavalry.exe` and valid macOS Cavalry `.app` bundles, with validated persistence and full-path display.
- User-initiated report preview, redaction, local export, and accepted-send rate limits.
- The same EmailJS browser-send or local-save feedback flow on macOS and Windows; neither platform is hardcoded to export-only.
- Shared right-side notices; the report-delivery explanation appears automatically when entering report preview, with no extra info button.

Do not infer full translation coverage from catalog counts or a successful startup. General Canvas/Graph/TrackingTool coverage, native Intel, native Windows/MSVC, and real Windows Cavalry acceptance remain separate gates.

## 3. Repository map

| Path | Responsibility |
|---|---|
| `gui/ui/` | React + TypeScript desktop UI, shared components, browser mock tests, Tauri build wrappers |
| `gui/src/` | Tauri commands, settings, backups, updates, report drafts, send-rate state |
| `gui/src-tauri/` | App metadata, CSP, platform bundle resources and icons |
| `patcher/` | Version/target checks, snapshots, transactions, atomic writes, platform operations |
| `injector/` | macOS injection, Qt text presentation, producer-specific measure/draw adapters |
| `assets/cavalry-28/` | Versioned Cavalry 2.8 source catalogs and manifest |
| `translations/pristine/` | Translation source inputs |
| `composer/` | Offline language-asset generation |
| `tools/` | Build, catalog, ABI, translation, release-privacy and audit tools |
| `tests/` | Generator, translation, catalog and synthetic host contracts |
| `docs/` | Public compatibility, native acceptance, feedback security, release notes and this handoff |
| `DESIGN.md` | Current visual and interaction specification |

Generated or local-only paths include `translations/working/`, `dist/`, `build/`, `gui/runtime/`, `gui/target/`, `gui/ui/dist/`, and `private-testing/`. Do not treat them as source truth or upload them automatically.

## 4. Runtime and data flow

### macOS

1. The Tauri UI calls Rust commands to resolve the current Cavalry target and verify version/resources.
2. The patcher creates a verified snapshot before changing supported resources.
3. Cavalry 2.7.2 and 2.8.0 use separate Qt injection contracts. The 2.8 path also requires its versioned source catalogs.
4. The manager checks the resulting state by content, not by signature bytes alone.
5. Restore selects a specific snapshot and preserves the current state first.

### Windows

The manager uses default and user-selected Windows target resolution plus the generic/QPA DLL payload. A custom directory must be absolute and contain `Cavalry.exe`; cancelling or rejecting a selection preserves the confirmed target. Cross-building and NSIS packaging are reproducible on macOS, but they do not prove native Windows installation, WebView2 behavior, or real Cavalry injection. Native Windows acceptance remains required.

### Feedback

1. The user writes a description and chooses whether to include up to 20 manager-operation records.
2. Rust creates a bounded, redacted preview containing only approved report fields.
3. The user reviews the exact content. Opening or closing the dialog never sends it.
4. EmailJS delivery uses the Tauri browser view and exact CSP origin. Rust owns the approved draft, local report, and persistent send-rate checks.
5. No mailbox password, SMTP authorization code, EmailJS Private Key, non-browser API, SQL database, or automatic telemetry is used.

Accepted by the provider is not a guarantee of mailbox delivery. The local limiter is abuse resistance, not a defense against a user deliberately modifying their own client.

## 5. Requirement evolution and design decisions

### Bilingual content

- Retain English for tutorial matching; do not replace it with Chinese-only text.
- Bind translations to observed UI fields and producers. Do not add dictionary entries merely to raise a count.
- Placeholder and color-name semantics require field-level judgment; not every English word is a translatable UI label.
- Composite tool hints may need a dedicated combined template. Translating prefix and action independently can produce unreadable concatenation.

### Manager UI

- Use one shared secondary-button style for cancel actions. Do not autofocus cancel: initial focus belongs on the title or the description input, while keyboard Tab still shows a visible focus ring.
- Move low-priority status and explanatory copy into right-side notifications; keep destructive and send confirmations explicit.
- Use the shared `ToastNotice` for the report-delivery explanation. It appears automatically on entering preview, has no manual info trigger or reserved blank area, and inherits the main notification motion and timing.
- Keep provider names, HTTP status, dashboard configuration, OS, and CPU architecture out of user-facing report copy. If the user does not approve collecting a field, remove it from the actual payload as well as the visual summary.
- Preserve the current draft when upgrading or restarting for verification. Never send, clear logs, apply patches, or save settings merely to make a UI test look complete.

## 6. Blockers, root causes, and reusable solutions

| Blocker / misleading symptom | Root cause | Solution and verification |
|---|---|---|
| Cavalry 2.8 writes fail with `EPERM` after a tool update | macOS App Management can reset for the updated tool; the first process may still be denied | Obtain explicit user permission, enable App Management, restart the tool, then retry once. Include path/permission guidance in errors and never loop unauthorized writes |
| Reusing the 2.7 injector on 2.8 fails or is unsafe | Qt 6.9.2 ABI, UUIDs, call sites, and source catalogs differ | Use the dedicated 2.8 injector and versioned assets; verify imports, UUIDs, call sites, and file identity before enabling writes |
| Translated tool hints become glued or unreadable | Prefix and action are translated independently and then concatenated | Add an observed combined presentation for the exact source; verify the whole rendered line, not just catalog presence |
| font-only output and Qt-enabled output disagree | The host also reads its embedded source catalog | Update the appropriate source catalog and injector together; compare non-UI fields and verify both modes |
| Applied resources look “changed” after re-signing | Signature bytes are included in a naive file hash | Compare unsigned Mach-O content/state and verify actual runtime status |
| Cancel shows a double border or green ring on dialog open | Inconsistent button class plus automatic focus | Share the secondary-button style, focus the title/description instead, and test keyboard-only focus separately |
| A right-side report toast is clipped by the dialog | A transformed dialog becomes the fixed-position containing block and `overflow:hidden` clips the child | Allow scoped overflow, preserve footer radius, and test the close control with viewport geometry plus `elementFromPoint`; finally reuse the shared toast component |
| Report UI hides technical fields but the report still contains them | Presentation filtering was mistaken for data minimization | Remove unapproved fields from the serialized preview and test the actual JSON |
| EmailJS reports non-browser API or credential failures | Wrong API surface or private/public key confusion | Use the browser `fetch` flow only, exact CSP origin, public browser configuration, and no Private Key; keep the SMTP authorization code only in the provider dashboard |
| Retrying can send duplicates or confuse acceptance with delivery | Ambiguous transport state and missing persistent rate state | Bind sends to the approved draft ID, count only accepted sends, persist 60-second/daily limits, and describe provider acceptance honestly |
| Windows package exists but cannot be called native-accepted | Cross-compilation, NSIS generation, Wine, and native Windows are different evidence levels | Stage target-specific resources, inspect NSIS with 7-Zip, compare payload hashes, attempt Wine separately, and leave native Windows/MSVC/host checks explicit |
| Windows compilation fails while an installer still appears | The cross-NSIS fallback reused an outdated `installer.nsi` and masked the real compile error | Refuse fallback unless the script was generated by the current build; keep Windows-only path selection behind `cfg`, then verify the new PE and every packaged resource |
| Windows startup reports missing `TaskDialogIndirect` | The PE imports the Comctl32 v6 API but has no manifest, leaving Windows on the older common-controls path | Embed an `asInvoker` Common-Controls v6 manifest only for Windows, verify the PE resource directory and embedded XML, and inspect the same payload inside NSIS |
| Windows cannot select Cavalry on another drive | Detection only covers default locations | Use the official Tauri directory picker, validate an absolute directory containing `Cavalry.exe`, persist the confirmed target, and preserve the old target on cancel or invalid input |
| Windows feedback offers only local export | Non-macOS delivery was hardcoded to export | Use the same reviewed EmailJS browser flow as macOS when no ingestion DSN is configured, with local export retained and no private credential added |
| A release leaks local paths or private evidence | Source, index, history, and packages were treated as one scope | Scan each scope independently with `tools/audit_release.py`, use explicit file allowlists, inspect actual archive members, and never print suspected secrets |

## 7. Build and test quick reference

```bash
npm ci --prefix gui/ui
npm test --prefix gui/ui
cargo test --manifest-path gui/Cargo.toml
cargo test --manifest-path patcher/Cargo.toml
npm run test:catalog28
npm run test:generator
npm run test:translations
npm run test:macos-canvas
python3 tools/audit_release.py self-test
python3 tools/test_windows_comctl32.py
```

Useful audits:

```bash
npm run audit:translations
CAVALRY_28_ASSETS=/path/to/Cavalry.app/Contents/assets npm run audit:catalog28
python3 tools/audit_release.py source
python3 tools/audit_release.py index
```

For a local macOS Universal build, install both Rust targets, set `CAVALRY_QT_PREFIX`, then run `npm run build:macos-universal`. Windows native and cross-packaging commands are in `docs/NATIVE-ACCEPTANCE.md`.

A green test suite is not a release by itself. Freeze the source commit, build and inspect each installer, scan source/index/package scopes, create SHA-256 manifests, upload only reviewed attachments, then download and byte-compare the release assets.

## 8. Current release boundaries

- Version 0.1.1 supplies a macOS Universal DMG and Windows x64 NSIS installer as a stable release with the same explicit coverage boundaries.
- macOS packages are ad-hoc signed and not notarized.
- Windows packages are unsigned and require WebView2; cross-build/package checks do not replace native Windows acceptance. The earlier Wine silent-install attempt timed out after 90 seconds without creating the target directory and is explicitly incomplete.
- Rosetta is not native Intel. Synthetic hosts are not full Cavalry projects.
- Cavalry 2.8 progress does not make every surface or Qt contract compatible.
- Historical releases remain unchanged. Do not move old tags or overwrite their assets.

## 9. Maintenance protocol

When behavior or architecture changes:

1. Update the smallest relevant source and tests.
2. Preserve original intent and record superseded requirements rather than rewriting history.
3. Update this file, `CHANGELOG.md`, the relevant README/compatibility section, and the local handoff.
4. Keep private screenshots, logs, email configuration, exact local paths, and raw chat out of the public repository.
5. Record what was compiled, executed, package-verified, simulated, and natively accepted as separate facts.
