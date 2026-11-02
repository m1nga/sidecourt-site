"""Reproduce the live-pilot self-conflict without weakening conflict protection."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

import taskdock as td
import workspace_ops as ops


class TransactionNotesTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name).resolve()
        self.root = self.base / 'Original'
        self.task = td.init_task('Notes test', 'Preserve the current work', self.base / 'index.json', self.root)
        self.identity = self.task['id']
        (self.root / 'cover.svg').write_text('<svg/>', encoding='utf-8')
        (self.root / 'README.md').write_text('# Work\n[Cover](cover.svg)\n', encoding='utf-8')
        (self.root / 'STATE.md').write_text('# State\n[Cover](cover.svg)\n', encoding='utf-8')
        self.script = str(Path(td.__file__).resolve())

    def snapshot(self, root=None):
        root = root or self.root
        return {p.relative_to(root).as_posix(): (p.read_bytes(), p.stat().st_mode & 0o777)
                for p in root.rglob('*') if p.is_file() and '.taskdock' not in p.relative_to(root).parts}

    def spec(self):
        notes = {}
        for name in ('STATE.md', 'README.md', 'PLAN.md', 'AGENTS.md'):
            raw = (self.root / name).read_bytes()
            notes[name] = {'expected_sha256': hashlib.sha256(raw).hexdigest(),
                           'text': raw.decode('utf-8') + '\nOrganization recorded in this operation.\n'}
        return {'operations': [{'type': 'move', 'from': 'cover.svg', 'to': 'assets/cover.svg',
                                'reason': 'Keep the asset findable'}], 'notes': notes}

    def cli(self, command, root, identity):
        return subprocess.run([sys.executable, self.script, command, '--path', str(root),
                               '--operation', identity], cwd=self.base, capture_output=True, text=True)

    def test_move_notes_links_and_undo_are_one_operation(self):
        before = self.snapshot()
        result = td.organize(self.root, self.identity, self.spec())
        self.assertEqual(result['status'], 'organized')
        self.assertEqual(set(result['notes_updated']), {'README.md', 'STATE.md', 'PLAN.md', 'AGENTS.md'})
        self.assertIn('Organization recorded', (self.root / 'STATE.md').read_text(encoding='utf-8'))
        self.assertIn('(assets/cover.svg)', (self.root / 'STATE.md').read_text(encoding='utf-8'))
        undone = subprocess.run(result['rollback_argv'], cwd=self.base, capture_output=True, text=True)
        self.assertEqual(undone.returncode, 0, undone.stdout + undone.stderr)
        self.assertEqual(self.snapshot(), before)

    def test_plan_does_not_write_notes(self):
        before = self.snapshot()
        planned = ops.plan(self.root, self.identity, self.spec())
        self.assertEqual(self.snapshot(), before)
        self.assertEqual(len(planned['notes_updated']), 4)

    def test_stale_note_input_refuses_before_work_changes(self):
        spec = self.spec()
        (self.root / 'PLAN.md').write_text('Another writer changed the plan', encoding='utf-8')
        before = self.snapshot()
        with self.assertRaisesRegex(ValueError, 'Note changed'):
            td.organize(self.root, self.identity, spec)
        self.assertEqual(self.snapshot(), before)

    def test_external_note_edit_after_plan_still_blocks_apply(self):
        planned = ops.plan(self.root, self.identity, self.spec())
        (self.root / 'STATE.md').write_text('New independent work', encoding='utf-8')
        before = self.snapshot()
        self.assertEqual(ops.transfer(self.root, self.identity, planned['operation_id'])['status'], 'conflict')
        self.assertEqual(self.snapshot(), before)

    def test_later_note_edit_still_blocks_whole_rollback(self):
        result = td.organize(self.root, self.identity, self.spec())
        with (self.root / 'STATE.md').open('a', encoding='utf-8') as f:
            f.write('\nA later user decision that must not be lost.\n')
        before = self.snapshot()
        reply = self.cli('rollback', self.root, result['operation_id'])
        self.assertEqual(reply.returncode, 1, reply.stdout + reply.stderr)
        self.assertEqual(json.loads(reply.stdout)['status'], 'conflict')
        self.assertEqual(self.snapshot(), before)

    def test_unchanged_guard_note_is_not_ignored_on_rollback(self):
        spec = self.spec(); del spec['notes']
        result = td.organize(self.root, self.identity, spec)
        (self.root / 'AGENTS.md').write_text('New instruction; preserve it', encoding='utf-8')
        before = self.snapshot()
        self.assertEqual(ops.transfer(self.root, self.identity, result['operation_id'], True)['status'], 'conflict')
        self.assertEqual(self.snapshot(), before)

    def test_invalid_note_targets_and_hashes_are_refused(self):
        before = self.snapshot()
        for name, value in [
            ('TASK.json', {'expected_sha256': '0'*64, 'text': '{}'}),
            ('../outside.md', {'expected_sha256': '0'*64, 'text': 'do not write'}),
            ('history/note.md', {'expected_sha256': '0'*64, 'text': 'do not write'}),
            ('STATE.md', 'bare text is not safe'),
            ('STATE.md', {'text': 'missing expected hash'}),
            ('STATE.md', {'expected_sha256': '0'*64, 'text': ''}),
            ('INDEX.md', {'expected_sha256': '0'*64, 'text': 'not an existing file'}),
        ]:
            with self.subTest(name=name, value=type(value).__name__):
                spec = self.spec(); spec['notes'] = {name: value}
                with self.assertRaises(ValueError): td.organize(self.root, self.identity, spec)
                self.assertEqual(self.snapshot(), before)

    def test_preserved_note_cannot_be_changed(self):
        spec = self.spec(); spec['preserve'] = ['STATE.md']
        before = self.snapshot()
        with self.assertRaisesRegex(ValueError, 'Preserved reference'):
            td.organize(self.root, self.identity, spec)
        self.assertEqual(self.snapshot(), before)

    def test_notes_partial_write_is_recoverable(self):
        before = self.snapshot()
        original = ops.atomic
        injected = []
        def interrupt(path, data, mode=0o600):
            original(path, data, mode)
            # The engine canonicalizes roots (macOS /var alias, Windows short paths).
            if path.resolve() == (self.root / 'PLAN.md').resolve():
                injected.append(str(path))
                raise OSError('after note write, before journal')
        with mock.patch.object(ops, 'atomic', side_effect=interrupt):
            result = td.organize(self.root, self.identity, self.spec())
        self.assertEqual(len(injected), 1, 'The post-write failure must actually fire')
        self.assertEqual(result['status'], 'organize_error')
        self.assertIn('rollback_argv', result)
        self.assertEqual(ops.transfer(self.root, self.identity, result['operation_id'], True)['status'], 'rolled_back')
        self.assertEqual(self.snapshot(), before)

    def test_recovery_for_copy_is_readonly_and_never_changes_original(self):
        before = self.snapshot()
        result = td.organize(self.root, self.identity, self.spec())
        original_after = self.snapshot()
        copy = self.base / 'Copy $literal 中文'
        shutil.copytree(self.root, copy)
        copied_before = self.snapshot(copy)
        reply = self.cli('recovery', copy, result['operation_id'])
        self.assertEqual(reply.returncode, 0, reply.stdout + reply.stderr)
        info = json.loads(reply.stdout)
        self.assertEqual(info['status'], 'recovery_ready')
        self.assertEqual(info['task_id'], self.identity)
        self.assertEqual(self.snapshot(copy), copied_before)
        self.assertEqual(info['rollback_argv'][info['rollback_argv'].index('--path') + 1], str(copy.resolve()))
        undone = subprocess.run(info['rollback_argv'], cwd=self.base, capture_output=True, text=True)
        self.assertEqual(undone.returncode, 0, undone.stdout + undone.stderr)
        self.assertEqual(self.snapshot(copy), before)
        self.assertEqual(self.snapshot(), original_after)

    def test_recovery_checks_identity_and_corrupt_blobs(self):
        result = td.organize(self.root, self.identity, self.spec())
        copy = self.base / 'Unrelated'; shutil.copytree(self.root, copy)
        task = json.loads((copy / 'TASK.json').read_text(encoding='utf-8'))
        import uuid
        task['id'] = str(uuid.uuid4()); (copy / 'TASK.json').write_text(json.dumps(task), encoding='utf-8')
        reply = self.cli('recovery', copy, result['operation_id'])
        self.assertEqual(reply.returncode, 2)
        self.assertIn('another task', reply.stderr)
        blob = next((self.root / '.taskdock/operations' / result['operation_id'] / 'blobs').iterdir())
        blob.write_bytes(b'corrupt')
        reply = self.cli('recovery', self.root, result['operation_id'])
        self.assertEqual(reply.returncode, 2)
        self.assertIn('corrupt', reply.stderr)


if __name__ == '__main__':
    unittest.main()
