"""Offline regression checks using temporary repositories and API fixtures."""
import importlib.util
import json
import shutil
from pathlib import Path
import subprocess
import tempfile
import unittest


def module(name):
    spec=importlib.util.spec_from_file_location(name, Path(__file__).with_name(name+'.py'))
    obj=importlib.util.module_from_spec(spec); spec.loader.exec_module(obj); return obj

release=module('check_release_source'); discovery=module('discovery_snapshot'); quality=module('review_gate')

class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.root=Path(self.tmp.name)
        self.git('init','-q');self.git('config','user.name','Fixture');self.git('config','user.email','fixture@example.invalid')
        for name in ('sample','other'):
            (self.root/name/'agents').mkdir(parents=True)
            for path in ('SKILL.md','README.md','agents/openai.yaml'):
                (self.root/name/path).write_text('fixture\n')
        (self.root/'products.json').write_text(json.dumps({'products':[{'name':'sample'},{'name':'other'}]}))
        (self.root/'LICENSE').write_text('fixture license\n');self.git('add','.');self.git('commit','-qm','fixture')
        folder=self.root/'publish-skill-product/scripts';folder.mkdir(parents=True)
        shutil.copy2(Path(__file__).with_name('review_gate.py'),folder/'review_gate.py')
        policy=self.root/'ops/skill-quality';policy.mkdir(parents=True)
        (policy/'baseline.json').write_text(json.dumps({'legacy_unchanged':{name:quality.fingerprint(self.root,name,True) for name in ('sample','other')}}))
        self.git('add','.');self.git('commit','-qm','adopt quality policy')

    def tearDown(self): self.tmp.cleanup()
    def git(self,*args): return subprocess.check_output(['git','-C',str(self.root),*args],text=True)
    def test_clean_source(self): self.assertEqual(release.check(self.root,'sample'),[])
    def test_unrelated_dirty_allowed(self):
        (self.root/'other/SKILL.md').write_text('user draft');self.assertEqual(release.check(self.root,'sample'),[])
    def test_unrelated_review_draft_allowed(self):
        folder=self.root/'ops/skill-quality/reviews';folder.mkdir()
        (folder/'other.json').write_text('unfinished unrelated review')
        self.assertEqual(release.check(self.root,'sample'),[])
    def test_dirty_target_blocked(self):
        (self.root/'sample/SKILL.md').write_text('user draft');self.assertTrue(release.check(self.root,'sample'))
    def test_staged_target_blocked(self):
        (self.root/'sample/SKILL.md').write_text('user draft');self.git('add','sample');self.assertTrue(release.check(self.root,'sample'))
    def test_untracked_target_blocked(self):
        (self.root/'sample/new.py').write_text('private draft');self.assertTrue(release.check(self.root,'sample'))
    def test_dirty_manifest_blocked(self):
        (self.root/'products.json').write_text('{}');self.assertTrue(release.check(self.root,'sample'))
    def test_path_traversal_blocked(self): self.assertTrue(release.check(self.root,'../sample'))
    def test_unregistered_blocked(self): self.assertTrue(release.check(self.root,'new'))

