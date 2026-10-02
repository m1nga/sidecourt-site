"""Public pages across builds: listed, link-only, limited, withdrawn; sitemap and llms.txt. No network."""
import ast
import json
import pathlib
import py_compile
import tempfile
import unittest

from public_pages import (WITHDRAWN_TEXT, llms_text, not_found_html, publish_site_pages, route_page_html, sitemap_xml)

HERE = pathlib.Path(__file__).resolve().parent
APP = ('<!DOCTYPE html>\n<html lang="en" data-base="/">\n<head>\n<meta charset="utf-8">\n<title>SideCourt · Independent work</title>\n'
       '<meta name="description" content="SideCourt — create something yours, show up for others.">\n'
       '<link rel="canonical" href="https://sidecourt.space/">\n</head>\n<body><main id="main-court"></main></body>\n</html>\n')
LISTED = {'id': '11111111-1111-4111-8111-111111111111', 'sidecourt_id': 'SC4M9Q2', 'player': 'ming',
          'data': {'name': 'DayCup', 'author': 'Ming', 'cardLine': 'A starting recipe.', 'cover': 'https://cdn.example/c.jpg'}}
SENSITIVE = {'id': '33333333-3333-4333-8333-333333333333', 'sidecourt_id': 'SC3333X', 'player': 'ming', 'labels': ['sensitive', 'agent_caution'],
             'data': {'name': 'Figure study', 'author': 'Ming', 'description': 'Drawings.', 'cover': 'https://cdn.example/f.jpg'}}
LINK_ONLY = {'id': '22222222-2222-4222-8222-222222222222', 'sidecourt_id': 'SC2GM4W', 'title': 'Link only', 'byline': 'B', 'description': 'Only by link.',
             'author': {'handle': 'bee'}, 'limited': False}
LIMITED = {'id': '44444444-4444-4444-8444-444444444444', 'sidecourt_id': 'SC4444Y', 'title': 'Too good to be true', 'byline': 'Scam', 'description': 'Send money.',
           'author': None, 'limited': True}
REMOVED_ID = '55555555-5555-4555-8555-555555555555'


def committed(out, folders, manifest=None):
    for folder in folders:
        (out / folder).mkdir(parents=True, exist_ok=True)
        (out / folder / 'index.html').write_text(APP.replace('SideCourt · Independent work', 'OLD ' + folder), encoding='utf-8')
    if manifest is not None:
        (out / 'public-pages.json').write_text(json.dumps(manifest), encoding='utf-8')


def fake_rpc(answers, calls):
    def rpc(name, args):
        calls.append((name, args))
        key = name + ':' + json.dumps(args, sort_keys=True)
        if key not in answers:
            raise RuntimeError('not answered: ' + key)
        value = answers[key]
        if isinstance(value, Exception):
            raise value
        return value
    return rpc


def head(out, folder):
    html = (out / folder / 'index.html').read_text(encoding='utf-8')
    return html[:html.index('</head>')]


