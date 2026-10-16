"""Whole-function contract rejection tests; fixtures contain no vendor code."""
import hashlib
import pathlib
import sys
import unittest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'tools'))
from audit_macos_canvas import legacy_branches, legacy_extension_uuids, verify_graph_elision, verify_viewport_names

class GraphContractTests(unittest.TestCase):
    def setUp(self):
        self.image = bytearray(range(256))
        self.sites = [64, 80, 96]
        digest = hashlib.sha256(self.image[32:160]).hexdigest()
        calls = '\n'.join('{%s, {%s}},' % (hex(i), ','.join(hex(x) for x in self.image[i:i+4])) for i in self.sites)
        self.branch = f'kGraphElideOffset=0x20; kGraphElideSize=0x80; kGraphElideSha256[]="{digest}";\n{calls}'
    def test_valid(self):
        self.assertEqual(verify_graph_elision(self.image, self.branch, 'fixture')['graphMeasureCallsitesVerified'], 3)
    def test_non_callsite_tamper_rejected(self):
        self.image[33] ^= 1
        with self.assertRaisesRegex(ValueError, 'digest mismatch'):
            verify_graph_elision(self.image, self.branch, 'fixture')
    def test_short_image_rejected(self):
        with self.assertRaisesRegex(ValueError, 'digest mismatch'):
            verify_graph_elision(self.image[:159], self.branch, 'fixture')
    def test_wrong_or_missing_callsite_rejected(self):
        for branch in [self.branch.replace('{0x40,', '{0x41,'), '\n'.join(self.branch.splitlines()[:-1])]:
            with self.assertRaises(ValueError):
                verify_graph_elision(self.image, branch, 'fixture')
class ViewportNameContractTests(unittest.TestCase):
    def setUp(self):
        self.image=bytearray(range(256))*2
        digest=hashlib.sha256(self.image[32:288]).hexdigest()
        def calls(sites):
            return '\n'.join('{%s,{%s}},' % (hex(i),','.join(hex(x) for x in self.image[i:i+4])) for i in sites)
        self.branch=f'kViewportNameOffset=0x20; kViewportNameSize=0x100; kViewportNameSha256[]="{digest}";\n'
        self.branch+='kViewportNameMakeCallsites[]={'+calls([64,80])+'};\n'
        self.branch+='kViewportNameMeasureCallsites[]={'+calls([96,112,128,144])+'};'
    def test_valid(self):
        result=verify_viewport_names(self.image,self.branch,'fixture')
        self.assertEqual(result['viewportNameMakeCallsVerified'],2)
        self.assertEqual(result['viewportNameMeasureCallsVerified'],4)
    def test_producer_tamper(self):
        self.image[33]^=1
        with self.assertRaisesRegex(ValueError,'digest mismatch'):verify_viewport_names(self.image,self.branch,'fixture')
    def test_instruction_drift(self):
        with self.assertRaisesRegex(ValueError,'instruction mismatch'):
            verify_viewport_names(self.image,self.branch.replace('{0x40,','{0x41,'),'fixture')
    def test_bounds(self):
        with self.assertRaisesRegex(ValueError,'digest mismatch'):verify_viewport_names(self.image[:287],self.branch,'fixture')
class LegacyBranchTests(unittest.TestCase):
    def test_280_branches_are_not_selected(self):
        text='#if defined(__arm64__) && defined(CAVALRY_I18N_CAVALRY_280)\nARM280\n#elif defined(__x86_64__) && defined(CAVALRY_I18N_CAVALRY_280)\nX86280\n#elif defined(__arm64__)\nARM27\n#elif defined(__x86_64__)\nX8627\n#endif'
        arm,x86=legacy_branches(text)
        self.assertEqual(arm.strip(),'ARM27')
        self.assertEqual(x86.strip(),'X8627')
    def test_27_uuid_is_selected_when_280_is_first(self):
        contract='#if defined(__arm64__) && defined(CAVALRY_I18N_CAVALRY_280)\nconstexpr char kExtensionUuid[] = "448DD50E-75F4-3F2D-A46B-2C9F00DF9408";\n#elif defined(__x86_64__) && defined(CAVALRY_I18N_CAVALRY_280)\nconstexpr char kExtensionUuid[] = "DB431633-99A8-3C32-89EF-3378D4B418EA";\n#elif defined(__arm64__)\nconstexpr char kExtensionUuid[] = "9A99CECD-995B-34D6-B089-6A19093A35B1";\n#elif defined(__x86_64__)\nconstexpr char kExtensionUuid[] = "C48EFBA5-24C5-318E-B7CD-FC39A6A01FF8";\n#endif'
        self.assertEqual(legacy_extension_uuids(contract),[
            '9A99CECD-995B-34D6-B089-6A19093A35B1',
            'C48EFBA5-24C5-318E-B7CD-FC39A6A01FF8',
        ])
if __name__ == '__main__': unittest.main()
