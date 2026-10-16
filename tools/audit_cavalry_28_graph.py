#!/usr/bin/env python3
"""Read-only Cavalry 2.8 Graph elision contract audit; never proves host rendering."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from audit_macos_canvas import identity, slices, verify_graph_elision
from audit_cavalry_28_tool_path import (
    CPUS,
    check_symbol_offsets,
    contract_branch,
    symbol_addresses,
    uint,
    uuid,
)

ROOT = Path(__file__).resolve().parents[1]
ELIDE_SYMBOL = "__ZN4lina8TextView16elideTextToWidthERKNSt3__112basic_stringIcNS1_11char_traitsIcEENS1_9allocatorIcEEEEfRK6SkFont"


def graph_branch(arch: str = "arm64") -> str:
    if arch not in CPUS:
        raise ValueError(f"unsupported architecture: {arch}")
    text = (ROOT / "injector/cavalry_bilingual_macos_graph_measure.inc").read_text(encoding="utf-8")
    directive = "#if" if arch == "arm64" else "#elif"
    marker = f"{directive} defined(__{arch}__) && defined(CAVALRY_I18N_CAVALRY_280)"
    branch = text.split(marker, 1)[1].split("#elif defined(__arm64__)", 1)[0]
    if arch == "arm64":
        branch = branch.split("#elif defined(__x86_64__)", 1)[0]
    return branch


def audit(app: Path, arch: str = "arm64") -> dict:
    contract = contract_branch(arch)
    branch = graph_branch(arch)
    images = {}
    for library in ("libExtensionLayer.dylib", "libCore.dylib", "libskia.dylib"):
        data = (app / "Contents/Frameworks" / library).read_bytes()
        image = slices(data)[CPUS[arch]]
        expected_uuid = uuid(contract, {
            "libExtensionLayer.dylib": "kExtensionUuid",
            "libCore.dylib": "kCoreUuid",
            "libskia.dylib": "kSkiaUuid",
        }[library])
        if identity(image) != expected_uuid:
            raise ValueError(f"{library}: UUID mismatch")
        images[library] = image

    elide_offset = uint(branch, "kGraphElideOffset")
    check_symbol_offsets(
        symbol_addresses(app / "Contents/Frameworks/libExtensionLayer.dylib", arch),
        {ELIDE_SYMBOL: ("libExtensionLayer.dylib", elide_offset)},
        "2.8 Graph",
    )
    report = verify_graph_elision(images["libExtensionLayer.dylib"], branch, arch)
    return {
        "scope": f"Cavalry 2.8 {arch} static Graph elision contract only; NOT native rendering",
        "state": "PASS_STATIC_CONTRACT_ONLY",
        "arch": arch,
        "app": str(app),
        "images": {name: {"uuid": identity(image)} for name, image in images.items()},
        "graphElideSymbolVerified": True,
        **report,
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
