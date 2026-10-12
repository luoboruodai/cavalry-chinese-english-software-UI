#!/usr/bin/env node
// The runtime formats raw translations using saved settings. Do not bake one user's template into releases.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
for (const name of ['zh-Hans.ts', 'zh-Hant.ts', 'ja_JP.ts', 'model_display_translations.json']) {
  fs.copyFileSync(path.join(root, 'translations/pristine', name), path.join(__dirname, name));
}
require('./generate_embedded_translations.js').generate();
