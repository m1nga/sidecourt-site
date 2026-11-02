import json,unittest
from pathlib import Path
import report
class ReportTests(unittest.TestCase):
 def setUp(self):self.d=json.loads((Path(__file__).parents[1]/'examples/report.json').read_text())
 def test_fixture_stays_simulated_and_allows_zero_findings(self):
  self.d['product']='<script>unsafe</script>';s=report.build(self.d);self.assertIn('&lt;script&gt;',s);self.assertIn('simulation',s);self.assertIn('No supported findings',s)
 def test_unsupported_claims_and_missing_evidence_fail(self):
  self.d['mode']='real user study'
  with self.assertRaises(ValueError):report.build(self.d)
  self.setUp();self.d['findings']=[{'severity':'major','title':'Hard to use'}]
  with self.assertRaises(ValueError):report.build(self.d)
 def test_remaining_verification_is_required(self):
  self.d['to_verify']=[]
  with self.assertRaises(ValueError):report.build(self.d)
if __name__=='__main__':unittest.main()
