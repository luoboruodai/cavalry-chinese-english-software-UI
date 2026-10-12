#!/usr/bin/env python3
"""Fail-closed privacy scan. Reports file names/rules, never matched secret values.
Source/index/history/package scopes are separate; none implies the others passed.
"""
import argparse, pathlib, re, subprocess, sys, tarfile, zipfile
ROOT = pathlib.Path(__file__).resolve().parents[1]
RULES = {
    'private_key': rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
    'github_token': rb'(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})',
    'credential_url': rb'https?://[^\s/:@]+:[^\s/@]+@',
    'personal_home': rb'/Users' + rb'/(?!example(?:/|["\']))[^/\s"\'<>]+/',
    'windows_home': rb'[A-Z]:\\Users\\(?!example\\)[^\\\s]+\\',
}
PRIVATE_NAMES = {'PROJECT.md','CHAT_BACKUP.md','.env','.DS_Store'}
def rules(data):
    return [name for name, expression in RULES.items() if re.search(expression, data)]
def git(*args): return subprocess.check_output(['git',*args],cwd=ROOT)
def entries(scope, package):
    if scope == 'source':
        for name in git('ls-files','-c','-o','--exclude-standard','-z').decode().split('\0'):
            path = ROOT/name
            if name and path.is_file(): yield name, path.read_bytes()
    elif scope == 'index':
        for name in git('diff','--cached','--name-only','--diff-filter=ACMR','-z').decode().split('\0'):
            if name: yield name, git('show',':'+name)
    elif scope == 'history':
        seen=set()
        for commit in git('rev-list','--all').decode().splitlines():
            for item in git('ls-tree','-r',commit).decode().splitlines():
                meta,name=item.split('\t',1); _,kind,obj=meta.split()
                if kind=='blob' and obj not in seen:
                    seen.add(obj); yield f'{commit[:8]}:{name}', git('cat-file','blob',obj)
    elif scope == 'package':
        path=pathlib.Path(package)
        if path.is_dir():
            for member in path.rglob('*'):
                if member.is_file() and not member.is_symlink(): yield str(member.relative_to(path)), member.read_bytes()
        elif zipfile.is_zipfile(path):
            with zipfile.ZipFile(path) as archive:
                for name in archive.namelist(): yield name, archive.read(name)
        else:
            with tarfile.open(path) as archive:
                for member in archive.getmembers():
                    if member.isfile(): yield member.name, archive.extractfile(member).read()
def main():
    parser=argparse.ArgumentParser();parser.add_argument('scope',choices=['source','index','history','package','self-test']);parser.add_argument('path',nargs='?');args=parser.parse_args()
    if args.scope=='self-test':
        assert rules(b'gh' + b'p_' + b'A'*36)==['github_token']
        assert rules(b'/Users/' + b'private-fixture/test.txt')==['personal_home']
        assert not rules(b'/Users/example/synthetic.txt')
        assert rules(b'https://' + b'name:password@host')==['credential_url']
        print('PASS: synthetic privacy rejection tests');return 0
    if args.scope=='package' and not args.path: parser.error('package needs a path')
    count=bad=0
    for name,data in entries(args.scope,args.path):
        count+=1; findings=rules(data)
        if pathlib.PurePosixPath(name).name in PRIVATE_NAMES:findings.append('private_filename')
        if findings:bad+=1;print(name+': '+', '.join(findings))
    print(f'{args.scope}: {count} files/blobs, {bad} flagged; {"PASS" if bad==0 else "BLOCKED"}')
    return bool(bad)
if __name__=='__main__':sys.exit(main())
