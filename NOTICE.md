# NOTICE

## Based on daftAI2026/Cavalry-i18n

This project (Cavalry Bilingual) is based on the open-source project
[daftAI2026/Cavalry-i18n](https://github.com/daftAI2026/Cavalry-i18n),
licensed under the MIT License. The original license text and copyright
notice are preserved verbatim in [LICENSE.daftai](./LICENSE.daftai).

## Modifications

Compared to the upstream project, this repository makes the following changes:

- **Bilingual composer** (`composer/make_bilingual.js`, `composer/bilingual.config.json`):
  rewrites the Simplified Chinese translations in the Qt Linguist source
  (`tools/zh-Hans.ts`, restored from the pristine copy under `translations/pristine/`)
  into a bilingual form `{zh}（{en}）`, so the Cavalry UI shows both Chinese and
  English for each string.
- **Build flow adjustments** (`package.json`, `scripts/swap_injector.sh`):
  npm-driven compose/build pipeline producing `dist/libCavalryTranslatorInjector.dylib`
  from the bilingual translation table, plus a local swap script for installing the
  rebuilt injector into `/Applications/Cavalry.app`.
- **Layout trim**: only the macOS injector build chain, its input assets, and the
  four language packs are kept here; the upstream Tauri switcher app, renderer,
  and CI tooling are not part of this repository.

## Disclaimer

This project is **not affiliated with, endorsed by, or sponsored by Scene Group
or the official Cavalry product**. It is provided for personal study and research
purposes only. Use it with a legally obtained copy of Cavalry, entirely at your
own risk.
