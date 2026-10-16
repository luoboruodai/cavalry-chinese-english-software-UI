"""No vendor files required. Metadata and unknown message formats must not fake UI coverage."""
import json
from pathlib import Path
import sys
import subprocess
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import audit_cavalry_28 as audit


class Cavalry28CatalogTests(unittest.TestCase):
    def test_only_ui_text_and_not_notes_or_identity_are_counted(self):
        data = [{"nodeType": "shape", "notes": [{"UI-text": "not an interface field"}],
                 "value": {"name": {"UI-text": "Open", "notes": ["verb"]}}}]
        records = audit.inspect_catalog(data, {"Open": {"打开"}}, "fixture")
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["status"], "exact_reuse_candidate")

    def test_ambiguous_missing_and_vendor_literals_remain_explicit(self):
        values = [{"UI-text": "Set"}, {"UI-text": "New feature"}, {"UI-text": "SVG", "dontTranslate": True}]
        statuses = [r["status"] for r in audit.inspect_catalog(values, {"Set": {"集合", "设置"}}, "fixture")]
        self.assertEqual(statuses, ["ambiguous", "missing", "vendor_no_translate"])

    def test_icu_plural_is_not_accepted_by_a_plain_placeholder_regex(self):
        text = "{0, plural, one {# hour} other {# hours}}"
        records = audit.inspect_catalog({"UI-text": text}, {text: {"{0}小时"}}, "fixture")
        self.assertEqual(records[0]["status"], "icu_review_required")

    def test_placeholder_loss_is_not_an_exact_reuse_candidate(self):
        records = audit.inspect_catalog({"UI-text": "Version: {0}"}, {"Version: {0}": {"版本"}}, "fixture")
        self.assertEqual(records[0]["status"], "placeholder_mismatch")

    def test_bad_ui_field_and_string_false_are_rejected(self):
        for value in ({"UI-text": 1}, {"UI-text": "Open", "dontTranslate": "false"}):
            with self.subTest(value=value), self.assertRaises(ValueError):
                audit.inspect_catalog(value, {}, "fixture")

    def test_empty_or_legacy_installation_cannot_look_complete(self):
        with tempfile.TemporaryDirectory() as name, self.assertRaisesRegex(ValueError, "Missing required"):
            audit.audit(Path(name), Path(name), "zh-Hans")

    def test_preview_keeps_native_schema_and_model_name_identity(self):
        data = [{"type":"nodeStrings","value":{"nodeType":"group","info":{"UI-text":"Group", "notes":["type"]},
            "attributes":{"title":{"UI-text":"Title", "notes":["label"]}},"niceName":{"UI-text":"Group"},
            "dontTranslate":False}}]
        mapping={"Group":{"分组"},"Title":{"标题"}}
        rows=audit.inspect_catalog(data,mapping,"Definitions/Translation/nodeStrings_en-GB.source.json")
        draft,counts=audit.candidate_catalog(data,rows,"Definitions/Translation/nodeStrings_en-GB.source.json")
        self.assertEqual(draft[0]["value"]["info"]["UI-text"],"Group")
        self.assertEqual(draft[0]["value"]["niceName"]["UI-text"],"Group")
        self.assertEqual(draft[0]["value"]["attributes"]["title"]["UI-text"],"标题")
        self.assertNotIn("notes",draft[0]["value"]["attributes"]["title"])
        self.assertEqual(draft[0]["value"]["nodeType"],"group")
        self.assertEqual(counts["identity_guarded"],2)
        self.assertEqual(counts["reused_exact"],1)

    def test_preview_cannot_silently_drop_unaccounted_ui_text(self):
        with self.assertRaisesRegex(ValueError,"Unaccounted UI-text"):
            audit.candidate_catalog({"UI-text":"Open"},[],"fixture")


    def test_source_experiment_is_bilingual_and_preserves_all_metadata(self):
        filename = "Definitions/Translation/nodeStrings_en-GB.source.json"
        data = [{"type": "nodeStrings", "value": {
            "nodeType": "group", "info": {"UI-text": "Group", "notes": ["persistent name"]},
            "attributes": {"title": {"UI-text": "Title", "notes": ["label"]},
                           "literal": {"UI-text": "RGB", "dontTranslate": True}},
            "niceName": {"UI-text": "Group"}}}]
        rows = audit.inspect_catalog(data, {"Group": {"分组"}, "Title": {"标题"}, "RGB": {"颜色"}}, filename)
        draft, counts = audit.candidate_catalog(data, rows, filename, bilingual=True, preserve_notes=True)
        self.assertEqual(draft[0]["value"]["attributes"]["title"]["UI-text"], "标题（Title）")
        self.assertEqual(draft[0]["value"]["info"], data[0]["value"]["info"])
        self.assertEqual(draft[0]["value"]["niceName"], data[0]["value"]["niceName"])
        self.assertEqual(draft[0]["value"]["attributes"]["literal"], data[0]["value"]["attributes"]["literal"])
        self.assertEqual(draft[0]["value"]["attributes"]["title"]["notes"], ["label"])
        self.assertEqual(audit.catalog_shape(draft), audit.catalog_shape(data))
        self.assertEqual(counts["identity_guarded"], 2)

    def test_source_experiment_does_not_fake_icu_or_conflict_translation(self):
        plural = "{0, plural, one {# hour} other {# hours}}"
        data = [{"UI-text": plural}, {"UI-text": "Set"}, {"UI-text": "Version: {0}"}]
        rows = audit.inspect_catalog(data, {plural: {"{0}小时"}, "Set": {"设置", "集合"},
                                           "Version: {0}": {"版本：{0}"}}, "fixture")
        draft, counts = audit.candidate_catalog(data, rows, "fixture", bilingual=True, preserve_notes=True)
        self.assertEqual(draft[:2], data[:2])
        self.assertEqual(draft[2]["UI-text"], "版本：{0}（Version: {0}）")
        self.assertEqual(counts["english_preserved"], 2)

    def test_source_experiment_does_not_duplicate_existing_bilingual_suffix(self):
        data = {"UI-text": "Title"}
        rows = audit.inspect_catalog(data, {"Title": {"标题（Title）"}}, "fixture")
        draft, _ = audit.candidate_catalog(data, rows, "fixture", bilingual=True)
        self.assertEqual(draft["UI-text"], "标题（Title）")

    def test_audit_draft_cannot_write_to_vendor_tree_or_app_bundle(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            assets = root / "vendor/Contents/assets"
            for destination in (assets, assets / "Definitions", assets.parent,
                                root / "Other.app/Contents/assets"):
                with self.subTest(destination=destination), self.assertRaises(ValueError):
                    audit.check_draft_destination(assets, destination)
            audit.check_draft_destination(assets, root / "review")

    def test_source_experiment_export_reports_preserved_and_bilingual_counts(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            assets, output = root / "assets", root / "review"
            relative = "Definitions/Translation/appStrings_en-GB.source.json"
            source = assets / relative
            source.parent.mkdir(parents=True)
            data = [{"type": "strings", "value": {"title": {"UI-text": "Title", "notes": ["label"]},
                    "future": {"UI-text": "Future"}}}]
            source.write_text(json.dumps(data))
            rows = audit.inspect_catalog(data, {"Title": {"标题"}}, relative)
            report = {"catalogs": [{"file": relative}], "records": rows, "counts": {"missing": 1}}
            status = audit.write_source_review_draft(assets, report, output, "zh-Hans")
            self.assertEqual(status["counts"], {"english_preserved": 1, "reused_exact": 1})
            self.assertFalse(status["hostWrites"])
            self.assertFalse(status["nativeUIValidated"])
            self.assertEqual(json.loads(source.read_text()), data)
            self.assertEqual(json.loads((output / relative).read_text())[0]["value"]["title"]["UI-text"], "标题（Title）")


    def test_structurally_valid_icu_candidate_is_projected_bilingually(self):
        source = "{0, plural, one {# hour} other {# hours}}"
        translated = "{0, plural, one {# 小时} other {# 小时}}"
        rows = audit.inspect_catalog({"UI-text": source}, {}, "fixture", {source: translated})
        self.assertEqual(rows[0]["status"], "icu_translation_candidate")
        draft, counts = audit.candidate_catalog({"UI-text": source}, rows, "fixture", bilingual=True)
        self.assertEqual(draft["UI-text"], translated + "（" + source + "）")
        self.assertEqual(counts["icu_translated"], 1)
        with self.assertRaises(ValueError):
            audit.inspect_catalog({"UI-text": source}, {}, "fixture", {source: "{0}小时"})

    def test_icu_overrides_do_not_claim_untranslated_languages(self):
        root = Path(__file__).resolve().parents[1]
        index = audit.icu_translation_index(root, "zh-Hans")
        self.assertEqual(len(index), 66)
        self.assertEqual(audit.icu_translation_index(root, "zh-Hant"), {})
        self.assertEqual(audit.icu_translation_index(root, "ja_JP"), {})

    def test_icu_candidate_catalog_rejects_duplicate_sources(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            path = root / "translations/pristine/cavalry_28_icu.json"
            path.parent.mkdir(parents=True)
            row = {"source": "{0, plural, other {# hours}}", "zh-Hans": "{0, plural, other {# 小时}}"}
            path.write_text(json.dumps({"schemaVersion": 1, "entries": [row, row]}))
            with self.assertRaises(ValueError):
                audit.icu_translation_index(root, "zh-Hans")


    def test_cli_report_cannot_overwrite_a_host_catalog(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            assets = root / "Fixture.app/Contents/assets"
            path = assets / "Definitions/Translation/appStrings_en-GB.source.json"
            path.parent.mkdir(parents=True)
            path.write_text("preserved host catalog sentinel")
            command = Path(__file__).resolve().parents[1] / "tools/audit_cavalry_28.py"
            result = subprocess.run([sys.executable, str(command), "--assets", str(assets),
                                     "--report", str(path)], capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("Draft destination must be separate", result.stderr)
            self.assertEqual(path.read_text(), "preserved host catalog sentinel")


    def test_context_candidates_do_not_leak_to_another_field_or_file(self):
        filename = "Definitions/Translation/appStrings_en-GB.source.json"
        data = [{"value": {"list.add": {"UI-text": "Add"},
                           "math.add": {"UI-text": "Add"}}}]
        context = {(filename, "$[0].value.list.add"):
                   {"source": "Add", "translation": "添加"}}
        index = {"Add": {"添加", "加法"}}
        rows = audit.inspect_catalog(data, index, filename, context_translations=context)
        self.assertEqual([r["status"] for r in rows], ["context_translation_candidate", "ambiguous"])
        draft, counts = audit.candidate_catalog(data, rows, filename, bilingual=True)
        self.assertEqual(draft[0]["value"]["list.add"]["UI-text"], "添加（Add）")
        self.assertEqual(draft[0]["value"]["math.add"]["UI-text"], "Add")
        self.assertEqual(counts, {"context_translated": 1, "english_preserved": 1})
        other = audit.inspect_catalog(data, index, "another-file", context_translations=context)
        self.assertTrue(all(r["status"] == "ambiguous" for r in other))

    def test_context_source_drift_is_not_silently_ignored(self):
        context = {("fixture", "$"): {"source": "Back", "translation": "背面"}}
        with self.assertRaisesRegex(ValueError, "source changed"):
            audit.inspect_catalog({"UI-text": "Front"}, {}, "fixture", context_translations=context)

    def test_vendor_no_translate_beats_context_candidates(self):
        data = {"UI-text": "RGB", "dontTranslate": True, "notes": ["literal"]}
        context = {("fixture", "$"): {"source": "RGB", "translation": "颜色"}}
        rows = audit.inspect_catalog(data, {}, "fixture", context_translations=context)
        self.assertEqual(rows[0]["status"], "vendor_no_translate")
        draft, counts = audit.candidate_catalog(data, rows, "fixture", bilingual=True, preserve_notes=True)
        self.assertEqual(draft, data)
        self.assertEqual(counts, {"english_preserved": 1})

    def test_grouped_model_names_stay_english_without_hiding_tooltips(self):
        filename = "Definitions/Translation/nodeStrings_en-GB.source.json"
        model = {"nodeType": "group", "info": {"name": {"UI-text": "Group", "notes": ["default"]},
                  "tooltip": {"UI-text": "Group help"}}, "niceName": {"UI-text": "Group"},
                  "attributes": {"name": {"UI-text": "Title"}}}
        data = [{"type": "nodeStrings", "values": [model]}]
        context = {(filename, "$[0].values[0].info.name"):
                   {"source": "Group", "translation": "分组"}}
        rows = audit.inspect_catalog(data, {"Group": {"分组"}, "Group help": {"分组帮助"},
                                     "Title": {"标题"}}, filename, context_translations=context)
        for bilingual, preserve_notes in ((True, True), (False, False)):
            with self.subTest(bilingual=bilingual):
                draft, counts = audit.candidate_catalog(data, rows, filename,
                                        bilingual=bilingual, preserve_notes=preserve_notes)
                projected = draft[0]["values"][0]
                self.assertEqual(projected["info"]["name"]["UI-text"], "Group")
                self.assertEqual(projected["info"]["tooltip"]["UI-text"], "分组帮助（Group help）" if bilingual else "分组帮助")
                self.assertEqual(projected["niceName"], model["niceName"])
                self.assertEqual(projected["nodeType"], "group")
                self.assertEqual(projected["attributes"]["name"]["UI-text"], "标题（Title）" if bilingual else "标题")
                self.assertEqual(counts["identity_guarded"], 2)
                if preserve_notes:
                    self.assertEqual(projected["info"]["name"], model["info"]["name"])
                    self.assertEqual(audit.catalog_shape(draft), audit.catalog_shape(data))

    def test_info_prefix_in_an_ordinary_field_is_not_a_model_identity(self):
        filename = "Definitions/Translation/nodeStrings_en-GB.source.json"
        data = [{"value": {"infoPanel": {"UI-text": "Information"}}}]
        rows = audit.inspect_catalog(data, {"Information": {"信息"}}, filename)
        draft, counts = audit.candidate_catalog(data, rows, filename, bilingual=True)
        self.assertEqual(draft[0]["value"]["infoPanel"]["UI-text"], "信息（Information）")
        self.assertEqual(counts, {"reused_exact": 1})

    def test_projection_rejects_stale_audit_rows(self):
        rows = audit.inspect_catalog({"UI-text": "Open"}, {"Open": {"打开"}}, "fixture")
        with self.assertRaisesRegex(ValueError, "source changed"):
            audit.candidate_catalog({"UI-text": "Save"}, rows, "fixture", bilingual=True)

    def test_ui_catalog_rejects_duplicates_empty_values_and_lost_placeholders(self):
        row = {"file": "fixture", "path": "$", "source": "Version: {0}", "zh-Hans": "版本：{0}"}
        cases = ([row, row], [row | {"path": ""}], [row | {"zh-Hans": "版本"}],
                 [row | {"zh-Hans": ""}], [row | {"source": "{0, plural, other {# hours}}"}])
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            path = root / "translations/pristine/cavalry_28_ui.json"
            path.parent.mkdir(parents=True)
            for entries in cases:
                with self.subTest(entries=entries):
                    path.write_text(json.dumps({"schemaVersion": 1, "entries": entries}))
                    with self.assertRaises(ValueError):
                        audit.ui_translation_index(root, "zh-Hans")
            path.write_text(json.dumps({"schemaVersion": 2, "entries": [row]}))
            with self.assertRaises(ValueError):
                audit.ui_translation_index(root, "zh-Hans")

    def test_context_candidates_do_not_claim_untranslated_languages(self):
        root = Path(__file__).resolve().parents[1]
        self.assertEqual(len(audit.ui_translation_index(root, "zh-Hans")), 69)
        self.assertEqual(len(audit.ui_translation_index(root, "zh-Hant")), 16)
        self.assertEqual(len(audit.ui_translation_index(root, "ja_JP")), 16)
        for language in ("zh-Hant", "ja_JP"):
            self.assertEqual(
                audit.ui_translation_index(root, language)[("Definitions/Translation/appStrings_en-GB.source.json", "$[0].value.sceneTree.placeholder.empty")]["source"],
                "Use the Create menu to add a Layer to the active Composition.",
            )

    def test_observed_main_workspace_fields_have_exact_candidates(self):
        root = Path(__file__).resolve().parents[1]
        index = audit.ui_translation_index(root, "zh-Hans")
        filename = "Definitions/Translation/appStrings_en-GB.source.json"
        expected_paths = {
            "$[0].value.align.title",
            "$[0].value.dgView.popover.addLayers",
            "$[0].value.menu.window.addLayers",
            "$[0].value.quickAdd.window.titleMulti",
            "$[0].value.sceneWindow.header.popover.addLayers",
            "$[0].value.sceneTree.placeholder.empty",
            "$[0].value.sceneWindow.header.search.placeholder",
            "$[0].value.tool.field.manipulator",
            "$[0].value.tool.field.snapAngle",
            "$[0].value.tool.field.snapAngleColon",
            "$[0].value.tool.transform.shortcut.sClickPath",
            "$[0].value.viewport.qualityHigh",
            "$[0].value.viewport.qualityLow",
            "$[0].value.viewport.qualityLowest",
        }
        self.assertTrue({(filename, path) for path in expected_paths} <= index.keys())
        self.assertEqual(index[(filename, "$[0].value.tool.field.snapAngleColon")],
                         {"source": "Snap Angle: ", "translation": "吸附角度:"})

    def test_audit_rejects_review_fields_absent_from_vendor_data(self):
        with tempfile.TemporaryDirectory() as name:
            assets = Path(name) / "assets"
            directory = assets / "Definitions/Translation"
            directory.mkdir(parents=True)
            for base in ("appStrings", "nodeStrings"):
                (directory / f"{base}_en-GB.source.json").write_text(json.dumps({"UI-text": "Open"}))
            context = {("Definitions/Translation/appStrings_en-GB.source.json", "$.removed"):
                       {"source": "Open", "translation": "打开"}}
            with patch.object(audit, "translation_index", return_value={}), \
                 patch.object(audit, "icu_translation_index", return_value={}), \
                 patch.object(audit, "ui_translation_index", return_value=context), \
                 self.assertRaisesRegex(ValueError, "field missing"):
                audit.audit(assets, Path(name), "zh-Hans")


if __name__ == "__main__":
    unittest.main()