class QualityTests(unittest.TestCase):
    setUp = ReleaseTests.setUp
    tearDown = ReleaseTests.tearDown
    git = ReleaseTests.git
    def require_review(self):
        (self.root/'sample/SKILL.md').write_text('changed behavior')

    def receipt(self):
        case={'request':'Fixture request','expected':'Fixture result','observed':'Fixture observed','kind':'simulated','result':'pass'}
        receipt={'schema_version':1,'skill':'sample','source_sha256':quality.fingerprint(self.root,'sample'),'reviewed_at':'2026-09-06',
                 'user_review':{'method':'Test fixture only','scenarios':[case,case]},
                 'similar_skills':[{'url':'https://example.invalid/skill','checked_at':'2026-09-06','learned':'Fixture idea','decision':'reject','reason':'Fixture boundary'}],
                 'validation':[{'command':'fixture','result':'pass','observed':'fixture passed'}],'unresolved_blockers':[]}
        folder=self.root/'ops/skill-quality/reviews';folder.mkdir(exist_ok=True)
        path=folder/'sample.json';path.write_text(json.dumps(receipt));return path,receipt

    def test_new_version_requires_review(self):
        self.require_review();self.assertTrue(quality.check(self.root,'sample')[0])
    def test_complete_current_review_passes(self):
        self.require_review();self.receipt();self.assertEqual(quality.check(self.root,'sample')[0],[])
    def test_source_change_invalidates_review(self):
        self.require_review();self.receipt();(self.root/'sample/README.md').write_text('new claim')
        self.assertIn('review is stale', '\n'.join(quality.check(self.root,'sample')[0]))
    def test_product_metadata_change_invalidates_review(self):
        self.require_review();self.receipt();manifest=json.loads((self.root/'products.json').read_text());manifest['products'][0]['title']='new title'
        (self.root/'products.json').write_text(json.dumps(manifest));self.assertTrue(quality.check(self.root,'sample')[0])
    def test_missing_comparison_and_failed_validation_block(self):
        self.require_review();path,data=self.receipt();data['similar_skills']=[];data['validation'][0]['result']='fail';path.write_text(json.dumps(data))
        errors=quality.check(self.root,'sample')[0];self.assertGreaterEqual(len(errors),2)
    def test_committed_inputs_not_local_receipt_control_release(self):
        self.require_review();self.git('add','sample');self.git('commit','-qm','new source without review');self.receipt()
        self.assertTrue(quality.check(self.root,'sample',True)[0]);self.assertFalse(quality.check(self.root,'sample')[0])


class DiscoveryTests(unittest.TestCase):
    def test_failed_api_is_unknown(self):
        def fail(*a,**k):return {'status':'unavailable','data':None}
        record=discovery.collect('a/b',['fixed query'],True,fail)
        self.assertEqual(record['search'][0]['status'],'unavailable');self.assertIsNone(record['search'][0]['rank'])
        self.assertNotIn('stargazers_count',record['metadata']);self.assertEqual(record['attribution'],'unknown')
    def test_rank_and_no_result(self):
        def fake(endpoint,**kw):
            data=({'items':[{'full_name':'c/d'},{'full_name':'A/B'}]} if kw.get('q')=='find' else {'items':[]}) if endpoint=='search/repositories' else {'stargazers_count':0}
            return {'status':'ok','data':data}
        r=discovery.collect('a/b',['find','missing'],fetch=fake)
        self.assertEqual(r['search'][0]['rank'],2);self.assertEqual(r['search'][1]['status'],'not_found_in_top_20')
        self.assertEqual(r['metadata']['stargazers_count'],0);self.assertIsNone(r['metadata']['forks_count'])
    def test_incomplete_results_are_not_absence(self):
        def fake(*a,**k):return {'status':'ok','data':{'items':[],'incomplete_results':True}}
        self.assertEqual(discovery.collect('a/b',['q'],fetch=fake)['search'][0]['status'],'incomplete')
    def test_comparison_only_matches_fixed_queries(self):
        old={'repository':'a/b','search':[{'query':'q','status':'found','rank':2}]}
        new={'repository':'a/b','search':[{'query':'q','status':'found','rank':1},{'query':'new','status':'found','rank':1}]}
        comparison=discovery.compare(old,new)
        self.assertEqual(len(comparison['search']),1);self.assertEqual(comparison['causal_effect'],'not_established')
    def test_cross_repository_comparison_rejected(self):
        with self.assertRaises(ValueError):discovery.compare({'repository':'a/b'},{'repository':'a/c'})
    def test_existing_snapshot_not_overwritten(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'snapshot.json';p.write_text('original')
            result=subprocess.run(['python3',str(Path(__file__).with_name('discovery_snapshot.py')),'a/b','--out',str(p)],capture_output=True)
            self.assertNotEqual(result.returncode,0);self.assertEqual(p.read_text(),'original')

if __name__=='__main__':unittest.main()
