import json
import plistlib
import tempfile
import unittest
from pathlib import Path

from tools.update_cavalry_28_source_resources import audit, apply


class Cavalry28SourceUpdateTests(unittest.TestCase):
    def make_tree(self):
        root = Path(tempfile.mkdtemp())
        app = root / "Cavalry 2.8.app"
        candidate = root / "candidate"
        for base in (app / "Contents/assets/Definitions/Translation", candidate / "Contents/assets/Definitions/Translation"):
            base.mkdir(parents=True)
        (app / "Contents/Info.plist").write_bytes(plistlib.dumps({
            "CFBundleIdentifier": "com.scenegroup.cavalry",
            "CFBundleShortVersionString": "2.8.0",
        }))
        for name in ("appStrings_en-GB.source.json", "nodeStrings_en-GB.source.json"):
            before = [{"value": {"UI-text": "English", "identity": name}}]
            after = [{"value": {"UI-text": "中文（English）", "identity": name}}]
            (app / "Contents/assets/Definitions/Translation" / name).write_text(json.dumps(before), encoding="utf-8")
            (candidate / "Contents/assets/Definitions/Translation" / name).write_text(json.dumps(after), encoding="utf-8")
        return root, app, candidate

    def test_audit_accepts_ui_only_changes(self):
        _, app, candidate = self.make_tree()
        report = audit(app, candidate)
        self.assertEqual(report["totalUiTextChanges"], 2)
        self.assertEqual(report["nonUiChanges"], 0)

    def test_apply_creates_backup_and_matches_candidate(self):
        root, app, candidate = self.make_tree()
        report = apply(app, candidate, root / "backups", audit(app, candidate))
        self.assertEqual(report["files"]["appStrings_en-GB.source.json"]["sameAsCandidate"], True)
        self.assertTrue((Path(report["backupDir"]) / "manifest.json").is_file())

    def test_audit_rejects_non_ui_change(self):
        _, app, candidate = self.make_tree()
        path = candidate / "Contents/assets/Definitions/Translation/appStrings_en-GB.source.json"
        path.write_text(json.dumps([{"value": {"UI-text": "中文", "identity": "changed"}}]), encoding="utf-8")
        with self.assertRaises(ValueError):
            audit(app, candidate)


if __name__ == "__main__":
    unittest.main()
