#!/usr/bin/env python3
"""Read-only check of the seven UI-only Skia callsites in BOTH Mach-O slices.
No renderer activation, no process attachment, no user scene reads.
"""
import argparse, json, pathlib, re, struct, uuid
ROOT=pathlib.Path(__file__).resolve().parents[1]
CPUS={'arm64':0x100000c,'x86_64':0x1000007}
def slices(data):
    if data[:4] != b'\xca\xfe\xba\xbe': raise ValueError('expected universal Mach-O')
    count=struct.unpack_from('>I',data,4)[0]
    result={}
    for i in range(count):
        cpu,_,offset,size,_=struct.unpack_from('>IIIII',data,8+20*i)
        if offset+size>len(data):raise ValueError('truncated slice')
        result[cpu]=data[offset:offset+size]
    return result
def identity(data):
    if data[:4]!=b'\xcf\xfa\xed\xfe':raise ValueError('expected 64-bit Mach-O')
    count=struct.unpack_from('<I',data,16)[0];at=32
    for _ in range(count):
        cmd,size=struct.unpack_from('<II',data,at)
        if size<8 or at+size>len(data):raise ValueError('invalid command')
        if cmd==0x1b:return str(uuid.UUID(bytes=data[at+8:at+24])).upper()
        at+=size
    raise ValueError('missing UUID')
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--app',required=True);args=parser.parse_args()
    code=(ROOT/'injector/cavalry_bilingual_macos_canvas.inc').read_text()
    contract=(ROOT/'injector/cavalry_i18n_macos_tool_help_text_path.cpp').read_text()
    expected=re.findall(r'constexpr char kExtensionUuid\[\] = "([A-F0-9-]+)"',contract)
    branch=code.split('#if defined(__arm64__)')[1].split('#endif')[0].split('#elif defined(__x86_64__)')
    data=slices((pathlib.Path(args.app)/'Contents/Frameworks/libExtensionLayer.dylib').read_bytes())
    report=[]
    for i,(arch,cpu) in enumerate(CPUS.items()):
        image=data[cpu];assert identity(image)==expected[i],f'{arch}: UUID mismatch'
        sites=re.findall(r'\{(0x[0-9a-f]+),\s*\{([^}]+)\}\}',branch[i])
        assert len(sites)==7
        for offset,encoded in sites:
            at=int(offset,16);want=bytes(int(x.strip(),16) for x in encoded.split(','));got=image[at:at+len(want)]
            assert got==want, f'{arch}: callsite mismatch at {offset}'
            tampered=bytes([got[0]^1])+got[1:];assert tampered!=want
        report.append({'arch':arch,'uuidMatched':True,'uiCallsitesVerified':len(sites),'tamperRejected':True})
    viewport=(ROOT/'injector/cavalry_bilingual_macos_viewport.inc').read_text().split('#if defined(__arm64__)')[1].split('#endif')[0].split('#elif defined(__x86_64__)')
    for i,(arch,cpu) in enumerate(CPUS.items()):
        image=data[cpu]
        sites=re.findall(r'\{(0x[0-9a-f]+),\s*\{([^}]+)\}\}',viewport[i])
        assert len(sites)==2
        for offset,encoded in sites:
            at=int(offset,16);want=bytes(int(x.strip(),16) for x in encoded.split(','));assert image[at:at+len(want)]==want, f'{arch} viewport callsite drift at {offset}'
        report[i]['viewportPathCallsitesVerified']=len(sites)
    print(json.dumps({'scope':'static binary contract, not a host rendering test','results':report},indent=2))
if __name__=='__main__':main()
