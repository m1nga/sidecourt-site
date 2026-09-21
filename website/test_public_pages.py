"""python3 -m unittest discover -s website  (no network: the fetch is not exercised here)."""
import pathlib
import tempfile
import unittest

from public_pages import inject_head, public_pages, publish_public_pages, read_config, sitemap_xml, summary

HERE = pathlib.Path(__file__).resolve().parent
APP = (HERE / 'platform-preview' / 'index.html').read_text()
UUID = '6e3d989a-1d92-4f96-9df1-abac78ea5fc0'


def head(document):
    return document[:document.index('</head>')]


class InjectHead(unittest.TestCase):
    def test_replaces_title_description_canonical_and_adds_open_graph(self):
        page = inject_head(APP, 'Quiet <Tools> · SideCourt', 'A "plain" & honest description', 'https://sidecourt.space/work/' + UUID + '/', 'article')
        h = head(page)
        self.assertEqual(h.count('<title>'), 1)
        self.assertIn('<title>Quiet &lt;Tools&gt; · SideCourt</title>', h)
        self.assertNotIn('Independent work', h)
        self.assertEqual(h.count('name="description"'), 1)
        self.assertIn('<meta name="description" content="A &quot;plain&quot; &amp; honest description">', h)
        self.assertEqual(h.count('rel="canonical"'), 1)
        self.assertIn('<link rel="canonical" href="https://sidecourt.space/work/' + UUID + '/">', h)
        self.assertIn('<meta property="og:title" content="Quiet &lt;Tools&gt; · SideCourt">', h)
        self.assertIn('<meta property="og:description" content="A &quot;plain&quot; &amp; honest description">', h)
        self.assertIn('<meta property="og:url" content="https://sidecourt.space/work/' + UUID + '/">', h)
        self.assertIn('<meta property="og:type" content="article">', h)
        self.assertNotIn('og:image', h)
        # The body, scripts and styles of the application are untouched.
        self.assertEqual(page[page.index('</head>'):], APP[APP.index('</head>'):])

    def test_data_url_cover_is_never_an_image_but_https_is(self):
        self.assertNotIn('og:image', head(inject_head(APP, 't', 'd', 'https://sidecourt.space/work/' + UUID + '/', 'article', 'data:image/png;base64,AAAA')))
        self.assertIn('<meta property="og:image" content="https://cdn.example/cover.jpg">', head(inject_head(APP, 't', 'd', 'https://sidecourt.space/work/' + UUID + '/', 'article', 'https://cdn.example/cover.jpg')))

    def test_missing_tags_are_inserted_and_stale_open_graph_removed(self):
        minimal = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta property="og:title" content="old">\n</head><body>x</body></html>'
        page = inject_head(minimal, 'Name · SideCourt', 'Desc', 'https://sidecourt.space/people/m1nga/', 'profile')
        h = head(page)
        self.assertNotIn('content="old"', h)
        self.assertEqual(h.count('og:title'), 1)
        for tag in ['<title>Name · SideCourt</title>', '<meta name="description" content="Desc">', '<link rel="canonical" href="https://sidecourt.space/people/m1nga/">', '<meta property="og:type" content="profile">']:
            self.assertIn(tag, h)
        self.assertTrue(page.endswith('<body>x</body></html>'))

    def test_replacement_is_idempotent(self):
        once = inject_head(APP, 'A · SideCourt', 'one', 'https://sidecourt.space/work/' + UUID + '/', 'article')
        twice = inject_head(once, 'B · SideCourt', 'two', 'https://sidecourt.space/work/' + UUID + '/', 'article')
        h = head(twice)
        self.assertEqual(h.count('<title>'), 1)
        self.assertEqual(h.count('og:title'), 1)
        self.assertIn('<title>B · SideCourt</title>', h)
        self.assertNotIn('one', h.split('<meta name="description"')[1].split('>')[0])


