from contextlib import redirect_stdout
from io import BytesIO, StringIO
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import youtube_playlist as yt


class YouTubePlaylistTests(unittest.TestCase):
    ids = [f"clip{i:07d}" for i in range(12)]

    def test_save_current_only_reports_eleven_missing(self):
        result = yt.compare("PLsaved", self.ids, self.ids[:1])
        self.assertEqual((result["status"], result["expectedCount"], result["actualCount"]),
                         ("mismatch", 12, 1))
        self.assertEqual(result["missingVideoIds"], self.ids[1:])

    def test_order_and_multiplicity_are_part_of_the_receipt(self):
        expected = self.ids + self.ids[:1]
        self.assertEqual(yt.compare("PLsaved", expected, expected)["status"], "verified")
        for actual in (expected[::-1], self.ids + self.ids[-1:]):
            self.assertEqual(yt.compare("PLsaved", expected, actual)["status"], "mismatch")

    def test_read_uses_auth_and_all_pages_in_destination_order(self):
        pages = []
        for positions, extra in [([1, 0], {"nextPageToken": "second"}), ([2], {})]:
            items = [{"snippet": {"position": i}, "contentDetails": {"videoId": self.ids[i]}}
                     for i in positions]
            pages.append(BytesIO(json.dumps({"items": items, "pageInfo": {"totalResults": 3},
                                             **extra}).encode()))
        with patch.object(yt, "urlopen", side_effect=pages) as get:
            self.assertEqual(yt.read_playlist("PLsaved", "test-token"), self.ids[:3])
            args = get.call_args.args[0]
            self.assertEqual(args.get_header("Authorization"), "Bearer test-token")
            self.assertIn("pageToken=second", args.full_url)

    def test_export_and_verify_are_separate(self):
        tracks = [{"title": f"Song {i}", "artists": ["Artist"], "youtubeVideoId": video_id}
                  for i, video_id in enumerate(self.ids)]
        manifest = {"tracklist": tracks, "_mixtape": {"catalogVerified": True,
                    "tracklistSha256": yt.tracklist_fingerprint(tracks)}}
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / "manifest.json"
            path.write_text(json.dumps(manifest))
            urls = Path(root) / "tracks.txt"
            with redirect_stdout(StringIO()):
                self.assertEqual(yt.main([str(path), "--write-urls", str(urls)]), 0)
            self.assertEqual(urls.read_text().splitlines(),
                             [f"https://www.youtube.com/watch?v={i}" for i in self.ids])
            before = urls.read_bytes()
            with redirect_stdout(StringIO()):
                self.assertEqual(yt.main([str(path), "--write-urls", str(urls)]), 2)
            self.assertEqual(urls.read_bytes(), before)
            for list_id in ("TLtemporary", "PLsaved"):
                with patch.dict(yt.os.environ, {}, clear=True), redirect_stdout(StringIO()) as output:
                    self.assertEqual(yt.main([str(path), "--playlist-id", list_id]), 2)
                    self.assertEqual(json.loads(output.getvalue())["status"], "blocked")
            del tracks[3]
            with self.assertRaisesRegex(ValueError, "complete"):
                yt.expected_ids(manifest)

    def test_incomplete_positions_are_not_verified(self):
        page = {"items": [{"snippet":{"position":0}, "contentDetails":{"videoId":self.ids[0]}}],
                "pageInfo":{"totalResults":12}}
        with patch.object(yt, "urlopen", return_value=BytesIO(json.dumps(page).encode())):
            with self.assertRaisesRegex(ValueError, "incomplete"):
                yt.read_playlist("PLsaved", "fixture-token")

    def test_changing_total_and_repeated_page_token_are_blocked(self):
        for second_total, second_token, message in [(3, None, "count changed"), (2, "same", "repeated")]:
            pages = []
            for position, total, token in [(0, 2, "same"), (1, second_total, second_token)]:
                page = {"items":[{"snippet":{"position":position}, "contentDetails":{"videoId":self.ids[position]}}],
                        "pageInfo":{"totalResults":total}}
                if token:
                    page["nextPageToken"] = token
                pages.append(BytesIO(json.dumps(page).encode()))
            with patch.object(yt, "urlopen", side_effect=pages):
                with self.assertRaisesRegex(ValueError, message):
                    yt.read_playlist("PLsaved", "fixture-token")
