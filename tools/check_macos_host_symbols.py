#!/usr/bin/env python3
"""Verify Qt undefined imports in an injector against the *installed host* Qt, not the build SDK.
This catches SDK/vendor patch-level ABI drift before a DYLD-at-launch failure.
"""
import argparse, pathlib, re, subprocess, sys

def nm(path, arch, undefined=False):
    args=['nm','-arch',arch,'-u' if undefined else '-gU',str(path)]
    result=subprocess.run(args,check=True,capture_output=True,text=True)
    return {line.split()[-1] for line in result.stdout.splitlines() if line.split()}

def qt_imports(symbols):
    names=sorted(symbols)
    demangled=subprocess.run(['c++filt'],input='\n'.join(names)+'\n',check=True,capture_output=True,text=True).stdout.splitlines()
    return {raw:pretty for raw,pretty in zip(names,demangled) if re.match(r'^(?:Q[A-Z][\w]*|QtPrivate)::',pretty)}

def missing(imports, exports):return {raw:pretty for raw,pretty in qt_imports(imports).items() if raw not in exports}

def main():
    p=argparse.ArgumentParser();p.add_argument('--host');p.add_argument('--injector');p.add_argument('--self-test',action='store_true');a=p.parse_args()
    if a.self_test:
        sample='__ZN7QWidget17setAccessibleNameERK7QString'
        assert sample in missing({sample},set())
        assert not missing({sample},{sample})
        print('PASS synthetic host ABI rejection');return 0
    if not a.host or not a.injector:p.error('--host and --injector required')
    root=pathlib.Path(a.host)/'Contents/Frameworks';candidates=[]
    for name in ['QtCore','QtGui','QtWidgets']:
        path=root/f'{name}.framework/Versions/A/{name}'
        if not path.is_file():p.error(f'missing host framework: {name}')
        candidates.append(path)
    dylib=pathlib.Path(a.injector)
    failed=0
    for arch in ['arm64','x86_64']:
        imported=nm(dylib,arch,True)
        exported=set().union(*(nm(file,arch) for file in candidates))
        issues=missing(imported,exported)
        if issues:
            for _,pretty in sorted(issues.items(),key=lambda x:x[1]):print(f'{arch}: missing {pretty}')
            failed+=len(issues)
        print(f'{arch}: {len(qt_imports(imported))} Qt imports, {len(issues)} unresolved by installed host')
    return bool(failed)
if __name__=='__main__':sys.exit(main())
