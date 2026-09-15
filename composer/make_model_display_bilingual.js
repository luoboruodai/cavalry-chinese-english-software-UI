#!/usr/bin/env node
/*
 * make_model_display_bilingual.js — 把 model_display_translations.json 的译文改写成双语形态
 * 输入输出均为同构 JSON ({"//": ..., "entries": [{source, zh-Hans, zh-Hant, ja_JP}, ...]});
 * 只改 --lang 指定的字段, 不动 source/其他语言字段/其他键。
 *
 * 用法:
 *   node make_model_display_bilingual.js --in translations/pristine/model_display_translations.json \
 *     --out translations/working/model_display_translations.json \
 *     [--lang zh-Hans] [--template "{zh}（{en}）"] [--config composer/bilingual.config.json]
 *
 * --config 读取 JSON 配置文件的 template/lang 字段; 命令行参数优先于配置文件。
 * 模板变量: {en}=source 原文, {zh}=原 value。默认 "{zh}（{en}）"。
 * 跳过规则: 译文无 CJK / source==value / 纯标点 / 已是双语形态。
 */
const fs = require('fs');
const path = require('path');

function loadConfig(argv) {
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] !== '--config') continue;
    const p = argv[i + 1];
    if (!p) { console.error('--config requires a path'); process.exit(2); }
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) {
      console.error('cannot read config ' + p + ': ' + e.message);
      process.exit(2);
    }
  }
  return {};
}

function parseArgs(argv) {
  const config = loadConfig(argv);
  const a = {
    lang: typeof config.lang === 'string' ? config.lang : 'zh-Hans',
    template: typeof config.template === 'string' ? config.template : '{zh}（{en}）'
  };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === '--in') { a.input = v; i++; }
    else if (k === '--out') { a.out = v; i++; }
    else if (k === '--lang') { a.lang = v; i++; }
    else if (k === '--template') { a.template = v; i++; }
    else if (k === '--config') { i++; }
    else { console.error('unknown arg: ' + k); process.exit(2); }
  }
  if (!a.input || !a.out) { console.error('--in and --out are required'); process.exit(2); }
  return a;
}

function hasCJK(s) { return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(s); }
function isPunctOnly(s) { return !/[\w\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(s); }
function alreadyBilingual(zh, en) { return zh.includes(en) && zh.length > en.length; }

function main() {
  const args = parseArgs(process.argv);
  const payload = JSON.parse(fs.readFileSync(args.input, 'utf8'));
  if (!Array.isArray(payload.entries)) {
    console.error('input JSON has no entries array: ' + args.input);
    process.exit(2);
  }

  let done = 0;
  const stats = { transformed: 0, skippedNoCJK: 0, skippedSame: 0, skippedPunct: 0, skippedDup: 0, skippedNoValue: 0 };

  for (const entry of payload.entries) {
    const src = entry.source;
    const value = entry[args.lang];
    if (typeof value !== 'string' || value.length === 0) { stats.skippedNoValue++; continue; }
    if (!hasCJK(value)) { stats.skippedNoCJK++; continue; }
    if (src === value) { stats.skippedSame++; continue; }
    if (isPunctOnly(value) || isPunctOnly(src)) { stats.skippedPunct++; continue; }
    if (alreadyBilingual(value, src)) { stats.skippedDup++; continue; }
    entry[args.lang] = args.template.replace('{zh}', value).replace('{en}', src);
    done++;
  }
  stats.transformed = done;

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`lang=${args.lang} entries=${payload.entries.length} transformed=${done} detail=${JSON.stringify(stats)}`);
}

main();
