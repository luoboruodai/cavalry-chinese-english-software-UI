#!/usr/bin/env python3
"""Catalog integrity, not live-UI coverage. Emits reproducible JSON and fails on lost placeholders."""
import argparse, collections, json, pathlib, re, sys, xml.etree.ElementTree as ET
ROOT = pathlib.Path(__file__).resolve().parents[1]
TOKEN = re.compile(r'%(?:L?\d+|L?n)')
def audit(path):
    root = ET.parse(path).getroot()
    counts = collections.Counter()
    keys, issues, duplicates = {}, [], []
    for context in root.findall('context'):
        owner = context.findtext('name', '')
        for message in context.findall('message'):
            source, tr = message.findtext('source', ''), message.find('translation')
            if tr is None or tr.get('type') in ('obsolete', 'vanished'): continue
            translation = ''.join(tr.itertext())
            counts['messages'] += 1
            if not owner or not source or not translation or tr.get('type') == 'unfinished':
                issues.append({'context': owner, 'source': source, 'reason': 'empty_or_unfinished'})
            if collections.Counter(TOKEN.findall(source)) != collections.Counter(TOKEN.findall(translation)):
                issues.append({'context': owner, 'source': source, 'reason': 'placeholder_mismatch'})
            if '\ufffd' in translation:
                issues.append({'context': owner, 'source': source, 'reason': 'replacement_character'})
            counts['cjkTranslations'] += bool(re.search('[\u3400-\u9fff]', translation))
            counts['identicalToSource'] += source == translation
            key = (owner, source)
            if key in keys:
                counts['duplicateKeys'] += 1
                if keys[key] != translation: duplicates.append({'context': owner, 'source': source})
            else: keys[key] = translation
    return {'scope': 'Qt catalog only; NOT a percentage of Cavalry UI translated', 'counts': dict(counts),
            'conflictingDuplicates': duplicates, 'errors': issues}
def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--output'); args = parser.parse_args()
    report = audit(ROOT / 'translations/pristine/zh-Hans.ts')
    report['modelDisplayEntries'] = len(json.loads((ROOT/'translations/pristine/model_display_translations.json').read_text())['entries'])
    text = json.dumps(report, ensure_ascii=False, indent=2) + '\n'
    if args.output: pathlib.Path(args.output).write_text(text)
    print(text)
    return bool(report['errors'] or report['conflictingDuplicates'])
if __name__ == '__main__': sys.exit(main())
