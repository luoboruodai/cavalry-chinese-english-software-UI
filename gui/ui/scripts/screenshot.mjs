// 无头截图:vite preview 起静态服务 + Playwright chromium 按 hash 深链逐区截图。
// 产出:gui/feedback_auto/<section>_<w>x<h>.png(12 张)
// 用法:npm run shot(先 build,再截图)
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const uiDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(uiDir, "..", "feedback_auto");
const PORT = 5199;
const BASE = `http://localhost:${PORT}`;
const SECTIONS = ["status", "type", "backup", "log"];
const VIEWPORTS = [
  [880, 620],
  [760, 540],
  [1280, 800],
];

mkdirSync(outDir, { recursive: true });

async function waitForServer(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (response.ok || response.status === 304) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`server ${url} did not start within ${timeoutMs}ms`);
}

const server = spawn(
  "npx",
  ["vite", "preview", "--port", String(PORT), "--strictPort"],
  { cwd: uiDir, stdio: ["ignore", "pipe", "pipe"] },
);
server.stderr.on("data", (chunk) => process.stderr.write(chunk));

try {
  await waitForServer(BASE);
  const browser = await chromium.launch();
  try {
    for (const [width, height] of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: 2,
      });
      const page = await context.newPage();
      for (const section of SECTIONS) {
        await page.goto(`${BASE}/#${section}`, { waitUntil: "networkidle" });
        // 等 web font 就绪 + 过渡动画(区切换 180ms / 拇指滑动 200ms)结束
        await page.evaluate(() =>
          document.fonts.ready.then(() => undefined),
        );
        await page.waitForTimeout(700);
        const file = join(outDir, `${section}_${width}x${height}.png`);
        await page.screenshot({ path: file });
        const size = statSync(file).size;
        console.log(
          `${section}_${width}x${height}.png  ${(size / 1024).toFixed(1)} KB`,
        );
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
} finally {
  server.kill("SIGTERM");
}

console.log(`done -> ${outDir}`);
