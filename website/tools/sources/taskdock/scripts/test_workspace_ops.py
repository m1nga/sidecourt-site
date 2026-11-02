import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock
import taskdock as td
import workspace_ops as ops


class OperationsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.root = self.base / 'Project'
        self.task = td.init_task('Launch', 'Prepare a useful launch', self.base / 'index.json', self.root)
        self.identity = self.task['id']

    def put(self, name, content):
        p = self.root / name; p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content); return p

    def move(self, src='draft.txt', dst='results/current.txt'):
        return {'operations': [{'type': 'move', 'from': src, 'to': dst, 'reason': 'Adopted result'}]}

    def plan(self, spec=None):
        return ops.plan(self.root, self.identity, spec or self.move())['operation_id']

    def apply(self, identity, rollback=False):
        return ops.transfer(self.root, self.identity, identity, rollback)

    def bytes(self):
        return {p.relative_to(self.root).as_posix(): p.read_bytes() for p in self.root.rglob('*') if p.is_file() and '.taskdock' not in p.parts}

    def test_move_repairs_incoming_and_outgoing_links_and_restores_all_bytes(self):
        self.put('draft.md', '[Evidence](evidence.txt#source)')
        self.put('evidence.txt', 'evidence')
        self.put('page.html', '<a href="draft.md?view=1#heading">Open</a>')
        self.put('README.md', '[Work](draft.md)')
        before = self.bytes()
        identity = self.plan(self.move('draft.md','results/current.md'))
        self.assertEqual(self.bytes(), before, 'Plan is a dry run')
        self.assertEqual(self.apply(identity)['status'], 'applied')
        self.assertIn('(results/current.md)', (self.root/'README.md').read_text())
        self.assertIn('../evidence.txt#source', (self.root/'results/current.md').read_text())
        self.assertIn('results/current.md?view=1#heading', (self.root/'page.html').read_text())
        self.assertEqual(self.apply(identity)['changed'], 0)
        self.assertEqual(self.apply(identity, True)['status'], 'rolled_back')
        self.assertEqual(self.bytes(), before)
        self.assertFalse((self.root/'results').exists())
        self.assertEqual(self.apply(identity, True)['changed'], 0)

    def test_merge_keeps_purpose_separate_and_roundtrips(self):
        self.put('copy.txt','same'); self.put('source.txt','same'); self.put('runtime.txt','same')
        self.put('README.md','[Resource](copy.txt)')
        before=self.bytes()
        i=self.plan({'operations':[{'type':'merge','from':'copy.txt','to':'source.txt','reason':'Redundant download, source and runtime have separate uses'}]})
        self.apply(i)
        self.assertFalse((self.root/'copy.txt').exists())
        self.assertTrue((self.root/'runtime.txt').exists())
        self.assertTrue((self.root/'source.txt').exists())
        self.apply(i,True); self.assertEqual(self.bytes(),before)

    def test_changed_source_cancels_entire_apply(self):
        self.put('draft.txt','before'); i=self.plan(); self.put('draft.txt','new work')
        before=self.bytes(); self.assertEqual(self.apply(i)['status'],'conflict'); self.assertEqual(self.bytes(),before)

    def test_changed_merge_survivor_cancels_apply(self):
        self.put('copy.txt','same'); self.put('source.txt','same')
        i=self.plan({'operations':[{'type':'merge','from':'copy.txt','to':'source.txt','reason':'same download'}]})
        self.put('source.txt','new version')
        self.assertEqual(self.apply(i)['status'],'conflict'); self.assertTrue((self.root/'copy.txt').exists())

    def test_new_occupant_and_rollback_edits_are_preserved(self):
        self.put('draft.txt','old'); i=self.plan(); self.put('results/current.txt','somebody else')
        self.assertEqual(self.apply(i)['status'],'conflict')
        (self.root/'results/current.txt').unlink(); self.apply(i)
        self.put('results/current.txt','new edit'); before=self.bytes()
        self.assertEqual(self.apply(i,True)['status'],'conflict'); self.assertEqual(self.bytes(),before)

    def test_interruption_after_write_before_journal_is_resumable(self):
        self.put('draft.txt','keep'); i=self.plan()
        original=ops.atomic
        def fail(path,data,mode=0o600):
            original(path,data,mode)
            if path.name=='current.txt': raise OSError('simulated interruption')
        with mock.patch.object(ops,'atomic',side_effect=fail):
            with self.assertRaises(OSError): self.apply(i)
        self.assertTrue((self.root/'draft.txt').exists())
        self.assertEqual(self.apply(i)['status'],'applied')
        self.assertEqual((self.root/'results/current.txt').read_text(),'keep')
        self.apply(i,True); self.assertEqual((self.root/'draft.txt').read_text(),'keep')

    def test_partial_apply_can_rollback_without_finishing(self):
        self.put('draft.txt','keep'); before=self.bytes(); i=self.plan()
        original=ops.atomic
        def fail(path,data,mode=0o600):
            original(path,data,mode)
            if path.name=='current.txt': raise OSError('simulated interruption')
        with mock.patch.object(ops,'atomic',side_effect=fail):
            with self.assertRaises(OSError): self.apply(i)
        self.assertEqual(self.apply(i,True)['status'],'rolled_back'); self.assertEqual(self.bytes(),before)

    def test_interrupted_rollback_can_resume(self):
        self.put('draft.txt','keep'); before=self.bytes(); i=self.plan(); self.apply(i)
        original=ops.atomic
        def fail(path,data,mode=0o600):
            original(path,data,mode)
            if path.name=='draft.txt': raise OSError('simulated interruption')
        with mock.patch.object(ops,'atomic',side_effect=fail):
            with self.assertRaises(OSError): self.apply(i,True)
        self.assertEqual(self.apply(i,True)['status'],'rolled_back'); self.assertEqual(self.bytes(),before)

    def test_preserved_history_conflict_fails_before_product_changes(self):
        self.put('draft.txt','content'); self.put('history/original.md','[Original](../draft.txt)'); before=self.bytes()
        with self.assertRaisesRegex(ValueError,'Preserved reference'): self.plan()
        self.assertEqual(self.bytes(),before)

    def test_unicode_spaces_css_and_markdown_examples(self):
        self.put('图 片.png','pixels'); self.put('style.css',"body{background:url('图%20片.png')}")
        self.put('README.md','[Image](<图 片.png>)\n```\n[Example](图%20片.png)\n```\n')
        before=self.bytes(); i=self.plan(self.move('图 片.png','assets/new image.png')); self.apply(i)
        self.assertIn('assets/new%20image.png',(self.root/'style.css').read_text())
        self.assertIn('[Example](图%20片.png)',(self.root/'README.md').read_text())
        self.apply(i,True); self.assertEqual(self.bytes(),before)

    def test_artifact_separates_decision_use_and_drift(self):
        self.put('draft.txt','old')
        spec={'items':[{'id':'design','path':'draft.txt','role':'runtime','decision':'rejected','used_in':['local-v1'],'evidence':'User rejected it; still in this local version'}]}
        ops.record(self.root,self.identity,spec)
        self.assertEqual(ops.reconcile(self.root)['status'],'attention')
        i=self.plan(); self.apply(i)
        row=ops.reconcile(self.root)['artifacts'][0]
        self.assertEqual(row['path'],'results/current.txt'); self.assertEqual(row['decision'],'rejected')
        self.put('results/current.txt','edit')
        self.assertEqual(ops.reconcile(self.root)['artifacts'][0]['file_state'],'changed')

    def test_artifact_record_is_all_or_nothing(self):
        self.put('draft.txt','old')
        valid={'id':'a','path':'draft.txt','role':'working','decision':'unknown','evidence':'Unreviewed'}
        with self.assertRaises(ValueError): ops.record(self.root,self.identity,{'items':[valid,{**valid,'id':'b','path':'missing.txt'}]})
        self.assertFalse(ops.artifact_path(self.root).exists())

    def test_paths_repositories_controls_and_symlinks_are_protected(self):
        self.put('draft.txt','keep'); outside=self.base/'outside.txt'; outside.write_text('private')
        (self.root/'link').symlink_to(self.base,target_is_directory=True)
        self.put('repo/.git/HEAD','ref: refs/heads/main'); self.put('repo/file.txt','code')
        for src,dst in [('draft.txt','../outside.txt'),('draft.txt','link/new.txt'),('draft.txt','STATE.md'),('repo/file.txt','file.txt'),('draft.txt','.taskdock/injected.txt')]:
            with self.assertRaises(ValueError): self.plan(self.move(src,dst))
        self.assertEqual(outside.read_text(),'private')

    def test_symlink_added_after_plan_is_rejected(self):
        self.put('draft.txt','keep'); i=self.plan()
        (self.root/'results').symlink_to(self.base,target_is_directory=True)
        with self.assertRaises(ValueError): self.apply(i)
        self.assertFalse((self.base/'current.txt').exists())

    def test_modified_preimage_is_rejected(self):
        self.put('draft.txt','keep'); i=self.plan()
        blob=next((self.root/'.taskdock/operations'/i/'blobs').iterdir()); blob.write_text('corrupt')
        with self.assertRaisesRegex(ValueError,'corrupt'): self.apply(i)
        self.assertTrue((self.root/'draft.txt').exists())

    @unittest.skipUnless(os.name == 'posix', 'POSIX executable mode bits are not a Windows file contract')
    def test_file_modes_are_restored(self):
        f=self.put('draft.txt','script'); f.chmod(0o755); i=self.plan(); self.apply(i)
        self.assertEqual((self.root/'results/current.txt').stat().st_mode & 0o777,0o755)
        self.apply(i,True); self.assertEqual(f.stat().st_mode & 0o777,0o755)

    def test_inventory_reports_duplicates_and_missing_refs_without_writes(self):
        self.put('a.txt','x'); self.put('b.txt','x'); self.put('README.md','[Missing](gone.txt)')
        before=self.bytes(); obj=ops.inventory(self.root)
        self.assertIn(['a.txt','b.txt'],obj['identical_content']); self.assertFalse(obj['references'][0]['exists'])
        self.assertEqual(before,self.bytes()); self.assertFalse((self.root/'.taskdock').exists())

    def test_other_task_plan_identity_and_parent_file_are_rejected(self):
        self.put('draft.txt','keep'); i=self.plan()
        with self.assertRaisesRegex(ValueError,'another task'): ops.transfer(self.root,'wrong-task',i)
        self.put('occupied','not directory')
        with self.assertRaisesRegex(ValueError,'not a directory'): self.plan(self.move('draft.txt','occupied/file.txt'))

    def test_new_or_changed_reference_invalidates_planned_impact(self):
        self.put('draft.txt','keep'); self.put('notes.md','No link yet'); i=self.plan()
        self.put('notes.md','[Added later](draft.txt)')
        self.assertEqual(self.apply(i)['status'],'conflict')
        self.put('notes.md','No link yet'); self.put('new.md','[New file](draft.txt)')
        self.assertEqual(self.apply(i)['status'],'conflict')
        self.assertTrue((self.root/'draft.txt').exists())

    def test_organize_moves_repairs_reports_and_rolls_back(self):
        self.put('README.md', '# Task\n\n![cover](cover.svg)\n')
        self.put('cover.svg', '<svg/>')
        self.put('cover copy.svg', '<svg/>')
        before = {p.relative_to(self.root).as_posix(): p.read_bytes() for p in self.root.rglob('*') if p.is_file()}
        # One path may appear in only one operation per plan: merge first, then move the survivor.
        merged = td.organize(self.root, self.identity, {'operations': [
            {'type': 'merge', 'from': 'cover copy.svg', 'to': 'cover.svg', 'reason': 'identical download'}]})
        self.assertEqual(merged['status'], 'organized')
        self.assertFalse((self.root / 'cover copy.svg').exists())
        moved = td.organize(self.root, self.identity, {'operations': [
            {'type': 'move', 'from': 'cover.svg', 'to': 'assets/cover.svg', 'reason': 'assets folder'}]})
        self.assertEqual(moved['status'], 'organized')
        self.assertIn('assets/cover.svg', (self.root / 'README.md').read_text())
        self.assertEqual(moved['link_repaired'], ['README.md'])
        self.assertIn(moved['operation_id'], moved['rollback'])
        self.assertTrue(any(line.startswith('Undo everything') for line in moved['report']))
        for op in (moved, merged):
            self.assertEqual(ops.transfer(self.root, self.identity, op['operation_id'], True)['status'], 'rolled_back')
        after = {p.relative_to(self.root).as_posix(): p.read_bytes() for p in self.root.rglob('*') if p.is_file() and '.taskdock' not in p.parts}
        self.assertEqual(after, before)

    def test_cli_from_unrelated_directory(self):
        self.put('draft.txt','keep'); spec=self.base/'spec.json'; spec.write_text(json.dumps(self.move()))
        cmd=[sys.executable,str(Path(td.__file__).resolve()),'plan','--path',str(self.root),'--spec',str(spec)]
        p=subprocess.run(cmd,cwd=self.base,capture_output=True,text=True)
        self.assertEqual(p.returncode,0,p.stderr); i=json.loads(p.stdout)['operation_id']
        p=subprocess.run([*cmd[:2],'apply','--path',str(self.root),'--operation',i],cwd=self.base,capture_output=True,text=True)
        self.assertEqual(p.returncode,0,p.stderr); self.assertEqual(json.loads(p.stdout)['status'],'applied')


if __name__=='__main__': unittest.main()
