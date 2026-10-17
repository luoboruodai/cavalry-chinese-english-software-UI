# Cavalry Bilingual

[简体中文](README.md) | **English**

A Chinese-English UI tool for Cavalry. It displays Chinese alongside the original English to help users follow English tutorials, with typography settings, restorable patches, and backup management.

> **Development candidate 0.1.0.** No formal Release installer is currently published. Full-UI, all-version, and all-platform compatibility are not claimed.
> Not affiliated with Scene Group or Cavalry. No Cavalry, Qt, or Skia host binaries are redistributed.

## Platform status

| Platform / host | Current status |
|---|---|
| macOS arm64 · Cavalry 2.7.2 / Qt 6.6.3 | The tool is installed locally and has selected real-host validation; this is not full-UI acceptance. |
| macOS universal | The tool and injector build for arm64 + x86_64. Most x86_64 execution evidence uses Rosetta; native Intel hardware remains unverified. |
| Cavalry 2.8.0 / Qt 6.9.2 | Isolated copies have evidence for selected strings, Paths, and fixed viewport hints. Production writes remain blocked; general Canvas/Graph, TrackingTool, and full-UI coverage are incomplete. |
| Windows x64 | Cross-build, Wine, and DLL-loading tests exist. Native Windows, MSVC, NSIS, and a real Cavalry host remain unverified. |

See the [compatibility and coverage matrix](docs/COMPATIBILITY.md) for exact boundaries. Rosetta, Wine, static ABI checks, synthetic tests, and real-host validation are different kinds of evidence.

## Features

- **Chinese-English display**: keeps the original English beside Chinese labels for easier tutorial matching.
- **Typography and fonts**: configure display order and font families with a preview; an empty font follows the system.
- **Restorable patches**: creates validated snapshots before applying changes and restores to selected snapshots.
- **Input safety**: preserves user input, custom layer names, paths, expressions, port IDs, and connection data; only UI presentation fields are translated.
- **Fail-closed compatibility**: unknown host versions, Qt ABIs, UUIDs, or call sites remain disabled instead of being forced.

## Download and installation

No formal Release installer is currently published. GitHub's automatic **Source code** archives are for source review and building; they are not installer packages.

### Build the macOS universal tool from source

Requirements: Node.js, Python 3.10+, Rust, macOS developer tools, a Qt 6.6.3 SDK, and both Rust macOS target libraries.

```bash
git clone https://github.com/luoboruodai/cavalry-chinese-english-software-UI.git
cd cavalry-chinese-english-software-UI

npm ci --prefix gui/ui
rustup target add aarch64-apple-darwin x86_64-apple-darwin
export CAVALRY_QT_PREFIX=/path/to/Qt/6.6.3/macos
npm run build:macos-universal
```

Output:

```text
gui/target/universal-apple-darwin/release/bundle/macos/Cavalry Bilingual.app
```

Local builds use ad-hoc signing and are not notarized. Do not describe them as notarized distribution packages. See the [native acceptance guide](docs/NATIVE-ACCEPTANCE.md) for Windows build entry points and acceptance requirements.

## Usage

1. **Save your project and quit Cavalry yourself.** The tool does not auto-save or force-quit the host.
2. Open Cavalry Bilingual, adjust display order and fonts under Typography & Fonts, review the preview, and save the settings.
3. Refresh detection on the Status page. Apply is enabled only when the host version, resources, and safety contracts match.
4. Relaunch Cavalry after applying.
5. To roll back, select the corresponding snapshot. **Restore returns to that snapshot; it does not necessarily mean a factory English state.** The current state is also preserved before restoration.

Old backups without a complete validation manifest are read-only and must not be restored automatically. Do not overwrite host files while Cavalry is running.

## Tests and audits

```bash
npm test --prefix gui/ui
cargo test --manifest-path patcher/Cargo.toml
bash tools/test_qt_runtime.sh
npm run test:generator
npm run test:translations
npm run audit:translations
npm run test:catalog28
npm run test:macos-canvas
```

`bash tools/test_qt_runtime.sh` requires a valid `CAVALRY_QT_PREFIX`. Dictionary counts, successful compilation, and synthetic tests do not establish live-UI coverage. Publishing also requires privacy checks on candidate files, the Git index/history, and the final archive.

## Project layout

- `gui/`: Tauri + React interface, draft settings, and status display.
- `patcher/`: Rust patch guards, versioned configuration, backup validation, and restore transactions.
- `injector/`: Qt runtime translation and self-drawn-text adapters guarded by exact ABI contracts.
- `translations/pristine/`: translation sources; model identities, user names, and IDs are not replaced by translations.
- `tools/`, `tests/`: build, generation, audit, and synthetic contract tests.

## Documentation

- [Changelog](CHANGELOG.md)
- [Compatibility and coverage matrix](docs/COMPATIBILITY.md)
- [Windows / Intel / Cavalry 2.8 native acceptance guide](docs/NATIVE-ACCEPTANCE.md)

## License

Distributed under the [MIT License](LICENSE). Copyright and MIT notices for derived portions from `daftAI2026/Cavalry-i18n` are retained in [LICENSE.daftai](LICENSE.daftai) and [NOTICE.md](NOTICE.md).

The GUI uses system fonts. Selecting a local font does not copy or redistribute the font file.
