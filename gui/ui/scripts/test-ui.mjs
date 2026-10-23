import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { preview } from 'vite';
const server = await preview({ preview: { port: 5217, host: '127.0.0.1', strictPort: true } });
const browser = await chromium.launch();
const base = 'http://127.0.0.1:5217';
const page = await browser.newPage();
const emailJsRequests = [];
await page.route('https://api.emailjs.com/api/v1.0/email/send', async route => {
  const body = route.request().postDataJSON();
  emailJsRequests.push(body);
  const failed = page.url().includes('mock=report-error');
  await route.fulfill({status:failed?500:200,contentType:'text/plain',body:failed?'synthetic failure':'OK'});
});
const closeModal = async () => {
  if (await page.getByRole('group',{name:'发送方式',exact:true}).count()) await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.locator('.app-modal').waitFor({state:'hidden'});
};
page.setDefaultTimeout(6000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
let checks = 0;
const check = (value, message) => { assert.ok(value, message); ++checks; };
const waitForModalSettled = async () => {
  await page.waitForFunction(() => {
    const dialog = document.querySelector('dialog.app-modal[open]');
    if (!dialog) return false;
    const style = getComputedStyle(dialog);
    return Number(style.opacity) === 1 && (style.transform === 'none' || style.transform === 'matrix(1, 0, 0, 1, 0, 0)');
  });
};
try {
  const tauriConfig = JSON.parse(readFileSync(new URL('../../src-tauri/tauri.conf.json', import.meta.url), 'utf8'));
  const capabilities = JSON.parse(readFileSync(new URL('../../src-tauri/capabilities/default.json', import.meta.url), 'utf8'));
  const externalHttpsOrigins = tauriConfig.app.security.csp.match(/https:\/\/[^\s;]+/g) ?? [];
  check(JSON.stringify(externalHttpsOrigins) === JSON.stringify(['https://api.emailjs.com']), 'CSP allows only the exact EmailJS HTTPS origin');
  check(capabilities.permissions.includes('dialog:allow-open') && !capabilities.permissions.includes('dialog:default'), 'directory picker has only the required open permission');
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
      check(await page.locator('.side-label').evaluateAll(nodes => nodes.every(el => getComputedStyle(el).display !== 'none')), 'all four navigation labels remain visible at every tested width');
      if (view === 'status') {
        check(await page.getByText('当前注入目标').isVisible(), 'status target switcher visible');
        check(await page.locator('.tb-refresh svg').evaluate(el => getComputedStyle(el).stroke) === 'rgb(76, 119, 53)', 'refresh icon uses the shared high-contrast green, not white');
        check(await page.getByRole('button', {name:'切换 Cavalry', exact:true}).isVisible(), 'status Cavalry switch button visible');
        check(await page.getByRole('button', {name:'选择 Cavalry 安装路径', exact:true}).isVisible(), 'status custom-path picker visible');
        check(await page.getByRole('button', {name:'软件更新', exact:true}).isVisible(), 'status software update button visible');
        check(await page.getByRole('button', {name:'应用双语', exact:true}).isVisible(), 'status apply button renamed');
      }
      if (view === 'log') {
        check(await page.getByRole('button', {name:'反馈问题', exact:true}).isVisible(), 'log report action visible');
        check(await page.locator('.log-detail summary').evaluateAll(nodes=>nodes.every(el=>el.getBoundingClientRect().height>=36)), 'log disclosure targets remain at least 36px');
      }
      if (view === 'type') {
        check(await page.getByRole('combobox', {name:'中文字体', exact:true}).isVisible(), 'Chinese font dropdown visible');
        check(await page.getByRole('combobox', {name:'英文字体', exact:true}).isVisible(), 'English font dropdown visible');
        const rect = await page.getByRole('button',{name:'保存设置',exact:true}).boundingBox();
        check(rect.y >= 56 && rect.y+rect.height <= height-26, `save must remain reachable at ${width}x${height}: ${JSON.stringify(rect)}`);
        const radii = await page.locator('.segmented').evaluate(el => [parseFloat(getComputedStyle(el).borderRadius), parseFloat(getComputedStyle(el.querySelector('.segment-thumb')).borderRadius)]);
        check(radii[0] === 12 && radii[1] === 8, 'nested radii should be offset by inset');
        check(await page.locator('.settings-footer').evaluate(el=>getComputedStyle(el).borderTopWidth)==='0px','typography footer has no bottom divider');
        if (width >= 1100) { const fields=await page.locator('.settings-fields').boundingBox(), preview=await page.locator('.preview-card').boundingBox(); check(preview.x >= fields.x+fields.width+12 && Math.abs(preview.y-fields.y)<2, 'wide typography puts live preview alongside fields'); check(preview.y+preview.height < height-100, 'wide preview no longer hides below the save bar'); }
      }
    }
  }
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto(`${base}/#status`);
  await page.waitForFunction(()=>!document.querySelector('.tb-refresh')?.disabled);
  const refreshButton=page.getByRole('button',{name:'刷新状态',exact:true});
  await refreshButton.click();
  const refreshIcon=refreshButton.locator('svg');
  check(await refreshIcon.evaluate(el=>getComputedStyle(el).animationName==='refresh-spin'&&getComputedStyle(el).animationDuration==='0.38s'),'refresh uses one bounded Kit-length spin');
  await page.waitForFunction(() => {
    const icon = document.querySelector('.tb-refresh svg');
    return icon && icon.getAnimations().every(animation => animation.playState === 'finished');
  });
  check(await refreshIcon.evaluate(el=>el.getAnimations().every(animation=>animation.playState==='finished')),'refresh spin stops instead of becoming an idle animation');
  await page.waitForFunction(()=>!document.querySelector('.tb-refresh')?.disabled);
  await page.emulateMedia({reducedMotion:'reduce'});
  await refreshButton.click();
  check(await refreshIcon.evaluate(el=>getComputedStyle(el).animationName==='none'),'reduced motion removes the refresh spin');
  await page.emulateMedia({reducedMotion:'no-preference'});

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
  await page.getByLabel('中文字体',{exact:true}).fill('PingFang');
  await page.getByRole('option',{name:'PingFang SC', exact:true}).click();
  await page.getByLabel('英文字体',{exact:true}).fill('Arial');
  await page.getByRole('option',{name:'Arial', exact:true}).click();
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
  await page.getByRole('button',{name:'备份',exact:true}).click();
  check(await page.locator('.backup-row').first().evaluate(el=>getComputedStyle(el).animationName)==='none','reduced motion disables Kit row reveal');
  await page.getByRole('button',{name:'日志',exact:true}).click();
  check(await page.locator('.log-row').first().evaluate(el=>getComputedStyle(el).animationName)==='none','reduced motion disables log row reveal');
  check(await page.locator('.segment-thumb').evaluate(el => getComputedStyle(el).transitionDuration === '0s'), 'reduced motion');
  // Feedback scope: one font field per language; cancel/Escape never commits a query.
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.setViewportSize({width:1000,height:760});
  await page.goto(`${base}/#type`);
  check(await page.locator('.font-grid input').count() === 2 && await page.locator('.font-grid select').count() === 0, 'exactly two font fields, not four');
  await page.getByLabel('中文字体',{exact:true}).click();
  check(await page.getByRole('option',{name:'系统默认',exact:true}).isVisible(), 'default choice is reachable');
  await page.getByLabel('中文字体',{exact:true}).fill('no matching font');
  check(await page.getByText('没有匹配的本机字体',{exact:true}).isVisible(), 'font empty results');
  await page.keyboard.press('Escape');
  check(await page.getByLabel('中文字体',{exact:true}).inputValue() === '', 'escape keeps saved font');
  check(await page.getByRole('button',{name:'保存设置',exact:true}).isDisabled(), 'uncommitted font query does not dirty settings');
  await page.getByLabel('英文字体',{exact:true}).focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  check(await page.getByLabel('英文字体',{exact:true}).inputValue() === 'Arial', 'single field supports keyboard selection');
  const underline = await page.getByRole('button',{name:'恢复默认',exact:true}).evaluate(el => getComputedStyle(el).borderBottomWidth);
  check(underline === '0px', 'restore defaults has no underline');
  await page.getByRole('button',{name:'取消更改',exact:true}).click();

  await page.locator('.content').evaluate(el=>el.scrollTo({top:el.scrollHeight}));
  await page.getByRole('button',{name:'备份',exact:true}).click();
  check(await page.locator('.content').evaluate(el=>el.scrollTop) === 0, 'switching sections resets scroll without discarding drafts');

  // The old green blocks float from the right, never occupy the status layout.
  await page.goto(`${base}/?mock=status-notices#status`);
  await page.locator('.toast').nth(2).waitFor();
  check(await page.locator('.toast').count() === 3, 'three status notifications');
  check(await page.locator('.view > p.notice').count() === 0, 'old notice blocks removed from document flow');
  const toastPresentation = await page.locator('.toast').evaluateAll(nodes => nodes.map(el => ({delay:getComputedStyle(el).transitionDelay.split(',')[0],background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color})));
  check(JSON.stringify(toastPresentation.map(item=>parseFloat(item.delay))) === JSON.stringify([0,.1,.2]), 'same-batch notifications stagger by 100ms');
  check(toastPresentation.every(item=>item.background==='rgb(255, 254, 250)'&&item.color==='rgb(40, 45, 38)'), 'notifications use the light cream surface and readable ink');
  check(await page.locator('.toast-stack').evaluate(el=>getComputedStyle(el).overflowX==='visible'&&getComputedStyle(el).overflowY==='visible'), 'toast entrance is not clipped by a scrolling stack');
  const floating = await page.locator('.toast-stack').evaluate(el => ({position:getComputedStyle(el).position, r:el.getBoundingClientRect().right}));
  check(floating.position === 'fixed' && floating.r > 950, 'notifications anchored top right');
  check(await page.locator('.toast').first().evaluate(el => getComputedStyle(el).transitionProperty.includes('transform')), 'notifications use interruptible slide transition');
  await page.getByRole('button',{name:'排版',exact:true}).click();
  await page.getByRole('radio',{name:'English（中文）',exact:true}).click();
  await page.getByRole('button',{name:'保存设置',exact:true}).click();
  await page.locator('.toast[data-kind="success"]').waitFor();
  check(await page.locator('.toast').count()===3,'a fourth notification replaces the oldest and keeps only three visible');
  check(await page.getByText('兼容性检查',{exact:true}).count()===0,'overflow removes the oldest status notification first');
  await page.getByRole('button',{name:'恢复默认',exact:true}).click();
  await page.getByText('已恢复默认草稿',{exact:true}).waitFor();
  check(await page.getByRole('button',{name:'保存设置',exact:true}).isEnabled(),'restoring defaults creates a saveable draft when saved settings differ');
  await page.getByRole('button',{name:'取消更改',exact:true}).click();
  await page.getByText('已取消更改',{exact:true}).waitFor();
  check(await page.getByRole('button',{name:'保存设置',exact:true}).isDisabled(),'cancel discards only the unsaved default draft');
  check(await page.locator('.settings-status').count()===0,'clean settings remove the persistent saved message');
  await page.goto(`${base}/?mock=status-notices#status`);
  await page.locator('.toast').nth(2).waitFor();
  for (let n=0; n<3; n++) {
    await page.locator('.toast-close').first().click();
    await page.waitForTimeout(180);
  }
  check(await page.locator('.toast').count() === 0, 'notification dismisses with exit');
  await page.getByRole('button',{name:'刷新状态',exact:true}).click();
  check(await page.locator('.toast').count() === 0, 'same refresh does not spam notifications');
  check(await page.locator('.action-hint').filter({hasText:'目标 Cavalry 正在运行，退出后可应用双语。'}).count()===0, 'running hint moves out of the visible layout into notifications');
  check(await page.locator('#status-running-hint').evaluate(el=>el.classList.contains('sr-only')),'running reason is retained only as an accessibility description');
  check((await page.getByRole('button',{name:'应用双语',exact:true}).getAttribute('aria-describedby')).includes('status-running-hint'),'running disabled reason remains available to assistive technology');
  check(await page.getByRole('button',{name:'技术细节',exact:true}).count() === 0, 'technical-details panel removed by latest request');
  check(await page.getByRole('button',{name:'应用双语',exact:true}).isDisabled(), 'removing diagnostics never removes safety guard');

  await page.goto(`${base}/?mock=status-28#status`);
  await page.waitForFunction(()=>!document.querySelector('.cta-coral')?.disabled);
  check(await page.getByRole('button',{name:'应用双语',exact:true}).isEnabled(),'Cavalry 2.8 / Qt 6.9.2 enables its dedicated runtime');
  check((await page.locator('.toast-body').first().innerText()).includes('2.8适配目标'),'2.8 compatibility identifies its own adaptation target');
  await page.goto(`${base}/?mock=status-28-missing-runtime#status`);
  check(await page.getByRole('button',{name:'应用双语',exact:true}).isDisabled(),'missing 2.8 runtime still blocks writes');
  check(await page.locator('.field-error').count()===0,'missing runtime no longer creates an inline error block');
  check(await page.locator('.toast[data-kind="error"] .toast-body').innerText()==='缺少当前版本对应的注入器，请重新安装完整工具包。不会尝试修改 Cavalry。','missing runtime is explained by a right-side notification');
  await page.goto(`${base}/?mock=status-28-unsupported#status`);
  check(await page.locator('.action-hint').count()===0,'unsupported compatibility no longer duplicates the transient notice inline');
  check(await page.getByRole('button',{name:'应用双语',exact:true}).getAttribute('aria-describedby')==='status-compatibility-hint','unsupported action retains an accessibility-only reason');

  // Delete confirmation uses a mock filesystem only; real user backups are never touched here.
  await page.goto(`${base}/#backup`);
  const countBefore = await page.locator('.backup-cards > li').count();
  await page.getByRole('button',{name:/^删除备份 /}).first().click();
  const dialog = page.getByRole('dialog');
  check(await dialog.getByText('删除备份？',{exact:true}).isVisible(), 'delete requires confirmation');
  check(await dialog.getByRole('heading',{name:'删除备份？',exact:true}).evaluate(el => el === document.activeElement), 'delete confirmation starts with title focus instead of a cancel outline');
  check(await dialog.evaluate(el=>getComputedStyle(el).transitionDuration.split(',').every(value=>parseFloat(value)===0.38)), 'pointer modal uses the Kit 380ms entrance');
  await dialog.getByRole('button',{name:'取消',exact:true}).click();
  await page.waitForTimeout(60);
  check(await page.locator('.app-modal').getAttribute('data-closing')==='true' && await page.locator('.app-modal').evaluate(el=>el.inert), 'modal exit has a bounded inert phase');
  check(await page.locator('.app-modal').evaluate(el=>getComputedStyle(el).transitionDuration.split(',').every(value=>parseFloat(value)===0.24)), 'modal exit uses the Kit 240ms duration');
  await page.locator('.app-modal').waitFor({state:'hidden'});
  check(await page.locator('.backup-cards > li').count() === countBefore, 'cancel leaves all backups intact');
  await page.getByRole('button',{name:/^删除备份 /}).first().click();
  await dialog.getByRole('button',{name:'移至废纸篓',exact:true}).click();
  await page.waitForFunction(n => document.querySelectorAll('.backup-cards > li').length === n, countBefore-1);
  check(await page.locator('.backup-cards > li').count() === countBefore-1, 'confirmed delete removes exactly one snapshot');
  const legacy = page.locator('.backup-row').filter({hasText:'旧版快照'});
  check(await legacy.getByRole('button',{name:/^还原备份 /}).isDisabled(), 'invalid snapshot cannot restore');
  check(await legacy.getByRole('button',{name:/^删除备份 /}).isEnabled(), 'invalid snapshot can be removed');
  check(await page.locator('.row-action').first().evaluate(el=>getComputedStyle(el).borderBottomWidth) === '0px', 'restore action has no underline');
  await page.goto(`${base}/?mock=delete-error#backup`);
  const failureCount = await page.locator('.backup-cards > li').count();
  await page.getByRole('button',{name:/^删除备份 /}).first().click();
  await page.getByRole('dialog').getByRole('button',{name:'移至废纸篓',exact:true}).click();
  await page.getByRole('dialog').getByRole('alert').waitFor();
  check(await page.locator('.backup-cards > li').count() === failureCount, 'delete failure retains snapshot and retry dialog');
  await page.getByRole('dialog').getByRole('button',{name:'取消',exact:true}).click();

  // Quiet log landing; details preserve diagnostics and clear is scoped and persisted.
  await page.goto(`${base}/#log`);
  const clearLogsAction = page.getByRole('button',{name:'清除全部日志',exact:true});
  check(await clearLogsAction.isEnabled(), 'clear logs action is available');
  check(await clearLogsAction.evaluate(el=>{
    const style=getComputedStyle(el);
    return style.borderTopWidth==='1px'&&style.borderTopStyle==='solid'&&style.backgroundColor==='rgb(255, 254, 250)'&&style.minHeight==='40px';
  }), 'clear logs uses the shared bordered button surface');
  check(await page.locator('.log-note').count() === 0, 'verbose mail/implementation note removed');
  const visibleBody = await page.locator('.log-card').innerText();
  check(!visibleBody.includes('/Users/') && !visibleBody.includes('@qq.com'), 'raw paths/email hidden in default log summaries');
  await page.locator('.log-detail summary').first().click();
  check(await page.locator('.log-detail[open] pre').first().isVisible(), 'original diagnostics are expandable');
  await page.getByRole('button',{name:'反馈问题',exact:true}).click();
  check(!(await page.getByRole('dialog').innerText()).includes('@qq.com'), 'feedback dialog does not expose recipient email');
  check(await page.getByRole('button',{name:'预览报告',exact:true}).isVisible(), 'report always starts with review, not an unapproved send');
  await closeModal();
  const logCount = await page.locator('.log-row').count();
  await page.getByRole('button',{name:'清除全部日志',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'取消',exact:true}).click();
  check(await page.locator('.log-row').count() === logCount, 'cancel clear preserves logs');
  await page.getByRole('button',{name:'清除全部日志',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'确认清除',exact:true}).click();
  await page.getByText('尚无操作记录',{exact:true}).waitFor();
  check(await page.getByRole('button',{name:'清除全部日志',exact:true}).isDisabled(), 'clear leads to honest empty state');
  await page.reload();
  await page.getByText('尚无操作记录',{exact:true}).waitFor();
  check(await page.locator('.log-row').count() === 0, 'clearing survives reload');

  // Native regression: successful error-report paths must not become failure badges.
  const reportRecords = [
    {time:'2026-10-19 08:00', text:'已生成错误报告 /Users/example/.cavalry-bilingual/error-reports/report.txt，已打开邮件草稿。'},
    {time:'2026-10-19 08:01', text:'错误报告已准备：C:\\Users\\example\\.cavalry-bilingual\\error-reports\\report.txt'},
    {time:'2026-10-19 08:02', text:'生成错误报告失败 — 无法打开邮件客户端。'},
    {time:'2026-10-19 08:03', text:'还原失败 — 回滚失败，请保留备份。'},
  ];
  await page.evaluate(entries => localStorage.setItem('cb-mock-operation-log-v1', JSON.stringify(entries)), reportRecords);
  await page.reload();
  await page.locator('.log-row').nth(3).waitFor();
  check(await page.locator('.log-row.log-info').count() === 2, 'Mac/Windows report paths containing error do not mark successful reports as failures');
  check(await page.locator('.log-row.log-error').count() === 2, 'actual report failure and rollback failure remain errors');
  check(await page.locator('.log-row .m').first().innerText() === '错误报告已准备，请检查后发送。', 'report result has an accurate compact summary');
  check((await page.locator('.log-row .m').nth(3).innerText()).includes('回滚失败'), 'critical rollback warning remains in summary');
  await page.locator('.log-detail summary').first().click();
  check(await page.locator('.log-detail[open] pre').innerText() === reportRecords[0].text, 'classification never rewrites stored original diagnostic text');

  // Target and font fields use the same accessible custom picker, not the native blue select.
  await page.goto(`${base}/#status`);
  check(await page.locator('.target-card select').count() === 0, 'version picker no longer uses native select');
  const target = page.getByRole('combobox',{name:'Cavalry 目标版本',exact:true});
  const targetRadius = await target.evaluate(el=>getComputedStyle(el).borderRadius);
  await target.click();
  await target.fill('2.8');
  await page.getByRole('option',{name:/Cavalry 2.8.0/}).click();
  check(await target.inputValue() === 'Cavalry 2.8.0', 'single target field displays chosen version');
  check(await page.getByRole('button',{name:'切换 Cavalry',exact:true}).isEnabled(), 'choosing a version creates an explicit switch action');
  await page.getByRole('button',{name:'排版',exact:true}).click();
  check(await page.getByLabel('中文字体',{exact:true}).evaluate(el=>getComputedStyle(el).borderRadius) === targetRadius, 'version/font picker geometry is shared');

  // Immediate acknowledgement, truthful release badge, progress, cancel and same-session dedup.
  await page.goto(`${base}/?mock=update-check-slow#status`);
  await page.getByRole('button',{name:'软件更新',exact:true}).click();
  check(await page.getByText('正在向官网确认最新版本…',{exact:true}).isVisible(), 'update click immediately shows checking dialog');
  await page.getByText('本机已有官网最新版本。',{exact:true}).waitFor();
  check(await page.locator('.update-dot').count() === 0, 'up-to-date installation has no fake new-version dot');
  await closeModal();
  await page.goto(`${base}/?mock=update-new#status`);
  await page.getByRole('status',{name:'发现新版本 2.9.0',exact:true}).waitFor();
  await page.evaluate(()=>localStorage.setItem('cb-mock-download-count','0'));
  await page.getByRole('button',{name:'软件更新',exact:true}).click();
  check(await page.getByRole('dialog',{name:'发现新版 Cavalry',exact:true}).isVisible(), 'official newer version has a distinct discoverable state');
  check(await page.evaluate(()=>localStorage.getItem('cb-mock-download-count')) === '0', 'checking never silently downloads');
  await page.getByRole('button',{name:'下载安装包',exact:true}).click();
  check(await page.getByRole('button',{name:'取消下载',exact:true}).isVisible(), 'download has visible busy/cancel feedback');
  await page.getByRole('button',{name:'后台下载',exact:true}).click();
  await page.getByRole('button',{name:'备份',exact:true}).click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('cb-mock-operation-log-v1')||'[]').some(entry=>entry.text.includes('Cavalry-2.9.0.dmg')));
  await page.getByRole('button',{name:'状态',exact:true}).click();
  await page.getByRole('button',{name:'软件更新',exact:true}).click();
  check(await page.getByText('Cavalry 2.9.0 已下载至“下载”文件夹。',{exact:true}).isVisible(), 'download survives section navigation and dialog close');
  check(await page.evaluate(()=>localStorage.getItem('cb-mock-download-count')) === '1', 'reopening completion does not start a duplicate download');
  check(await page.getByRole('button',{name:'打开下载位置',exact:true}).isEnabled(), 'completed package has an actionable reveal affordance');
  await closeModal();
  await page.goto(`${base}/#status`);
  await page.getByRole('button',{name:'软件更新',exact:true}).click();
  await page.getByRole('button',{name:'重新下载安装包',exact:true}).click();
  await page.getByRole('button',{name:'取消下载',exact:true}).click();
  await page.getByText('下载已取消，未完成的文件已移除。',{exact:true}).waitFor();
  check(await page.getByRole('button',{name:'重新下载安装包',exact:true}).isEnabled(), 'cancel returns to an honest retryable state');
  await page.goto(`${base}/?mock=update-check-error#status`);
  await page.getByRole('button',{name:'软件更新',exact:true}).click();
  await page.getByRole('dialog').getByRole('alert').waitFor();
  check(await page.getByRole('button',{name:'重新检查',exact:true}).isEnabled(), 'offline update has a clear retry, not a silent click');
  check(await page.locator('.update-dot').count() === 0, 'check failure never advertises an unverified new release');
  await page.goto(`${base}/?mock=update-download-error#status`);
  await page.getByRole('button',{name:'软件更新',exact:true}).click();
  await page.getByRole('button',{name:'重新下载安装包',exact:true}).click();
  await page.getByRole('dialog').getByRole('alert').waitFor();
  check((await page.getByRole('dialog').getByRole('alert').innerText()).includes('下载连接中断'), 'download failure is explicit and does not claim completion');

  // Privacy review is required before any report transport, and cancellation sends nothing.
  await page.goto(`${base}/#log`);
  await page.evaluate(()=>localStorage.setItem('cb-mock-report-send-count','0'));
  await page.getByRole('button',{name:'反馈问题',exact:true}).click();
  await page.getByLabel('问题描述',{exact:false}).fill('点击更新后卡住\npassword=do-not-send\n/Users/example/private/project.txt\nuser@example.com');
  await page.getByRole('checkbox').uncheck();
  await page.getByRole('button',{name:'预览报告',exact:true}).click();
  await page.getByText('查看原始数据',{exact:true}).click();
  const approved = await page.getByLabel('即将提交的报告内容',{exact:true}).innerText();
  check(!approved.includes('/Users/example') && !approved.includes('do-not-send') && !approved.includes('user@example.com'), 'report preview strips test paths, credentials and email');
  check(JSON.parse(approved).logs.length === 0, 'unchecked logs are not included');
  check(await page.getByRole('button',{name:'发送报告',exact:true}).isVisible(), 'unconfigured direct service uses the EmailJS API');
  check(!(await page.getByRole('dialog').innerText()).includes('@qq.com'), 'no recipient exposed even at preview');
  await closeModal();
  check(await page.evaluate(()=>localStorage.getItem('cb-mock-report-send-count')) === '0', 'preview/cancel does not invoke a send');
  await page.getByRole('button',{name:'反馈问题',exact:true}).click();
  await page.getByRole('button',{name:'预览报告',exact:true}).click();
  check(await page.locator('.report-summary').count()===0 && await page.locator('.review-delivery-note').count()===0, 'inline delivery captions are replaced by the top-right disclosure');
  const deliveryGroup=page.getByRole('group',{name:'发送方式',exact:true});
  check(await deliveryGroup.isVisible() && await page.getByRole('button',{name:'查看发送方式',exact:true}).count()===0, 'delivery toast appears automatically without an info trigger');
  const deliveryText=await deliveryGroup.innerText();
  check(deliveryText.includes('发送说明') && deliveryText.includes('报告只会在你确认后发送') && !/EmailJS|外部服务|未配置服务|开发者反馈服务/.test(deliveryText), 'delivery disclosure uses actionable copy without implementation details');
  check(await deliveryGroup.locator('strong').count()===0 && await deliveryGroup.locator('.toast-title').count()===1 && await deliveryGroup.locator('.toast-body').count()===1 && await deliveryGroup.locator('.toast-close').count()===1, 'delivery popover matches the main-toast title, body and close structure');
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'发送报告',exact:true}).click();
  await page.getByRole('dialog',{name:'反馈已提交',exact:true}).waitFor();
  check(await page.getByText('报告已提交，感谢你的反馈。',{exact:true}).isVisible(), 'successful submission uses neutral user-facing copy');
  check(emailJsRequests.length===1 && emailJsRequests[0].template_params.report_id==='mock-report-approved', 'the real browser fetch sends the reviewed report ID to EmailJS');
  check(!JSON.stringify(emailJsRequests[0]).includes('do-not-send') && !JSON.stringify(emailJsRequests[0]).includes('/Users/example'), 'the real browser payload retains preview redaction');
  await page.getByRole('button',{name:'完成',exact:true}).click();
  await page.goto(`${base}/?mock=report-oauth-cancel#log`);
  await page.evaluate(()=>localStorage.setItem('cb-mock-report-send-count','0'));
  await page.getByRole('button',{name:'反馈问题',exact:true}).click();
  await page.getByRole('button',{name:'预览报告',exact:true}).click();
  await page.getByRole('button',{name:'发送报告',exact:true}).click();
  check((await page.getByRole('dialog').getByRole('alert').innerText()).includes('外部授权已取消'), 'cancelled OAuth explains why nothing was sent');
  check(await page.evaluate(()=>localStorage.getItem('cb-mock-report-send-count')) === '0', 'cancelled OAuth never invokes the mail API');
  check(emailJsRequests.length===1, 'cancelled OAuth never reaches the EmailJS endpoint');
  await closeModal();
  await page.goto(`${base}/?mock=report-rate-limit#log`);
  await page.getByRole('button',{name:'反馈问题',exact:true}).click();
  await page.getByRole('button',{name:'预览报告',exact:true}).click();
  await page.getByRole('button',{name:'发送报告',exact:true}).click();
  check((await page.getByRole('dialog').getByRole('alert').innerText()).includes('60 秒'), 'rate-limited sends explain the required wait');
  check(await page.evaluate(()=>localStorage.getItem('cb-mock-report-send-count')) === '0', 'rate-limited sends do not count as accepted mail');
  check(emailJsRequests.length===1, 'rate-limited sends do not reach the EmailJS endpoint');
  await closeModal();
  await page.goto(`${base}/?mock=report-service#log`);
  await page.getByRole('button',{name:'反馈问题',exact:true}).click();
  await page.getByLabel('问题描述',{exact:false}).fill('合成问题反馈，不含真实日志');
  await page.getByRole('button',{name:'预览报告',exact:true}).click();
  await page.getByRole('button',{name:'发送报告',exact:true}).click();
  await page.getByRole('dialog',{name:'反馈已提交',exact:true}).waitFor();
  check(await page.getByText('报告已提交，感谢你的反馈。',{exact:true}).isVisible(), 'only an acknowledged send reaches submitted state');
  await page.getByRole('button',{name:'完成',exact:true}).click();
  check(await page.getByText('问题反馈已提交给开发者。',{exact:true}).count() === 2, 'external OAuth and service submissions each create a truthful operation entry');
  await page.goto(`${base}/?mock=report-error#log`);
  await page.getByRole('button',{name:'反馈问题',exact:true}).click();
  await page.getByRole('button',{name:'预览报告',exact:true}).click();
  await page.getByText('查看原始数据',{exact:true}).click();
  const beforeFailure = await page.getByLabel('即将提交的报告内容',{exact:true}).innerText();
  await page.getByRole('button',{name:'发送报告',exact:true}).click();
  await page.getByRole('dialog').getByRole('alert').waitFor();
  check(await page.getByLabel('即将提交的报告内容',{exact:true}).innerText() === beforeFailure, 'failed delivery retains the exact reviewed draft');
  check(await page.getByRole('button',{name:'发送报告',exact:true}).isEnabled(), 'send failure is retryable');
  check(emailJsRequests.length===2 && await page.evaluate(()=>localStorage.getItem('cb-mock-report-abort-count'))==='1', 'a failed browser response aborts without a success receipt or duplicate completion');
  await page.getByRole('button',{name:'保存报告',exact:true}).click();
  check(await page.getByRole('dialog',{name:'报告已保存',exact:true}).isVisible(), 'offline export remains usable without a service account');
  await page.getByRole('button',{name:'完成',exact:true}).click();

  // Native-style modal geometry and stable destructive targets at the minimum window size.
  await page.setViewportSize({width:700,height:540});
  await page.goto(`${base}/#log`);
  await page.getByRole('button',{name:'反馈问题',exact:true}).click();
  await page.getByRole('button',{name:'预览报告',exact:true}).click();
  const modalBounds=await page.getByRole('dialog').boundingBox();
  const sendBounds=await page.getByRole('button',{name:'发送报告',exact:true}).boundingBox();
  check(modalBounds.y >= 12 && modalBounds.y+modalBounds.height <= 528, 'report modal fits the minimum window');
  check(sendBounds.y >= modalBounds.y && sendBounds.y+sendBounds.height <= 540, 'report actions never fall below the window');
  await closeModal();
  await page.getByRole('button',{name:'备份',exact:true}).click();
  const deleteAction=page.getByRole('button',{name:/^删除备份 /}).first();
  const beforeHover=await deleteAction.boundingBox();
  await page.mouse.move(beforeHover.x+beforeHover.width/2,beforeHover.y+beforeHover.height/2);await page.waitForTimeout(280);
  const afterHover=await deleteAction.boundingBox();
  check(JSON.stringify(beforeHover) === JSON.stringify(afterHover), 'danger target remains stationary during hover');
  check(await page.locator('.collection-panel.backup-cards').count() === 1, 'backup collection keeps its semantic wrapper while rows use separate surfaces');
  await page.emulateMedia({reducedMotion:'reduce'});
  check(await deleteAction.evaluate(el=>getComputedStyle(el).transitionDuration) === '0s', 'new shared control motion honors reduced motion');

  // Continued craft pass: meaningful empty states, consistent confirmations and deliberate focus.
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.setViewportSize({width:700,height:540});
  await page.goto(`${base}/?mock=empty-backups#backup`);
  await page.getByText('暂无备份',{exact:true}).waitFor();
  const emptyBox=await page.locator('.empty-block').boundingBox();
  check(emptyBox.height >= 200, 'empty collection uses intentional room, not an accidental 100px strip');
  check(await page.locator('.empty-block').evaluate(el=>getComputedStyle(el).animationName==='empty-state-in'&&getComputedStyle(el).animationDuration==='0.45s'),'empty collection uses the Kit 450ms finite entrance');
  check(await page.getByText('应用双语时会自动保留快照，之后可在这里还原或管理。',{exact:true}).isVisible(), 'empty backup explains how a real snapshot appears');
  check(await page.locator('.empty-title').evaluate(el=>getComputedStyle(el).color) === 'rgb(40, 45, 38)', 'empty heading uses content ink rather than disabled gray');
  check(await page.locator('.empty-art').getAttribute('aria-hidden') === 'true', 'decorative empty art does not create a false action');
  await page.goto(`${base}/#log`);
  await page.getByRole('button',{name:'清除全部日志',exact:true}).click();
  await page.getByRole('button',{name:'确认清除',exact:true}).click();
  await page.getByText('尚无操作记录',{exact:true}).waitFor();
  check(await page.getByText('之后的应用、还原和设置变更会显示在这里。',{exact:true}).isVisible(), 'empty log explains its future contents');

  // Preview focuses its title; Back returns to the description, completion to Done.
  await page.getByRole('button',{name:'反馈问题',exact:true}).click();
  check(await page.getByLabel('问题描述',{exact:false}).evaluate(el=>document.activeElement===el), 'feedback opens on description');
  await page.getByRole('button',{name:'预览报告',exact:true}).click();
  check(await page.getByRole('heading',{name:'确认反馈内容',exact:true}).evaluate(el=>document.activeElement===el), 'preview focuses the content heading, never Send or Save');
  await page.getByRole('button',{name:'返回修改',exact:true}).click();
  check(await page.getByLabel('问题描述',{exact:false}).evaluate(el=>document.activeElement===el), 'returning to compose restores description focus');
  await closeModal();
  check(await page.getByRole('button',{name:'反馈问题',exact:true}).evaluate(el=>document.activeElement===el), 'closing feedback restores its original trigger');
  await page.goto(`${base}/?mock=report-service#log`);
  await page.getByRole('button',{name:'反馈问题',exact:true}).click();
  await page.getByRole('button',{name:'预览报告',exact:true}).click();
  await page.getByRole('button',{name:'发送报告',exact:true}).click();
  await page.getByRole('button',{name:'完成',exact:true}).waitFor();
  check(await page.getByRole('button',{name:'完成',exact:true}).evaluate(el=>document.activeElement===el), 'receipt focuses Done instead of an obsolete submit action');
  await closeModal();

  // Same modal contract for status and backup actions; failures preserve the decision.
  await page.goto(`${base}/#status`);
  await page.getByRole('button',{name:'应用双语',exact:true}).click();
  check(await page.getByRole('dialog',{name:'应用双语？',exact:true}).isVisible(), 'status apply uses shared modal instead of old inline strip');
  check(await page.getByRole('heading',{name:'应用双语？',exact:true}).evaluate(el=>document.activeElement===el), 'apply starts with title focus instead of a cancel outline');
  const statusModalBox=await page.getByRole('dialog').boundingBox();
  check(statusModalBox.y>=12 && statusModalBox.y+statusModalBox.height<=528, 'status confirmation fits minimum window');
  await closeModal();
  check(await page.getByRole('button',{name:'应用双语',exact:true}).evaluate(el=>document.activeElement===el), 'apply cancellation returns focus to its trigger');
  await page.goto(`${base}/?mock=apply-error#status`);
  await page.getByRole('button',{name:'应用双语',exact:true}).click();
  await page.getByRole('button',{name:'确认应用',exact:true}).click();
  await page.getByRole('dialog').getByRole('alert').waitFor();
  check(await page.getByRole('dialog',{name:'应用双语？',exact:true}).isVisible(), 'apply error stays in the shared confirmation');
  check(await page.getByRole('button',{name:'确认应用',exact:true}).isEnabled(), 'apply failure is retryable');
  await closeModal();
  await page.goto(`${base}/?mock=restore-error#status`);
  await page.getByRole('button',{name:'还原最近备份',exact:true}).click();
  await page.getByRole('button',{name:'确认还原',exact:true}).click();
  await page.getByRole('dialog').getByRole('alert').waitFor();
  check(await page.getByRole('dialog',{name:'还原最近备份？',exact:true}).isVisible(), 'restore error follows the same confirmation contract');
  await closeModal();
  await page.goto(`${base}/?mock=apply-busy#status`);
  await page.getByRole('button',{name:'应用双语',exact:true}).click();
  await page.getByRole('button',{name:'确认应用',exact:true}).click();
  check(await page.getByRole('button',{name:'取消',exact:true}).isDisabled(), 'in-flight apply cannot pretend to cancel the backend');
  await page.keyboard.press('Escape');
  check(await page.getByRole('dialog').isVisible(), 'busy confirmation retains modal protection on Escape');
  await page.getByRole('dialog').waitFor({state:'hidden'});

  // Keyboard mode changes are immediate; pointer changes retain a bounded transition.
  await page.goto(`${base}/#type`);
  await page.getByRole('radio',{name:'中文（English）',exact:true}).focus();
  await page.keyboard.press('ArrowRight');
  check(await page.locator('.segment-thumb').evaluate(el=>getComputedStyle(el).transitionDuration)==='0s', 'keyboard template choice has no motion delay');
  check(await page.locator('.settings-status').getAttribute('data-dirty') === 'true', 'unsaved draft has a semantic status marker');
  await page.getByRole('radio',{name:'中文（English）',exact:true}).click();
  check(await page.locator('.segment-thumb').evaluate(el=>getComputedStyle(el).transitionDuration)!=='0s', 'pointer template choice keeps subtle spatial feedback');
  await page.emulateMedia({reducedMotion:'reduce'});
  check(await page.locator('.segment-thumb').evaluate(el=>getComputedStyle(el).transitionDuration)==='0s', 'reduced motion overrides pointer transitions');

  // Round 5: focus and portaled menus respect the actual sticky action boundary.
  await page.emulateMedia({reducedMotion:'no-preference'});
  for (const [width,height] of [[700,540],[760,540]]) {
    await page.setViewportSize({width,height});
    await page.goto(`${base}/#type`);
    await page.getByRole('radio',{name:'自定义',exact:true}).click();
    for (const expected of ['template','zh-font','en-font']) {
      await page.keyboard.press('Tab');
      const focus=await page.evaluate(()=>{
        const el=document.activeElement, rect=el.getBoundingClientRect(), footer=document.querySelector('.settings-footer').getBoundingClientRect(), content=document.querySelector('.content').getBoundingClientRect();
        const hit=document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2);
        return {id:el.id,top:rect.top,bottom:rect.bottom,footerTop:footer.top,contentTop:content.top,unobscured:hit===el||el.contains(hit)};
      });
      check(focus.id===expected && focus.unobscured && focus.top>=focus.contentTop && focus.bottom<focus.footerTop, `${width}: keyboard field is visible above the sticky footer: ${JSON.stringify(focus)}`);
    }
    await page.keyboard.press('ArrowDown');
    await page.getByRole('listbox').waitFor();
    await page.waitForTimeout(200);
    const menuBounds=await page.getByRole('listbox').boundingBox(), footerBounds=await page.locator('.settings-footer').boundingBox();
    check(menuBounds.y>=72 && menuBounds.y+menuBounds.height<=footerBounds.y-6, `${width}: font list stays outside toolbar/footer`);
    await page.locator('.content').evaluate(el=>el.scrollTo({top:el.scrollHeight}));
    await page.getByRole('listbox').waitFor({state:'hidden'});
    check(await page.getByLabel('英文字体',{exact:true}).getAttribute('aria-expanded')==='false', 'scrolling anchor out of view closes popup');
    check(await page.getByLabel('英文字体',{exact:true}).inputValue()==='', 'scroll closing does not change saved font');
    await page.getByRole('button',{name:'日志',exact:true}).click();
    check(await page.locator('.content').evaluate(el=>getComputedStyle(el).scrollPaddingBottom)==='12px', 'hidden settings do not reserve phantom footer space in other sections');
    await page.getByRole('button',{name:'排版',exact:true}).click();
    check(await page.locator('.content').evaluate(el=>parseFloat(getComputedStyle(el).scrollPaddingBottom)>60), 'returning to settings restores actual footer inset');
  }

  // Long families remain searchable/readable; scrolling the menu itself must not close it.
  await page.setViewportSize({width:700,height:540});
  await page.goto(`${base}/?mock=font-stress#type`);
  await page.getByRole('radio',{name:'自定义',exact:true}).click();
  await page.keyboard.press('Tab');await page.keyboard.press('Tab');await page.keyboard.press('ArrowDown');
  const fontList=page.getByRole('listbox');await fontList.waitFor();
  await fontList.evaluate(el=>{el.scrollTop=160;});await page.waitForTimeout(30);
  check(await fontList.isVisible(), 'scrolling inside the font list preserves the popup');
  check(await fontList.evaluate(el=>el.scrollWidth<=el.clientWidth), 'long font-family names wrap without horizontal overflow');
  await page.getByLabel('中文字体',{exact:true}).fill('Studio Sans 79');
  const longFont='Studio Sans 79 — Extended Display Variable Font Family';
  await page.getByRole('option',{name:longFont,exact:true}).click();
  check(await page.getByLabel('中文字体',{exact:true}).inputValue()===longFont, 'long selected family retains its full value');
  check(await page.getByLabel('中文字体',{exact:true}).getAttribute('title')===longFont, 'closed long field retains a full-name tooltip');
  check(await page.getByRole('button',{name:'保存设置',exact:true}).isEnabled(), 'long-name choice remains a draft until Save');
  await page.getByRole('button',{name:'取消更改',exact:true}).click();
  check(await page.getByLabel('中文字体',{exact:true}).inputValue()==='', 'cancel still restores the original font after long-name selection');

  // Save failures persist beside the action, not below the long settings/preview content.
  for (const fixture of ['save-error','save-error-long']) {
    await page.goto(`${base}/?mock=${fixture}#type`);
    await page.getByRole('radio',{name:'English（中文）',exact:true}).click();
    await page.getByRole('button',{name:'保存设置',exact:true}).click();
    await page.getByRole('alert').waitFor();
    await page.waitForTimeout(50);
    const failure=await page.getByRole('alert').boundingBox(), save=await page.getByRole('button',{name:'保存设置',exact:true}).boundingBox();
    check(failure.y>=64 && failure.y+failure.height<=508, `${fixture}: persistent failure is inside the viewport`);
    check(save.y>=failure.y+failure.height && save.y+save.height<=508, `${fixture}: retry remains below the visible error and above footer`);
    check(await page.getByRole('button',{name:'保存设置',exact:true}).getAttribute('aria-describedby')==='settings-save-error', 'save action references its persistent error');
    check(await page.locator('.toast[data-kind="error"] .toast-body').innerText()==='设置保存未完成，详细原因已保留在保存栏。','long save diagnostics stay detailed in context and concise in the toast');
    check(await page.locator('.toast-stack').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=window.innerHeight;}),'notification stack remains inside the viewport after a long save failure');
    check(await page.getByText('保存未完成，更改仍保留',{exact:true}).isVisible(), 'save failure communicates preserved draft');
    while(await page.locator('.toast-close').count()){await page.locator('.toast-close').first().click();await page.waitForTimeout(180);}
    check(await page.getByRole('alert').isVisible(), 'closing transient toast never removes the actionable save error');
    check(await page.locator('.content').evaluate(el=>parseFloat(getComputedStyle(el).scrollPaddingBottom)>=document.querySelector('.settings-footer').getBoundingClientRect().height+23), 'scroll inset grows with actual error/footer height');
    if(fixture==='save-error-long') {
      check(await page.locator('.settings-save-error p').evaluate(el=>el.scrollHeight>el.clientHeight),'long error is locally scrollable rather than pushing actions out');
      await page.getByLabel('保存失败原因',{exact:true}).focus();
      await page.keyboard.press('ArrowDown');await page.waitForTimeout(150);
      check(await page.getByLabel('保存失败原因',{exact:true}).evaluate(el=>document.activeElement===el&&el.scrollTop>0),'long failure reason can be read with keyboard scrolling');
    }
    await page.getByRole('button',{name:'取消更改',exact:true}).click();
    check(await page.getByRole('alert').count()===0, 'cancel clears failure display together with discarded draft');
    check(await page.getByRole('button',{name:'保存设置',exact:true}).isDisabled(), 'original settings survive cancelled failed save');
  }

  // Round 6: a failed read is never presented as infinite loading or confirmed empty data.
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.setViewportSize({width:700,height:540});
  await page.goto(`${base}/?mock=config-error#type`);
  await page.getByRole('heading',{name:'设置读取失败',exact:true}).waitFor();
  check(await page.getByRole('button',{name:'重新读取设置',exact:true}).isEnabled(), 'configuration failure offers a local retry');
  check(await page.locator('.settings-fields').count()===0, 'failed configuration never enables defaults as if loaded');
  check(await page.getByText('正在读取已保存的设置…',{exact:true}).count()===0, 'configuration rejection stops the loading claim');
  await page.waitForTimeout(180);
  check(await page.getByRole('heading',{name:'设置读取失败',exact:true}).isVisible(), 'configuration failure waits for manual retry, not a background loop');
  await page.goto(`${base}/?mock=config-error-once#type`);
  await page.getByRole('button',{name:'重新读取设置',exact:true}).click();
  await page.getByLabel('中文字体',{exact:true}).waitFor();
  check(await page.getByRole('button',{name:'保存设置',exact:true}).isDisabled(), 'retry loads saved configuration without creating a draft');
  check(await page.getByRole('radio',{name:'中文（English）',exact:true}).evaluate(el=>document.activeElement===el), 'settings retry returns focus to the loaded controls');
  check(await page.getByRole('alert').count()===0, 'configuration retry removes the failure state after success');
  await page.goto(`${base}/?mock=config-slow#type`);
  check(await page.getByRole('heading',{name:'正在读取已保存的设置…',exact:true}).isVisible(), 'slow settings have a truthful loading state');
  check(await page.getByRole('button',{name:'保存设置',exact:true}).count()===0, 'initial loading cannot write defaults');
  await page.getByLabel('中文字体',{exact:true}).waitFor();

  await page.goto(`${base}/?mock=backups-error#backup`);
  await page.getByRole('heading',{name:'备份读取失败',exact:true}).waitFor();
  check(await page.getByText('暂无备份',{exact:true}).count()===0, 'unreadable backup list is not an empty-backup claim');
  check((await page.locator('.collection-count').innerText()).includes('—'), 'unknown backup count stays unknown, not zero');
  check(await page.getByRole('button',{name:'重新读取备份',exact:true}).isEnabled(), 'backup failure offers a nearby retry');
  await page.goto(`${base}/?mock=backups-error-once#backup`);
  await page.getByRole('button',{name:'重新读取备份',exact:true}).click();
  await page.locator('.backup-cards > li').nth(3).waitFor();
  check(await page.locator('.backup-cards > li').count()===4, 'successful backup retry restores the genuine list');
  check(await page.locator('.collection-count').evaluate(el=>document.activeElement===el), 'backup retry restores context at the count, not a destructive action');
  await page.goto(`${base}/?mock=backups-stale#backup`);
  await page.locator('.backup-cards > li').nth(3).waitFor();
  const previousNames=await page.locator('.backup-title').allTextContents();
  await page.getByRole('button',{name:'刷新状态',exact:true}).click();
  await page.getByRole('heading',{name:'备份列表未能刷新',exact:true}).waitFor();
  check(JSON.stringify(await page.locator('.backup-title').allTextContents())===JSON.stringify(previousNames), 'refresh failure retains the last good snapshot list');
  check(await page.getByText('保留上次读取的快照，列表可能不是最新状态。',{exact:true}).isVisible(), 'retained list is honestly marked stale');
  await page.getByRole('button',{name:'重新读取备份',exact:true}).click();
  await page.getByRole('heading',{name:'备份列表未能刷新',exact:true}).waitFor({state:'hidden'});
  check(await page.locator('.backup-cards > li').count()===4, 'stale-list retry does not discard snapshots');
  await page.goto(`${base}/?mock=backups-slow#backup`);
  check(await page.getByRole('heading',{name:'正在读取备份…',exact:true}).isVisible(), 'initial backup scan has a distinct pending state');
  check(await page.getByText('暂无备份',{exact:true}).count()===0, 'pending scan does not flash the empty state');
  await page.locator('.backup-cards > li').nth(3).waitFor();

  await page.goto(`${base}/?mock=fonts-error-once#type`);
  await page.getByRole('heading',{name:'字体列表读取失败',exact:true}).waitFor();
  check(await page.getByText('字体列表未载入',{exact:true}).isVisible(), 'font-card header signals failed enumeration even before scrolling to recovery details');
  check(await page.getByLabel('中文字体',{exact:true}).isDisabled(), 'failed font list cannot masquerade as an editable default-only choice');
  check(await page.getByLabel('中文字体',{exact:true}).inputValue()==='PingFang SC' && await page.getByLabel('英文字体',{exact:true}).inputValue()==='Arial', 'saved font selections stay visible when font enumeration fails');
  await page.getByRole('button',{name:'日志',exact:true}).click();
  check((await page.locator('.log-detail pre').allTextContents()).some(text=>text.includes('模拟fonts读取失败')), 'font error retains its diagnostic in local logs rather than hiding it entirely');
  await page.getByRole('button',{name:'排版',exact:true}).click();
  await page.getByRole('radio',{name:'English（中文）',exact:true}).click();
  await page.getByRole('button',{name:'重新读取字体',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('#zh-font').disabled);
  check(await page.getByRole('radio',{name:'English（中文）',exact:true}).getAttribute('aria-checked')==='true', 'retrying font enumeration never resets a typography draft');
  check(await page.getByRole('button',{name:'取消更改',exact:true}).isEnabled(), 'draft remains cancellable after resource retry');
  check(await page.getByRole('heading',{name:'字体列表读取失败',exact:true}).count()===0, 'font retry clears error after success');
  check(await page.getByLabel('中文字体',{exact:true}).evaluate(el=>document.activeElement===el), 'font retry brings keyboard focus back to the enabled picker');
  await page.getByRole('button',{name:'取消更改',exact:true}).click();
  check(await page.getByRole('button',{name:'保存设置',exact:true}).isDisabled(), 'cancel still restores the saved settings after retry');
  await page.goto(`${base}/?mock=fonts-slow#type`);
  await page.getByLabel('中文字体',{exact:true}).waitFor();
  check(await page.getByText('正在读取本机字体…',{exact:true}).isVisible(), 'slow font enumeration has inline progress feedback');
  check(await page.getByLabel('中文字体',{exact:true}).isDisabled(), 'pending font enumeration cannot overwrite an existing font');
  await page.waitForFunction(()=>!document.querySelector('#zh-font').disabled);
  check(await page.getByLabel('中文字体',{exact:true}).inputValue()==='PingFang SC', 'enumeration completion preserves selected family');

  // Round 7: failed detection is unknown, never an unverified not-installed result.
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.setViewportSize({width:700,height:540});
  await page.goto(`${base}/?mock=status-error#status`);
  await page.getByRole('heading',{name:'暂时无法检测 Cavalry',exact:true}).waitFor();
  check((await page.locator('.status-capsule').innerText()).includes('检测未完成'), 'initial detection failure has a truthful header capsule');
  check(await page.locator('.summary-hero').count()===0, 'unknown detection does not fabricate a missing-installation summary');
  check(await page.getByRole('button',{name:'应用双语',exact:true}).count()===0, 'unknown detection never exposes an actionable apply command');
  check(await page.getByRole('button',{name:'重新检测',exact:true}).isEnabled(), 'failed detection has an in-context retry');
  await page.goto(`${base}/?mock=status-error-once#status`);
  await page.getByRole('button',{name:'重新检测',exact:true}).click();
  await page.locator('.summary-hero').waitFor();
  check(await page.locator('.summary-hero').innerText()==='双语已应用', 'manual retry shows the actual detected state');
  check(await page.locator('.summary-hero').evaluate(el=>document.activeElement===el), 'retry returns keyboard context to the refreshed summary');
  await page.goto(`${base}/?mock=status-missing#status`);
  await page.getByRole('heading',{name:'未检测到 Cavalry',exact:true}).waitFor();
  check(await page.getByRole('heading',{name:'暂时无法检测 Cavalry',exact:true}).count()===0, 'genuinely missing installation remains distinct from detection failure');
  await page.goto(`${base}/?mock=status-slow#status`);
  check(await page.getByRole('heading',{name:'正在检测 Cavalry…',exact:true}).isVisible(), 'slow detection uses shared pending-state styling');
  await page.locator('.summary-hero').waitFor();
  await page.goto(`${base}/?mock=status-stale#status`);
  await page.getByRole('button',{name:'刷新状态',exact:true}).waitFor({state:'visible'});
  await page.waitForFunction(()=>!document.querySelector('.tb-refresh').disabled);
  await page.getByRole('button',{name:'刷新状态',exact:true}).click();
  await page.getByRole('heading',{name:'状态未能刷新',exact:true}).waitFor();
  check((await page.locator('.status-capsule').innerText()).includes('状态未刷新'), 'stale status is marked in the header');
  check(await page.locator('.summary-hero').innerText()==='双语已应用', 'failed refresh retains last good result with a visible stale warning');
  check(await page.getByRole('button',{name:'应用双语',exact:true}).isDisabled() && await page.getByRole('button',{name:'还原最近备份',exact:true}).isDisabled(), 'stale detection blocks apply and restore until rechecked');
  check(await page.locator('#status-action-hint').isVisible(), 'disabled status actions keep a persistent local reason');
  await page.getByRole('button',{name:'重新检测',exact:true}).click();
  await page.getByRole('heading',{name:'状态未能刷新',exact:true}).waitFor({state:'hidden'});
  check(await page.getByRole('button',{name:'应用双语',exact:true}).isEnabled(), 'successful recheck restores allowed operations');

  // The target file write and follow-up read form one visible, non-repeatable operation.
  await page.goto(`${base}/?mock=target-switch-slow#status`);
  const targetPicker=page.getByRole('combobox',{name:'Cavalry 目标版本',exact:true});
  await targetPicker.click();await page.getByRole('option',{name:/Cavalry 2.8.0/}).click();
  check(await page.getByText('尚未切换 · 当前目标仍为 Cavalry 2.7.2',{exact:true}).isVisible(), 'draft version choice is visibly different from the confirmed target');
  const switchBefore=await page.getByRole('button',{name:'切换 Cavalry',exact:true}).boundingBox();
  await page.getByRole('button',{name:'切换 Cavalry',exact:true}).click();
  const switching=page.getByRole('button',{name:'正在切换 Cavalry',exact:true});
  check(await switching.isDisabled() && await targetPicker.isDisabled(), 'in-flight target switch cannot be repeated or retargeted');
  check(await switching.getAttribute('aria-busy')==='true' && await switching.evaluate(el=>getComputedStyle(el).opacity)==='1', 'working target switch stays readable and is distinct from an unavailable control');
  check(await page.getByRole('button',{name:'应用双语',exact:true}).isDisabled() && await page.getByRole('button',{name:'还原最近备份',exact:true}).isDisabled(), 'host actions are blocked across the target transition');
  check(await page.getByRole('button',{name:'排版',exact:true}).isDisabled() && await page.getByRole('button',{name:'刷新状态',exact:true}).isDisabled(), 'navigation and refresh cannot create overlapping target transitions');
  const switchDuring=await switching.boundingBox();
  check(switchDuring.width===switchBefore.width, 'switch button retains stable geometry while showing progress');
  check((await page.locator('.status-capsule').innerText()).includes('正在切换目标'), 'target transition has immediate visible acknowledgement');
  await switching.evaluate(el=>el.click());
  check(await page.evaluate(()=>localStorage.getItem('cb-mock-target-switch-count'))==='1', 'disabled repeated click does not issue a second target write');
  await page.waitForFunction(()=>!document.querySelector('#cavalry-target').disabled);
  check(await targetPicker.inputValue()==='Cavalry 2.8.0', 'completed switch retains the selected version');
  check(await page.locator('.meta-cell .v').first().innerText()==='2.8.0', 'summary now comes from the confirmed target read');
  check(await targetPicker.evaluate(el=>document.activeElement===el), 'switch completion returns focus to target context');
  check(await page.getByRole('button',{name:'应用双语',exact:true}).isDisabled(), 'new target still respects its own compatibility guard');

  await page.goto(`${base}/?mock=target-switch-error-once#status`);
  await targetPicker.click();await page.getByRole('option',{name:/Cavalry 2.8.0/}).click();
  await page.getByRole('button',{name:'切换 Cavalry',exact:true}).click();
  await page.getByRole('heading',{name:'未完成目标切换',exact:true}).waitFor();
  check(await targetPicker.inputValue()==='Cavalry 2.8.0' && await page.locator('.meta-cell .v').first().innerText()==='2.7.2', 'write failure keeps the proposed version and original confirmed summary distinct');
  check(await page.getByRole('button',{name:'重试切换 Cavalry',exact:true}).isEnabled(), 'switch failure has a clear retry action');
  const targetFailureBounds=await page.getByRole('heading',{name:'未完成目标切换',exact:true}).boundingBox();
  check(targetFailureBounds.y>=64 && targetFailureBounds.y+targetFailureBounds.height<=508, 'switch failure stays visible near its retry even in the minimum window');
  check(await targetPicker.evaluate(el=>document.activeElement===el), 'failure also restores keyboard context');
  await page.keyboard.press('Tab');await page.keyboard.press('Enter');
  await page.waitForFunction(()=>!document.querySelector('#cavalry-target').disabled);
  await page.getByRole('heading',{name:'未完成目标切换',exact:true}).waitFor({state:'hidden'});
  check(await page.locator('.meta-cell .v').first().innerText()==='2.8.0', 'keyboard retry can complete the intended switch');
  check(await page.evaluate(()=>localStorage.getItem('cb-mock-target-switch-count'))==='2', 'manual retry creates exactly one additional write');

  await page.goto(`${base}/?mock=target-switch-status-error#status`);
  await targetPicker.click();await page.getByRole('option',{name:/Cavalry 2.8.0/}).click();
  await page.getByRole('button',{name:'切换 Cavalry',exact:true}).click();
  await page.getByRole('heading',{name:'状态未能刷新',exact:true}).waitFor();
  await page.waitForFunction(()=>!document.querySelector('#cavalry-target').disabled);
  check(await page.getByRole('heading',{name:'未完成目标切换',exact:true}).count()===0, 'acknowledged target write is not falsely reported as a failed write when status read fails');
  check(await page.getByRole('button',{name:'应用双语',exact:true}).isDisabled() && await page.getByRole('button',{name:'还原最近备份',exact:true}).isDisabled(), 'unverified post-switch state cannot enable host actions');
  await page.getByRole('button',{name:'重新检测',exact:true}).click();
  await page.getByRole('heading',{name:'状态未能刷新',exact:true}).waitFor({state:'hidden'});
  check(await page.locator('.meta-cell .v').first().innerText()==='2.8.0', 'recheck follows the already confirmed new target, not the previous installation');

  // No selected installation is not the same thing as the first available installation.
  await page.goto(`${base}/?mock=target-switch-unselected#status`);
  await page.getByRole('heading',{name:'未检测到 Cavalry',exact:true}).waitFor();
  check(await page.getByRole('button',{name:'切换 Cavalry',exact:true}).isEnabled(), 'first available version remains switchable when the saved target is missing');
  check(await page.getByText('尚未切换 · 当前目标未在本机找到',{exact:true}).isVisible(), 'available version is not falsely labelled the confirmed target');
  await page.getByRole('button',{name:'切换 Cavalry',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('#cavalry-target').disabled);
  check(await page.locator('.summary-hero').innerText()==='双语已应用', 'confirming the available target recovers from a missing saved installation');

  await page.goto(`${base}/#status`);
  await targetPicker.click();await page.getByRole('option',{name:/Cavalry 2.8.0/}).click();
  await page.getByRole('button',{name:'切换 Cavalry',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.meta-cell .v')?.textContent==='2.8.0');
  check(await page.getByRole('button',{name:'切换 Cavalry',exact:true}).isDisabled(), 'ordinary browser demo also follows confirmed target changes, not only special test fixtures');

  await page.goto(`${base}/?mock=choose-path#status`);
  const originalTargetNote = await page.locator('.target-card-note').innerText();
  await page.getByRole('button',{name:'选择 Cavalry 安装路径',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.target-card-note')?.textContent?.includes('E:\\Cavalry'));
  check(await page.locator('.target-card-note').innerText()==='当前路径：E:\\Cavalry', 'choosing a custom directory confirms and displays the exact target path');
  await targetPicker.click();
  check(await page.getByRole('option',{name:/E:\\Cavalry/}).isVisible(), 'same-version installations remain distinguishable by path in the picker');
  await page.keyboard.press('Escape');

  await page.goto(`${base}/?mock=choose-path-cancel#status`);
  const beforeCancel = await page.locator('.target-card-note').innerText();
  await page.getByRole('button',{name:'选择 Cavalry 安装路径',exact:true}).click();
  check(await page.locator('.target-card-note').innerText()===beforeCancel && await page.getByRole('heading',{name:'未完成目标切换',exact:true}).count()===0, 'cancelling the native picker preserves the confirmed target without an error');

  await page.goto(`${base}/?mock=choose-path-invalid#status`);
  await page.getByRole('button',{name:'选择 Cavalry 安装路径',exact:true}).click();
  await page.getByRole('heading',{name:'未完成目标切换',exact:true}).waitFor();
  check((await page.locator('.target-card .resource-state').innerText()).includes('不是可识别的 Cavalry 安装目录'), 'an invalid directory explains why it was rejected');
  check(await page.locator('.target-card-note').innerText()===originalTargetNote, 'an invalid directory preserves the previous confirmed target');

  await page.goto(`${base}/?mock=status-error#status`);
  await page.getByRole('heading',{name:'暂时无法检测 Cavalry',exact:true}).waitFor();
  check(await targetPicker.isEnabled(), 'failed detection retains the benign alternate-target recovery path');
  await targetPicker.click();await page.getByRole('option',{name:/Cavalry 2.8.0/}).click();
  await page.getByRole('button',{name:'切换 Cavalry',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('#cavalry-target').disabled);
  check(await targetPicker.inputValue()==='Cavalry 2.8.0', 'another recognized target can be selected even while status reads fail');
  check(await page.getByRole('button',{name:'应用双语',exact:true}).count()===0 && (await page.locator('.status-capsule').innerText()).includes('检测未完成'), 'alternate-target recovery never turns a failed read into an enabled host mutation');

  await page.goto(`${base}/#status`);
  check(await page.locator('.cta-coral .dot').count()===0, 'applied CTA removes the residual notification dot');
  await page.goto(`${base}/?mock=status-28#status`);
  check(await page.locator('.cta-coral .dot').count()===1, 'actionable CTA keeps its notification dot');
  await page.goto(`${base}/#type`);
  check(await page.locator('.font-card .field-help').innerText()==='留空跟随系统；英文优先、中文回退，仅影响 Cavalry 界面。', 'font guidance stays short and preserves the interface-only boundary');
  await page.goto(`${base}/#log`);
  await page.getByRole('button',{name:'清除全部日志',exact:true}).click();
  const clearCancel=page.getByRole('button',{name:'取消',exact:true});
  check(await clearCancel.getAttribute('class')==='secondary-button' && await clearCancel.evaluate(el=>document.activeElement!==el), 'cancel matches the clear-log button without an initial green focus ring');
  await page.keyboard.press('Tab');await page.keyboard.press('Tab');
  check(await clearCancel.evaluate(el=>document.activeElement===el&&el.matches(':focus-visible')), 'keyboard can still explicitly focus the cancel button');
  await closeModal();

  // Round 8: readable review renders every approved field without modifying the native payload.
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.setViewportSize({width:700,height:540});
  const reviewLogs=Array.from({length:20},(_,index)=>({time:`2026-10-19 15:${String(index).padStart(2,'0')}`,text:`合成记录 ${index+1}：${'这是需要完整检查的诊断信息。'.repeat(8)}`}));
  await page.goto(`${base}/#log`);
  await page.evaluate(entries=>localStorage.setItem('cb-mock-operation-log-v1',JSON.stringify(entries)),reviewLogs);
  await page.reload();
  await page.getByRole('button',{name:'反馈问题',exact:true}).click();
  check(await page.getByText('描述本次问题，可选择附带最近的操作记录。',{exact:true}).isVisible(),'feedback introduction explains the concrete compose action');
  check(await page.locator('.report-message-label .muted').count()===0 && !((await page.locator('.report-input-hint').innerText()).includes('先预览内容')),'redundant optional and preview hints are removed');
  check(await page.locator('.report-privacy').innerText().then(text=>text.includes('不读取工程文件')&&text.includes('脱敏预览')),'privacy and review boundaries remain in the report dialog');
  const description='选择字体后预览没有变化。\n请确认 <测试内容> 是否会被保留。';
  await page.getByLabel('问题描述',{exact:false}).fill(description);
  check(await page.getByLabel('已填写字符数',{exact:true}).innerText()===`${description.length} / 2000`, 'feedback description has a truthful character counter');
  await page.getByRole('button',{name:'预览报告',exact:true}).click();
  const readableReview=page.getByRole('region',{name:'报告内容预览',exact:true});
  check(await readableReview.isVisible(), 'approved preview defaults to a readable document, not raw JSON');
  check(await page.getByRole('heading',{name:'确认反馈内容',exact:true}).evaluate(el=>document.activeElement===el), 'readable review retains deliberate title focus');
  check(await page.getByLabel('即将提交的报告内容',{exact:true}).isHidden(), 'raw serialized payload stays collapsed by default');
  check(await page.locator('.review-message').textContent()===description, 'human review preserves message text and line breaks exactly');
  check(await page.locator('.review-message').locator('*').count()===0, 'description markup remains text in the review');
  check(await page.locator('.review-environment dd').allTextContents().then(values=>JSON.stringify(values)===JSON.stringify(['Cavalry Bilingual','0.1.2','2.7.2'])), 'only tool and Cavalry versions appear in the human review');
  check(await page.getByRole('region',{name:'版本信息',exact:true}).isVisible(), 'environment section is simplified to version information');
  check(await page.locator('.review-logs li').count()===20, 'review retains all attached records, including below the fold');
  check(JSON.stringify(await page.locator('.review-logs p').allTextContents())===JSON.stringify(reviewLogs.map(entry=>entry.text)), 'operation text is not silently summarized or truncated');
  check(JSON.stringify(await page.locator('.review-logs time').allTextContents())===JSON.stringify(reviewLogs.map(entry=>entry.time)), 'operation times retain the approved order');
  check(await readableReview.evaluate(el=>el.scrollHeight>el.clientHeight && el.tabIndex===0), 'long review has an explicit keyboard-scroll entry');
  await readableReview.focus();
  await page.keyboard.press('End');await page.waitForTimeout(160);
  check(await readableReview.evaluate(el=>el.scrollTop>0), 'keyboard can scroll through the attached records');
  await waitForModalSettled();
  const reviewBounds=await readableReview.boundingBox(), reviewActionBounds=await page.getByRole('button',{name:'发送报告',exact:true}).boundingBox();
  check(reviewBounds.y>=64 && reviewBounds.y+reviewBounds.height<=reviewActionBounds.y, 'review scroll surface never overlays its actions');
  check(reviewActionBounds.y+reviewActionBounds.height<=528, 'long report keeps final actions inside the minimum window');
  check(await page.getByRole('group',{name:'发送方式',exact:true}).isVisible() && await page.getByRole('button',{name:'查看发送方式',exact:true}).count()===0 && await page.locator('.report-preview-shell').evaluate(el=>getComputedStyle(el).paddingTop)==='0px', 'automatic delivery toast removes the trigger and its reserved space');
  const deliveryNote=await page.getByRole('group',{name:'发送方式',exact:true}).boundingBox();
  check(await page.getByRole('button',{name:'发送报告',exact:true}).evaluate(el=>{const rect=el.getBoundingClientRect();const hit=document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2);return hit===el||el.contains(hit);}), 'delivery popover remains reachable without covering report actions');
  check(Math.abs(deliveryNote.y-76)<=1 && Math.abs(deliveryNote.x+deliveryNote.width-(700-16))<=1, 'delivery details use the same right-side floating geometry as main-window toasts');
  const deliveryClose=page.getByRole('button',{name:'关闭通知：发送说明',exact:true});
  const deliveryCloseBounds=await deliveryClose.boundingBox();
  check(deliveryCloseBounds.x>=0 && deliveryCloseBounds.x+deliveryCloseBounds.width<=700 && await deliveryClose.evaluate(el=>{const rect=el.getBoundingClientRect();const hit=document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2);return hit===el||el.contains(hit);}), 'delivery close control is fully visible and not clipped by the modal');
  await page.keyboard.press('Escape');
  check(await page.getByRole('dialog').count()===1 && await page.getByRole('group',{name:'发送方式',exact:true}).count()===0, 'Escape closes only the delivery popover and leaves the parent dialog open');
  check(await page.getByRole('heading',{name:'确认反馈内容',exact:true}).evaluate(el=>document.activeElement===el), 'closing the automatic delivery toast restores focus to the report heading');
  await page.getByText('查看原始数据',{exact:true}).click();
  const originalReport=await page.getByLabel('即将提交的报告内容',{exact:true}).innerText();
  const originalParsed=JSON.parse(originalReport);
  check(originalParsed.message===description && JSON.stringify(originalParsed.logs)===JSON.stringify(reviewLogs), 'expanded original data matches the human review without rebuilding the report');
  check(!('platform' in originalParsed) && !('architecture' in originalParsed), 'approved report omits system and architecture details');
  check(await page.locator('.review-raw summary').evaluate(el=>el.getBoundingClientRect().height)>=36, 'raw-data disclosure uses the shared target height');
  await page.getByText('查看原始数据',{exact:true}).click();
  await page.getByRole('button',{name:'返回修改',exact:true}).click();
  check(await page.getByLabel('问题描述',{exact:false}).inputValue()===description, 'returning from review preserves the description');
  await page.getByRole('checkbox').uncheck();
  await page.getByRole('button',{name:'预览报告',exact:true}).click();
  check(await page.getByText('不附带操作记录。',{exact:true}).isVisible() && await page.locator('.review-logs li').count()===0, 'opting out removes records from the readable preview');
  await page.getByRole('button',{name:'返回修改',exact:true}).click();
  await page.getByLabel('问题描述',{exact:false}).fill('');
  await page.getByRole('button',{name:'预览报告',exact:true}).click();
  check(await page.getByText('未填写问题描述。',{exact:true}).isVisible(), 'optional blank message is represented honestly, not fabricated content');
  await closeModal();

  // Unknown fields must never disappear in a partial human rendering of approved data.
  for (const [fixture,expected] of [['report-extra-field','这是新增字段，必须在完整预览中显示'],['report-extra-log-field','新的记录字段同样不得遗漏'],['report-invalid-shape','完整原文必须仍能检查']]) {
    await page.goto(`${base}/?mock=${fixture}#log`);
    await page.getByRole('button',{name:'反馈问题',exact:true}).click();
    await page.getByRole('button',{name:'预览报告',exact:true}).click();
    check(await page.getByRole('region',{name:'报告内容预览',exact:true}).count()===0, `${fixture}: unknown shape does not produce an incomplete curated preview`);
    const fullPreview=page.getByLabel('即将提交的报告内容',{exact:true});
    check(await fullPreview.isVisible() && (await fullPreview.innerText()).includes(expected), `${fixture}: complete original stays visibly reviewable`);
    check(await fullPreview.getAttribute('tabindex')==='0', 'fallback original can be keyboard scrolled');
    check(await page.getByText('报告格式有变化，请检查以下完整内容后再决定是否发送。',{exact:true}).isVisible(), 'fallback explains why the full original is shown');
    await closeModal();
  }

  await page.goto(`${base}/#log`);
  await page.getByRole('button',{name:'反馈问题',exact:true}).click();
  await page.getByRole('button',{name:'预览报告',exact:true}).click();
  await page.getByRole('button',{name:'返回修改',exact:true}).click();
  await page.getByLabel('问题描述',{exact:false}).fill('x'.repeat(2000));
  check(await page.getByLabel('已填写字符数',{exact:true}).innerText()==='2000 / 2000', 'long composition counter follows the actual textarea limit');
  check(await page.getByLabel('问题描述',{exact:false}).getAttribute('maxlength')==='2000', 'description retains its existing input limit');
  await page.getByRole('button',{name:'预览报告',exact:true}).click();
  await page.getByRole('button',{name:'保存报告',exact:true}).click();
  const savedLocation=page.getByText('查看保存位置',{exact:true});await savedLocation.waitFor();
  check(await savedLocation.locator('..').evaluate(el=>el.getBoundingClientRect().height)>=36, 'saved-report location disclosure follows the same reachable target geometry');
  await page.getByRole('button',{name:'完成',exact:true}).click();

  // Round 9: available quiet actions are readable and distinct from true disabled controls.
  const renderedInkContrast = async locator => locator.evaluate(el => {
    const rgba=value=>{const channels=value.match(/[\d.]+/g)?.map(Number)??[];return [channels[0]??0,channels[1]??0,channels[2]??0,channels[3]??1];};
    const over=(color,background)=>color.slice(0,3).map((channel,index)=>channel*color[3]+background[index]*(1-color[3]));
    const linear=channel=>{const value=channel/255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4;};
    const luminance=color=>color.reduce((sum,channel,index)=>sum+linear(channel)*[.2126,.7152,.0722][index],0);
    const ancestors=[];for(let node=el;node;node=node.parentElement)ancestors.unshift(node);
    let background=[255,255,255];for(const node of ancestors)background=over(rgba(getComputedStyle(node).backgroundColor),background);
    const foreground=over(rgba(getComputedStyle(el).color),background),a=luminance(foreground),b=luminance(background);
    return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  });
  await page.emulateMedia({reducedMotion:'no-preference'});
  for(const [width,height] of [[700,540],[1000,760]]) {
    await page.setViewportSize({width,height});
    await page.goto(`${base}/#type`);
    for(const label of ['English（中文）','自定义']) {
      const option=page.getByRole('radio',{name:label,exact:true});
      check(await option.isEnabled() && await renderedInkContrast(option)>=4.5, `${width}: available unselected option ${label} uses readable ink`);
      check(await option.getAttribute('aria-checked')==='false', 'improving ink never pretends an unselected option is selected');
    }
    const reset=page.getByRole('button',{name:'恢复默认',exact:true});
    await reset.scrollIntoViewIfNeeded();await page.mouse.move(12,12);await page.waitForTimeout(170);
    check(await renderedInkContrast(reset)>=4.5, 'restore-default action is readable before hover');
    const resetRest=await reset.boundingBox();
    await reset.hover();await page.waitForTimeout(280);
    check(await reset.evaluate(el=>getComputedStyle(el).color)==='rgb(40, 45, 38)', 'quiet action hover uses the common content ink');
    check(await reset.evaluate(el=>getComputedStyle(el).backgroundColor)==='rgba(0, 0, 0, 0)', 'low-priority reset remains a text action rather than a filled primary control');
    check(await reset.evaluate(el=>getComputedStyle(el).transform)==='none' && await reset.boundingBox().then(rect=>rect.width===resetRest.width&&rect.height===resetRest.height), 'quiet text-action hover does not change its target geometry');
    await page.getByRole('radio',{name:'中文（English）',exact:true}).focus();
    await page.keyboard.press('Tab');await page.keyboard.press('Tab');await page.keyboard.press('Tab');
    check(await reset.evaluate(el=>document.activeElement===el&&el.matches(':focus-visible')), 'keyboard reaches the reset action with an explicit focus state');
    await page.waitForTimeout(280);
    check(await reset.evaluate(el=>getComputedStyle(el).color)==='rgb(40, 45, 38)', 'keyboard quiet-action ink is as legible as pointer hover');
    const disabledCancel=page.getByRole('button',{name:'取消更改',exact:true});
    check(await disabledCancel.isDisabled() && await disabledCancel.evaluate(el=>parseFloat(getComputedStyle(el).opacity))<.6, 'real disabled draft controls remain visibly different from available quiet actions');
    await page.getByRole('button',{name:'状态',exact:true}).click();
    const backupLink=page.getByRole('button',{name:'查看备份 →',exact:true});
    await backupLink.scrollIntoViewIfNeeded();await page.mouse.move(12,12);await page.waitForTimeout(170);
    check(await renderedInkContrast(backupLink)>=4.5, 'backup navigation is readable without becoming the primary action');
    await backupLink.click();await page.locator('.backup-cards > li').first().waitFor();
    const rowRestore=page.getByRole('button',{name:/^还原备份 /}).first(), rowDelete=page.getByRole('button',{name:/^删除备份 /}).first();
    await rowRestore.focus();await page.keyboard.press('Tab');await page.waitForTimeout(280);
    check(await rowDelete.evaluate(el=>document.activeElement===el&&el.matches(':focus-visible')), 'keyboard can focus the row danger action without activating it');
    check(await rowDelete.evaluate(el=>{const s=getComputedStyle(el.closest('.backup-row'),'::before');return s.borderTopWidth==='0px'&&s.boxShadow.includes('1.5px')}),'keyboard focus uses Kit 1.5px inset emphasis without moving the hit target');
    check(await rowDelete.evaluate(el=>getComputedStyle(el).color)==='rgb(160, 68, 53)', 'direct keyboard danger focus has the same risk ink as direct hover');
    check(await rowDelete.evaluate(el=>getComputedStyle(el).backgroundColor)==='rgb(249, 236, 230)', 'danger focus has its semantic wash without shifting the row');
    check(await page.getByRole('dialog').count()===0, 'focusing danger only provides feedback; it never performs deletion');
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(`${base}/#type`);
  check(await page.getByRole('button',{name:'恢复默认',exact:true}).evaluate(el=>getComputedStyle(el).transitionDuration.split(',').every(value=>parseFloat(value)===0)), 'quiet-action feedback still respects reduced motion');

  // Round 10: content-aware picker direction, independent rows and redesigned log paths.
  await page.emulateMedia({reducedMotion:'no-preference'});
  for (const [width,height] of [[700,540],[1000,760],[1280,800]]) {
    await page.setViewportSize({width,height});
    await page.goto(`${base}/#type`);
    const font=page.getByLabel('中文字体',{exact:true});
    await font.scrollIntoViewIfNeeded();await font.click();
    const menu=page.getByRole('listbox');await menu.waitFor();await page.waitForTimeout(280);
    const geometry=await menu.evaluate(el=>{
      const r=el.getBoundingClientRect(),a=document.getElementById('zh-font').getBoundingClientRect(),f=document.querySelector('.settings-footer').getBoundingClientRect();
      return {side:el.dataset.side,top:r.top,bottom:r.bottom,left:r.left,right:r.right,anchorTop:a.top,anchorBottom:a.bottom,footer:f.top,origin:getComputedStyle(el).transformOrigin};
    });
    check(geometry.top>=72 && geometry.bottom<=geometry.footer-6 && geometry.left>=12 && geometry.right<=width-12, `${width}: picker is entirely inside its real available area`);
    check(geometry.side===(width===700?'top':'bottom'), `${width}: prefer a useful downward list and flip only in the constrained window: ${JSON.stringify(geometry)}`);
    check(geometry.side==='top'?geometry.bottom<=geometry.anchorTop-5:geometry.top>=geometry.anchorBottom+5,'popup never covers its search field');
    check(await page.locator('.font-field .font-arrow').first().getAttribute('data-side')===geometry.side,'chevron follows actual placement, not simply open/closed');
    const scrollBefore=await page.locator('.content').evaluate(el=>el.scrollTop);
    await page.keyboard.press('End');await page.waitForTimeout(30);
    check(await page.locator('.content').evaluate(el=>el.scrollTop)===scrollBefore,'keyboard option navigation only scrolls the popup, not its parent page');
    await font.fill('Inter');await page.getByRole('option',{name:'Inter',exact:true}).waitFor();
    check(await menu.locator('[role=option]').count()===1,'filtered single result still uses the same listbox');
    await font.fill('zzzz-no-font');check(await page.getByText('没有匹配的本机字体',{exact:true}).isVisible(),'empty search remains attached and readable');
    await page.keyboard.press('Escape');check(await font.inputValue()==='','search and direction changes do not commit a font');
    await page.keyboard.press('ArrowDown');await menu.waitFor();
    check(await menu.getAttribute('data-keyboard')==='true' && await menu.evaluate(el=>getComputedStyle(el).transitionDuration)==='0s','keyboard menu opening is immediate');
    await page.keyboard.press('Escape');

    await page.getByRole('button',{name:'备份',exact:true}).click();await page.locator('.backup-row').first().waitFor();
    const rows=page.locator('.backup-row'),row=rows.first(),del=page.getByRole('button',{name:/^删除备份 /}).first();
    const entrance=await row.evaluate(el=>({surfaceOpacity:getComputedStyle(el,'::before').opacity,contentTransform:getComputedStyle(el.querySelector('.backup-meta')).transform}));
    check(entrance.surfaceOpacity==='1'&&entrance.contentTransform!=='none','row content shares the surface travel while opacity is owned by the parent reveal');
    // waitFor(visible) only proves the reveal has started; Kit keeps actions locked until the finite phase completes.
    await page.waitForFunction(()=>[...document.querySelectorAll('.backup-row')].every(el=>getComputedStyle(el).pointerEvents==='auto'));
    // Input readiness at 99% is intentionally earlier than the final visual frame.
    await page.waitForFunction(()=>{const row=document.querySelector('.backup-row');return row&&['.backup-symbol','.backup-meta'].every(selector=>{const value=getComputedStyle(row.querySelector(selector)).transform;return value==='none'||new DOMMatrix(value).m42===0;});});
    const reveal=await rows.evaluateAll(nodes=>nodes.slice(0,2).map(el=>({name:getComputedStyle(el).animationName,duration:getComputedStyle(el).animationDuration,delay:getComputedStyle(el).animationDelay,pointer:getComputedStyle(el).pointerEvents})));
    check(reveal[0].name==='collection-row-in'&&reveal[0].duration==='0.336s'&&reveal[1].delay==='0.0455s','Kit reveal maps its 700ms parent to 336ms phases and 45.5ms stagger');
    check(reveal.every(item=>item.pointer==='auto'),'row actions unlock after the finite reveal');
    check(await renderedInkContrast(page.locator('.collection-count b'))>=4.5,'collection count has readable ink on its filled badge');
    check(await page.locator('.list-overview [role="status"]').evaluate(el=>el.classList.contains('sr-only')),'recoverable count remains accessible without a second visible caption');
    const structure=await rows.evaluateAll(nodes=>nodes.slice(0,2).map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el,'::before');return {top:r.top,bottom:r.bottom,height:r.height,radius:s.borderRadius,border:s.borderTopWidth,cursor:getComputedStyle(el).cursor};}));
    check(structure[1].top-structure[0].bottom>=7 && structure.every(r=>r.height===64&&parseFloat(r.radius)===8&&r.border==='1px'),'Kit rows use 64px height, 8px radius and 8px separation');
    check(structure.every(r=>r.cursor!=='pointer'),'non-action row space does not impersonate a clickable selection');
    check(await rows.first().locator('.backup-symbol').evaluate(el=>el.getBoundingClientRect().width===28&&el.getBoundingClientRect().height===28),'Kit leading icon tile is 28px');
    await page.mouse.move(8,8);await page.waitForTimeout(170);
    const restColor=await row.evaluate(el=>getComputedStyle(el,'::before').backgroundColor),restInsets=await row.evaluate(el=>{const s=getComputedStyle(el,'::before');return {left:parseFloat(s.left),right:parseFloat(s.right)}}),restSymbolBackground=await row.locator('.backup-symbol').evaluate(el=>getComputedStyle(el).backgroundColor),restDeleteIconTransform=await del.locator('.row-action-content').evaluate(el=>getComputedStyle(el).transform),restDeleteIconRect=await del.locator('svg').boundingBox(),delRest=await del.boundingBox(),restMetaRect=await row.locator('.backup-meta').boundingBox(),restSymbolRect=await row.locator('.backup-symbol').boundingBox();
    check(restInsets.left>0&&restInsets.right>0,'resting card surface starts inset like Kit shrink2');
    check(restDeleteIconTransform.includes('-4'),'rest action icon starts with Kit direction negative offset');
    await row.hover({position:{x:130,y:20}});await page.waitForTimeout(70);
    check(JSON.stringify(await del.boundingBox())===JSON.stringify(delRest),'decorative row expansion never moves the danger target mid-transition');
    const midDeleteIconRect=await del.locator('svg').boundingBox();
    const midGlyphRatio=midDeleteIconRect.width/restDeleteIconRect.width;
    check(midGlyphRatio>1&&midGlyphRatio<1.083333,'action glyph interpolates through the Kit 18 to 19.5px growth phase');
    const parentProgress=await row.evaluate(el=>{
      const value=getComputedStyle(el).getPropertyValue('--row-motion-progress');
      return Number.parseFloat(value);
    });
    check(parentProgress>0&&parentProgress<1,'row owns the shared motion progress');
    check(await rows.nth(1).evaluate(el=>{
      const progress=Number.parseFloat(getComputedStyle(el).getPropertyValue('--row-motion-progress'));
      const action=el.querySelector('.row-action-content');
      return progress===0&&new DOMMatrix(getComputedStyle(action).transform).m41===-4;
    }),'hover is scoped to the owning row instead of leaking into sibling forms');
    const parentDriven=await row.evaluate(el=>{
      const p=Number.parseFloat(getComputedStyle(el).getPropertyValue('--row-motion-progress'));
      const surface=getComputedStyle(el,'::before');
      const action=el.querySelector('.row-action-content');
      const content=el.querySelector('.backup-meta');
      return {p,left:parseFloat(surface.left),actionScale:new DOMMatrix(getComputedStyle(action).transform).a,contentX:new DOMMatrix(getComputedStyle(content).transform).m41};
    });
    check(Math.abs(parentDriven.left-4*(1-parentDriven.p))<0.03&&Math.abs(parentDriven.actionScale-(1+0.083333*parentDriven.p))<0.002&&Math.abs(parentDriven.contentX-4*(1-parentDriven.p))<0.03,'surface, action group and content all derive from the parent progress');
    check(midDeleteIconRect.x>=delRest.x&&midDeleteIconRect.x+midDeleteIconRect.width<=delRest.x+delRest.width,'animated action glyph stays inside its stable button hit rect');
    await page.waitForTimeout(200);
    const finalDeleteIconRect=await del.locator('svg').boundingBox();
    check(Math.abs(finalDeleteIconRect.width/restDeleteIconRect.width-1.083333)<0.02,'action glyph reaches the Kit 18 to 19.5px growth ratio');
    check(await del.locator('.row-action-content').evaluate(el=>getComputedStyle(el).transform.includes('1.0833')),'action label and icon share one visual transform');
    check(await row.evaluate(el=>getComputedStyle(el,'::before').backgroundColor)===restColor,'row hover keeps the same white surface instead of a green wash');
    check(await row.evaluate(el=>{const s=getComputedStyle(el,'::before');return parseFloat(s.left)===0&&parseFloat(s.right)===0}),'row surface expands to the full hit rect without scaling its border');
    const accent=await row.evaluate(el=>{const s=getComputedStyle(el,'::after');return {left:parseFloat(s.left),width:parseFloat(s.width),opacity:parseFloat(s.opacity)}});
    check(accent.left===1.5&&accent.width===2.5&&accent.opacity===1,'Kit hover accent stripe reaches its exact final geometry');
    const finalMetaRect=await row.locator('.backup-meta').boundingBox(),finalSymbolRect=await row.locator('.backup-symbol').boundingBox();
    check(Math.abs(finalMetaRect.x-(restMetaRect.x-4))<0.02&&Math.abs(finalSymbolRect.x-(restSymbolRect.x-4))<0.02,'leading tile and reading content follow the surface expansion');
    check(await row.locator('.backup-symbol').evaluate(el=>getComputedStyle(el).backgroundColor)===restSymbolBackground,'row hover does not independently recolor the leading icon');
    check(await del.locator('.row-action-content').evaluate(el=>getComputedStyle(el).transform)!==restDeleteIconTransform,'action icon and label follow the row interaction without moving the button hit target');
    check(JSON.stringify(await del.boundingBox())===JSON.stringify(delRest),'group hover never moves the danger hit target');
    check(await del.evaluate(el=>getComputedStyle(el).color)==='rgb(101, 109, 96)','group hover does not falsely activate the destructive action');
    await del.hover();await page.waitForTimeout(280);
    check(await del.evaluate(el=>getComputedStyle(el).color)==='rgb(160, 68, 53)','only direct danger hover gets the danger ink');
    await page.mouse.down();check(JSON.stringify(await del.boundingBox())===JSON.stringify(delRest),'pressed danger target stays fixed');await page.mouse.move(8,8);await page.mouse.up();
    check(await page.getByRole('dialog').count()===0,'press then release outside never opens the delete confirmation');
    await page.getByRole('button',{name:'备份',exact:true}).focus();await page.waitForTimeout(320);check(await row.evaluate(el=>getComputedStyle(el,'::before').backgroundColor)===restColor,'hover reverses fully after pointer and keyboard focus both leave the row');
    check(await page.getByRole('button',{name:/^还原备份 /}).last().isDisabled(),'legacy snapshot protection stays intact after restyling');
    check(await row.evaluate(el=>el.getAnimations({subtree:true}).every(animation=>animation.playState==='finished')),'finite row feedback leaves no active animation at rest');

    await page.getByRole('button',{name:'日志',exact:true}).click();
    check(await page.locator('.section-head .report-button').count()===1,'feedback entry is part of the log header, separate from destructive list tools');
    check(await page.locator('.log-toolbar .local-note').count()===0,'redundant local-storage caption is removed from the log toolbar');
    check(/^操作记录 \d+ 条，仅保存在本机$/.test(await page.locator('.log-count').getAttribute('aria-label')),'local storage scope remains available to assistive technology');
    const logRow=page.locator('.log-row').first(),affordance=logRow.locator('.detail-affordance');
    check(await affordance.evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).m41===-4),'log detail text and arrow start with Kit direction negative offset');
    await logRow.hover({position:{x:130,y:20}});await page.waitForTimeout(70);
    check(await logRow.evaluate(el=>{
      const progress=Number.parseFloat(getComputedStyle(el).getPropertyValue('--row-motion-progress'));
      const surfaceLeft=parseFloat(getComputedStyle(el,'::before').left);
      const detailX=new DOMMatrix(getComputedStyle(el.querySelector('.detail-affordance')).transform).m41;
      return progress>0&&progress<1&&Math.abs(surfaceLeft-4*(1-progress))<0.03&&Math.abs(detailX+4*(1-progress))<0.03;
    }),'log surface and detail group derive from their owning row progress');
    check(await page.locator('.log-row').nth(1).evaluate(el=>{
      const progress=Number.parseFloat(getComputedStyle(el).getPropertyValue('--row-motion-progress'));
      const detailX=new DOMMatrix(getComputedStyle(el.querySelector('.detail-affordance')).transform).m41;
      return progress===0&&detailX===-4;
    }),'log hover does not leak into the adjacent form');
    await page.waitForTimeout(210);
    check(await affordance.evaluate(el=>getComputedStyle(el).backgroundColor)==='rgba(0, 0, 0, 0)','log detail hover removes the green button wash');
    check(await affordance.evaluate(el=>getComputedStyle(el).color)==='rgb(40, 45, 38)','log detail hover uses normal content ink');
    check(await affordance.evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).m41===0),'log detail text and arrow follow the row interaction');
    check(await logRow.locator('.log-summary').evaluate(el=>getComputedStyle(el).transform==='matrix(1, 0, 0, 1, 0, 0)' || getComputedStyle(el).transform==='none'),'log reading content reaches the same expanded surface position');
    const disclosure=page.locator('.log-detail summary').first();await disclosure.focus();await page.keyboard.press('Enter');
    const raw=page.locator('.log-detail[open] pre');await raw.waitFor();
    const original=await raw.innerText();check(original.length>0 && await raw.getAttribute('tabindex')==='0','raw diagnostic is preserved and keyboard-scrollable');
    await page.keyboard.press('Tab');check(await raw.evaluate(el=>document.activeElement===el),'expanded diagnostic is the next keyboard stop');
    check(await page.locator('.log-detail[open] .detail-open').isVisible() && !(await page.locator('.log-detail[open] .detail-closed').isVisible()),'disclosure label changes to collapse, not a stale Details label');
    await disclosure.click();await disclosure.click();check(await raw.innerText()===original,'repeated expanding never transforms the saved diagnostic');
    await page.getByRole('button',{name:'反馈问题',exact:true}).focus();await page.keyboard.press('Enter');
    check(await page.getByRole('dialog').getAttribute('data-keyboard')==='true','keyboard modal has no movement delay');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(60);
    check(await page.locator('.app-modal').getAttribute('data-closing')==='true' && await page.locator('.app-modal').evaluate(el=>getComputedStyle(el).transitionDuration.split(',').every(value=>parseFloat(value)===0.24)),'keyboard-opened modal still runs the 240ms exit');
    await page.locator('.app-modal').waitFor({state:'hidden'});
    check(await page.getByRole('button',{name:'反馈问题',exact:true}).evaluate(el=>document.activeElement===el),'feedback cancellation returns focus to the new header location');
    await page.getByRole('button',{name:'清除全部日志',exact:true}).click();
  check(await page.getByRole('heading',{name:'清除操作记录？',exact:true}).evaluate(el=>document.activeElement===el),'log clearing starts with title focus instead of a forced cancel outline');await closeModal();
  }
  // A short filtered popup should not flip upward just because a full list would not fit.
  await page.setViewportSize({width:1280,height:800});await page.goto(`${base}/#type`);
  await page.getByLabel('中文字体',{exact:true}).click();await page.getByLabel('中文字体',{exact:true}).fill('Arial');
  check(await page.getByRole('listbox').getAttribute('data-side')==='bottom','one result remains below a field with space for it');await page.keyboard.press('Escape');
  // Responsive reflow updates placement and never retains both top and bottom anchors.
  await page.getByLabel('中文字体',{exact:true}).click();await page.setViewportSize({width:1000,height:760});await page.waitForTimeout(40);
  check(await page.getByRole('listbox').evaluate(el=>(el.style.top==='auto')!==(el.style.bottom==='auto')),'resize leaves exactly one vertical placement constraint');await page.keyboard.press('Escape');
  await page.goto(`${base}/#log`);await page.getByRole('button',{name:'清除全部日志',exact:true}).click();await page.getByRole('button',{name:'确认清除',exact:true}).click();
  check(await page.getByRole('button',{name:'清除全部日志',exact:true}).isDisabled(),'empty log keeps the true disabled clear action');
  check(await page.getByRole('button',{name:'反馈问题',exact:true}).isEnabled(),'empty log still allows a problem description without fabricated records');
  const emptyArt=await page.locator('.empty-art').boundingBox(),emptyCopy=await page.locator('.empty-copy').boundingBox();
  check(emptyArt.x+emptyArt.width<emptyCopy.x,'empty log illustration and content form a readable horizontal group');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.getByRole('button',{name:'反馈问题',exact:true}).click();
  check(await page.getByRole('dialog').evaluate(el=>getComputedStyle(el).transitionDuration)==='0s' && await page.getByRole('dialog').evaluate(el=>getComputedStyle(el).transform)==='none','reduced motion removes modal movement while keeping focus and content');await closeModal();

  check(errors.length === 0, `browser errors: ${errors.join(';')}`);
  console.log(`PASS ${checks} UI assertions: 5 sizes × 4 sections, shared pickers, official-update check/badge/progress/cancel, reviewed reports, scoped delete, persisted logs, failure paths, keyboard, drafts, responsive layout.`);
} finally { await browser.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
