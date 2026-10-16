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

test('runtime playback-range wording has a bilingual compatibility alias', () => {
  const entries=parseTs(path.join(__dirname,'../translations/pristine/zh-Hans.ts'));
  const matches=entries.filter(entry=>entry.context==='MenuBarManager' && entry.source==='Set Playback Range to Selection');
  assert.deepEqual(matches.map(entry=>entry.translation), ['将播放范围设为所选内容']);
});

test('preferences surfaces include bilingual rendering and Bézier labels', () => {
  const entries=parseTs(path.join(__dirname,'../translations/pristine/zh-Hans.ts'));
  const bySource=new Map(entries.filter(entry=>entry.context==='MenuBarManager').map(entry=>[entry.source,entry.translation]));
  assert.equal(bySource.get('Viewport/Rendering'), '视口/渲染');
  assert.equal(bySource.get('Use Absolute Bézier Positions'), '使用绝对 Bézier 位置');
});

test('preferences heading preserves the host slash-space variant in every language', () => {
  for (const language of ['zh-Hans','zh-Hant','ja_JP']) {
    const entries=parseTs(path.join(__dirname,`../translations/pristine/${language}.ts`));
    const labels=entries.filter(entry=>entry.context==='MenuBarManager' &&
      ['Viewport/Rendering','Viewport/ Rendering'].includes(entry.source));
    assert.equal(labels.length,2,language);
    assert.equal(labels[0].translation,labels[1].translation,language);
    assert.notEqual(labels[0].source,labels[0].translation,language);
  }
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


test('preference terminology is technical and Off stays owner-scoped', () => {
  const expected={
    'zh-Hans':{Performance:'性能',Pretty:'格式化','Minimise Cache':'缩减缓存',Off:'关闭'},
    'zh-Hant':{Performance:'效能',Pretty:'格式化','Minimise Cache':'縮減快取',Off:'關閉'},
    ja_JP:{Performance:'パフォーマンス',Pretty:'整形','Minimise Cache':'キャッシュを縮小',Off:'オフ'},
  };
  for (const [language,words] of Object.entries(expected)) {
    const entries=parseTs(path.join(__dirname,`../translations/pristine/${language}.ts`));
    for (const [source,translation] of Object.entries(words)) {
      const context=source==='Off'?'BilingualPreferences':'MenuBarManager';
      assert.deepEqual(entries.filter(e=>e.context===context && e.source===source).map(e=>e.translation),[translation]);
    }
    assert.ok(entries.filter(e=>e.source==='Off').every(e=>e.context==='BilingualPreferences'));
  }
});


test('observed 2.8 opt-in label is bilingual without touching the selection value', () => {
  for (const language of ['zh-Hans','zh-Hant','ja_JP']) {
    const entries=parseTs(path.join(__dirname,`../translations/pristine/${language}.ts`));
    const rows=entries.filter(e=>e.context==='MenuBarManager' && e.source==='Share anonymised usage data');
    assert.equal(rows.length,1,language);assert.notEqual(rows[0].source,rows[0].translation,language);
  }
});

test('font-only mode bypasses Qt translation while default installation remains intact', () => {
  const source=fs.readFileSync(path.join(__dirname,'../injector/CavalryTranslatorInjector.mm'),'utf8');
  const fontOnly=source.split('if (envFlagEnabled("CAVALRY_I18N_FONT_ONLY"))')[1].split('if (gTranslator == nullptr)')[0];
  assert.ok(fontOnly.includes('gInstallAttempted = true'));
  assert.ok(fontOnly.includes('return true'));
  const defaultInstall=source.split('if (gTranslator == nullptr)')[1].split('if (dumpOnlyEnglish)')[0];
  assert.ok(defaultInstall.includes('new EmbeddedTranslator'));
  assert.ok(defaultInstall.includes('app->installTranslator'));
  const bootstrap=source.split('void bootstrapInjector()')[1];
  assert.ok(bootstrap.includes('if (!envFlagEnabled("CAVALRY_I18N_FONT_ONLY"))'));
});

test('Windows bilingual display runs shared polish only after its display translation', () => {
  const source=fs.readFileSync(path.join(__dirname,'../injector/windows/cavalry_i18n_display.cpp'),'utf8');
  const body=source.split('void CavalryDisplayTranslator::translateWidget(QWidget *widget)')[1].split('\nvoid ')[0];
  assert.ok(body.includes('cavalry_bilingual::polishWidget(guardedWidget.data())'));
  assert.ok(body.indexOf('translateWidgetText(')<body.indexOf('cavalry_bilingual::polishWidget('));
  assert.match(body,/#ifdef CAVALRY_BILINGUAL_ENABLED/);
});


test('observed preferences use technical terminology rather than literal machine mistranslations', () => {
  const entries=parseTs(path.join(__dirname,'../translations/pristine/zh-Hans.ts'));
  const expected={
    'Infinite Scrubbing':'无限拖动调节',
    'Remember Graph Editor Curve Framing':'记住曲线编辑器的视图范围',
    'Maintain Proportional Easing':'保持缓动比例',
    'Nudge Step':'微调步长','Render Notifications':'渲染通知','Bake Accuracy':'烘焙精度',
    'Show Tips button in Message Bar':'在消息栏中显示提示按钮',
    'Show Feedback button in Message Bar':'在消息栏中显示反馈按钮',
  };
  for (const [source,translation] of Object.entries(expected))
    assert.deepEqual(entries.filter(e=>e.context==='MenuBarManager' && e.source===source).map(e=>e.translation),[translation]);
});


test('2.8 observed menu moves and Preferences MCP/video controls keep contextual bilingual labels', () => {
  const expected={
    'Preferences...':'偏好设置...', 'AI Studio':'AI 工作室',
    'Retime Composition':'合成重定时',
    'Video Cache Size (MB)':'视频缓存大小（MB）',
    'MCP Server':'MCP 服务器',
    'Enable MCP Server':'启用 MCP 服务器',
    'MCP Server Port':'MCP 服务器端口',
  };
  const entries=parseTs(path.join(__dirname,'../translations/pristine/zh-Hans.ts'));
  for (const [source,translation] of Object.entries(expected))
    assert.deepEqual(entries.filter(e=>e.context==='MenuBarManager'&&e.source===source).map(e=>e.translation),[translation]);
});
