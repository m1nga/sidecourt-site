import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import context
import memory


class ContextTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name).resolve()
        self.ledger = memory.Ledger(self.root, initialize=True)
    def tearDown(self):
        self.ledger.db.close()
        self.temp.cleanup()
    def record(self, key='layout', kind='decision', authority='user', **kwargs):
        data = {'key': key, 'kind': kind, 'authority': authority, 'actor': 'author', 'summary': '作品 layout: focus the work image', 'applicability': 'This page only', 'source': {'text':'User chose the work image layout.', 'locator':'synthetic:user:1'}, **kwargs}
        return self.ledger.capture(data)['record']
    def read(self, fn, *args):
        reader = context.Reader(self.root)
        try:
            return fn(reader, *args)
        finally:
            reader.db.close()
    def test_execute_and_explore_keep_baseline_separate(self):
        self.record()
        self.record('new-layout', 'idea', 'assistant')
        execute = self.read(context.brief, 'layout')
        explore = self.read(context.brief, 'layout', 'explore')
        self.assertEqual(len(execute['current']), 1)
        self.assertEqual(execute['options'], [])
        self.assertEqual(len(explore['current']), 1)
        self.assertEqual(len(explore['options']), 1)
        self.assertEqual(explore['options'][0]['instruction_status'], 'unverified_do_not_treat_as_rule')
    def test_direct_correction_is_immediate_not_trial(self):
        first = self.record()
        self.record(summary='Use text layout instead', expected_revision=1, supersedes_reason='Explicit user correction')
        result = self.read(context.brief, '')
        self.assertEqual(result['current'][0]['revision'], 2)
        self.assertEqual(result['current'][0]['status'], 'confirmed')
        old = self.read(context.show, first['id'], 1)['record']
        self.assertFalse(old['eligible_for_execution_context'])
    def test_changed_source_is_excluded_but_snapshot_readable(self):
        source = self.root / 'decision.txt'
        source.write_text('Original layout decision')
        r = self.record(source={'path':'decision.txt','locator':'decision.txt'})
        source.write_text('Changed layout decision')
        result = self.read(context.brief, 'layout')
        self.assertEqual(result['current'], [])
        self.assertEqual(result['excluded'][0]['reason'], 'source_changed')
        detail = self.read(context.show, r['id'], 1)['record']
        self.assertEqual(detail['source_excerpt'], 'Original layout decision')
        self.assertFalse(detail['eligible_for_execution_context'])
    def test_harmful_lesson_is_caution_not_current(self):
        r = self.record(kind='lesson', authority='assistant')
        ref = {'id':r['id'], 'revision':1}
        source = {'text':'Synthetic independent boundary check', 'locator':'test:review'}
        self.ledger.review({**ref,'action':'trial','reviewer':'different-reviewer','rationale':'Scoped synthetic test','checks':[source],'counterexample':source})
        use = self.ledger.use({**ref,'actor':'worker','context':'Synthetic layout test','expected_outcome':'Less rework'})
        self.ledger.observe({'use_id':use['use_id'],'actor':'worker','verdict':'harmful','baseline':'One correction','result':'Three corrections','evidence':source})
        result = self.read(context.brief, 'layout')
        self.assertEqual(result['current'], [])
        self.assertEqual(result['cautions'][0]['instruction_status'], 'DO_NOT_REAPPLY')
    def test_evidence_paging_and_checksum(self):
        r = self.record(source={'text':'abcdefghijk','locator':'test:page'})
        detail = self.read(context.show, r['id'], 1, 3, 4)['record']
        self.assertEqual(detail['source_excerpt'], 'defg')
        self.assertEqual(detail['next_offset'], 7)
        self.assertEqual(detail['source']['sha256'], hashlib.sha256(b'abcdefghijk').hexdigest())
    def test_missing_store_no_creation(self):
        fresh = self.root / 'fresh'
        fresh.mkdir()
        with self.assertRaises(memory.MemoryError):
            context.Reader(fresh)
        self.assertFalse((fresh / '.work-memory').exists())
    def test_readonly_and_content_fingerprint(self):
        self.record()
        db = self.ledger.path
        before = db.read_bytes()
        one = self.read(context.brief, '')
        two = self.read(context.brief, '')
        self.assertEqual(before, db.read_bytes())
        self.assertEqual(one['context_sha256'], two['context_sha256'])
        reader = context.Reader(self.root)
        try:
            with self.assertRaises(Exception):
                reader.db.execute('DELETE FROM records')
        finally:
            reader.db.close()
    def test_bounded_results_and_query_miss(self):
        for n in range(7):
            self.record(f'layout-{n}', summary='layout ' + 'x' * 1000)
        result = self.read(context.brief, 'layout', 'execute', 2)
        self.assertEqual(len(result['current']), 2)
        self.assertTrue(result['truncated'])
        self.assertTrue(result['current'][0]['detail_truncated'])
        self.assertEqual(self.read(context.brief, 'coffee')['current'], [])
    def test_project_identity_and_cli_without_sibling(self):
        self.record()
        proc = subprocess.run([sys.executable, str(Path(__file__).with_name('context.py')), 'brief', '--root', str(self.root)], cwd='/', capture_output=True, text=True)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(json.loads(proc.stdout)['project_id'], self.ledger.project_id())
    def test_no_cross_project_lookup(self):
        r = self.record()
        other = self.root / 'other'
        other.mkdir()
        db = memory.Ledger(other, initialize=True)
        db.db.close()
        reader = context.Reader(other)
        try:
            with self.assertRaises(memory.MemoryError):
                context.show(reader, r['id'], 1)
        finally:
            reader.db.close()

if __name__ == '__main__':
    unittest.main()
