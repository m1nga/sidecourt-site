"""Fault injection and actual shell roundtrips for organizer recovery reporting."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest import mock
import recovery
import taskdock as td
import workspace_ops as ops


class RecoveryReportingTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.root = self.base / 'Task'
        self.identity = td.init_task('Recovery', 'Temporary evidence', self.base/'index.json', self.root)['id']
        (self.root/'draft.txt').write_text('original', encoding='utf-8')
        self.spec = {'operations': [{'type': 'move', 'from': 'draft.txt', 'to': 'results/current.txt', 'reason': 'test'}]}

    def organize(self):
        return td.organize(self.root, self.identity, self.spec)

    def test_write_before_journal_fault_retains_recovery_and_can_undo(self):
        original = ops.atomic
        def fail(path, data, mode=0o600):
            original(path, data, mode)
            if path.name == 'current.txt':
                raise OSError('interrupted after write, before completed entry')
        with mock.patch.object(ops, 'atomic', side_effect=fail):
            result = self.organize()
        self.assertEqual(result['status'], 'organize_error')
        self.assertEqual(result['mutation_state'], 'partial_or_unverified')
        self.assertTrue((self.root/'results/current.txt').exists())
        folder = self.root/result['recovery']
        self.assertEqual(json.loads((folder/'journal.json').read_text())['completed'], [])
        self.assertEqual(json.loads((folder/'recovery.json').read_text())['operation_id'], result['operation_id'])
        self.assertEqual(ops.transfer(self.root, self.identity, result['operation_id'], True)['status'], 'rolled_back')
        self.assertFalse((self.root/'results/current.txt').exists())

    def test_check_exception_after_apply_keeps_recovery(self):
        with mock.patch.object(td, 'check', side_effect=OSError('check unavailable')):
            result = self.organize()
        self.assertEqual(result['status'], 'organized_check_failed')
        self.assertEqual(result['mutation_state'], 'applied')
        self.assertEqual(result['stage'], 'check')
        self.assertTrue(result['rollback_argv'])
        self.assertNotIn('nothing moved', json.dumps(result).lower())

    def test_recovery_save_failure_prevents_apply(self):
        original = ops.save
        def fail(path, obj):
            if path.name == 'recovery.json':
                raise OSError('cannot save recovery details')
            original(path, obj)
        with mock.patch.object(ops, 'save', side_effect=fail):
            result = self.organize()
        self.assertEqual(result['stage'], 'save_recovery')
        self.assertEqual(result['mutation_state'], 'not_started')
        self.assertTrue(result['operation_id'])
        self.assertTrue((self.root/'draft.txt').exists())
        self.assertFalse((self.root/'results').exists())

    def test_preapply_external_edit_is_preserved_and_reported_not_started(self):
        original = ops.transfer
        def edit_then_apply(*args, **kwargs):
            (self.root/'draft.txt').write_text('new work', encoding='utf-8')
            return original(*args, **kwargs)
        with mock.patch.object(ops, 'transfer', side_effect=edit_then_apply):
            result = self.organize()
        self.assertEqual(result['status'], 'conflict')
        self.assertEqual(result['mutation_state'], 'not_started')
        self.assertEqual((self.root/'draft.txt').read_text(), 'new work')
        self.assertFalse((self.root/'results').exists())

    def test_resume_finds_pending_operation_without_writes_after_folder_move(self):
        identity = ops.plan(self.root, self.identity, self.spec)['operation_id']
        moved = self.base/'moved'
        shutil.move(str(self.root), str(moved))
        before = {p.relative_to(moved).as_posix(): p.read_bytes() for p in moved.rglob('*') if p.is_file()}
        result = td.resume(moved)
        pending = result['pending_recovery']['operations']
        self.assertEqual(len(pending), 1)
        self.assertEqual(pending[0]['operation_id'], identity)
        self.assertIn(str(moved.resolve()), pending[0]['rollback_argv'])
        self.assertNotIn(str(self.root), pending[0]['rollback_argv'])
        after = {p.relative_to(moved).as_posix(): p.read_bytes() for p in moved.rglob('*') if p.is_file()}
        self.assertEqual(before, after)

    def test_resume_scan_limit_is_explicit(self):
        for _ in range(2):
            ops.plan(self.root, self.identity, self.spec)
        result = recovery.pending_operations(self.root, self.identity, td.__file__, limit=1)
        self.assertFalse(result['complete'])
        self.assertTrue(result['warnings'])

    def test_resume_does_not_hash_completed_preimages(self):
        self.organize()
        with mock.patch.object(ops, 'load_operation', side_effect=AssertionError('resume must be cheap')):
            result = td.resume(self.root)
        self.assertEqual(result['pending_recovery']['operations'], [])

    def test_corrupt_journal_cannot_erase_known_operation_identity(self):
        identity = ops.plan(self.root, self.identity, self.spec)['operation_id']
        (self.root/'.taskdock/operations'/identity/'journal.json').write_text('{bad', encoding='utf-8')
        result = td.resume(self.root)['pending_recovery']['operations'][0]
        self.assertEqual(result['operation_id'], identity)
        self.assertEqual(result['mutation_state'], 'unknown')

    def test_explicit_powershell_literal_quoting(self):
        cmd = recovery.shell_command(['C:\\Program Files\\python.exe', "C:\\it's $literal\\main.py"], 'powershell')
        self.assertEqual(cmd, "& 'C:\\Program Files\\python.exe' 'C:\\it''s $literal\\main.py'")
        with self.assertRaises(ValueError):
            recovery.shell_command(['echo'], 'cmd')

    @unittest.skipUnless(os.name == 'posix', 'POSIX shell-specific contract')
    def test_posix_displayed_command_roundtrips_literal_paths(self):
        for suffix in ['space and 中文', "single'quote", 'double"quote', '$RECOVERY_TEST', '`literal`', ';not-a-command']:
            with self.subTest(suffix=suffix):
                renamed = self.base/('Task-' + suffix)
                self.root.rename(renamed)
                self.root = renamed
                result = self.organize()
                proc = subprocess.run(['/bin/sh', '-c', result['rollback']], capture_output=True, text=True,
                                      env=dict(os.environ, RECOVERY_TEST='expanded'), timeout=15)
                self.assertEqual(proc.returncode, 0, proc.stderr)
                self.assertTrue((self.root/'draft.txt').exists())
                self.assertFalse((self.root/'results/current.txt').exists())

    @unittest.skipUnless(os.name == 'nt', 'Actual Windows PowerShell contract')
    def test_powershell_displayed_command_roundtrips_literal_paths(self):
        for suffix in ['space and 中文', "single'quote", '$env-USERPROFILE', '`literal`', '%USERPROFILE%', 'curly’quote']:
            with self.subTest(suffix=suffix):
                renamed = self.base/('Task-' + suffix)
                self.root.rename(renamed)
                self.root = renamed
                result = self.organize()
                proc = subprocess.run(['pwsh', '-NoProfile', '-NonInteractive', '-Command', result['rollback']],
                                      capture_output=True, text=True, encoding='utf-8', timeout=30)
                self.assertEqual(proc.returncode, 0, proc.stderr)
                self.assertTrue((self.root/'draft.txt').exists())
                self.assertFalse((self.root/'results/current.txt').exists())


if __name__ == '__main__':
    unittest.main()
