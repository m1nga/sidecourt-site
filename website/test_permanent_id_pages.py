"""Offline regression tests; python3 -m unittest discover -s website."""
import json
import pathlib
import tempfile
import unittest
from public_pages import public_pages, publish_public_pages, sitemap_xml

APP = '<!doctype html><html><head><title>SideCourt</title><meta name="description" content="old"><link rel="canonical" href="https://sidecourt.space/"></head><body><script src="/court.js"></script></body></html>'
UUID = '11111111-1111-4111-8111-111111111111'
ROW = {'id': UUID, 'sidecourt_id': 'SC4M9Q2', 'player': 'ming', 'data': {'name': 'A useful work', 'author': 'Ming', 'cardLine': 'A short card line.', 'description': 'Long public detail.'}, 'draft': {'name': 'PRIVATE SECRET'}}

class PermanentIDPages(unittest.TestCase):
    def test_short_and_legacy_aliases_have_the_same_canonical_and_public_card_line(self):
        pages = public_pages([ROW])
        posts = [p for p in pages if p[0].startswith('work/')]
        self.assertEqual([p[0] for p in posts], ['work/' + UUID, 'work/SC4M9Q2'])
        for page in posts:
            self.assertEqual(page[2], 'A short card line.')
            self.assertEqual(page[3], 'https://sidecourt.space/work/SC4M9Q2')
        self.assertEqual(sitemap_xml([p[3] for p in posts]).count('<url>'), 1)

    def test_overwriting_staged_pages_preserves_both_aliases_author_meta_and_other_products(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = pathlib.Path(tmp)
            download = out / 'cleanpause' / 'downloads' / 'keep.zip'
            download.parent.mkdir(parents=True)
            download.write_bytes(b'product bytes')
            for folder in ['work/' + UUID, 'work/SC4M9Q2']:
                path = out / folder
                path.mkdir(parents=True)
                (path / 'index.html').write_text(APP)
            publish_public_pages(out, APP, [ROW])
            for identity in [UUID, 'SC4M9Q2']:
                html = (out / 'work' / identity / 'index.html').read_text()
                self.assertIn('href="https://sidecourt.space/work/SC4M9Q2"', html)
                self.assertIn('<meta name="author" content="Ming">', html)
                self.assertIn('property="og:description" content="A short card line."', html)
                self.assertNotIn('PRIVATE SECRET', html)
            self.assertEqual(download.read_bytes(), b'product bytes')

    def test_review_config_keeps_environment_path_and_noindex(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = pathlib.Path(tmp)
            (out / 'config.js').write_text('window.SIDECOURT_CONFIG=' + json.dumps({'siteUrl': 'https://m1nga.github.io/sidecourt-review/', 'reviewSite': True}) + ';')
            publish_public_pages(out, APP, [ROW])
            for identity in [UUID, 'SC4M9Q2']:
                html = (out / 'work' / identity / 'index.html').read_text()
                self.assertIn('href="https://m1nga.github.io/sidecourt-review/work/SC4M9Q2"', html)
                self.assertIn('name="robots" content="noindex,nofollow"', html)

    def test_connection_guide_has_its_own_metadata_even_with_no_public_posts(self):
        for config in [{}, {'siteUrl': 'https://m1nga.github.io/sidecourt-review/', 'reviewSite': True}]:
            with tempfile.TemporaryDirectory() as tmp:
                publish_public_pages(tmp, APP, [], config)
                page = (pathlib.Path(tmp) / 'connect-ai' / 'index.html').read_text()
                canonical = (config.get('siteUrl') or 'https://sidecourt.space').rstrip('/') + '/connect-ai'
                self.assertIn('<title>Connect your AI · SideCourt</title>', page)
                self.assertIn('ChatGPT, Claude, Claude Code or Codex', page)
                self.assertIn('href="' + canonical + '"', page)
                self.assertIn('property="og:url" content="' + canonical + '"', page)
                if config.get('reviewSite'):
                    self.assertIn('name="robots" content="noindex,nofollow"', page)

    def test_invalid_short_id_does_not_make_a_folder_and_public_text_is_escaped(self):
        row = dict(ROW, sidecourt_id='SC4L9Q2', data={'name': '</title><script>bad()</script>', 'author': 'Ming <script>', 'cardLine': ' ', 'description': 'Old description'})
        pages = public_pages([row])
        self.assertEqual([p[0] for p in pages if p[0].startswith('work/')], ['work/' + UUID])
        self.assertEqual(pages[0][2], 'Old description')
        with tempfile.TemporaryDirectory() as tmp:
            publish_public_pages(tmp, APP, [row])
            html = (pathlib.Path(tmp) / 'work' / UUID / 'index.html').read_text()
            self.assertNotIn('<script>bad()', html)
            self.assertIn('&lt;script&gt;', html)

if __name__ == '__main__':
    unittest.main()
