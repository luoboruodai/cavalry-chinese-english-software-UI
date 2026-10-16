"""Self-contained catalog gate and failure-path tests; never touches a live Cavalry app."""
from __future__ import annotations

import contextlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import validate_translations as validator
from forbidden_translation_patterns import detect_forbidden_translation_patterns


class TranslationGateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix="cb-self-contained-catalog-")
        cls.root = Path(cls.temp.name)
        # Intentionally no sibling reference repository and no PYTHONPATH dependency.
        for name in ("tools", "languages", "translations/pristine"):
            shutil.copytree(ROOT / name, cls.root / name,
                            ignore=shutil.ignore_patterns("__pycache__"))
        (cls.root / "injector").mkdir()
        subprocess.run(["node", str(cls.root / "tools/prepare_runtime.js")],
                       cwd=cls.root, check=True, capture_output=True, text=True, timeout=60)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    @contextlib.contextmanager
    def changed(self, name, contents):
        path = self.root / name
        before = path.read_bytes()
        try:
            if contents is None:
                path.unlink()
            else:
                path.write_text(contents, encoding="utf-8")
            yield path
        finally:
            path.write_bytes(before)

    def report(self):
        return validator.build_report(self.root)

    def test_fresh_checkout_cli_without_reference_or_pythonpath(self):
        env = dict(os.environ)
        env.pop("PYTHONPATH", None)
        result = subprocess.run(
            [sys.executable, str(self.root / "tools/validate_translations.py"),
             "--root", str(self.root), "--json-report", str(self.root / "report.json"),
             "--markdown-summary", str(self.root / "report.md")],
            cwd=self.root, env=env, capture_output=True, text=True, timeout=60,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        report = json.loads((self.root / "report.json").read_text())
        self.assertEqual(report["overall_status"], "PASS")
        self.assertEqual(len(report["languages"]), 3)
        for language in report["languages"].values():
            self.assertGreater(language["runtime_records"]["ts-message"], 3000)
            self.assertGreater(language["runtime_records"]["generated-entry"], 4000)
        self.assertIn("NOT live-UI coverage", (self.root / "report.md").read_text())

    def test_catalog_identity_drift_fails_without_relaxing_whitelist(self):
        data = json.loads((self.root / "languages/zh-Hans/nodeStrings.json").read_text())
        data[0]["value"]["niceName"] = "元素"
        with self.changed("languages/zh-Hans/nodeStrings.json", json.dumps(data, ensure_ascii=False)):
            report = self.report()
        self.assertEqual(report["gates"]["B3"]["status"], "FAIL")
        self.assertEqual(report["languages"]["zh_Hans"]["no_translate_issue_count"], 1)

    def test_missing_or_empty_runtime_inputs_cannot_pass(self):
        for name, content in [("tools/zh-Hans.ts", None), ("tools/zh-Hans.ts", "<TS/>"),
                              ("injector/generated_translations.inc", None)]:
            with self.subTest(name=name, content=content), self.changed(name, content):
                report = self.report()
                self.assertEqual(report["overall_status"], "FAIL")
                self.assertEqual(report["gates"]["B2"]["status"], "FAIL")

    def test_empty_generated_language_array_cannot_pass(self):
        path = "injector/generated_translations.inc"
        content = (self.root / path).read_text()
        start = content.index("const TranslationEntry kZhHansEntries[] = {\n")
        end = content.index("\n};", start)
        content = content[:start] + "const TranslationEntry kZhHansEntries[] = {" + content[end:]
        with self.changed(path, content):
            self.assertEqual(self.report()["gates"]["B2"]["status"], "FAIL")

    def test_missing_pattern_configuration_is_not_silently_ignored(self):
        with self.changed("tools/forbidden_translation_patterns.json", None):
            env = dict(os.environ)
            env.pop("PYTHONPATH", None)
            result = subprocess.run([sys.executable, str(self.root / "tools/validate_translations.py"), "--help"],
                                    cwd=self.root, env=env, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("forbidden_translation_patterns.json", result.stderr)

    def test_qt_localized_and_count_placeholders_are_tracked(self):
        self.assertEqual(validator.placeholder_tokens("%1 %L1 %n %Ln {} {0} {{name}}"),
                         ["%1", "%L1", "%n", "%Ln", "{}", "{0}", "{{name}}"])

    def test_ts_placeholder_loss_fails(self):
        xml = '<TS><context><name>MenuBarManager</name><message><source>Open %1</source><translation>打开</translation></message></context></TS>'
        with self.changed("tools/zh-Hans.ts", xml):
            self.assertEqual(self.report()["gates"]["B4"]["status"], "FAIL")

    def test_generated_placeholder_addition_fails(self):
        name = "injector/generated_translations.inc"
        text = (self.root / name).read_text().replace('{"QMenuBar", "File", "文件"}', '{"QMenuBar", "File", "文件 %1"}', 1)
        with self.changed(name, text):
            self.assertEqual(self.report()["gates"]["B4"]["status"], "FAIL")

    def test_forbidden_pattern_is_rejected_in_runtime_catalog(self):
        xml = '<TS><context><name>MenuBarManager</name><message><source>Open</source><translation>打开（译）</translation></message></context></TS>'
        with self.changed("tools/zh-Hans.ts", xml):
            report = self.report()
            self.assertEqual(report["gates"]["B13"]["status"], "FAIL")
            self.assertGreater(report["languages"]["zh_Hans"]["forbidden_patterns"]["by_pattern"]["FP-1"], 0)

    def test_generated_parser_keeps_escaped_quotes_backslashes_and_unicode(self):
        row = ["Fixture", 'Open "C:\\test"\n%1', '打开 "C:\\test"\n%1']
        text = "const TranslationEntry kZhHansEntries[] = {\n    {" + ", ".join(json.dumps(x, ensure_ascii=False) for x in row) + "},\n};\n"
        with self.changed("injector/generated_translations.inc", text) as path:
            records = validator.parse_generated_translation_entry_records(path, "zh-Hans")
        self.assertEqual(records, [dict(zip(("context", "source", "translation"),
                                           map(validator.normalize_string, row)))])

    def test_malformed_generated_row_is_not_skipped(self):
        name = "injector/generated_translations.inc"
        text = (self.root / name).read_text().replace('{"QMenuBar", "File", "文件"}', '{"QMenuBar", "File", BROKEN}', 1)
        with self.changed(name, text) as path, self.assertRaisesRegex(ValueError, "malformed entry"):
            validator.parse_generated_translation_entry_records(path, "zh-Hans")

    def test_ts_numeric_entities_message_attributes_and_inactive_entries(self):
        xml = '<TS><context><name>Fixture</name><message id="a"><source xml:space="preserve"> Name </source><translation xml:space="preserve"> &#x540d;&#31216; </translation></message><message><source>Old</source><translation type="vanished">旧</translation></message></context></TS>'
        with self.changed("tools/zh-Hans.ts", xml) as path:
            self.assertEqual(validator.parse_ts_message_records(path),
                             [{"context": "Fixture", "source": "Name", "translation": "名称"}])

    def test_ts_orphan_or_plural_is_rejected(self):
        for xml, expected in [
            ('<TS><message><source>Open</source><translation>打开</translation></message></TS>', "outside context"),
            ('<TS><context><name>Fixture</name><message numerus="yes"><source>%n items</source><translation><numerusform>%n 项</numerusform></translation></message></context></TS>', "plural"),
        ]:
            with self.subTest(expected=expected), self.changed("tools/zh-Hans.ts", xml) as path:
                with self.assertRaisesRegex(ValueError, expected):
                    validator.parse_ts_message_records(path)

    def test_pattern_rules_and_technical_tokens(self):
        for language, target, source, pattern in [
            ("zh-Hans", "打开（译）", "Open", "FP-1"),
            ("zh-Hans", "檔案", "File", "FP-5"),
            ("zh-Hant", "图层", "Layer", "FP-4"),
            ("zh-Hans", "阿里尔", "Arial", "FP-10"),
            ("zh-Hans", "打开", "Element_123", "FP-7"),
        ]:
            with self.subTest(pattern=pattern):
                hits = detect_forbidden_translation_patterns(language, target, source, "MenuBarManager")
                self.assertIn(pattern, {hit["id"] for hit in hits})
        self.assertEqual(detect_forbidden_translation_patterns("zh-Hans", "导出 SVG", "Export SVG", "MenuBarManager"), [])


if __name__ == "__main__":
    unittest.main()
