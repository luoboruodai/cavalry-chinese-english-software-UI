#!/usr/bin/env python3
"""
Apply a reviewed Cavalry 2.8 source-resource candidate without touching
non-UI fields. The default is a check-only audit; writes require --apply and a
backup root. No signing, process control, network access, or user-project
writes are performed here.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import plistlib
import shutil
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

RESOURCE_NAMES = (
    "appStrings_en-GB.source.json",
    "nodeStrings_en-GB.source.json",
)
RELATIVE_RESOURCE_DIR = Path("Contents/assets/Definitions/Translation")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def compare_ui_only(left: Any, right: Any, path: str = "$", changes: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    changes = [] if changes is None else changes
    if type(left) is not type(right):
        raise ValueError(f"结构类型变化于 {path}: {type(left).__name__} -> {type(right).__name__}")
    if isinstance(left, dict):
        if list(left.keys()) != list(right.keys()):
            missing = [key for key in left if key not in right]
            extra = [key for key in right if key not in left]
            raise ValueError(f"结构键变化于 {path}: missing={missing} extra={extra}")
        for key in left:
            compare_ui_only(left[key], right[key], f"{path}.{key}", changes)
        return changes
    if isinstance(left, list):
        if len(left) != len(right):
            raise ValueError(f"数组长度变化于 {path}: {len(left)} -> {len(right)}")
        for index, (before, after) in enumerate(zip(left, right)):
            compare_ui_only(before, after, f"{path}[{index}]", changes)
        return changes
    if left != right:
        if not path.endswith(".UI-text"):
            raise ValueError(f"非 UI 字段变化于 {path}")
        if not isinstance(right, str) or not right:
            raise ValueError(f"UI-text 不能为空于 {path}")
        changes.append({"path": path, "before": left, "after": right})
    return changes


def app_version(app: Path) -> str:
    plist_path = app / "Contents/Info.plist"
    if not plist_path.is_file():
        raise ValueError(f"找不到 Cavalry Info.plist: {plist_path}")
    with plist_path.open("rb") as handle:
        plist = plistlib.load(handle)
    identifier = plist.get("CFBundleIdentifier")
    if identifier != "com.scenegroup.cavalry":
        raise ValueError(f"不是官方 Cavalry bundle: {identifier!r}")
    version = str(plist.get("CFBundleShortVersionString", ""))
    if not version.startswith("2.8"):
        raise ValueError(f"只允许 Cavalry 2.8，实际为 {version or '未知'}")
    return version


def resource_paths(app: Path, candidate_root: Path) -> list[tuple[Path, Path, str]]:
    app_dir = app / RELATIVE_RESOURCE_DIR
    candidate_dir = candidate_root / "Definitions/Translation"
    if not candidate_dir.is_dir():
        candidate_dir = candidate_root / RELATIVE_RESOURCE_DIR
    result = []
    for name in RESOURCE_NAMES:
        target = app_dir / name
        candidate = candidate_dir / name
        if not target.is_file():
            raise ValueError(f"正式 app 缺少资源: {target}")
        if not candidate.is_file():
            raise ValueError(f"候选资源缺失: {candidate}")
        result.append((target, candidate, name))
    return result


def audit(app: Path, candidate_root: Path) -> dict[str, Any]:
    version = app_version(app)
    files: dict[str, Any] = {}
    total_changes = 0
    for target, candidate, name in resource_paths(app, candidate_root):
        changes = compare_ui_only(load_json(target), load_json(candidate))
        files[name] = {
            "target": str(target),
            "candidate": str(candidate),
            "beforeSha256": sha256(target),
            "candidateSha256": sha256(candidate),
            "uiTextChanges": len(changes),
            "nonUiChanges": 0,
        }
        total_changes += len(changes)
    return {
        "schemaVersion": 1,
        "app": str(app),
        "cavalryVersion": version,
        "candidateRoot": str(candidate_root),
        "resourceRelativeDir": str(RELATIVE_RESOURCE_DIR),
        "files": files,
        "totalUiTextChanges": total_changes,
        "nonUiChanges": 0,
    }


def apply(app: Path, candidate_root: Path, backup_root: Path, report: dict[str, Any]) -> dict[str, Any]:
    timestamp = int(time.time())
    backup_dir = backup_root / f"cavalry-2.8-source-{timestamp}"
    backup_dir.mkdir(parents=True, exist_ok=False)
    backup_resource_dir = backup_dir / RELATIVE_RESOURCE_DIR
    backup_resource_dir.mkdir(parents=True, exist_ok=True)
    applied = dict(report)
    applied["backupDir"] = str(backup_dir)
    applied["appliedAtUnix"] = timestamp
    try:
        for name, record in report["files"].items():
            target = Path(record["target"])
            candidate = Path(record["candidate"])
            backup = backup_resource_dir / name
            shutil.copy2(target, backup)
            with candidate.open("rb") as source:
                payload = source.read()
            with tempfile.NamedTemporaryFile(
                mode="wb", dir=target.parent, prefix=f".{name}.", suffix=".tmp", delete=False
            ) as temporary:
                temporary.write(payload)
                temporary_path = Path(temporary.name)
            os.replace(temporary_path, target)
            record["backupPath"] = str(backup)
            record["afterSha256"] = sha256(target)
            record["sameAsCandidate"] = record["afterSha256"] == record["candidateSha256"]
        (backup_dir / "manifest.json").write_text(
            json.dumps(applied, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        return applied
    except Exception:
        # Keep the backup for manual recovery; never silently restore over a
        # concurrently changed app after a partial write.
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app", required=True, type=Path)
    parser.add_argument("--candidate-root", required=True, type=Path)
    parser.add_argument("--backup-root", type=Path)
    parser.add_argument("--apply", action="store_true", help="write only after audit passes")
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()

    if args.apply and args.backup_root is None:
        parser.error("--apply 需要 --backup-root")
    report = audit(args.app, args.candidate_root)
    if args.apply:
        report = apply(args.app, args.candidate_root, args.backup_root, report)
    output = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.report:
        args.report.write_text(output, encoding="utf-8")
    sys.stdout.write(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
