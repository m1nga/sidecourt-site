import html,json,tempfile,unittest,zipfile
from pathlib import Path
from tools_pages import inject_home_tools,publish_tools,skill_row,SKILL_CATEGORIES

ROOT=Path(__file__).parent
class ToolsTest(unittest.TestCase):
 def test_home_injection_keeps_platform_and_is_idempotent(self):
  source=(ROOT/'platform-preview/index.html').read_text();out=inject_home_tools(source)
  self.assertEqual(inject_home_tools(out),out)
  for marker in ['id="home-drops"','id="home-season"','id="main-court"','href="/your-court"']:
   self.assertIn(marker,out)
  self.assertEqual(out.count('id="home-ming-tools"'),1)
  self.assertIn('href="/skills/">SKILLS',out)
 def test_skill_row_escapes_content_and_searches_useful_context(self):
  row=skill_row({'name':'A < B','description':'Use "source" & notes.','kind':'Skill','bring':'A portfolio','status':'Legacy','url':'/skills/example/'})
  self.assertIn('A &lt; B',row)
  self.assertIn('Use &quot;source&quot; &amp; notes.',row)
  self.assertIn('a portfolio legacy',row)
  self.assertIn('Bring: A portfolio',row)
  self.assertEqual(row.count('<a '),1)
  self.assertIn('alt="" width="36" height="36"',row)
 def test_catalog_routes_packages_and_no_private_library(self):
  data=json.loads((ROOT/'tools/catalog.json').read_text());self.assertEqual(len(data['items']),21)
  self.assertEqual(len({x['slug'] for x in data['items']}),21)
  with tempfile.TemporaryDirectory() as tmp:
   out=Path(tmp);urls=publish_tools(ROOT,out)
   self.assertEqual(len(urls),22)
   self.assertNotIn('https://sidecourt.space/drops/redbot/test/',urls)
   products=(out/'products/index.html').read_text();skills=(out/'skills/index.html').read_text()
   self.assertIn('Less friction.',products);self.assertIn('<h1>Skills</h1>',skills)
   self.assertNotIn('class="catalog-tabs"',skills)
   self.assertNotIn('SIDECOURT / SKILLS',skills)
   self.assertIn('width:min(calc(100% - 96px),1180px)',skills)
   self.assertIn('class="catalog-mobile-nav"',skills)
   self.assertIn('class="catalog-page"',skills)
   for asset in ['/assets/InterLatin.woff2','/assets/drops.webp','/assets/drops.jpg']:
    self.assertIn(asset,skills)
   for route in ['/discovery/','/skills/','/season','/get-on','/your-court']:
    self.assertIn('href="'+route+'"',skills)
   self.assertIn('href="/skills/" aria-current="page"',skills)
   nav=skills.split('<nav class="catalog-nav"',1)[1].split('</nav>',1)[0]
   self.assertNotIn('href="/products/"',nav)
   self.assertNotIn('href="/tools/"',nav)
   self.assertIn('id="tool-search" type="search"',skills)
   self.assertIn('No match. Try a different task or clear the search.',skills)
   self.assertNotIn('http-equiv="refresh"',products)
   self.assertEqual(products.count('data-entry='),5);self.assertEqual(skills.count('data-entry='),17)
   for category in SKILL_CATEGORIES:
    self.assertIn('data-skill-category="'+category+'"',skills)
   for item in data['items']:
    if 'install' in item:self.assertIn(item['category'],SKILL_CATEGORIES)
   self.assertIn('id="tool-reset"',skills)
   for item in data['items']:
    if item.get('preview_image'):
     self.assertIn(item['preview_image'],products)
     self.assertTrue((out/item['preview_image'].lstrip('/')).is_file())
   listing=skills.split('<ul class="skill-list"',1)[1].split('</ul>',1)[0]
   self.assertEqual(listing.count('class="skill-row"'),17)
   self.assertEqual(listing.count('class="skill-ring"'),17)
   self.assertIn('Invitation-only test',listing)
   self.assertNotIn('catalog-cover',listing)
   self.assertNotIn('class="card',listing)
   self.assertIn('grid-template-columns:36px 220px minmax(0,1fr) auto',skills)
   self.assertIn('.skill-ring{width:28px;height:28px}',skills)
   self.assertIn('.skill-list>li[hidden]{display:none}',skills)
   self.assertIn('<div class="grid">',products)
   for item in data['items']:
    if 'install' not in item:continue
    self.assertIn('href="/skills/'+item['slug']+'/"',listing)
    self.assertIn(html.escape(item['name']),listing)
    if item['status']=='Legacy':self.assertIn('Legacy · Reference',skill_row(item))
   for item in data['items']:
    if 'package' not in item:continue
    detail=(out/('skills/'+item['slug']+'/index.html')).read_text()
    self.assertIn('class="catalog-detail"',detail)
    self.assertIn('id="install"',detail)
    self.assertIn('id="copy"',detail)
    self.assertIn('Copy the command above manually.',detail)
    self.assertIn(item['package'],detail)
    self.assertIn(item['repository'],detail)
    self.assertIn('/tools/sources/'+item['slug']+'/SKILL.md',detail)
    if item['status']=='Legacy':self.assertIn('not a current default workflow',detail)
    with zipfile.ZipFile(out/item['package'].lstrip('/')) as z:
     self.assertIn(item['slug']+'/SKILL.md',z.namelist());self.assertIsNone(z.testzip());self.assertEqual(len(z.namelist()),len(set(z.namelist())))
   red=(out/'drops/redbot/app/index.html').read_text();self.assertIn('demo.js',red);seed=(out/'drops/redbot/app/demo.js').read_text();self.assertIn('REDBOT_SEED',seed);self.assertNotIn('6ae4be29000000002501b621',red+seed)
   self.assertIn('https://sidecourt.space/drops/redbot/app/',red)
   self.assertFalse((out/'tools/library.json').exists())
if __name__=='__main__':unittest.main()
