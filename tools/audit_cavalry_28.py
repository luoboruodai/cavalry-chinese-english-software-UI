#!/usr/bin/env python3
"""Read-only Cavalry 2.8 catalog migration audit. Never writes a host or claims live-UI coverage."""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import json
from pathlib import Path
import re

from icu_message_contract import validate_translation

from validate_translations import (
    build_rule_sets, collect_leaves, file_paths, parse_ts_message_records,
    placeholder_tokens,
)

ROOT = Path(__file__).resolve().parents[1]
LANGUAGES = ("zh-Hans", "zh-Hant", "ja_JP")
ICU_MESSAGE = re.compile(r"\{\s*[^,{}]+\s*,\s*(?:plural|select|selectordinal)\s*,")


def translation_index(root: Path, language: str) -> dict[str, set[str]]:
    """Only original, paired assets. A collision stays ambiguous, never last-wins."""
    index: dict[str, set[str]] = defaultdict(set)
    policy = json.loads((root / "tools/translation-whitelist.json").read_text())
    for group, en, target in file_paths(root, language):
        if not en.is_file() or not target.is_file():
            raise ValueError(f"Missing baseline catalog: {en.name} / {target.name}")
        rules = build_rule_sets(policy, group)
        sources = collect_leaves(json.loads(en.read_text()), rules)
        translations = collect_leaves(json.loads(target.read_text()), rules)
        for path, leaf in sources.items():
            if leaf["mode"] != "translate":
                continue
            translated = translations.get(path)
            if translated is None or translated["mode"] != "translate":
                raise ValueError(f"Baseline translate leaf missing: {target.name} {path}")
            if leaf["value"] != translated["value"]:
                index[leaf["value"]].add(translated["value"])
    for entry in parse_ts_message_records(root / f"translations/pristine/{language}.ts"):
        if entry["source"] != entry["translation"]:
            # This is feasibility data, not source-only runtime lookup. All conflicting
            # contexts must remain visible; the report must not install these strings.
            index[entry["source"]].add(entry["translation"])
    models = json.loads((root / "translations/pristine/model_display_translations.json").read_text())
    for entry in models["entries"]:
        if entry.get(language) and entry[language] != entry["source"]:
            index[entry["source"]].add(entry[language])
    return dict(index)


def icu_translation_index(root: Path, language: str) -> dict[str, str]:
    path = root / "translations/pristine/cavalry_28_icu.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("schemaVersion") != 1 or not isinstance(data.get("entries"), list):
        raise ValueError("Invalid Cavalry 2.8 ICU candidate catalog")
    translations, seen = {}, set()
    for entry in data["entries"]:
        source = entry.get("source")
        if not isinstance(source, str) or not ICU_MESSAGE.search(source) or source in seen:
            raise ValueError("Missing, non-ICU or duplicate ICU candidate source")
        seen.add(source)
        if language not in entry:
            continue  # Unsupported languages remain explicitly ICU-review-required.
        translated = entry[language]
        if not isinstance(translated, str) or not translated or translated == source:
            raise ValueError("ICU candidate must contain a nonempty translation")
        validate_translation(source, translated)
        translations[source] = translated
    return translations


def ui_translation_index(root: Path, language: str) -> dict[tuple[str, str], dict[str, str]]:
    """Bind new/ambiguous UI candidates to a vendor file, field and exact source."""
    path = root / "translations/pristine/cavalry_28_ui.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("schemaVersion") != 1 or not isinstance(data.get("entries"), list):
        raise ValueError("Invalid Cavalry 2.8 UI candidate catalog")
    translations, seen = {}, set()
    for entry in data["entries"]:
        file, field, source = (entry.get(key) for key in ("file", "path", "source"))
        if any(not isinstance(value, str) or not value for value in (file, field, source)):
            raise ValueError("UI candidate requires nonempty file, path and source")
        key = (file, field)
        if key in seen:
            raise ValueError(f"Duplicate UI candidate field: {file} {field}")
        seen.add(key)
        if ICU_MESSAGE.search(source):
            raise ValueError("ICU candidates belong in the structural ICU catalog")
        if language not in entry:
            continue
        translated = entry[language]
        if not isinstance(translated, str) or not translated or translated == source:
            raise ValueError("UI candidate must contain a nonempty translation")
        if Counter(placeholder_tokens(source)) != Counter(placeholder_tokens(translated)):
            raise ValueError(f"UI candidate placeholder mismatch: {file} {field}")
        translations[key] = {"source": source, "translation": translated}
    return translations


