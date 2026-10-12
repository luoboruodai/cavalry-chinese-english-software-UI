// Tauri wrapper with an explicit workspace path and platform overlay.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const ui = fileURLToPath(new URL("../", import.meta.url));
const cli = fileURLToPath(new URL("../node_modules/@tauri-apps/cli/tauri.js", import.meta.url));
const args = process.argv.slice(2);
const needsConfig = (args[0] === "build" || args[0] === "dev") && !args.includes("--config");
if (needsConfig) args.push("--config", process.platform === "win32" ? "../src-tauri/tauri.windows.conf.json" : "../src-tauri/tauri.macos.conf.json");
const result = spawnSync(process.execPath, [cli, ...args], {
  cwd: ui,
  stdio: "inherit",
  env: { ...process.env, TAURI_APP_PATH: fileURLToPath(new URL("../../src-tauri", import.meta.url)) },
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
