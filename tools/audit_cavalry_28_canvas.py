#!/usr/bin/env python3
"""Read-only Cavalry 2.8 Canvas callsite contract audit; never proves host rendering."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from audit_macos_canvas import identity, slices
from audit_cavalry_28_tool_path import CPUS, callsites, check_bytes, contract_branch, uuid

ROOT = Path(__file__).resolve().parents[1]


def canvas_branch(arch: str = "arm64") -> str:
    if arch not in CPUS:
        raise ValueError(f"unsupported architecture: {arch}")
    text = (ROOT / "injector/cavalry_bilingual_macos_canvas.inc").read_text(encoding="utf-8")
    directive = "#if" if arch == "arm64" else "#elif"
    marker = f"{directive} defined(__{arch}__) && defined(CAVALRY_I18N_CAVALRY_280)"
    return text.split(marker, 1)[1].split("#elif defined(__arm64__)", 1)[0]


def audit(app: Path, arch: str = "arm64") -> dict:
    contract = contract_branch(arch)
    branch = canvas_branch(arch)
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

    sites = callsites(branch, "kCanvasCallsites")
    if len(sites) != 8:
        raise ValueError(f"expected exactly eight 2.8 Canvas callsites, got {len(sites)}")
    for offset, expected in sites:
        check_bytes(images["libExtensionLayer.dylib"], offset, expected, "2.8 Canvas")
    measure_sites = callsites(branch, "kCanvasMeasureCallsites")
    if len(measure_sites) != 1:
        raise ValueError(f"expected exactly one 2.8 Canvas measure callsite, got {len(measure_sites)}")
    for offset, expected in measure_sites:
        check_bytes(images["libExtensionLayer.dylib"], offset, expected, "2.8 Canvas measure")

    return {
        "scope": f"Cavalry 2.8 {arch} static Canvas callsite contract only; NOT native rendering",
        "state": "PASS_STATIC_CONTRACT_ONLY",
        "arch": arch,
        "app": str(app),
        "images": {name: {"uuid": identity(image)} for name, image in images.items()},
        "canvasCallsitesVerified": len(sites),
        "canvasMeasureCallsitesVerified": len(measure_sites),
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
