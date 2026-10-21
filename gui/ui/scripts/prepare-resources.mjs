// Stage identical resources for both workspace crates. Never bundle SDK/vendor DLLs.
import { copyFileSync, cpSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
const targetTriple = process.env.CAVALRY_TARGET_TRIPLE ?? process.env.TAURI_ENV_TARGET_TRIPLE ?? "";
const targetPlatform =
  process.env.CAVALRY_RESOURCE_PLATFORM ??
  (/windows/i.test(targetTriple) || process.platform === "win32" ? "windows" : "macos");
const files = targetPlatform === "windows"
  ? ["windows/generic/cavalryi18n.dll", "windows/qpa/qwindows.dll"]
  : ["libCavalryTranslatorInjector.dylib"];
const optionalFiles = targetPlatform === "windows" ? [] : ["libCavalryTranslatorInjector-280.dylib"];
for (const file of [...files, ...optionalFiles]) for (const directory of ["../../runtime/", "../../src-tauri/runtime/"]) {
  const source = new URL(`../../../dist/${file}`, import.meta.url);
  if (optionalFiles.includes(file) && !existsSync(source)) {
    console.log(`Optional runtime not staged: ${file}`);
    continue;
  }
  const target = new URL(file, new URL(directory, import.meta.url));
  mkdirSync(new URL(".",target), {recursive:true}); copyFileSync(source,target);
  console.log(`Staged ${targetPlatform} runtime: ${fileURLToPath(target)}`);
}

const cavalry28Assets = new URL("../../../assets/cavalry-28/", import.meta.url);
if (targetPlatform !== "windows" && existsSync(cavalry28Assets)) for (const directory of ["../../runtime/cavalry-28-assets/", "../../src-tauri/runtime/cavalry-28-assets/"]) {
  const target = new URL(directory, import.meta.url);
  mkdirSync(target, { recursive: true });
  cpSync(cavalry28Assets, target, { recursive: true });
  console.log(`Staged Cavalry 2.8 assets: ${fileURLToPath(target)}`);
}

const packageFiles = [
  ["../../../docs/INSTALL-WINDOWS.txt", "../../docs/INSTALL-WINDOWS.txt"],
  ["../../../LICENSE", "../../LICENSE"],
  ["../../../LICENSE.daftai", "../../LICENSE.daftai"],
  ["../../../NOTICE.md", "../../NOTICE.md"],
];
for (const [sourceName, targetName] of packageFiles) {
  const source = new URL(sourceName, import.meta.url);
  const target = new URL(targetName, import.meta.url);
  mkdirSync(new URL(".", target), { recursive: true });
  copyFileSync(source, target);
  console.log(`Staged package file: ${fileURLToPath(target)}`);
}

// Both workspace crates resolve the same license resource relative to their root.
for (const directory of ["../../runtime/", "../../src-tauri/runtime/"]) {
  const target = new URL("legal/sentry-types-MIT.txt", new URL(directory, import.meta.url));
  mkdirSync(new URL(".", target), { recursive: true });
  copyFileSync(new URL("../../../docs/licenses/sentry-types-MIT.txt", import.meta.url), target);
}
