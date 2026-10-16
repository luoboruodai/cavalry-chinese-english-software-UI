"""Cavalry 2.8 Graph elision contract fixtures; no vendor binaries required."""
import hashlib
import re
import unittest

import audit_cavalry_28_graph as audit
import audit_cavalry_28_tool_path as common
from audit_macos_canvas import verify_graph_elision


class Cavalry28GraphTests(unittest.TestCase):
    def test_graph_callsites_reject_every_tamper(self):
        for arch in ("arm64", "x86_64"):
            with self.subTest(arch=arch):
                branch = audit.graph_branch(arch)
                sites = common.callsites(branch, "kGraphMeasureCallsites")
                self.assertEqual(len(sites), 3)
                start = common.uint(branch, "kGraphElideOffset")
                size = common.uint(branch, "kGraphElideSize")
                image = bytearray(max(offset for offset, _ in sites) + 16)
                for offset, expected in sites:
                    self.assertTrue(start <= offset and offset + len(expected) <= start + size)
                    image[offset:offset + len(expected)] = expected
                    common.check_bytes(image, offset, expected, "2.8 Graph")
                for offset, expected in sites:
                    with self.subTest(offset=hex(offset)):
                        image[offset] ^= 1
                        with self.assertRaisesRegex(ValueError, "machine code mismatch"):
                            common.check_bytes(image, offset, expected, "2.8 Graph")
                        image[offset] ^= 1

    def test_elide_digest_boundaries_and_non_callsite_tamper(self):
        for arch in ("arm64", "x86_64"):
            with self.subTest(arch=arch):
                branch = audit.graph_branch(arch)
                start = common.uint(branch, "kGraphElideOffset")
                size = common.uint(branch, "kGraphElideSize")
                image = bytearray(start + size)
                for offset, expected in common.callsites(branch, "kGraphMeasureCallsites"):
                    image[offset:offset + len(expected)] = expected
                declared = re.search(r'kGraphElideSha256\[\]="([0-9a-f]{64})"', branch).group(1)
                actual = hashlib.sha256(image[start:start + size]).hexdigest()
                report = verify_graph_elision(image, branch.replace(declared, actual), arch)
                self.assertEqual(report["graphMeasureCallsitesVerified"], 3)
                self.assertEqual(report["graphElisionCodeBytes"], size)
                self.assertTrue(report["graphElisionTamperRejected"])
                image[start] ^= 1
                with self.assertRaisesRegex(ValueError, "digest mismatch"):
                    verify_graph_elision(image, branch.replace(declared, actual), arch)

    def test_28_graph_does_not_reuse_27_contract(self):
        legacy = {
            "arm64": (0x433E04, "c4ac15fc0bfa9ae71cefd0e4b65fd6683e47b57c6e91543b2a24573058913e64"),
            "x86_64": (0x4AE3A0, "eb67095465ddf3bf0fb35c07a23a702cc38b4e39c5b6f2c8f48a125fe266c1f4"),
        }
        for arch, (old_offset, old_digest) in legacy.items():
            with self.subTest(arch=arch):
                branch = audit.graph_branch(arch)
                self.assertNotEqual(common.uint(branch, "kGraphElideOffset"), old_offset)
                self.assertNotIn(old_digest, branch)
        with self.assertRaisesRegex(ValueError, "unsupported architecture"):
            audit.graph_branch("unknown")


if __name__ == "__main__":
    unittest.main()
