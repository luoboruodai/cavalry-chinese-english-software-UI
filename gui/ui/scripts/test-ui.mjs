import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { preview } from 'vite';
const server = await preview({ preview: { port: 5217, host: '127.0.0.1', strictPort: true } });
const browser = await chromium.launch();
const base = 'http://127.0.0.1:5217';
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
let checks = 0;
const check = (value, message) => { assert.ok(value, message); ++checks; };
try {
  for (const [width, height] of [[700,540],[760,540],[880,620],[1000,760],[1280,800]]) {
    await page.setViewportSize({width,height});
    for (const view of ['status','type','backup','log']) {
      await page.goto(`${base}/#${view}`);
      await page.getByRole('button', {name:'刷新状态',exact:true}).waitFor();
      await page.waitForTimeout(250);
      const overflow = await page.evaluate(() => document.querySelector('.content').scrollWidth > document.querySelector('.content').clientWidth);
      check(!overflow, `${view} ${width}: horizontal overflow`);
      check(await page.locator('.section-head:visible').evaluate(el => el.getBoundingClientRect().top < 100), `${view} header not top aligned`);
      const buttons = await page.locator('button:visible').evaluateAll(nodes => nodes.map(e => ({ text: e.getAttribute('aria-label') || e.textContent, h: e.getBoundingClientRect().height })));
      check(buttons.every(b => b.h >= 36), `${view}: undersized targets ${JSON.stringify(buttons.filter(b=>b.h<36))}`);
      if (view === 'type') {
        const rect = await page.getByRole('button',{name:'保存设置',exact:true}).boundingBox();
        check(rect.y >= 56 && rect.y+rect.height <= height-26, `save must remain reachable at ${width}x${height}: ${JSON.stringify(rect)}`);
        const radii = await page.locator('.segmented').evaluate(el => [parseFloat(getComputedStyle(el).borderRadius), parseFloat(getComputedStyle(el.querySelector('.segment-thumb')).borderRadius)]);
        check(radii[0] === 12 && radii[1] === 8, 'nested radii should be offset by inset');
      }
    }
  }
  await page.goto(`${base}/#type`);
  await page.getByRole('radio',{name:'中文（English）',exact:true}).focus();
  await page.keyboard.press('ArrowRight');
  check(await page.getByRole('radio',{name:'English（中文）',exact:true}).getAttribute('aria-checked') === 'true', 'keyboard mode');
  await page.getByRole('button',{name:'日志',exact:true}).click();
  await page.getByRole('button',{name:'排版',exact:true}).click();
  check(await page.getByRole('radio',{name:'English（中文）',exact:true}).getAttribute('aria-checked') === 'true', 'navigation must retain draft');
  await page.getByRole('radio',{name:'自定义',exact:true}).click();
  await page.getByLabel('显示模板',{exact:true}).fill('{en}');
  check(await page.getByRole('button',{name:'保存设置',exact:true}).isDisabled(), 'one-language template must not save');
  await page.getByLabel('显示模板',{exact:true}).fill('{en} · {zh}');
  await page.getByLabel('中文字体',{exact:true}).fill('PingFang SC');
  await page.getByLabel('英文字体',{exact:true}).fill('Arial');
  await page.getByRole('button',{name:'保存设置',exact:true}).click();
  check(await page.getByRole('button',{name:'保存设置',exact:true}).isDisabled(), 'saved draft should be clean');
  await page.getByRole('button',{name:'恢复默认',exact:true}).click();
  check(await page.getByRole('button',{name:'取消更改',exact:true}).isEnabled(), 'defaults must be reversible draft');
  await page.getByRole('button',{name:'取消更改',exact:true}).click();
  check(await page.getByLabel('英文字体',{exact:true}).inputValue() === 'Arial', 'cancel defaults restores saved font');
  await page.goto(`${base}/?mock=save-error#type`);
  await page.getByRole('radio',{name:'English（中文）',exact:true}).click();
  await page.getByRole('button',{name:'保存设置',exact:true}).click();
  await page.getByRole('alert').waitFor();
  check(await page.getByRole('radio',{name:'English（中文）',exact:true}).getAttribute('aria-checked') === 'true', 'failed save keeps draft');
  check(await page.getByRole('button',{name:'保存设置',exact:true}).isEnabled(), 'failed save permits retry');
  await page.emulateMedia({reducedMotion:'reduce'});
  check(await page.locator('.segment-thumb').evaluate(el => getComputedStyle(el).transitionDuration === '0s'), 'reduced motion');
  check(errors.length === 0, `browser errors: ${errors.join(';')}`);
  console.log(`PASS ${checks} UI assertions: 5 sizes × 4 sections, hot areas, radius, visible actions, keyboard, draft, cancellation, failure, reduced motion.`);
} finally { await browser.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
