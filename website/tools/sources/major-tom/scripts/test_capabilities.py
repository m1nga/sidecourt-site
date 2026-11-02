import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from capabilities import discover


class DiscoveryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name).resolve()
    def tearDown(self):
        self.temp.cleanup()
    def skill(self, root, name='work-memory', description='Recall sourced project evidence'):
        folder = root / name
        folder.mkdir(parents=True)
        (folder / 'SKILL.md').write_text(f'---\nname: {name}\ndescription: >\n  {description}\n---\nNever run this body.\n')
        return folder
    def test_finds_folded_metadata_without_body(self):
        self.skill(self.root)
        result = discover([str(self.root)], 'recall')
        self.assertEqual(result['capabilities'][0]['name'], 'work-memory')
        self.assertNotIn('Never run', json.dumps(result))
        self.assertFalse(result['capabilities'][0]['body_read'])
    def test_duplicate_symlink_and_changed_versions(self):
        a, b, c = [self.root / x for x in ('a','b','c')]
        folder = self.skill(a)
        b.mkdir()
        (b / folder.name).symlink_to(folder)
        self.skill(c, description='Recall a different version')
        items = discover([str(a), str(b), str(c)])['capabilities']
        self.assertEqual(len(items), 2)
        self.assertTrue(all(x['conflicting_versions'] for x in items))
    def test_missing_root_and_bad_metadata_do_not_hide_valid_skill(self):
        self.skill(self.root)
        bad = self.root / 'broken'
        bad.mkdir()
        (bad / 'SKILL.md').write_text('no frontmatter')
        result = discover([str(self.root), str(self.root / 'missing')])
        self.assertEqual(result['total_matching'], 1)
        self.assertEqual(result['gap_count'], 2)
    def test_empty_match_not_absence_and_limit(self):
        self.skill(self.root)
        self.skill(self.root, 'major-tom', 'Coordinate existing owners')
        self.assertTrue(discover([str(self.root)], limit=1)['truncated'])
        self.assertEqual(discover([str(self.root)], 'coffee')['total_matching'], 0)
        with self.assertRaises(ValueError):
            discover([str(self.root)], limit=0)
    def test_cli_from_unrelated_directory(self):
        self.skill(self.root)
        proc = subprocess.run([sys.executable, str(Path(__file__).with_name('capabilities.py')), '--root', str(self.root)], cwd='/', capture_output=True, text=True)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(json.loads(proc.stdout)['total_matching'], 1)

if __name__ == '__main__':
    unittest.main()
