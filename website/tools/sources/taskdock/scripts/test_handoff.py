import tempfile,unittest
from pathlib import Path
import taskdock,handoff
from report_page import save_page
class HandoffTests(unittest.TestCase):
 def test_selected_identity_escaping_and_bounded_notes(self):
  with tempfile.TemporaryDirectory() as tmp:
   p=Path(tmp);root=p/'task';d=taskdock.init_task('Client <brief>','Ship one result',p/'index.json',root)
   (root/'STATE.md').write_text('<script>alert(1)</script>'+('x'*1000))
   before=(root/'STATE.md').read_bytes();result=handoff.build(root,500)
   self.assertFalse(result['pending_recovery']);self.assertEqual(result['task_id'],d['id']);self.assertIn('&lt;script&gt;',result['body']);self.assertIn('Truncated',result['body']);self.assertEqual(before,(root/'STATE.md').read_bytes())
   out=p/'report.html';save_page(out,'Report',result['body'])
   with self.assertRaises(FileExistsError):save_page(out,'Other','other')
 def test_missing_task_does_not_initialize(self):
  with tempfile.TemporaryDirectory() as tmp:
   with self.assertRaises(OSError):handoff.build(tmp)
   self.assertEqual(list(Path(tmp).iterdir()),[])
if __name__=='__main__':unittest.main()
