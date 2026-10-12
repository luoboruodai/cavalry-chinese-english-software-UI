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
