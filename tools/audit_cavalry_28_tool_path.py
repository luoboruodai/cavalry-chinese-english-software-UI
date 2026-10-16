#!/usr/bin/env python3
"""Read-only Cavalry 2.8 arm64 tool-path contract audit; never proves host rendering."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import subprocess

from audit_macos_canvas import identity, slices

ROOT = Path(__file__).resolve().parents[1]
CPUS = {"arm64": 0x100000C, "x86_64": 0x1000007}
GET_PATH = "__ZN11SkTextUtils7GetPathEPKvm14SkTextEncodingffRK6SkFontP6SkPath"
MAKE_FROM_CT = "__Z24SkMakeTypefaceFromCTFontPK8__CTFont"
UNICHAR = "__ZNK10SkTypeface14unicharToGlyphEi"
SET_SIZE = "__ZN6SkFont7setSizeEf"
PATH_EMPTY = "__ZNK6SkPath7isEmptyEv"
MAKE_SCALABLE = "__ZN7cavalry16MakeScalableFontE5sk_spI10SkTypefaceEf"


def contract_branch(arch: str = "arm64") -> str:
    text = (ROOT / "injector/cavalry_i18n_macos_tool_help_text_path.cpp").read_text(encoding="utf-8")
    if arch not in CPUS:
        raise ValueError(f"unsupported architecture: {arch}")
    directive = "#if" if arch == "arm64" else "#elif"
    marker = f"{directive} defined(__{arch}__) && defined(CAVALRY_I18N_CAVALRY_280)"
    return text.split(marker, 1)[1].split("#elif defined(__arm64__)", 1)[0]


def viewport_branch(arch: str = "arm64") -> str:
    text = (ROOT / "injector/cavalry_bilingual_macos_viewport.inc").read_text(encoding="utf-8")
    if arch not in CPUS:
        raise ValueError(f"unsupported architecture: {arch}")
    directive = "#if" if arch == "arm64" else "#elif"
    marker = f"{directive} defined(__{arch}__) && defined(CAVALRY_I18N_CAVALRY_280)"
    return text.split(marker, 1)[1].split("#elif defined(__arm64__)", 1)[0]


def uint(branch: str, name: str) -> int:
    match = re.search(rf"\b{re.escape(name)}\s*=\s*(0x[0-9a-fA-F]+)\s*;", branch)
    if not match:
        raise ValueError(f"missing contract constant: {name}")
    return int(match.group(1), 16)


def uuid(branch: str, name: str) -> str:
    match = re.search(rf"constexpr char {re.escape(name)}\[\] = \"([A-F0-9-]+)\"", branch)
    if not match:
        raise ValueError(f"missing UUID: {name}")
    return match.group(1)


def byte_array(branch: str, name: str) -> bytes:
    match = re.search(rf"\b{re.escape(name)}\s*=\s*\{{(.*?)\}};", branch, re.S)
    if not match:
        raise ValueError(f"missing byte array: {name}")
    return bytes(int(value, 16) for value in re.findall(r"0x([0-9a-fA-F]+)", match.group(1)))


def callsites(branch: str, name: str) -> list[tuple[int, bytes]]:
    match = re.search(rf"\b{re.escape(name)}\[\] = \{{(.*?)\}};", branch, re.S)
    if not match:
        raise ValueError(f"missing callsite array: {name}")
    sites = []
    for offset, encoded in re.findall(r"\{(0x[0-9a-fA-F]+),\s*\{([^}]+)\}\}", match.group(1)):
        sites.append((int(offset, 16), bytes(int(value, 16) for value in re.findall(r"0x([0-9a-fA-F]+)", encoded))))
    return sites


def check_bytes(image: bytes | bytearray, offset: int, expected: bytes, label: str) -> None:
    if offset < 0 or offset + len(expected) > len(image):
        raise ValueError(f"{label}: callsite outside image")
    if image[offset:offset + len(expected)] != expected:
        raise ValueError(f"{label}: machine code mismatch at 0x{offset:x}")


def symbol_addresses(path: Path, arch: str = "arm64") -> dict[str, int]:
    if arch not in CPUS:
        raise ValueError(f"unsupported architecture: {arch}")
    result = subprocess.run(["nm", "-m", "-arch", arch, str(path)], capture_output=True, text=True)
    if result.returncode != 0:
        raise ValueError(f"nm failed for {path}: {result.stderr.strip()}")
    addresses = {}
    for line in result.stdout.splitlines():
        fields = line.split()
        if fields and re.fullmatch(r"[0-9a-fA-F]{16}", fields[0]):
            addresses[fields[-1]] = int(fields[0], 16)
    return addresses


def expected_symbols(branch: str) -> dict[str, tuple[str, int]]:
    return {
        GET_PATH: ("libskia.dylib", uint(branch, "kGetPathOffset")),
        MAKE_FROM_CT: ("libskia.dylib", uint(branch, "kMakeTypefaceFromCTFontOffset")),
        UNICHAR: ("libskia.dylib", uint(branch, "kUnicharToGlyphOffset")),
        SET_SIZE: ("libskia.dylib", uint(branch, "kSetFontSizeOffset")),
        PATH_EMPTY: ("libskia.dylib", uint(branch, "kPathIsEmptyOffset")),
        MAKE_SCALABLE: ("libCore.dylib", uint(branch, "kMakeScalableFontOffset")),
    }


def check_uuid(image: bytes | bytearray, expected: str, label: str) -> None:
    if identity(image) != expected:
        raise ValueError(f"{label}: UUID mismatch")


def check_symbol_offsets(actual: dict[str, int], expected: dict[str, tuple[str, int]], label: str) -> None:
    for symbol, (library, offset) in expected.items():
        if actual.get(symbol) != offset:
            raise ValueError(f"{label}: symbol offset mismatch for {symbol} in {library}")


def audit(app: Path, arch: str = "arm64") -> dict:
    branch = contract_branch(arch)
    view_branch = viewport_branch(arch)
    images = {}
    for library in ("libExtensionLayer.dylib", "libCore.dylib", "libskia.dylib"):
        data = (app / "Contents/Frameworks" / library).read_bytes()
        image = slices(data)[CPUS[arch]]
        expected_uuid = uuid(branch, {"libExtensionLayer.dylib": "kExtensionUuid", "libCore.dylib": "kCoreUuid", "libskia.dylib": "kSkiaUuid"}[library])
        check_uuid(image, expected_uuid, library)
        images[library] = image

    for symbol, (library, offset) in expected_symbols(branch).items():
        check_symbol_offsets(symbol_addresses(app / "Contents/Frameworks" / library, arch), {symbol: (library, offset)}, library)

    checks = [
        (images["libCore.dylib"], uint(branch, "kCoreGetPathCallOffset"), byte_array(branch, "kCoreGetPathCall"), "Core GetPath"),
        (images["libExtensionLayer.dylib"], uint(branch, "kExtensionMakePathCallOffset"), byte_array(branch, "kExtensionMakePathCall"), "getOrCreateTextPath"),
        (images["libExtensionLayer.dylib"], uint(branch, "kExtensionPrefixCallOffset"), byte_array(branch, "kExtensionPrefixCall"), "setupToolHelp prefix"),
        (images["libExtensionLayer.dylib"], uint(branch, "kExtensionActionCallOffset"), byte_array(branch, "kExtensionActionCall"), "setupToolHelp action"),
    ]
    for image, offset, expected, label in checks:
        check_bytes(image, offset, expected, label)
    viewport = callsites(view_branch, "kViewportCallsites")
    if len(viewport) != 2:
        raise ValueError("expected exactly two viewport callsites")
    for offset, expected in viewport:
        check_bytes(images["libExtensionLayer.dylib"], offset, expected, "viewport hint")

    return {
        "scope": f"Cavalry 2.8 {arch} static tool-path contract only; NOT native rendering or save acceptance",
        "state": "PASS_STATIC_CONTRACT_ONLY",
        "arch": arch,
        "app": str(app),
        "images": {name: {"uuid": identity(image)} for name, image in images.items()},
        "symbolOffsetsVerified": len(expected_symbols(branch)),
        "callChainsVerified": len(checks),
        "viewportCallsitesVerified": len(viewport),
        "nativeUIValidated": False,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", required=True, type=Path)
    parser.add_argument("--arch", choices=sorted(CPUS), default="arm64")
    args = parser.parse_args()
    print(json.dumps(audit(args.app, args.arch), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
