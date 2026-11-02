import tempfile,unittest
from pathlib import Path
import memory,doctor
class DoctorTests(unittest.TestCase):
 def test_absent_database_is_read_only(self):
  with tempfile.TemporaryDirectory() as tmp:
   d=doctor.inspect(tmp);self.assertFalse(d['ok']);self.assertEqual(d['state'],'not_initialized');self.assertEqual(list(Path(tmp).iterdir()),[])
 def test_changed_evidence_is_reported_and_not_repaired(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp).resolve();src=root/'choice.txt';src.write_text('Use a calm layout')
   ledger=memory.Ledger(root,initialize=True)
   ledger.capture({'key':'layout','kind':'decision','authority':'user','actor':'fixture','summary':'Use a calm layout','applicability':'This fixture only','source':{'path':'choice.txt','locator':'fixture:1'}});ledger.db.close();src.write_text('The source changed')
   d=doctor.inspect(root,'layout');self.assertTrue(d['ok']);self.assertTrue(d['status']['stale']);self.assertEqual(d['brief']['current'],[]);self.assertEqual(src.read_text(),'The source changed')
if __name__=='__main__':unittest.main()
