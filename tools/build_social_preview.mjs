// Build the public repository social card from synthetic UI screenshots only.
// Run `npm run shot --prefix gui/ui` first; no native logs or user projects are read.
import { createRequire } from "node:module";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
const require = createRequire(new URL("../gui/ui/package.json", import.meta.url));
const { chromium } = require("playwright");
const root = fileURLToPath(new URL("../", import.meta.url));
const image = (path) => `data:image/png;base64,${readFileSync(new URL(path, import.meta.url)).toString("base64")}`;
const icon = image("../gui/ui/public/app-icon.png");
const screenshot = image("../gui/feedback_auto/status_1280x800.png");
const output = new URL("../docs/assets/social-preview.png", import.meta.url);
mkdirSync(new URL(".", output), { recursive: true });
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;width:1280px;height:640px;background:#f5f1e4;color:#2c2e2a;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif;overflow:hidden}main{height:100%;display:flex;align-items:center;gap:44px;padding:52px 58px}.copy{width:47%;flex:none}.brand{display:flex;align-items:center;gap:14px;font-size:23px;font-weight:650}.brand img{width:54px;height:54px;border-radius:14px}.kicker{margin:44px 0 12px;color:#617653;font-size:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase}h1{margin:0;font-size:49px;line-height:1.14;letter-spacing:0;font-weight:720}.en{margin:18px 0 0;color:#62685d;font-size:24px;line-height:1.35;font-weight:500}.chips{display:flex;flex-wrap:wrap;gap:9px;margin-top:28px}.chip{padding:8px 13px;border:1px solid #d7d1c1;border-radius:999px;background:#fffefa;font-size:14px}.version{margin-top:36px;color:#4f6c3f;font-size:15px;font-weight:650}.visual{position:relative;width:53%;height:100%;display:flex;align-items:center}.accent{position:absolute;right:-24px;top:40px;width:170px;height:170px;border-radius:50%;background:#dcebcf}.card{position:relative;width:100%;padding:13px;border:1px solid #d9d3c4;border-radius:24px;background:#fffefa}.cardbar{display:flex;align-items:center;justify-content:space-between;padding:3px 4px 13px;color:#68745e;font-size:11px;font-weight:700;letter-spacing:1.4px}.dots{display:flex;gap:5px}.dots i{width:7px;height:7px;border-radius:50%;background:#8ed462}.dots i:nth-child(2){background:#ff705d}.dots i:nth-child(3){background:#2ba0ff}.card img{display:block;width:100%;border:1px solid #e4dece;border-radius:14px}.note{position:absolute;right:22px;bottom:34px;padding:11px 15px;border:1px solid #d9d3c4;border-radius:12px;background:#fffefa;font-size:13px;font-weight:650}.note:before{content:"";display:inline-block;width:8px;height:8px;margin-right:8px;border-radius:50%;background:#78a957}
</style></head><body><main><section class="copy"><div class="brand"><img src="${icon}"><span>Cavalry Bilingual</span></div><div class="kicker">Chinese + English UI</div><h1>中英对照，<br>专注创作。</h1><p class="en">Read the tutorial.<br>Keep the original UI.</p><div class="chips"><span class="chip">双语界面</span><span class="chip">字体排版</span><span class="chip">可恢复快照</span></div><div class="version">0.1.3 Stable&nbsp;&nbsp;·&nbsp;&nbsp;macOS + Windows</div></section><section class="visual"><div class="accent"></div><div class="card"><div class="cardbar"><span>DESKTOP MANAGER</span><span class="dots"><i></i><i></i><i></i></span></div><img src="${screenshot}"></div><div class="note">双语已应用</div></section></main></body></html>`;
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 640 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.screenshot({ path: fileURLToPath(output), type: "png" });
} finally {
  await browser.close();
}
console.log(fileURLToPath(output));
console.log(root);
