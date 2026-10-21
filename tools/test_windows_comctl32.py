#!/usr/bin/env python3
"""Build and optionally Wine-run a Comctl32 v6 manifest probe; never tests a Cavalry host."""
from __future__ import annotations

import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "build" / "windows-comctl32-probe"
CC = os.environ.get("CC_WINDOWS", "x86_64-w64-mingw32-gcc")
WINDRES = os.environ.get("WINDRES_WINDOWS", "x86_64-w64-mingw32-windres")
WINE = os.environ.get("WINE64", "/opt/homebrew/bin/wine64")

def run(command: list[str], **kwargs) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, cwd=ROOT, text=True, stdout=subprocess.PIPE,
                          stderr=subprocess.STDOUT, timeout=30, **kwargs)

def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = (ROOT / "gui/src-tauri/cavalry-bilingual.exe.manifest").read_text(encoding="utf-8")
    if 'name="Microsoft.Windows.Common-Controls"' not in manifest or 'version="6.0.0.0"' not in manifest:
        raise SystemExit("Common Controls v6 dependency missing")
    if 'level="asInvoker"' not in manifest:
        raise SystemExit("Manifest must not elevate privileges")
    without = OUT / "probe-without-manifest.exe"
    with_v6 = OUT / "probe-with-v6-manifest.exe"
    print(run([CC, "-Os", "-s", str(ROOT / "tests/windows_comctl32_probe.c"), "-o", str(without)]).stdout, end="")
    rc = OUT / "probe-v6.rc"
    rc.write_text('#define RT_MANIFEST 24\n1 RT_MANIFEST "cavalry-bilingual.exe.manifest"\n', encoding="ascii")
    resource = OUT / "probe-v6.res"
    print(run([WINDRES, "-I", str(ROOT / "gui/src-tauri"), str(rc), "-O", "coff", "-o", str(resource)]).stdout, end="")
    print(run([CC, "-Os", "-s", str(ROOT / "tests/windows_comctl32_probe.c"), str(resource), "-o", str(with_v6)]).stdout, end="")
    if not Path(WINE).exists():
        print(f"Probe built; Wine not available at {WINE}; native Windows remains unverified")
        return 0
    prefix = OUT / "wine-prefix"
    prefix.mkdir(exist_ok=True)
    env = os.environ.copy()
    env.update({"WINEPREFIX": str(prefix), "WINEDEBUG": "-all", "WINEARCH": "win64"})
    failed = False
    for label, executable in (("without-manifest", without), ("with-v6-manifest", with_v6)):
        try:
            result = run([WINE, str(executable)], env=env)
            print(f"{label}: exit={result.returncode}\n{result.stdout}", end="")
            if label == "with-v6-manifest" and result.returncode != 0:
                failed = True
        except subprocess.TimeoutExpired as error:
            print(f"{label}: TIMEOUT\n{error.stdout or ''}")
            if label == "with-v6-manifest":
                failed = True
    return int(failed)

if __name__ == "__main__":
    sys.exit(main())
