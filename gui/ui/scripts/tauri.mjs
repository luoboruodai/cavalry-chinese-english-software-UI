// Tauri wrapper with an explicit workspace path and platform overlay.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const ui = fileURLToPath(new URL("../", import.meta.url));
const cli = fileURLToPath(new URL("../node_modules/@tauri-apps/cli/tauri.js", import.meta.url));
const args = process.argv.slice(2);
function flagValue(name) {
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1];
  const prefix = `${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  return inline?.slice(prefix.length);
}

const configArg = flagValue("--config") ?? "";
const targetArg = flagValue("--target") ?? "";
const isExplicitMacTarget = /macos|darwin/i.test(configArg) || /darwin/i.test(targetArg);
const isWindowsTarget =
  !isExplicitMacTarget &&
  (process.platform === "win32" ||
    /windows/i.test(configArg) ||
    /windows/i.test(targetArg));
const resourcePlatform = isWindowsTarget ? "windows" : "macos";
const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const repoRootForScript = repoRoot.replace(/[\\/]+$/, "");

function tryCrossNsisFallback(buildStartedAt) {
  if (!isWindowsTarget || !targetArg) return false;
  const scriptDir = join(repoRoot, "gui", "target", targetArg, "release", "nsis", "x64");
  const installerScript = join(scriptDir, "installer.nsi");
  const mainBinary = join(repoRoot, "gui", "target", targetArg, "release", "cavalry-bilingual.exe");
  const wrapper =
    process.env.CAVALRY_MAKENSIS_WRAPPER ??
    join(repoRoot, "..", "tools-local", "bin", "makensis-wrapper.sh");
  if (!existsSync(installerScript) || !existsSync(wrapper) || !existsSync(mainBinary)) return false;
  // A compile/resource failure must never be hidden by packaging an old script.
  if (statSync(installerScript).mtimeMs < buildStartedAt - 2000) {
    console.error("Cross NSIS fallback refused an outdated installer.nsi; fix the underlying build failure first.");
    return false;
  }

  // Keep the mirror under /tmp: the Wine wrapper translates /tmp paths to a
  // Windows drive path, while macOS's randomized /var/folders path is not
  // reliably representable inside the cross-platform NSIS process.
  const asciiRoot = join("/tmp", "cavalry-bilingual-build");
  const asciiScript = join(scriptDir, "installer-ascii.nsi");
  const generated = join(scriptDir, "nsis-output.exe");
  const bundleDir = join(repoRoot, "gui", "target", targetArg, "release", "bundle", "nsis");
  const baseConfig = JSON.parse(
    readFileSync(join(repoRoot, "gui", "src-tauri", "tauri.conf.json"), "utf8"),
  );
  const productName = String(baseConfig.productName ?? "Cavalry Bilingual");
  const version = String(baseConfig.version ?? "0.1.0");
  const output = join(bundleDir, `${productName}_${version}_x64-setup.exe`);
  try {
    rmSync(asciiRoot, { recursive: true, force: true });
    symlinkSync(repoRoot, asciiRoot, "dir");
    const script = readFileSync(installerScript, "utf8").replaceAll(repoRootForScript, asciiRoot);
    writeFileSync(asciiScript, script, "utf8");
    const fallback = spawnSync(wrapper, [asciiScript], {
      cwd: scriptDir,
      stdio: "inherit",
      env: { ...process.env },
    });
    if (fallback.status !== 0 || !existsSync(generated)) return false;
    mkdirSync(bundleDir, { recursive: true });
    copyFileSync(generated, output);
    console.log(`Built NSIS installer with cross-platform wrapper: ${output}`);
    return true;
  } finally {
    rmSync(asciiScript, { force: true });
    rmSync(join(scriptDir, "installer-ascii-wine.nsi"), { force: true });
    rmSync(asciiRoot, { recursive: true, force: true });
  }
}
const needsConfig = (args[0] === "build" || args[0] === "dev") && !configArg;
if (needsConfig) {
  args.push(
    "--config",
    isWindowsTarget
      ? "../src-tauri/tauri.windows.conf.json"
      : "../src-tauri/tauri.macos.conf.json",
  );
}
const buildStartedAt = Date.now();
const result = spawnSync(process.execPath, [cli, ...args], {
  cwd: ui,
  stdio: "inherit",
  env: {
    ...process.env,
    CAVALRY_RESOURCE_PLATFORM: resourcePlatform,
    CAVALRY_TARGET_TRIPLE: targetArg,
    TAURI_APP_PATH: fileURLToPath(new URL("../../src-tauri", import.meta.url)),
  },
});
if (result.error) console.error(result.error.message);
let status = result.status ?? 1;
if (status !== 0 && tryCrossNsisFallback(buildStartedAt)) status = 0;
process.exit(status);
