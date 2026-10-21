"""Cavalry 2.8 tool-path contract fixtures; no vendor binaries required."""
import struct
import unittest
import pathlib
import sys
import uuid

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "tools"))
import audit_cavalry_28_tool_path as audit


class Cavalry28ToolPathTests(unittest.TestCase):
    def test_contract_constants_and_callsite_reject_every_tamper(self):
        for arch in ("arm64", "x86_64"):
            with self.subTest(arch=arch):
                branch = audit.contract_branch(arch)
                viewport = audit.viewport_branch(arch)
                checks = [
                    (audit.uint(branch, "kCoreGetPathCallOffset"), audit.byte_array(branch, "kCoreGetPathCall"), "core"),
                    (audit.uint(branch, "kExtensionMakePathCallOffset"), audit.byte_array(branch, "kExtensionMakePathCall"), "make"),
                    (audit.uint(branch, "kExtensionPrefixCallOffset"), audit.byte_array(branch, "kExtensionPrefixCall"), "prefix"),
                    (audit.uint(branch, "kExtensionActionCallOffset"), audit.byte_array(branch, "kExtensionActionCall"), "action"),
                ] + [(offset, expected, "viewport") for offset, expected in audit.callsites(viewport, "kViewportCallsites")]
                image = bytearray(max(offset for offset, _, _ in checks) + 32)
                for offset, expected, label in checks:
                    image[offset:offset + len(expected)] = expected
                    audit.check_bytes(image, offset, expected, label)
                for offset, expected, label in checks:
                    with self.subTest(label=label, offset=hex(offset)):
                        image[offset] ^= 1
                        with self.assertRaisesRegex(ValueError, "machine code mismatch"):
                            audit.check_bytes(image, offset, expected, label)
                        image[offset] ^= 1

    def test_symbol_offsets_reject_every_mismatch(self):
        for arch in ("arm64", "x86_64"):
            with self.subTest(arch=arch):
                expected = audit.expected_symbols(audit.contract_branch(arch))
                actual = {symbol: offset for symbol, (_, offset) in expected.items()}
                audit.check_symbol_offsets(actual, expected, "fixture")
                for symbol in expected:
                    with self.subTest(symbol=symbol), self.assertRaises(ValueError):
                        audit.check_symbol_offsets(actual | {symbol: actual[symbol] + 1}, expected, "fixture")

    def test_prefix_action_and_version_branches_cannot_impersonate_each_other(self):
        for arch in ("arm64", "x86_64"):
            with self.subTest(arch=arch):
                branch = audit.contract_branch(arch)
                self.assertNotEqual(
                    audit.uint(branch, "kExtensionPrefixCallOffset"),
                    audit.uint(branch, "kExtensionActionCallOffset"),
                )
                self.assertNotEqual(
                    audit.byte_array(branch, "kExtensionPrefixCall"),
                    audit.byte_array(branch, "kExtensionActionCall"),
                )
        self.assertNotEqual(
            audit.uuid(audit.contract_branch("x86_64"), "kExtensionUuid"),
            "C48EFBA5-24C5-318E-B7CD-FC39A6A01FF8",
        )
        with self.assertRaisesRegex(ValueError, "unsupported architecture"):
            audit.contract_branch("unknown")

    def test_uuid_parser_and_mismatch_rejection(self):
        expected = str(uuid.uuid4()).upper()
        header = bytearray(56)
        struct.pack_into("<I", header, 0, 0xFEEDFACF)
        struct.pack_into("<I", header, 16, 1)
        struct.pack_into("<I", header, 20, 24)
        struct.pack_into("<II", header, 32, 0x1B, 24)
        header[40:56] = uuid.UUID(expected).bytes
        self.assertEqual(audit.identity(bytes(header)), expected)
        audit.check_uuid(bytes(header), expected, "fixture")
        with self.assertRaisesRegex(ValueError, "UUID mismatch"):
            audit.check_uuid(bytes(header), str(uuid.uuid4()).upper(), "fixture")
        with self.assertRaises(ValueError):
            audit.check_symbol_offsets({}, {audit.GET_PATH: ("libskia.dylib", 0x1c5f0)}, "fixture")


if __name__ == "__main__":
    unittest.main()
