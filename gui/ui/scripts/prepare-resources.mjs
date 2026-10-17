// Stage identical resources for both workspace crates. Never bundle SDK/vendor DLLs.
import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
const files = process.platform === "win32" ? ["windows/generic/cavalryi18n.dll", "windows/qpa/qwindows.dll"] : ["libCavalryTranslatorInjector.dylib"];
for (const file of files) for (const directory of ["../../runtime/", "../../src-tauri/runtime/"]) {
  const source = new URL(`../../../dist/${file}`, import.meta.url);
  const target = new URL(file, new URL(directory, import.meta.url));
  mkdirSync(new URL(".",target), {recursive:true}); copyFileSync(source,target);
  console.log(`Staged runtime: ${fileURLToPath(target)}`);
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
