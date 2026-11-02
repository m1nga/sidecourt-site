import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('taskdock', Path(__file__).with_name('taskdock.py'))
td = importlib.util.module_from_spec(spec)
spec.loader.exec_module(td)


class TaskWorkspaceTests(unittest.TestCase):
    def setUp(self):
        # Keep temporary test work under this skill's Desktop source; no home index writes.
        self.temp = tempfile.TemporaryDirectory(prefix='.taskdock-test-', dir=Path(__file__).parent)
        self.root = Path(self.temp.name)
        self.index = self.root / 'index' / 'index.json'

    def tearDown(self):
        self.temp.cleanup()

    def new(self, path=None):
        return td.init_task('测试任务', '交付可验证的结果', self.index, path or self.root / 'task')

    def test_resume_does_not_overwrite_user_state(self):
        result = self.new()
        state = self.root / 'task' / 'STATE.md'
        state.write_text('用户补充的进度', encoding='utf-8')
        again = self.new()
        self.assertEqual(result['id'], again['id'])
        self.assertEqual(again['status'], 'existing')
        self.assertEqual(state.read_text(encoding='utf-8'), '用户补充的进度')

    def test_move_repairs_stale_index_and_preserves_links(self):
        result = self.new()
        task = self.root / 'task'
        (task / '结果').mkdir()
        (task / '结果' / '结论.md').write_text('已验证', encoding='utf-8')
        with (task / 'README.md').open('a', encoding='utf-8') as stream:
            stream.write('\n[结果](结果/结论.md)\n')
        moved = self.root / 'new-place' / 'renamed'
        moved.parent.mkdir()
        shutil.move(str(task), str(moved))
        found = td.locate(self.index, identity=result['id'], roots=[self.root])
        self.assertEqual(found['status'], 'found')
        self.assertEqual(found['matches'][0]['path'], str(moved))
        self.assertEqual(json.loads(self.index.read_text())['tasks'][result['id']]['path'], str(moved))
        self.assertEqual(td.check(moved)['status'], 'pass')

    def test_duplicate_identity_is_not_silently_selected(self):
        result = self.new()
        shutil.copytree(self.root / 'task', self.root / 'copy')
        before = self.index.read_bytes()
        found = td.locate(self.index, identity=result['id'], roots=[self.root])
        self.assertEqual(found['status'], 'ambiguous')
        self.assertEqual(len(found['matches']), 2)
        self.assertEqual(self.index.read_bytes(), before)

    def test_adoption_preserves_existing_control_files(self):
        task = self.root / 'occupied'
        task.mkdir()
        (task / 'README.md').write_text('User original')
        with self.assertRaisesRegex(ValueError, 'occupied'):
            td.init_task('保留', '目标', self.index, task, adopt=True)
        self.assertEqual((task / 'README.md').read_text(), 'User original')
        self.assertFalse((task / 'TASK.json').exists())

    def test_broken_link_is_detected_and_reorganization_can_be_repaired(self):
        self.new()
        task = self.root / 'task'
        (task / 'draft.md').write_text('result')
        readme = task / 'README.md'
        readme.write_text(readme.read_text() + '\n[产出](draft.md)\n')
        (task / 'outputs').mkdir()
        (task / 'draft.md').rename(task / 'outputs' / 'final.md')
        self.assertEqual(td.check(task)['status'], 'fail')
        readme.write_text(readme.read_text().replace('(draft.md)', '(outputs/final.md)'))
        self.assertEqual(td.check(task)['status'], 'pass')

    def test_bounded_search_is_not_reported_as_exhaustive(self):
        result = self.new()
        found = td.locate(self.index, identity=result['id'], roots=[self.root], max_dirs=1)
        self.assertEqual(found['status'], 'partial')
        self.assertTrue(found['warnings'])

    def test_missing_index_can_be_rebuilt_from_moved_folder(self):
        result = self.new()
        self.index.unlink()
        found = td.locate(self.index, identity=result['id'], roots=[self.root])
        self.assertEqual(found['status'], 'found')
        self.assertTrue(self.index.exists())

    def test_external_symlink_cannot_replace_control_file(self):
        self.new()
        task = self.root / 'task'
        (self.root / 'external.md').write_text('other source')
        (task / 'STATE.md').unlink()
        (task / 'STATE.md').symlink_to(self.root / 'external.md')
        with self.assertRaisesRegex(ValueError, 'symlinked'):
            td.check(task)

    def test_corrupt_index_does_not_lose_created_task(self):
        self.index.parent.mkdir()
        self.index.write_text('{broken')
        result = self.new()
        self.assertEqual(result['status'], 'created-unindexed')
        self.assertEqual(td.read_task(self.root / 'task')['id'], result['id'])
        self.assertEqual(self.index.read_text(), '{broken')

    def test_wrong_json_type_is_a_clear_validation_error(self):
        self.new()
        (self.root / 'task' / 'TASK.json').write_text('[]')
        with self.assertRaisesRegex(ValueError, 'Not a TaskDock'):
            td.check(self.root / 'task')

    def test_english_workspace_has_english_resume_files(self):
        result = td.init_task('Launch review', 'Deliver a reviewed launch plan', self.index, self.root / 'english', language='en')
        report = td.resume(result['path'])
        self.assertIn('## Next action', report['records']['STATE.md']['text'])
        self.assertIn('Launch review', report['records']['README.md']['text'])

    def test_resume_is_bounded_and_preserves_state(self):
        self.new()
        path = self.root / 'task' / 'STATE.md'
        path.write_text('x' * 5000)
        before = path.read_bytes()
        report = td.resume(path.parent, max_chars=100)
        self.assertTrue(report['records']['STATE.md']['truncated'])
        self.assertEqual(len(report['records']['STATE.md']['text']), 100)
        self.assertEqual(path.read_bytes(), before)

    def test_resume_includes_index_without_loading_linked_evidence(self):
        self.new()
        task = self.root / 'task'
        (task / 'evidence.md').write_text('DETAILS_ONLY_ON_REQUEST')
        (task / 'INDEX.md').write_text('[Decision](evidence.md)')
        report = td.resume(task)
        self.assertEqual(report['records']['INDEX.md']['text'], '[Decision](evidence.md)')
        self.assertNotIn('DETAILS_ONLY_ON_REQUEST', json.dumps(report))
        self.assertFalse(report['records']['INDEX.md']['truncated'])

    def test_resume_bounds_index_without_changing_it(self):
        self.new()
        path = self.root / 'task' / 'INDEX.md'
        path.write_text('判断依据' * 1000, encoding='utf-8')
        before = path.read_bytes()
        report = td.resume(path.parent, max_chars=17)
        self.assertEqual(len(report['records']['INDEX.md']['text']), 17)
        self.assertTrue(report['records']['INDEX.md']['truncated'])
        self.assertEqual(path.read_bytes(), before)

    def test_resume_rejects_external_index_symlink(self):
        self.new()
        external = self.root / 'external.md'
        external.write_text('PRIVATE_OTHER_TASK')
        (self.root / 'task' / 'INDEX.md').symlink_to(external)
        with self.assertRaisesRegex(ValueError, 'Symlinked retrieval index'):
            td.resume(self.root / 'task')

    def test_same_name_is_not_identity_and_new_tasks_do_not_collide(self):
        first = td.init_task('同名', '一', self.index, desktop=self.root)
        second = td.init_task('同名', '二', self.index, desktop=self.root)
        self.assertNotEqual(first['id'], second['id'])
        self.assertNotEqual(first['path'], second['path'])
        self.assertEqual(td.locate(self.index, title='同名', roots=[self.root])['status'], 'ambiguous')


if __name__ == '__main__':
    unittest.main()
