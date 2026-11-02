"""Acceptance assertions retained from the independent 2026-09-19 audit.
All data is temporary; no live model or private material is used.
"""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

import taskdock as td
import workspace_ops as ops

HERE = Path(__file__).resolve().parent


class RecoveryContractTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='taskdock-recovery-contract-')
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)

    def fixture(self, name='Project'):
        root = self.base / name
        created = td.init_task('Recovery audit', 'Temporary test files only',
                               self.base / 'index' / 'index.json', root)
        (root / 'draft.txt').write_text('original bytes', encoding='utf-8')
        return root, created['id']

    @staticmethod
    def spec():
        return {'operations': [{'type': 'move', 'from': 'draft.txt',
                'to': 'results/current.txt', 'reason': 'acceptance fixture'}]}

    @staticmethod
    def visible(root):
        return {p.relative_to(root).as_posix(): ops.snapshot(p)
                for p in root.rglob('*') if p.is_file() and '.taskdock' not in p.parts}

    def assert_recoverable_response(self, response):
        self.assertTrue(response.get('operation_id'), 'Missing operation_id after mutation')
        self.assertTrue(response.get('recovery'), 'Missing saved recovery location')
        self.assertTrue(response.get('rollback_argv') or response.get('rollback'),
                        'Missing actionable recovery command')

    def test_normal_roundtrip_preserves_bytes_and_modes(self):
        root, tid = self.fixture()
        before = self.visible(root)
        result = td.organize(root, tid, self.spec())
        self.assertEqual(result['status'], 'organized')
        self.assertEqual(ops.transfer(root, tid, result['operation_id'], rollback=True)['status'],
                         'rolled_back')
        self.assertEqual(self.visible(root), before)

    def test_post_apply_check_problem_keeps_recovery_or_refuses_before_mutation(self):
        root, _ = self.fixture()
        (root / 'legacy.md').write_bytes(b'caf\xe9\n')
        before = self.visible(root)
        moves = self.base / 'moves.json'
        moves.write_text(json.dumps(self.spec()), encoding='utf-8')
        p = subprocess.run([sys.executable, str(HERE / 'taskdock.py'), 'organize',
                            '--path', str(root), '--spec', str(moves)],
                           capture_output=True, text=True, timeout=10)
        # Both preflight rejection and explicit partial-check reporting are valid.
        if self.visible(root) == before:
            self.assertNotEqual(p.returncode, 0, 'No-op must not masquerade as successful organization')
            return
        response = json.loads(p.stdout.strip() or p.stderr.strip())
        self.assert_recoverable_response(response)
        self.assertNotIn('nothing moved', json.dumps(response).lower())

    def test_partial_apply_must_not_claim_unchanged_and_must_keep_recovery(self):
        root, tid = self.fixture()
        original_save = ops.save
        injected = [False]

        def save_and_edit(path, obj):
            original_save(path, obj)
            entries = obj.get('completed', []) if isinstance(obj, dict) else []
            if path.name == 'journal.json' and not injected[0] and any(
                    e.get('path') == 'results/current.txt' for e in entries):
                (root / 'draft.txt').write_text('new concurrent edit', encoding='utf-8')
                injected[0] = True

        with patch.object(ops, 'save', side_effect=save_and_edit):
            result = td.organize(root, tid, self.spec())
        self.assertTrue(injected[0], 'Fault injection did not reach its target')
        self.assertTrue((root / 'results/current.txt').exists())
        self.assertEqual((root / 'draft.txt').read_text(encoding='utf-8'), 'new concurrent edit')
        self.assertNotIn('nothing moved', json.dumps(result).lower(),
                         'The response contradicts an actual destination write')
        self.assert_recoverable_response(result)

    @unittest.skipUnless(os.name == 'posix', 'POSIX shell contract; Windows needs a separate test')
    def test_returned_undo_restores_a_literal_dollar_sign_path(self):
        root, _ = self.fixture('Project-$TASKDOCK_AUDIT_SUFFIX')
        before = self.visible(root)
        result = td.organize(root, td.read_task(root)['id'], self.spec())
        env = dict(os.environ, TASKDOCK_AUDIT_SUFFIX='EXPANDED')
        if isinstance(result.get('rollback_argv'), list):
            command = result['rollback_argv']
        else:
            command = ['/bin/sh', '-c', result['rollback']]
        p = subprocess.run(command, env=env, capture_output=True, text=True, timeout=10)
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertEqual(self.visible(root), before)


if __name__ == '__main__':
    unittest.main()
