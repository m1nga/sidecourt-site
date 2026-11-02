import copy,json,unittest
from pathlib import Path
import brief
class BriefTests(unittest.TestCase):
 def setUp(self):self.d=json.loads((Path(__file__).parents[1]/'examples/capture-brief.json').read_text())
 def test_unseen_reference_is_honest_and_content_escaped(self):
  self.d['project']='<script>unsafe</script>';s=brief.build(self.d);self.assertIn('&lt;script&gt;',s);self.assertIn('unseen',s);self.assertIn('not an executed build',s)
 def test_unknown_reference_or_missing_checks_fails(self):
  self.d['tasks'][0]['source_refs']=['unknown']
  with self.assertRaises(ValueError):brief.build(self.d)
  self.setUp();self.d['tasks'][0]['checks']=[]
  with self.assertRaises(ValueError):brief.build(self.d)
 def test_unsafe_url_fails(self):
  self.d['references'][0]['url']='javascript:alert(1)'
  with self.assertRaises(ValueError):brief.build(self.d)
if __name__=='__main__':unittest.main()