class SitePages(unittest.TestCase):
    def test_each_state_gets_its_head_and_only_listed_works_reach_sitemap_and_llms(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = pathlib.Path(tmp)
            download = out / 'drops' / 'cleanpause' / 'updates.json'
            download.parent.mkdir(parents=True)
            download.write_text('{"mac":{}}\n')
            committed(out, ['work/' + LINK_ONLY['id'], 'work/SC4444Y', 'work/' + REMOVED_ID, 'work/SCREMVD', 'people/gone_user', 'work/' + LISTED['id']],
                      {'works': [{'id': REMOVED_ID, 'sidecourt_id': 'SCREMV2'}]})
            calls = []
            rpc = fake_rpc({'sc_public_works:{}': [LISTED, SENSITIVE],
                            'sc_public_post:{"work_id": "' + LINK_ONLY['id'] + '"}': LINK_ONLY,
                            'sc_public_post_by_id:{"sidecourt_id": "SC4444Y"}': LIMITED,
                            'sc_public_post:{"work_id": "' + REMOVED_ID + '"}': None,
                            'sc_public_post_by_id:{"sidecourt_id": "SCREMVD"}': RuntimeError('timeout')}, calls)
            warnings = []
            plan = publish_site_pages(out, APP, {'siteUrl': 'https://sidecourt.space'}, rpc=rpc, warn=warnings.append)
            self.assertTrue(plan['manifest']['complete'])
            states = {(e['id'], e['sidecourt_id']): e['state'] for e in plan['manifest']['works']}
            self.assertEqual(states[(LISTED['id'], 'SC4M9Q2')], 'listed')
            self.assertEqual(states[(LINK_ONLY['id'], 'SC2GM4W')], 'unlisted')
            self.assertEqual(states[(LIMITED['id'], 'SC4444Y')], 'limited')
            self.assertEqual(states[(REMOVED_ID, 'SCREMV2')], 'withdrawn')
            self.assertEqual(states[(None, 'SCREMVD')], 'withdrawn')
            self.assertTrue(any('SCREMVD' in w for w in warnings))
            # Listed: final canonical, indexable, cover as preview; the sensitive one keeps its cover out.
            listed = head(out, 'work/SC4M9Q2')
            self.assertIn('<link rel="canonical" href="https://sidecourt.space/work/SC4M9Q2/">', listed)
            self.assertNotIn('name="robots"', listed)
            self.assertIn('<meta property="og:image" content="https://cdn.example/c.jpg">', listed)
            self.assertEqual(head(out, 'work/' + LISTED['id']), listed)
            self.assertNotIn('og:image', head(out, 'work/SC3333X'))
            # Link-only keeps its head but is noindex; its new short address is written too.
            link = head(out, 'work/SC2GM4W')
            self.assertIn('<title>Link only · SideCourt</title>', link)
            self.assertIn('<meta name="robots" content="noindex">', link)
            self.assertEqual(head(out, 'work/' + LINK_ONLY['id']), link)
            # Limited: nothing of the work in previews.
            limited = head(out, 'work/SC4444Y')
            self.assertNotIn('Too good', limited)
            self.assertNotIn('Send money', limited)
            self.assertIn('<meta name="robots" content="noindex">', limited)
            self.assertIn('href="https://sidecourt.space/work/SC4444Y/"', limited)
            # Withdrawn (removed, or not checkable): the neutral placeholder, no address, no picture.
            for folder in ['work/' + REMOVED_ID, 'work/SCREMVD', 'work/SCREMV2']:
                placeholder = head(out, folder)
                self.assertIn('<meta name="description" content="' + WITHDRAWN_TEXT + '">', placeholder)
                self.assertIn('<meta name="robots" content="noindex">', placeholder)
                self.assertNotIn('canonical', placeholder)
                self.assertNotIn('OLD', placeholder)
            hidden_person = head(out, 'people/gone_user')
            self.assertNotIn('gone_user', hidden_person)
            self.assertIn('noindex', hidden_person)
            self.assertIn('<link rel="canonical" href="https://sidecourt.space/people/ming/">', head(out, 'people/ming'))
            # Only listed works reach the sitemap; agent_caution keeps a work out of llms.txt.
            self.assertEqual(plan['sitemap'], ['https://sidecourt.space/work/SC4M9Q2/', 'https://sidecourt.space/work/SC3333X/'])
            self.assertEqual([e['name'] for e in plan['llms']], ['DayCup'])
            written = json.loads((out / 'public-pages.json').read_text(encoding='utf-8'))
            self.assertEqual(written, plan['manifest'])
            self.assertEqual(download.read_text(), '{"mac":{}}\n')
            # One read of the list, one question per earlier page that is not listed.
            self.assertEqual([c[0] for c in calls].count('sc_public_works'), 1)
            self.assertEqual(len(calls), 5)

    def test_a_failed_read_keeps_committed_pages_and_their_sitemap(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = pathlib.Path(tmp)
            committed(out, ['work/SC4M9Q2'], {'version': 1, 'site': 'https://sidecourt.space/', 'complete': True, 'works': [
                {'id': LISTED['id'], 'sidecourt_id': 'SC4M9Q2', 'state': 'listed', 'url': 'https://sidecourt.space/work/SC4M9Q2/', 'name': 'DayCup', 'labels': []},
                {'id': SENSITIVE['id'], 'sidecourt_id': 'SC3333X', 'state': 'listed', 'url': 'https://sidecourt.space/work/SC3333X/', 'name': 'x', 'labels': ['agent_caution']},
                {'id': REMOVED_ID, 'sidecourt_id': None, 'state': 'withdrawn'}], 'people': []})
            before = (out / 'work/SC4M9Q2/index.html').read_text(encoding='utf-8')
            warnings = []
            plan = publish_site_pages(out, APP, {'siteUrl': 'https://sidecourt.space', 'supabaseUrl': 'https://x.supabase.co', 'publishableKey': 'sb_publishable_x'},
                                      rpc=fake_rpc({'sc_public_works:{}': RuntimeError('HTTP 503')}, []), warn=warnings.append)
            self.assertFalse(plan['manifest']['complete'])
            self.assertEqual((out / 'work/SC4M9Q2/index.html').read_text(encoding='utf-8'), before)
            self.assertEqual(plan['sitemap'], ['https://sidecourt.space/work/SC4M9Q2/', 'https://sidecourt.space/work/SC3333X/'])
            self.assertEqual([e['name'] for e in plan['llms']], ['DayCup'])
            self.assertTrue(any('HTTP 503' in w for w in warnings))
            # The connection guide is still written.
            self.assertIn('https://sidecourt.space/connect-ai/', head(out, 'connect-ai'))

    def test_no_cloud_configuration_is_a_failed_read_not_an_empty_site(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = pathlib.Path(tmp)
            committed(out, ['work/SC4M9Q2'])
            plan = publish_site_pages(out, APP, {}, warn=lambda m: None)
            self.assertFalse(plan['manifest']['complete'])
            self.assertIn('OLD work/SC4M9Q2', (out / 'work/SC4M9Q2/index.html').read_text(encoding='utf-8'))

    def test_review_pages_are_all_noindex_nofollow(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = pathlib.Path(tmp)
            committed(out, ['work/' + REMOVED_ID])
            publish_site_pages(out, APP, {'siteUrl': 'https://m1nga.github.io/sidecourt-review/online-v2-2', 'reviewSite': True},
                               rpc=fake_rpc({'sc_public_works:{}': [LISTED], 'sc_public_post:{"work_id": "' + REMOVED_ID + '"}': None}, []))
            for folder in ['work/SC4M9Q2', 'work/' + REMOVED_ID, 'people/ming', 'connect-ai']:
                self.assertIn('<meta name="robots" content="noindex,nofollow">', head(out, folder))
            self.assertIn('href="https://m1nga.github.io/sidecourt-review/online-v2-2/work/SC4M9Q2/"', head(out, 'work/SC4M9Q2'))


class Files(unittest.TestCase):
    def test_llms_lists_names_and_final_addresses_only(self):
        text = llms_text('# SideCourt\n\nIntro.\n\n', [{'name': 'A [tricky] name', 'url': 'https://sidecourt.space/work/SC4M9Q2/'}])
        self.assertTrue(text.startswith('# SideCourt\n\nIntro.\n\n## Works\n'))
        self.assertIn('- [A (tricky) name](https://sidecourt.space/work/SC4M9Q2/)\n', text)
        self.assertEqual(llms_text('# SideCourt\n', []), '# SideCourt\n')

    def test_sitemap_deduplicates_and_escapes(self):
        xml = sitemap_xml(['https://sidecourt.space/?a=1&b=2', 'https://sidecourt.space/?a=1&b=2'])
        self.assertEqual(xml.count('<url>'), 1)
        self.assertIn('&amp;b=2', xml)

    def test_route_and_not_found_heads(self):
        drops = route_page_html(APP, 'drops')
        self.assertIn('<link rel="canonical" href="https://sidecourt.space/drops/">', drops)
        self.assertNotIn('name="robots"', drops)
        self.assertIn('<meta name="robots" content="noindex">', route_page_html(APP, 'your-court/settings'))
        self.assertNotIn('name="robots"', route_page_html(APP, 'your-court/privacy'))
        missing = not_found_html(APP)
        self.assertNotIn('canonical', missing[:missing.index('</head>')])
        self.assertIn('<meta name="robots" content="noindex">', missing)

    def test_build_py_uses_final_addresses_and_the_site_pages_step(self):
        build = HERE / 'build.py'
        py_compile.compile(str(build), doraise=True, cfile=str(pathlib.Path(tempfile.gettempdir()) / 'sidecourt-build-check.pyc'))
        source = build.read_text(encoding='utf-8')
        tree = ast.parse(source)
        imported = {alias.name for node in ast.walk(tree) if isinstance(node, ast.ImportFrom) and node.module == 'public_pages' for alias in node.names}
        self.assertTrue({'publish_site_pages', 'llms_text', 'sitemap_xml', 'read_config'} <= imported)
        static = next(node for node in ast.walk(tree) if isinstance(node, ast.Assign) and getattr(node.targets[0], 'id', '') == 'static_urls')
        urls = [element.value for element in static.value.elts]
        self.assertTrue(urls and all(url.endswith('/') for url in urls), urls)
        self.assertNotIn("shutil.copyfile(root / 'llms.txt'", source)
        llms = (HERE / 'llms.txt').read_text(encoding='utf-8')
        self.assertNotIn('https://sidecourt.space/connect-ai)', llms)


if __name__ == '__main__':
    unittest.main()
