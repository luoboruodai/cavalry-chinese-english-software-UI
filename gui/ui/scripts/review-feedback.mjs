// Scoped feedback captures. All data/mutations use browser fixtures, never real backups/mail.
import { chromium } from 'playwright';
import { preview } from 'vite';
import { mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
const out = resolve(process.env.CAVALRY_UI_SCREENSHOT_DIR || '../feedback_auto/round2');
mkdirSync(out, {recursive:true});
const server = await preview({preview:{host:'127.0.0.1', port:5219, strictPort:true}});
const browser = await chromium.launch();
try {
  for (const [width,height] of [[1000,760], [700,540], [1280,800]]) {
    const context = await browser.newContext({viewport:{width,height}, deviceScaleFactor:2});
    const page = await context.newPage();
    const capture = async (name) => { await page.mouse.move(10, 10); await page.waitForTimeout(220); await page.screenshot({path:join(out, `${name}-${width}x${height}.png`)}); };
    for (const view of ['status','type','backup','log']) {
      await page.goto(`http://127.0.0.1:5219/#${view}`);
      await page.evaluate(()=>document.fonts.ready);
      await page.waitForTimeout(260);
      while (await page.locator('.toast-close').count()) { await page.locator('.toast-close').first().click(); await page.waitForTimeout(180); }
      await capture(view);
      if (view==='status') {
        await page.getByRole('combobox',{name:'Cavalry 目标版本',exact:true}).click();
        await capture('target-open');
        await page.keyboard.press('Escape');
        await page.getByRole('button',{name:'软件更新',exact:true}).click();
        await page.getByText('本机已有官网最新版本。',{exact:true}).waitFor();
        await capture('update-current');
        await page.keyboard.press('Escape');
        await page.getByRole('button',{name:'应用双语',exact:true}).click();
        await capture('apply-confirm');
        await page.keyboard.press('Escape');
      }
      if (view==='log') {
        await page.getByRole('button',{name:'反馈问题',exact:true}).click();
        await page.getByLabel('问题描述',{exact:false}).fill('点击软件更新后，想确认安装包是否下载完成。');
        await capture('report-compose');
        await page.getByRole('button',{name:'预览报告',exact:true}).click();
        await capture('report-preview');
        await page.keyboard.press('Escape');
        await page.getByRole('button',{name:'清除全部日志',exact:true}).click();
        await page.getByRole('button',{name:'确认清除',exact:true}).click();
        await page.getByText('尚无操作记录',{exact:true}).waitFor();
        await capture('log-empty');
      }
      if (view==='type') {
        await page.getByLabel('中文字体',{exact:true}).click();
        await capture('fonts-open');
        await page.keyboard.press('Escape');
      }
      if (view==='backup') {
        await page.getByRole('button',{name:/^删除备份 /}).first().click();
        await capture('delete-confirm');
        await page.keyboard.press('Escape');
        await page.goto('http://127.0.0.1:5219/?mock=empty-backups#backup');
        await page.getByText('暂无备份',{exact:true}).waitFor();
        await capture('backup-empty');
      }
    }
    await page.goto('http://127.0.0.1:5219/?mock=status-notices#status');
    await page.locator('.toast').nth(2).waitFor();
    await page.waitForTimeout(220);
    await capture('notifications');
    await context.close();
  }
  console.log(`42 scoped screenshots -> ${out}`);
} finally { await browser.close(); await new Promise(resolve=>server.httpServer.close(resolve)); }
