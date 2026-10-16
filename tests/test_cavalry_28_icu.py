"""ICU structural validation, independent of vendor files and OS ICU availability."""
from pathlib import Path
import json
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from icu_message_contract import message_contract, validate_translation, MessageSyntaxError


class IcuContractTests(unittest.TestCase):
    def test_plural_can_move_in_a_translated_sentence(self):
        validate_translation('Saved {0, plural, one {# layer} other {# layers}} to {1}.',
                             '已将{0, plural, one {# 个图层} other {# 个图层}}保存到{1}。')

    def test_reordering_preserves_each_branch_arguments(self):
        validate_translation('{a} {n, plural, one {# file {b}} other {# files {c}}}',
                             '{n, plural, other {{c} # 个文件} one {{b} # 个文件}}{a}')

    def test_nested_select_plural_and_offset(self):
        message_contract('{gender, select, female {{n, plural, offset:1 =0 {none} one {# file} other {# files}}} other {{n}}}')
        message_contract('{n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}')

    def test_dropped_arguments_branches_hashes_types_offsets_are_rejected(self):
        source = '{0, plural, offset:1 =0 {none} one {# file {1}} other {# files {1}}}'
        for target in (source.replace('{1}', ''), source.replace('one {# file {1}} ', ''),
                       source.replace('#', ''), source.replace('offset:1', 'offset:2'),
                       source.replace('plural,', 'selectordinal,'), source.replace('=0', '=2')):
            with self.subTest(target=target), self.assertRaises(MessageSyntaxError):
                validate_translation(source, target)

    def test_literals_and_apostrophes_do_not_invent_arguments(self):
        validate_translation("'{fake}' {0} isn't ''broken''", "'{literal}' {0} 没有损坏")
        validate_translation("{n, plural, other {'#' # files}}", "{n, plural, other {'#' # 文件}}")
        self.assertNotEqual(message_contract("{n, plural, other {'#' files}}"),
                            message_contract('{n, plural, other {# files}}'))

    def test_invalid_patterns_are_rejected(self):
        for text in ('{0, plural, one {file}}', '{0, plural, other {# files}',
                     '{0, plural, other {#} other {#}}', '{0, plural, feww {#} other {#}}',
                     '{0, select, offset:1 other {x}}', '{0, number broken}', '{0', '}'):
            with self.subTest(text=text), self.assertRaises(MessageSyntaxError):
                message_contract(text)

    def test_scalar_format_style_is_part_of_contract(self):
        validate_translation('At {0, date, short}: {1, number, integer}',
                             '{0, date, short}：{1, number, integer}')
        with self.assertRaises(MessageSyntaxError):
            validate_translation('{0, number, integer}', '{0, number, currency}')

    def test_all_committed_cavalry_28_icu_candidates_preserve_contract(self):
        file = Path(__file__).resolve().parents[1] / 'translations/pristine/cavalry_28_icu.json'
        data = json.loads(file.read_text())
        self.assertEqual(data['schemaVersion'], 1)
        self.assertEqual(len(data['entries']), len({e['source'] for e in data['entries']}))
        for entry in data['entries']:
            for language in ('zh-Hans', 'zh-Hant', 'ja_JP'):
                if language in entry:
                    with self.subTest(source=entry['source'], language=language):
                        validate_translation(entry['source'], entry[language])


if __name__ == '__main__':
    unittest.main()
