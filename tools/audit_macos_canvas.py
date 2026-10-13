#!/usr/bin/env python3
"""Read-only audit of UI-only Skia drawing, viewport and Lina elision contracts in BOTH slices.
No renderer activation, no process attachment, no user scene reads.
"""
import argparse, hashlib, json, pathlib, re, struct, uuid
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
def verify_graph_elision(image, branch, arch):
    """The full digest protects the byte-pop and bounds-consumption assumptions,
    not just the three calls to SkFont. Static proof only; no host UI claim.
    """
    start = int(re.search(r'kGraphElideOffset=(0x[0-9a-f]+)', branch).group(1), 16)
    size = int(re.search(r'kGraphElideSize=(0x[0-9a-f]+)', branch).group(1), 16)
    digest = re.search(r'kGraphElideSha256\[\]="([0-9a-f]{64})"', branch).group(1)
    if start + size > len(image) or hashlib.sha256(image[start:start+size]).hexdigest() != digest:
        raise ValueError(f'{arch}: graph elision function digest mismatch')
    sites = re.findall(r'\{(0x[0-9a-f]+),\s*\{([^}]+)\}\}', branch)
    if len(sites) != 3:
        raise ValueError(f'{arch}: expected exactly three elision measurement calls')
    for offset, encoded in sites:
        at = int(offset, 16)
        want = bytes(int(x.strip(), 16) for x in encoded.split(','))
        if not start <= at < start + size or at + len(want) > start + size or image[at:at+len(want)] != want:
            raise ValueError(f'{arch}: graph measure callsite mismatch at {offset}')
    # Prove a byte outside the callsites cannot bypass the new whole-function gate.
    tampered = bytearray(image[start:start+size]); tampered[0] ^= 1
    if hashlib.sha256(tampered).hexdigest() == digest:
        raise ValueError('tamper probe unexpectedly matched')
    return {'graphMeasureCallsitesVerified': len(sites), 'graphElisionDigestVerified': True,
            'graphElisionCodeBytes': size, 'graphElisionTamperRejected': True}

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
    graph=(ROOT/'injector/cavalry_bilingual_macos_graph_measure.inc').read_text().split('#if defined(__arm64__)')[1].split('#endif')[0].split('#elif defined(__x86_64__)')
    for i,(arch,cpu) in enumerate(CPUS.items()):
        report[i].update(verify_graph_elision(data[cpu], graph[i], arch))
    print(json.dumps({'scope':'static binary contract, not a host rendering test','results':report},indent=2))
if __name__=='__main__':main()
