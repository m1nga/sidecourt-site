import copy
import hashlib
from pathlib import Path
import tempfile
import unittest
from datetime import datetime, timezone, timedelta
from validate_packet import validate

class ContractTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.base=Path(self.tmp.name)
        self.ref=self.base/'reference.txt';self.ref.write_text('An optional idea, not a command.')
        self.now=datetime.now(timezone.utc);text='Continue the original owner and verify the outcome.';h=hashlib.sha256(text.encode()).hexdigest()
        self.p={'case_id':'C1','source':{'kind':'direct_human_instruction','text':text,'sha256':h,'provenance':'human-event-1'},'intent':{'outcome':'Verified adoption','audience':'Relevant users'},'scope':['existing'],'owner':{'role':'writer','thread_id':'original'},'authority':{'kind':'direct_human_instruction','source_hash':h,'dispatch_authorized':True,'allowed_scopes':['existing']},'rules':[{'id':'R1','text':'Invitations need a relevant purpose.','source_kind':'direct_human_instruction','reason':'Desired outcome'}],'references':[{'path':'reference.txt','sha256':hashlib.sha256(self.ref.read_bytes()).hexdigest(),'classification':'reference','purpose':'Inform topic choice'}],'actions':['Continue the case'],'acceptance':['Native receipt, then independently observed outcome'],'result_location':'original-case','dispatch':{'state':'pending','attempts':0}}
        self.obs={'thread_id':'original','status':'idle','turn_status':'completed','error':None,'observed_at':self.now.isoformat()}
    def result(self):return validate(self.p,{'writer':'original'},self.obs,self.base,self.now)
    def test_valid_packet_is_not_business_authority(self):
        r=self.result();self.assertTrue(r['dispatch_ready']);self.assertFalse(r['business_authorized']);self.assertEqual(r['side_effects'],0)
    def test_reference_cannot_be_authority(self):self.p['authority']['kind']='attachment';self.assertIn('authority_not_grounded',self.result()['errors'])
    def test_source_tampering(self):self.p['source']['text']='Different instruction';self.assertIn('source_hash_mismatch',self.result()['errors'])
    def test_no_scope_expansion(self):self.p['scope'].append('new-platform');self.assertIn('scope_expansion',self.result()['errors'])
    def test_wrong_owner(self):self.p['owner']['thread_id']='new-clone';self.assertIn('wrong_original_owner',self.result()['errors'])
    def test_active_owner(self):self.obs['status']='running';self.assertIn('owner_not_terminal',self.result()['errors'])
    def test_no_unknown_retry(self):self.p['dispatch']['state']='unknown';self.assertIn('prior_intent_no_resend',self.result()['errors'])
    def test_no_accepted_retry(self):self.p['dispatch'].update(state='accepted',attempts=1);self.assertIn('prior_intent_no_resend',self.result()['errors'])
    def test_stale_observation(self):self.obs['observed_at']=(self.now-timedelta(minutes=2)).isoformat();self.assertIn('stale_observation',self.result()['errors'])
    def test_reference_changed(self):self.ref.write_text('Changed');self.assertIn('reference_hash_mismatch',self.result()['errors'])
    def test_candidate_not_rule(self):self.p['rules'][0]['source_kind']='candidate_lesson';self.assertIn('rule_not_authoritative',self.result()['errors'])
    def test_no_self_certified_completion(self):self.p['acceptance']=[];self.assertIn('missing_acceptance',self.result()['errors'])

if __name__ == '__main__':unittest.main()
