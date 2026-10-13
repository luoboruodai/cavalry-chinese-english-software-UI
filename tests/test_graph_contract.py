"""Whole-function contract rejection tests; fixtures contain no vendor code."""
import hashlib
import pathlib
import sys
import unittest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'tools'))
from audit_macos_canvas import verify_graph_elision, verify_viewport_names

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
if __name__ == '__main__': unittest.main()