def inspect_catalog(data, index: dict[str, set[str]], file: str,
                    icu_translations: dict[str, str] | None = None,
                    context_translations: dict[tuple[str, str], dict[str, str]] | None = None) -> list[dict]:
    records = []

    def walk(value, path: str):
        if isinstance(value, dict):
            if "UI-text" in value:
                source = value["UI-text"]
                if not isinstance(source, str) or not source:
                    raise ValueError(f"{file} {path}: UI-text must be a nonempty string")
                keep = value.get("dontTranslate", False)
                if not isinstance(keep, bool):
                    raise ValueError(f"{file} {path}: dontTranslate must be boolean")
                candidates = sorted(index.get(source, set()))
                context = (context_translations or {}).get((file, path))
                if context is not None and context["source"] != source:
                    raise ValueError(f"UI candidate source changed: {file} {path}")
                # ICU branches use a structural contract, never the plain-token shortcut.
                if keep:
                    status = "vendor_no_translate"
                elif ICU_MESSAGE.search(source):
                    translated = (icu_translations or {}).get(source)
                    if translated is None:
                        status = "icu_review_required"
                    else:
                        validate_translation(source, translated)
                        candidates = [translated]
                        status = "icu_translation_candidate"
                elif context is not None:
                    candidates = [context["translation"]]
                    status = "context_translation_candidate"
                elif len(candidates) > 1:
                    status = "ambiguous"
                elif not candidates:
                    status = "missing"
                elif Counter(placeholder_tokens(source)) != Counter(placeholder_tokens(candidates[0])):
                    status = "placeholder_mismatch"
                else:
                    status = "exact_reuse_candidate"
                records.append({"file": file, "path": path, "source": source,
                                "status": status, "candidates": candidates})
            for key, child in value.items():
                if key not in ("notes", "UI-text", "dontTranslate"):
                    walk(child, f"{path}.{key}")
        elif isinstance(value, list):
            for i, child in enumerate(value):
                walk(child, f"{path}[{i}]")
    walk(data, "$")
    return records


def audit(assets: Path, root: Path, language: str) -> dict:
    for name in ("appStrings", "nodeStrings"):
        required = assets / f"Definitions/Translation/{name}_en-GB.source.json"
        if not required.is_file():
            raise ValueError(f"Missing required 2.8 catalog: {required.name}")
    index = translation_index(root, language)
    icu_translations = icu_translation_index(root, language)
    context_translations = ui_translation_index(root, language)
    records, catalogs = [], []
    for path in sorted(assets.rglob("*_en-GB.source.json")):
        relative = path.relative_to(assets).as_posix()
        entries = inspect_catalog(json.loads(path.read_text(encoding="utf-8")), index, relative,
                                  icu_translations, context_translations)
        if not entries:
            raise ValueError(f"Empty UI-text catalog: {relative}")
        catalogs.append({"file": relative, "uiTextCount": len(entries)})
        records.extend(entries)
    unknown_fields = context_translations.keys() - {(r["file"], r["path"]) for r in records}
    if unknown_fields:
        raise ValueError(f"UI candidate field missing from vendor catalogs: {sorted(unknown_fields)[0]}")
    return {
        "scope": "2.8 static UI-text migration feasibility only; NOT live-UI coverage or installation approval",
        "language": language,
        "status": "MIGRATION_REQUIRED",
        "hostWrites": False,
        "catalogs": catalogs,
        "counts": dict(sorted(Counter(r["status"] for r in records).items())),
        "totalUiText": len(records),
        "runtimeAcceptance": "NOT_RUN",
        "records": records,
    }