class Summary(unittest.TestCase):
    def test_collapses_whitespace_and_cuts_at_a_word(self):
        self.assertEqual(summary('  a \n\n b\tc '), 'a b c')
        long = ('word ' * 60).strip()
        cut = summary(long)
        self.assertLessEqual(len(cut), 201)
        self.assertTrue(cut.endswith('…'))
        self.assertNotIn('  ', cut)


class PublicPages(unittest.TestCase):
    def test_valid_rows_become_pages_and_everything_else_is_skipped(self):
        rows = [
            {'id': UUID, 'data': {'name': ' Quiet  Tools ', 'description': 'Hand tools\nfor slow work.', 'kind': 'work', 'cover': 'data:image/png;base64,AA'}, 'version': 3, 'player': 'm1nga'},
            {'id': 'e03dae0d-06e2-41dc-8a5c-25c192be3d2c', 'data': {'name': 'A request', 'description': '', 'kind': 'thought'}, 'version': 1, 'player': {'handle': 'm1nga'}},
            {'id': '../evil', 'data': {'name': 'x'}, 'player': 'bad handle!'},
            {'id': UUID.upper(), 'data': {'name': 'upper'}, 'player': None},
            {'id': 'ffffffff-ffff-4fff-8fff-ffffffffffff', 'data': None, 'player': 'ab'},
            'not a row', None,
        ]
        pages = public_pages(rows)
        folders = [p[0] for p in pages]
        self.assertEqual(folders, ['work/' + UUID, 'work/e03dae0d-06e2-41dc-8a5c-25c192be3d2c', 'work/ffffffff-ffff-4fff-8fff-ffffffffffff', 'people/m1nga'])
        first = pages[0]
        self.assertEqual(first[1], 'Quiet Tools · SideCourt')
        self.assertEqual(first[2], 'Hand tools for slow work.')
        self.assertEqual(first[3], 'https://sidecourt.space/work/' + UUID + '/')
        self.assertEqual(first[4], 'article')
        self.assertEqual(pages[1][2], 'A public post on SideCourt.')
        self.assertEqual(pages[2][1], 'A post · SideCourt')
        author = pages[3]
        self.assertEqual(author[1], '@m1nga · SideCourt')
        self.assertEqual(author[3], 'https://sidecourt.space/people/m1nga/')
        self.assertEqual(author[4], 'profile')

    def test_non_list_input_yields_nothing(self):
        self.assertEqual(public_pages(None), [])
        self.assertEqual(public_pages({'id': UUID}), [])

    def test_publish_writes_folders_and_overwrites_staged_copies(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = pathlib.Path(tmp)
            staged = out / 'work' / UUID
            staged.mkdir(parents=True)
            (staged / 'index.html').write_text(APP)
            pages = publish_public_pages(out, APP, [{'id': UUID, 'data': {'name': 'Quiet Tools', 'description': 'd'}, 'player': 'm1nga'}])
            self.assertEqual(len(pages), 2)
            work = (staged / 'index.html').read_text()
            self.assertIn('<title>Quiet Tools · SideCourt</title>', work)
            person = (out / 'people' / 'm1nga' / 'index.html').read_text()
            self.assertIn('<title>@m1nga · SideCourt</title>', person)
            self.assertIn('href="https://sidecourt.space/people/m1nga/"', person)

    def test_config_is_read_from_the_shipped_config_js(self):
        config = read_config(HERE / 'platform-preview' / 'config.js')
        self.assertTrue(config['supabaseUrl'].startswith('https://'))
        self.assertTrue(config['publishableKey'].startswith('sb_publishable_'))

    def test_sitemap(self):
        xml = sitemap_xml(['https://sidecourt.space/', 'https://sidecourt.space/work/' + UUID + '/'])
        self.assertTrue(xml.startswith('<?xml version="1.0" encoding="UTF-8"?><urlset'))
        self.assertIn('<url><loc>https://sidecourt.space/work/' + UUID + '/</loc></url>', xml)
        self.assertEqual(xml.count('<url>'), 2)


if __name__ == '__main__':
    unittest.main()
