import importlib.util,json,tempfile,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('reader',Path(__file__).with_name('read_library.py'));reader=importlib.util.module_from_spec(spec);spec.loader.exec_module(reader)
class ReaderTest(unittest.TestCase):
 def setUp(self):
  self.d={'items':[{'id':'a','title':'Clear first task','url':'https://example.org/a','research':{'points':[['Recovery','Keep invalid input editable.']]}},{'id':'b','title':'First task video','url':'https://example.org/b'},{'id':'c','title':'First task removed'}],'annotations':{'c':{'trashed':True}},'guides':[]}
 def test_read_is_unchanged_and_shortlist_then_exact_source(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'backup.json';p.write_text(json.dumps(self.d));before=p.read_bytes();x=reader.read(p)
   self.assertEqual(reader.select(x,'recovery')['matches'][0]['id'],'a');self.assertEqual(reader.select(x,item_id='a')['item']['research']['points'][0][0],'Recovery');self.assertEqual(p.read_bytes(),before)
 def test_title_only_and_removed_source_boundaries(self):
  rows=reader.select(self.d,'first task')['matches'];self.assertEqual({r['id'] for r in rows},{'a','b'});self.assertEqual(next(r for r in rows if r['id']=='b')['status'],'needs_reading')
  with self.assertRaises(ValueError):reader.select(self.d,item_id='c')
 def test_bad_input_is_not_a_silent_empty_library(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'bad.json';p.write_text('{}')
   with self.assertRaises(ValueError):reader.read(p)
if __name__=='__main__':unittest.main()