def catalog_shape(value):
    """Match the vendor's translation schema, not just a count of text leaves."""
    if isinstance(value, dict):
        return {key: catalog_shape(child) for key, child in value.items()}
    if isinstance(value, list):
        return [catalog_shape(child) for child in value]
    return type(value).__name__


def candidate_catalog(source_data, entries: list[dict], filename: str, *,
                      bilingual: bool = False, preserve_notes: bool = False):
    """Preview exact/context candidates; preserve unverified strings and model identities."""
    by_path = {(row["file"], row["path"]): row for row in entries}
    categories = {"exact_reuse_candidate": "reused_exact",
                  "icu_translation_candidate": "icu_translated",
                  "context_translation_candidate": "context_translated"}
    counts = Counter()

    def project(value, path: str):
        if isinstance(value, dict):
            result = {}
            for key, child in value.items():
                if key == "notes":
                    if preserve_notes:
                        result[key] = child
                    continue  # Native source drafts retain notes; locale translations omit them.
                child_path = f"{path}.{key}"
                if key == "UI-text":
                    row = by_path.get((filename, path))
                    if row is None:
                        raise ValueError(f"Unaccounted UI-text: {filename} {path}")
                    if row["source"] != child:
                        raise ValueError(f"Candidate source changed: {filename} {path}")
                    # Model info names and plugin niceName can become persistent
                    # model defaults; Qt visual tests alone do not prove safety.
                    identity = (
                        (filename.startswith("Definitions/Translation/nodeStrings_")
                         and re.match(r"^\$\[\d+\]\.(?:value|values\[\d+\])\.info(?:\.name)?$", path))
                        or ".niceName" in path
                    )
                    reusable = row["status"] in categories
                    if reusable and not identity:
                        translated = row["candidates"][0]
                        if translated != child:
                            category = categories[row["status"]]
                            counts[category] += 1
                            if bilingual and not translated.endswith(f"（{child}）"):
                                translated = f"{translated}（{child}）"
                            result[key] = translated
                            continue
                    counts["english_preserved"] += 1
                    if identity and reusable:
                        counts["identity_guarded"] += 1
                result[key] = project(child, child_path)
            return result
        if isinstance(value, list):
            return [project(child, f"{path}[{i}]") for i, child in enumerate(value)]
        return value

    candidate = project(source_data, "$")
    if sum(counts[key] for key in (*categories.values(), "english_preserved")) != len(entries):
        raise ValueError(f"Candidate denominator drift: {filename}")
    return candidate, counts


def check_draft_destination(assets: Path, draft_dir: Path) -> None:
    """An audit/export destination must not be a host bundle or its catalog tree."""
    destination, source = draft_dir.resolve(), assets.resolve()
    if destination == source or source in destination.parents or destination in source.parents:
        raise ValueError("Draft destination must be separate from the vendor assets")
    if any(part.lower().endswith(".app") for part in destination.parts):
        raise ValueError("Draft export cannot write inside a host .app bundle")


