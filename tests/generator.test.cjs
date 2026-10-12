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
