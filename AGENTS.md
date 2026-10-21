# Cavalry Bilingual — Agent entry

Read [docs/PROJECT-CONTEXT.md](docs/PROJECT-CONTEXT.md) first. It is the compact, public handoff for architecture, original intent, requirement evolution, blockers, solutions, commands, and current release boundaries. Read [DESIGN.md](DESIGN.md) before changing UI.

A machine-local `PROJECT.md` may exist but is intentionally ignored by Git. If present, read only its current top section for local paths, installed artifacts, and private evidence; never commit it or its referenced private material.

## Non-negotiable boundaries

- Preserve English source text and user values. Do not translate editable values, custom layer names, paths, expressions, port IDs, or connection data.
- Treat `translations/pristine/` and `assets/cavalry-28/` as source inputs. Do not hand-edit generated `translations/working/`, `tools/*.ts`, `dist/`, `build/`, `gui/runtime/`, or `gui/target/`.
- Keep Cavalry 2.7.2 / Qt 6.6.3 and 2.8.0 / Qt 6.9.2 contracts separate. Unknown versions, UUIDs, resources, or call sites must fail closed.
- Save before mutation, preserve a restorable snapshot, use atomic writes, and verify rollback. Never force-quit Cavalry or modify a real project for a test.
- Keep source, public documents, synthetic tests, installers, and private evidence separate. Do not upload `.env`, mailbox authorization codes, EmailJS Private Keys, real logs, personal paths, or private-testing material.
- Do not claim Windows, Intel, full-UI, or all-version acceptance from cross-builds, static checks, Wine, or Rosetta. Record compiled, package-verified, simulated, and native-host evidence separately.
- Do not push, tag, create a release, change repository metadata, or update installed skills unless the user has authorized that action.

## Fast commands

```bash
npm ci --prefix gui/ui
npm test --prefix gui/ui
cargo test --manifest-path gui/Cargo.toml
cargo check --manifest-path gui/Cargo.toml --target x86_64-pc-windows-gnu
cargo test --manifest-path patcher/Cargo.toml
npm run test:catalog28
npm run test:generator
npm run test:translations
python3 tools/audit_release.py self-test
```

Use `npm run build:macos-universal` for a local macOS build after setting the required Qt environment. Windows build and acceptance entries are in [docs/NATIVE-ACCEPTANCE.md](docs/NATIVE-ACCEPTANCE.md).

## Release and documentation map

- Current release: `v0.1.0-preview.3` (pre-release, not stable).
- Release notes: [docs/RELEASE-0.1.0-preview.3.md](docs/RELEASE-0.1.0-preview.3.md)
- Compatibility: [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md)
- Feedback security: [docs/FEEDBACK-SERVICE.md](docs/FEEDBACK-SERVICE.md)
- Release privacy scanner: `python3 tools/audit_release.py self-test`

When behavior, architecture, commands, or release boundaries change, update `docs/PROJECT-CONTEXT.md`, `CHANGELOG.md`, the relevant README section, and the local handoff in the same iteration. Do not copy entire chat logs into the repository.
