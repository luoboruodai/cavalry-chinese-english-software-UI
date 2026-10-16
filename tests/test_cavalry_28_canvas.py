"""Cavalry 2.8 Canvas callsite contract fixtures; no vendor binaries required."""
import unittest

import audit_cavalry_28_canvas as audit
import audit_cavalry_28_tool_path as common


class Cavalry28CanvasTests(unittest.TestCase):
    def test_canvas_callsites_reject_every_tamper(self):
        for arch in ("arm64", "x86_64"):
            with self.subTest(arch=arch):
                sites = audit.callsites(audit.canvas_branch(arch), "kCanvasCallsites")
                self.assertEqual(len(sites), 8)
                image = bytearray(max(offset for offset, _ in sites) + 16)
                for offset, expected in sites:
                    image[offset:offset + len(expected)] = expected
                    common.check_bytes(image, offset, expected, "2.8 Canvas")
                for offset, expected in sites:
                    with self.subTest(offset=hex(offset)):
                        image[offset] ^= 1
                        with self.assertRaisesRegex(ValueError, "machine code mismatch"):
                            common.check_bytes(image, offset, expected, "2.8 Canvas")
                        image[offset] ^= 1

    def test_canvas_measure_callsites_reject_every_tamper(self):
        for arch in ("arm64", "x86_64"):
            with self.subTest(arch=arch):
                sites = audit.callsites(audit.canvas_branch(arch), "kCanvasMeasureCallsites")
                self.assertEqual(len(sites), 1)
                offset, expected = sites[0]
                image = bytearray(offset + 16)
                image[offset:offset + len(expected)] = expected
                common.check_bytes(image, offset, expected, "2.8 Canvas measure")
                image[offset] ^= 1
                with self.assertRaisesRegex(ValueError, "machine code mismatch"):
                    common.check_bytes(image, offset, expected, "2.8 Canvas measure")

    def test_numeric_and_literal_candidates_stay_excluded(self):
        excluded_draw = {
            "arm64": {0x23B2F0, 0x417E88},
            "x86_64": {0x273C25, 0x486AEA},
        }
        excluded_measure = {"arm64": {0x23B20C}, "x86_64": {0x273B1A}}
        for arch in ("arm64", "x86_64"):
            with self.subTest(arch=arch):
                branch = audit.canvas_branch(arch)
                draw_offsets = {offset for offset, _ in audit.callsites(branch, "kCanvasCallsites")}
                measure_offsets = {offset for offset, _ in audit.callsites(branch, "kCanvasMeasureCallsites")}
                self.assertTrue(excluded_draw[arch].isdisjoint(draw_offsets))
                self.assertTrue(excluded_measure[arch].isdisjoint(measure_offsets))

    def test_28_canvas_does_not_reuse_27_offsets(self):
        for arch, legacy in (("arm64", 0x368CA0), ("x86_64", 0x3CF3D3)):
            with self.subTest(arch=arch):
                offsets = [offset for offset, _ in audit.callsites(audit.canvas_branch(arch), "kCanvasCallsites")]
                self.assertNotIn(legacy, offsets)
        with self.assertRaisesRegex(ValueError, "unsupported architecture"):
            audit.canvas_branch("unknown")


if __name__ == "__main__":
    unittest.main()
