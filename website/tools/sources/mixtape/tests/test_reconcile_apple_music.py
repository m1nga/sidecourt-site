from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path


SKILL_DIR = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "mixtape_reconcile_apple_music",
    SKILL_DIR / "scripts" / "reconcile_apple_music.py",
)
reconcile = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
sys.modules[SPEC.name] = reconcile
SPEC.loader.exec_module(reconcile)


class ManifestTests(unittest.TestCase):
    def test_retained_playlist_cannot_also_be_deleted(self) -> None:
        with self.assertRaisesRegex(SystemExit, "cannot also be deleted"):
            reconcile.parse_manifest(
                {
                    "stableTitle": "跑步",
                    "keep": {
                        "id": 6073,
                        "expectedName": "跑步 v4",
                        "expectedTrackCount": 33,
                    },
                    "delete": [{"id": 6073, "expectedName": "跑步 v4"}],
                }
            )

    def test_delete_requires_exact_original_name(self) -> None:
        manifest = reconcile.parse_manifest(
            {
                "stableTitle": "跑步",
                "keep": {
                    "id": 6073,
                    "expectedName": "梦想感起跑 v4",
                    "expectedTrackCount": 33,
                },
                "delete": [{"id": 6059, "expectedName": "梦想感起跑 v3"}],
            }
        )
        inventory = {
            "6073": reconcile.Playlist("6073", "梦想感起跑 v4", 33),
            "6059": reconcile.Playlist("6059", "别人的歌单", 8),
        }
        with self.assertRaisesRegex(SystemExit, "delete ID 6059 is named"):
            reconcile.build_plan(manifest, inventory)


class ReconciliationPlanTests(unittest.TestCase):
    def setUp(self) -> None:
        self.manifest = reconcile.parse_manifest(
            {
                "stableTitle": "跑步",
                "keep": {
                    "id": 6073,
                    "expectedName": "梦想感起跑 v4·不再缺歌版",
                    "expectedTrackCount": 33,
                },
                "delete": [
                    {
                        "id": 6059,
                        "expectedName": "梦想感起跑 v3·两小时完整版",
                        "expectedTrackCount": 8,
                    },
                    {
                        "id": 6068,
                        "expectedName": "梦想感起跑·60min",
                        "expectedTrackCount": 4,
                    },
                ],
                "protect": [
                    {
                        "id": 5334,
                        "expectedName": "I wonder if you know",
                        "expectedTrackCount": 1,
                    }
                ],
            }
        )

    def test_happy_path_has_one_rename_and_exact_deletions(self) -> None:
        inventory = {
            "6073": reconcile.Playlist("6073", "梦想感起跑 v4·不再缺歌版", 33),
            "6059": reconcile.Playlist("6059", "梦想感起跑 v3·两小时完整版", 8),
            "6068": reconcile.Playlist("6068", "梦想感起跑·60min", 4),
            "5334": reconcile.Playlist("5334", "I wonder if you know", 1),
        }
        plan = reconcile.build_plan(self.manifest, inventory)
        self.assertEqual(plan["keep"]["action"], "rename")
        self.assertEqual([item["id"] for item in plan["delete"]], ["6059", "6068"])
        self.assertTrue(all(item["status"] == "delete" for item in plan["delete"]))
        self.assertEqual(plan["protect"][0]["action"], "preserve")

    def test_completed_reconciliation_is_idempotent(self) -> None:
        inventory = {
            "6073": reconcile.Playlist("6073", "跑步", 33),
            "5334": reconcile.Playlist("5334", "I wonder if you know", 1),
        }
        plan = reconcile.build_plan(self.manifest, inventory)
        self.assertEqual(plan["keep"]["action"], "keep")
        self.assertTrue(all(item["status"] == "already_absent" for item in plan["delete"]))
        receipt = reconcile.verify_receipt(self.manifest, inventory)
        self.assertTrue(receipt["verified"])
        self.assertTrue(receipt["protected"][0]["unchanged"])

    def test_unmanaged_stable_title_collision_is_blocked(self) -> None:
        inventory = {
            "6073": reconcile.Playlist("6073", "梦想感起跑 v4·不再缺歌版", 33),
            "9000": reconcile.Playlist("9000", "跑步", 12),
            "5334": reconcile.Playlist("5334", "I wonder if you know", 1),
        }
        with self.assertRaisesRegex(SystemExit, "unmanaged playlist"):
            reconcile.build_plan(self.manifest, inventory)

    def test_delete_and_protect_cannot_overlap(self) -> None:
        with self.assertRaisesRegex(SystemExit, "both deleted and protected"):
            reconcile.parse_manifest(
                {
                    "stableTitle": "跑步",
                    "keep": {
                        "id": 6073,
                        "expectedName": "跑步 v4",
                        "expectedTrackCount": 33,
                    },
                    "delete": [{"id": 6059, "expectedName": "跑步 v3"}],
                    "protect": [{"id": 6059, "expectedName": "跑步 v3"}],
                }
            )


if __name__ == "__main__":
    unittest.main()
