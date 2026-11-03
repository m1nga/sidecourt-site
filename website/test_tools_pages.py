import json,tempfile,unittest,zipfile
from pathlib import Path
from tools_pages import inject_home_tools,publish_tools

ROOT=Path(__file__).parent
class ToolsTest(unittest.TestCase):
 def test_home_injection_keeps_platform_and_is_idempotent(self):
  source=(ROOT/'platform-preview/index.html').read_text();out=inject_home_tools(source)
  self.assertEqual(inject_home_tools(out),out)
  for marker in ['id="home-drops"','id="home-season"','id="main-court"','href="/your-court"']:
   self.assertIn(marker,out)
  self.assertEqual(out.count('id="home-ming-tools"'),1)
  self.assertIn('href="/skills/">SKILLS',out)
 def test_catalog_routes_packages_and_no_private_library(self):
  data=json.loads((ROOT/'tools/catalog.json').read_text());self.assertEqual(len(data['items']),20)
  self.assertEqual(len({x['slug'] for x in data['items']}),20)
  with tempfile.TemporaryDirectory() as tmp:
   out=Path(tmp);urls=publish_tools(ROOT,out)
   self.assertEqual(len(urls),23)
   products=(out/'products/index.html').read_text();skills=(out/'skills/index.html').read_text()
   self.assertIn('Less friction.',products);self.assertIn('Give your AI',skills)
   self.assertNotIn('http-equiv="refresh"',products)
   self.assertEqual(products.count('data-entry='),4);self.assertEqual(skills.count('data-entry='),17)
   for item in data['items']:
    if 'package' not in item:continue
    self.assertTrue((out/('skills/'+item['slug']+'/index.html')).is_file())
    with zipfile.ZipFile(out/item['package'].lstrip('/')) as z:
     self.assertIn(item['slug']+'/SKILL.md',z.namelist());self.assertIsNone(z.testzip());self.assertEqual(len(z.namelist()),len(set(z.namelist())))
   red=(out/'drops/redbot/app/index.html').read_text();self.assertIn('demo.js',red);seed=(out/'drops/redbot/app/demo.js').read_text();self.assertIn('REDBOT_SEED',seed);self.assertNotIn('6ae4be29000000002501b621',red+seed)
   self.assertIn('https://sidecourt.space/drops/redbot/app/',red)
   self.assertFalse((out/'tools/library.json').exists())
if __name__=='__main__':unittest.main()
