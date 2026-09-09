import argparse, hashlib, json, pathlib, shutil, urllib.request, zipfile, plistlib
from release_assets import fetch_asset
parser=argparse.ArgumentParser()
parser.add_argument('--source-root',type=pathlib.Path)
args=parser.parse_args()
root=pathlib.Path(__file__).resolve().parent
out=root.parent/'_site'
if out.exists(): shutil.rmtree(out)
(out/'drops/cleanpause').mkdir(parents=True)
(out/'cleanpause').mkdir(parents=True)
html=(root/'cleanpause.html').read_text()
assert 'hero-download-windows' in html and 'download-app' in html
assert 'chatgpt' not in html.lower() and 'github' not in html.lower()
(out/'cleanpause/index.html').write_text(html)
drop_html = (root/'drop.html').read_text()
assert 'https://sidecourt.space/drops/cleanpause/' in drop_html
assert 'file:' not in drop_html
(out/'drops/cleanpause/index.html').write_text(drop_html)
drops_html = (root/'drops.html').read_text()
assert 'https://sidecourt.space/drops/' in drops_html
assert 'file:' not in drops_html
(out/'drops/index.html').write_text(drops_html)
shutil.copytree(root/'origin-assets',out/'origin-assets')
(out/'index.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><title>SideCourt</title><meta http-equiv="refresh" content="0;url=./drops/cleanpause/"><link rel="canonical" href="https://sidecourt.space/drops/cleanpause/"><script>location.replace(new URL("./drops/cleanpause/",location.href).href)</script><a href="./drops/cleanpause/">Discover CleanPause on SideCourt</a></html>')
(out/'404.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><title>Not found</title><h1>Not found</h1></html>')
(out/'.nojekyll').touch()
(out/'robots.txt').write_text(
 'User-agent: *\n'
 'Allow: /cleanpause/\n'
 'Allow: /drops/\n'
 'Disallow: /downloads/\n'
 'Sitemap: https://sidecourt.space/sitemap.xml\n'
)
sitemap = '''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://sidecourt.space/cleanpause/</loc></url>
  <url><loc>https://sidecourt.space/drops/</loc></url>
  <url><loc>https://sidecourt.space/drops/cleanpause/</loc></url>
</urlset>
'''
(out/'sitemap.xml').write_text(sitemap)
assert '/downloads/' not in sitemap
assets = json.loads((root/'assets.json').read_text())
updates = {}
for a in assets:
 dest=out/a['destination'];dest.parent.mkdir(parents=True,exist_ok=True)
 if args.source_root: shutil.copyfile(args.source_root/a['source'],dest)
 else:
  fetch_asset(a, dest)
 assert dest.stat().st_size==a['size'],a['destination']
 assert hashlib.sha256(dest.read_bytes()).hexdigest()==a['sha256'],a['destination']
 if dest.suffix=='.zip':
  with zipfile.ZipFile(dest) as archive: assert archive.testzip() is None
 if 'platform' in a:
  assert a['platform'] in ['mac','windows']
  expected_name = ('CleanPause-' + a['version'] + '.zip') if a['platform'] == 'mac' else ('CleanPause-Windows-' + a['version'] + '-x64.zip')
  assert dest.name == expected_name
  assert a['destination'] in html
  if a['platform'] == 'mac':
   with zipfile.ZipFile(dest) as archive:
    info = plistlib.loads(archive.read('CleanPause.app/Contents/Info.plist'))
    assert info['CFBundleShortVersionString'] == a['version']
  assert a['platform'] not in updates
  updates[a['platform']] = {'version': a['version'], 'download_url': 'https://sidecourt.space/' + a['destination']}
 print('Verified',a['destination'],a['size'],flush=True)
assert set(updates) == {'mac', 'windows'}
manifest = json.dumps(updates, indent=2) + '\n'
# Existing installed versions depend on this endpoint. Keep it byte-identical.
(out/'drops/cleanpause/updates.json').write_text(manifest)
(out/'cleanpause/updates.json').write_text(manifest)
print('Verified packages and update manifest published together.')
