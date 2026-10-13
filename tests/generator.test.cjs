const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseTs, generate } = require('../tools/generate_embedded_translations.js');
function fixture(text, run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-catalog-'));
  const file = path.join(dir, 'test.ts');
  fs.writeFileSync(file, text);
  try { run(file, dir); } finally { fs.rmSync(dir, {recursive:true, force:true}); }
}
test('message attributes, numeric Unicode entities and exact whitespace', () => {
  fixture('<TS><context extra="yes"><name>Fixture</name><message id="a"><source xml:space="preserve"> Name </source><translation xml:space="preserve"> &#x540d;&#31216; </translation></message></context></TS>', file => {
    assert.deepEqual(parseTs(file), [{context:'Fixture', source:' Name ', translation:' 名称 '}]);
  });
});
test('inactive or unfinished translations cannot enter runtime tables', () => {
  fixture('<TS><context><name>Fixture</name><message><source>Open</source><translation type="unfinished">打开</translation></message></context></TS>', file => assert.deepEqual(parseTs(file), []));
});
test('orphan messages and unsupported plurals fail closed instead of disappearing', () => {
  fixture('<TS><message><source>Open</source><translation>打开</translation></message></TS>', file => assert.throws(() => parseTs(file), /outside/));
  fixture('<TS><context><name>Fixture</name><message numerus="yes"><source>%n items</source><translation><numerusform>%n 项</numerusform></translation></message></context></TS>', file => assert.throws(() => parseTs(file), /plural/));
});
test('generated runtime tables are deterministic and support dynamic formatting', () => {
  fixture('<TS/>', (_, dir) => {
    const a=path.join(dir,'a.inc'), b=path.join(dir,'b.inc');generate(a);generate(b);
    assert.equal(fs.readFileSync(a,'utf8'), fs.readFileSync(b,'utf8'));
    assert.ok(fs.readFileSync(a,'utf8').includes('return CAVALRY_BILINGUAL_ENTRIES(kZhHansEntries, *count)'));
  });
});

test('graph input actions and graph-only removal have distinct, non-destructive wording', () => {
  const entries=parseTs(path.join(__dirname,'../translations/pristine/zh-Hans.ts'));
  for (const [source,translation] of [
    ['Mute Input','停用输入连接'],['Unmute Input','恢复输入连接'],['Disconnect Input','断开输入连接'],
    ['Remove all layers from the Dependency Graph','从依赖图中移除所有图层'],
    ['Remove selected layers from the Dependency Graph','从依赖图中移除选中的图层'],
  ]) {
    const matches=entries.filter(entry=>entry.source===source);
    assert.ok(matches.length>0, `Missing ${source}`);
    for (const entry of matches) assert.equal(entry.translation,translation);
  }
});

test('platform line-edit translators never write commit values or normalize scene model roles', () => {
  const mac=fs.readFileSync(path.join(__dirname,'../injector/CavalryTranslatorInjector.mm'),'utf8');
  const win=fs.readFileSync(path.join(__dirname,'../injector/windows/cavalry_i18n_display.cpp'),'utf8');
  const macEdit=mac.split('void translateLineEditDisplayText(')[1].split('void translateLabelDisplayText(')[0];
  const winEdit=win.split('void CavalryDisplayTranslator::translateLineEditDisplay(')[1].split('void CavalryDisplayTranslator::translatePlainTextEditDisplay(')[0];
  for (const body of [macEdit,winEdit]) {
    assert.ok(body.includes('Placeholder'));
    assert.doesNotMatch(body,/->setText\s*\(|->text\s*\(|lineEditText/);
  }
  assert.doesNotMatch(mac,/translatedLineEditValue|hookLineEditTextChanges|normalizeTimeEditorModelRows|timeEditorSafeItemText/);
});
