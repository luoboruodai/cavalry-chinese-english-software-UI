#!/usr/bin/env node
/*
 * make_bilingual.js — 把 Qt Linguist .ts 的译文改写成双语形态
 * 输入输出均为合法 TS XML；只改 <translation> 文本，不动 source/结构/属性。
 *
 * 用法:
 *   node make_bilingual.js --ts tools/zh-Hans.ts --out tools/zh-Hans.ts \
 *     [--all] [--contexts QMenuBar,QMenu] [--limit N] [--sources-file f.json] \
 *     [--template "{zh}（{en}）"] [--config composer/bilingual.config.json] [--lang zh-Hans]
 *
 * --config 读取 JSON 配置文件的 template/lang 字段; 命令行参数优先于配置文件。
 * --lang 仅作声明(选择哪个 .ts 由 --ts 决定), 缺省回退配置值或 "zh-Hans"。
 * 模板变量: {en}=source 原文, {zh}=原译文。默认 "{zh}（{en}）"。
 * 跳过规则: 译文无 CJK / source==译文 / 纯标点 / 已是双语形态(含（且以）结尾)。
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
    template: typeof config.template === 'string' ? config.template : '{zh}（{en}）',
    lang: typeof config.lang === 'string' ? config.lang : 'zh-Hans',
    all: false, contexts: null, limit: 0, sourcesFile: null, reverse: false
  };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === '--ts') { a.ts = v; i++; }
    else if (k === '--out') { a.out = v; i++; }
    else if (k === '--template') { a.template = v; i++; }
    else if (k === '--lang') { a.lang = v; i++; }
    else if (k === '--config') { i++; }
    else if (k === '--all') { a.all = true; }
    else if (k === '--reverse') { a.reverse = true; }
    else if (k === '--contexts') { a.contexts = new Set(v.split(',').map(s => s.trim())); i++; }
    else if (k === '--limit') { a.limit = parseInt(v, 10); i++; }
    else if (k === '--sources-file') { a.sourcesFile = v; i++; }
    else { console.error('unknown arg: ' + k); process.exit(2); }
  }
  if (!a.ts || !a.out) { console.error('--ts and --out are required'); process.exit(2); }
  return a;
}

const RE_MESSAGE = /<message>([\s\S]*?)<\/message>|<message>([\s\S]*?)<\/message>\s*/g;
// 分块: 按 <context> 扫描太慢,直接逐 message 处理,同时跟踪最近一个 <name>
const RE_BLOCK = /(<context>\s*<name>([^<]+)<\/name>)?([\s\S]*?)(?=<context>|<\/TS>)/g;

function hasCJK(s) { return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(s); }
function isPunctOnly(s) { return !/[\w\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(s); }
function alreadyBilingual(zh, en) {
  // 粗略判重: 译文里已包含完整 source 子串(转义形态也算)
  const unesc = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&apos;/g, "'").replace(/&quot;/g, '"');
  const z = unesc(zh), e = unesc(en);
  return z.includes(e) && z.length > e.length;
}

function main() {
  const args = parseArgs(process.argv);
  const xml = fs.readFileSync(args.ts, 'utf8');
  let sourceFilter = null;
  if (args.sourcesFile) sourceFilter = new Set(JSON.parse(fs.readFileSync(args.sourcesFile, 'utf8')));

  let count = 0, skipped = 0, done = 0;
  const stats = { transformed: 0, skippedNoCJK: 0, skippedSame: 0, skippedPunct: 0, skippedDup: 0, skippedFilter: 0 };

  const out = xml.replace(RE_BLOCK, (whole, _ctxTag, ctxName, body) => {
    if (!body || !body.includes('<message>')) return whole;
    const newBody = body.replace(/<message>([\s\S]*?)<\/message>/g, (m, inner) => {
      count++;
      const sm = inner.match(/<source((?:\s+[^>]*)?)>([\s\S]*?)<\/source>/);
      const tm = inner.match(/<translation((?:\s+[^>]*)?)>([\s\S]*?)<\/translation>/);
      if (!sm || !tm) { skipped++; return m; }
      const src = sm[2], tr = tm[2];
      const context = ctxName || '';

      const hitFilter =
        (sourceFilter && !sourceFilter.has(decode(src))) ||
        (args.contexts && !args.contexts.has(context)) ||
        (!args.all && !sourceFilter && !args.contexts);
      if (hitFilter) { stats.skippedFilter++; return m; }
      if (args.limit && done >= args.limit) { stats.skippedFilter++; return m; }

      if (!hasCJK(tr)) { stats.skippedNoCJK++; return m; }
      if (src === tr) { stats.skippedSame++; return m; }
      if (isPunctOnly(tr) || isPunctOnly(src)) { stats.skippedPunct++; return m; }
      if (alreadyBilingual(tr, src)) { stats.skippedDup++; return m; }

      const merged = args.template.replace('{zh}', tr).replace('{en}', src);
      done++;
      return '<message>' + inner.replace(/<translation((?:\s+[^>]*)?)>([\s\S]*?)<\/translation>/,
        (t, attrs) => `<translation${attrs}>${merged}</translation>`) + '</message>';
    });
    return (_ctxTag || '') + newBody;
  });

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, out, 'utf8');
  console.log(`messages=${count} transformed=${done} skipped=${skipped} detail=${JSON.stringify(stats)}`);
}

function decode(s){return s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&apos;/g,"'").replace(/&quot;/g,'"');}

main();