def write_source_review_draft(assets: Path, report: dict, draft_dir: Path, language: str) -> dict:
    """Bilingual en-GB source-schema experiment, not an installer or locale package.

    Keeping the host's English locale also keeps the original ICU plural rules.
    Only structurally validated ICU candidates change; unresolved messages and
    source collisions stay English, not pseudo-translated.
    Only UI-text changes: model identities, notes, IDs and dontTranslate survive.
    """
    check_draft_destination(assets, draft_dir)
    results = Counter()
    for catalog in report["catalogs"]:
        relative = catalog["file"]
        original = json.loads((assets / relative).read_text(encoding="utf-8"))
        records = [row for row in report["records"] if row["file"] == relative]
        candidate, counts = candidate_catalog(
            original, records, relative, bilingual=True, preserve_notes=True)
        if catalog_shape(candidate) != catalog_shape(original):
            raise ValueError(f"Source schema drift: {relative}")
        results.update(counts)
        path = draft_dir / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(candidate, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    status = {
        "state": "REVIEW_ONLY_SOURCE_EXPERIMENT_DO_NOT_INSTALL",
        "language": language, "hostLocale": "en-GB", "bilingual": True,
        "hostWrites": False, "nativeUIValidated": False,
        "counts": dict(sorted(results.items())),
        "icuMessageCountPreservedEnglish": report["counts"].get("icu_review_required", 0),
        "sourceCollisionsPreservedEnglish": report["counts"].get("ambiguous", 0),
        "unresolvedSourceCount": report["counts"].get("missing", 0),
    }
    (draft_dir / "REVIEW-STATUS.json").write_text(
        json.dumps(status, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return status


def write_review_draft(assets: Path, report: dict, draft_dir: Path, language: str) -> dict:
    """Do not copy draft files to the signed app; this is not an installer."""
    check_draft_destination(assets, draft_dir)
    locale = {"zh-Hans": "zh-CN", "zh-Hant": "zh-TW", "ja_JP": "ja-JP"}[language]
    results = Counter()
    for catalog in report["catalogs"]:
        relative = catalog["file"]
        source_path = assets / relative
        reference_path = source_path.with_name(
            source_path.name.replace("_en-GB.source.json", "_ja-JP.translation.json")
        )
        if not reference_path.is_file():
            raise ValueError(f"Missing vendor 2.8 translation schema: {reference_path.name}")
        source_data = json.loads(source_path.read_text(encoding="utf-8"))
        records = [row for row in report["records"] if row["file"] == relative]
        candidate, counts = candidate_catalog(source_data, records, relative)
        reference = json.loads(reference_path.read_text(encoding="utf-8"))
        if catalog_shape(candidate) != catalog_shape(reference):
            raise ValueError(f"Vendor schema drift: {relative}")
        results.update(counts)
        path = draft_dir / relative.replace("_en-GB.source.json", f"_{locale}.translation.json")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(candidate, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    status = {
        "state": "REVIEW_ONLY_DO_NOT_INSTALL",
        "language": language,
        "localeFilenameCandidate": locale,
        "hostWrites": False,
        "nativeUIValidated": False,
        "counts": dict(sorted(results.items())),
        "unresolvedSourceCount": report["counts"].get("missing", 0),
        "icuMessageCount": report["counts"].get("icu_review_required", 0),
    }
    (draft_dir / "REVIEW-STATUS.json").write_text(
        json.dumps(status, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return status


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--assets", required=True, type=Path)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--language", choices=LANGUAGES, default="zh-Hans")
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--draft-dir", type=Path,
                        help="Optional review-only 2.8 JSON drafts; never writes to a Cavalry.app")
    parser.add_argument("--source-draft-dir", type=Path,
                        help="Optional bilingual en-GB source-schema experiment; review only, not an installer")
    args = parser.parse_args()
    # Validate every output, including the report, before the first write.
    for directory in (args.report, args.draft_dir, args.source_draft_dir):
        if directory is not None:
            check_draft_destination(args.assets, directory)
    report = audit(args.assets, args.root, args.language)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.draft_dir:
        draft = write_review_draft(args.assets, report, args.draft_dir, args.language)
        print(json.dumps(draft, ensure_ascii=False, indent=2))
    if args.source_draft_dir:
        print(json.dumps(write_source_review_draft(
            args.assets, report, args.source_draft_dir, args.language), ensure_ascii=False, indent=2))
    print(json.dumps({k: v for k, v in report.items() if k not in ("catalogs", "records")}, ensure_ascii=False, indent=2))
    return 0  # Successful audit, explicitly not a passing compatibility gate.


if __name__ == "__main__":
    raise SystemExit(main())
