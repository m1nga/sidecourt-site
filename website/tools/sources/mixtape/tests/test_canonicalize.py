from __future__ import annotations

import importlib.util
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock


SKILL_DIR = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "mixtape_canonicalize", SKILL_DIR / "scripts" / "canonicalize.py"
)
canonicalize = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(canonicalize)


class MatchingTests(unittest.TestCase):
    def test_rejects_same_title_by_wrong_artist(self) -> None:
        candidate = {
            "trackName": "The Less I Know (The Better)",
            "artistName": "ALB",
            "artistId": 1,
        }
        with mock.patch.object(canonicalize, "artist_ids", return_value=frozenset()):
            quality = canonicalize.candidate_quality(
                candidate, "The Less I Know the Better", ["Tame Impala"], "gb"
            )
        self.assertIsNone(quality)

    def test_rejects_wrong_raw_control(self) -> None:
        candidate = {
            "trackName": "RAW CONTROL",
            "artistName": "DubMabs",
            "artistId": 2,
        }
        with mock.patch.object(canonicalize, "artist_ids", return_value=frozenset()):
            quality = canonicalize.candidate_quality(
                candidate, "Raw Control", ["Discip"], "gb"
            )
        self.assertIsNone(quality)

    def test_rejects_unrequested_mixed_version(self) -> None:
        candidate = {
            "trackName": "Sprinter (Mixed)",
            "artistName": "Central Cee & Dave",
            "artistId": 3,
        }
        quality = canonicalize.candidate_quality(
            candidate, "Sprinter", ["Central Cee", "Dave"], "gb"
        )
        self.assertIsNone(quality)

    def test_accepts_exact_collaboration(self) -> None:
        candidate = {
            "trackName": "Rumble",
            "artistName": "Skrillex, Fred again.. & Flowdan",
            "artistId": 4,
        }
        quality = canonicalize.candidate_quality(
            candidate,
            "Rumble",
            ["Skrillex", "Fred again..", "Flowdan"],
            "gb",
        )
        self.assertIsNotNone(quality)

    def test_accepts_reordered_collaboration(self) -> None:
        candidate = {
            "trackName": "Sprinter",
            "artistName": "Dave & Central Cee",
            "artistId": 5,
        }
        quality = canonicalize.candidate_quality(
            candidate, "Sprinter", ["Central Cee & Dave"], "gb"
        )
        self.assertIsNotNone(quality)

    def test_exact_artist_beats_added_collaborator(self) -> None:
        exact = {
            "trackName": "Satisfaction",
            "artistName": "Benny Benassi",
            "artistId": 6,
        }
        expanded = {
            "trackName": "Satisfaction",
            "artistName": "David Guetta & Benny Benassi",
            "artistId": 7,
        }
        exact_score = canonicalize.candidate_quality(
            exact, "Satisfaction", ["Benny Benassi"], "gb"
        )[0]
        expanded_score = canonicalize.candidate_quality(
            expanded, "Satisfaction", ["Benny Benassi"], "gb"
        )[0]
        self.assertGreater(exact_score, expanded_score)

    def test_catalog_id_lookup_is_checked_against_requested_track(self) -> None:
        looked_up = {
            "wrapperType": "track",
            "trackName": "The Less I Know The Better",
            "artistName": "Tame Impala",
            "artistId": 8,
            "trackId": 1702056850,
        }
        with mock.patch.object(canonicalize, "api_lookup", return_value=[looked_up]), mock.patch.object(
            canonicalize, "api_search", return_value=[]
        ):
            track, evidence = canonicalize.canonicalize_track(
                "The Less I Know the Better",
                ["Tame Impala"],
                "gb",
                delay=0,
                catalog_id=1702056850,
            )
        self.assertEqual(track["artists"], "Tame Impala")
        self.assertEqual(evidence["catalogId"], 1702056850)


class HandoffTests(unittest.TestCase):
    def test_poster_emits_documented_plural_artists_field(self) -> None:
        tracklist = [{"title": "One More Time", "artists": "Daft Punk"}]
        payload = {
            "title": "Test",
            "tracklist": tracklist,
            "_mixtape": {
                "catalogVerified": True,
                "storefront": "gb",
                "tracklistSha256": canonicalize.tracklist_fingerprint(tracklist),
            },
        }
        with tempfile.TemporaryDirectory() as temp_dir:
            payload_path = Path(temp_dir) / "payload.json"
            payload_path.write_text(json.dumps(payload), encoding="utf-8")
            result = subprocess.run(
                [
                    "bash",
                    str(SKILL_DIR / "scripts" / "post_playlist.sh"),
                    str(payload_path),
                    "--dry-run",
                ],
                check=True,
                capture_output=True,
                text=True,
            )
        posted = json.loads(result.stdout)
        self.assertEqual(posted["tracklist"][0]["artists"], "Daft Punk")
        self.assertNotIn("artist", posted["tracklist"][0])
        self.assertNotIn("_mixtape", posted)

    def test_poster_rejects_edit_after_verification(self) -> None:
        original = [{"title": "One More Time", "artists": "Daft Punk"}]
        payload = {
            "title": "Test",
            "tracklist": [{"title": "Around the World", "artists": "Daft Punk"}],
            "_mixtape": {
                "catalogVerified": True,
                "storefront": "gb",
                "tracklistSha256": canonicalize.tracklist_fingerprint(original),
            },
        }
        with tempfile.TemporaryDirectory() as temp_dir:
            payload_path = Path(temp_dir) / "payload.json"
            payload_path.write_text(json.dumps(payload), encoding="utf-8")
            result = subprocess.run(
                [
                    "bash",
                    str(SKILL_DIR / "scripts" / "post_playlist.sh"),
                    str(payload_path),
                    "--dry-run",
                ],
                capture_output=True,
                text=True,
            )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("edited after verification", result.stderr)


if __name__ == "__main__":
    unittest.main()
