#!/usr/bin/env python3
"""Keep one stable Apple Music playlist after a Mixtape iteration.

This macOS-only helper treats deletion as a verified reconciliation, never a
fuzzy-name cleanup. It inventories Music first, checks exact playlist IDs,
original names, and track counts from a manifest, then renames the retained
playlist and deletes only the explicitly listed superseded IDs. Dry-run is the
default; ``--apply`` is required for mutation, followed by a read-back receipt.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable


RECORD_SEPARATOR = "\x1e"
FIELD_SEPARATOR = "\x1f"

INVENTORY_SCRIPT = r'''
tell application "Music"
    set outputText to ""
    repeat with playlistItem in every user playlist
        set outputText to outputText & (id of playlistItem as text) & (ASCII character 31) & ¬
            (count of tracks of playlistItem as text) & (ASCII character 31) & ¬
            (name of playlistItem as text) & (ASCII character 30)
    end repeat
    return outputText
end tell
'''

APPLY_SCRIPT = r'''
on run argv
    set keepId to (item 1 of argv) as integer
    set stableTitle to item 2 of argv
    set expectedKeepName to item 3 of argv
    set expectedKeepCount to item 4 of argv
    set deleteCount to (item 5 of argv) as integer

    tell application "Music"
        set keepMatches to every user playlist whose id is keepId
        if (count of keepMatches) is not 1 then error "retained playlist ID is missing or ambiguous"
        set keepPlaylist to item 1 of keepMatches
        set currentKeepName to (name of keepPlaylist as text)
        if currentKeepName is not expectedKeepName and currentKeepName is not stableTitle then ¬
            error "retained playlist name changed after preflight"
        if (count of tracks of keepPlaylist as text) is not expectedKeepCount then ¬
            error "retained playlist count changed after preflight"

        set argumentIndex to 6
        repeat deleteCount times
            set oldId to (item argumentIndex of argv) as integer
            set oldName to item (argumentIndex + 1) of argv
            set oldCount to item (argumentIndex + 2) of argv
            set oldMatches to every user playlist whose id is oldId
            if (count of oldMatches) is 1 then
                set oldPlaylist to item 1 of oldMatches
                if (name of oldPlaylist as text) is not oldName then ¬
                    error "superseded playlist name changed after preflight"
                if oldCount is not "" and (count of tracks of oldPlaylist as text) is not oldCount then ¬
                    error "superseded playlist count changed after preflight"
            else if (count of oldMatches) is greater than 1 then
                error "superseded playlist ID is ambiguous"
            end if
            set argumentIndex to argumentIndex + 3
        end repeat

        set name of keepPlaylist to stableTitle

        set argumentIndex to 6
        repeat deleteCount times
            set oldId to (item argumentIndex of argv) as integer
            set oldMatches to every user playlist whose id is oldId
            if (count of oldMatches) is 1 then delete item 1 of oldMatches
            set argumentIndex to argumentIndex + 3
        end repeat
    end tell
end run
'''


@dataclass(frozen=True)
class Playlist:
    id: str
    name: str
    track_count: int


@dataclass(frozen=True)
class Target:
    id: str
    expected_name: str
    expected_track_count: int | None


@dataclass(frozen=True)
class Manifest:
    stable_title: str
    keep: Target
    delete: tuple[Target, ...]
    protect: tuple[Target, ...]


def fail(message: str) -> "NoReturn":
    raise SystemExit(f"Mixtape reconciliation refused: {message}")


def normalize_id(value: Any, label: str) -> str:
    text = str(value).strip()
    if not text.isdigit():
        fail(f"{label} ID must be numeric, got {value!r}")
    return text


def parse_target(value: Any, label: str, *, count_required: bool) -> Target:
    if not isinstance(value, dict):
        fail(f"{label} must be an object")
    playlist_id = normalize_id(value.get("id"), label)
    expected_name = value.get("expectedName")
    if not isinstance(expected_name, str) or not expected_name.strip():
        fail(f"{label}.expectedName is required")
    raw_count = value.get("expectedTrackCount")
    if raw_count is None and count_required:
        fail(f"{label}.expectedTrackCount is required")
    if raw_count is not None and (isinstance(raw_count, bool) or not isinstance(raw_count, int) or raw_count < 0):
        fail(f"{label}.expectedTrackCount must be a non-negative integer")
    return Target(playlist_id, expected_name, raw_count)


def parse_manifest(value: Any) -> Manifest:
    if not isinstance(value, dict):
        fail("manifest root must be an object")
    stable_title = value.get("stableTitle")
    if not isinstance(stable_title, str) or not stable_title.strip():
        fail("stableTitle is required")
    keep = parse_target(value.get("keep"), "keep", count_required=True)
    raw_delete = value.get("delete", [])
    if not isinstance(raw_delete, list):
        fail("delete must be an array")
    delete = tuple(
        parse_target(item, f"delete[{index}]", count_required=False)
        for index, item in enumerate(raw_delete)
    )
    raw_protect = value.get("protect", [])
    if not isinstance(raw_protect, list):
        fail("protect must be an array")
    protect = tuple(
        parse_target(item, f"protect[{index}]", count_required=False)
        for index, item in enumerate(raw_protect)
    )
    delete_ids = [item.id for item in delete]
    protect_ids = [item.id for item in protect]
    if keep.id in delete_ids:
        fail("the retained playlist cannot also be deleted")
    if keep.id in protect_ids:
        fail("the retained playlist is already protected by being kept")
    if len(delete_ids) != len(set(delete_ids)):
        fail("delete contains duplicate playlist IDs")
    if len(protect_ids) != len(set(protect_ids)):
        fail("protect contains duplicate playlist IDs")
    overlap = sorted(set(delete_ids) & set(protect_ids))
    if overlap:
        fail(f"playlist IDs cannot be both deleted and protected: {', '.join(overlap)}")
    return Manifest(stable_title.strip(), keep, delete, protect)


def run_osascript(script: str, args: list[str] | None = None) -> str:
    command = ["osascript", "-e", script]
    if args:
        command.extend(["--", *args])
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip() or "unknown AppleScript error"
        fail(detail)
    return result.stdout.rstrip("\n")


def read_inventory(runner: Callable[[str, list[str] | None], str] = run_osascript) -> dict[str, Playlist]:
    raw = runner(INVENTORY_SCRIPT, None)
    playlists: dict[str, Playlist] = {}
    for row in raw.split(RECORD_SEPARATOR):
        if not row:
            continue
        parts = row.split(FIELD_SEPARATOR, 2)
        if len(parts) != 3:
            fail("Music returned an unreadable inventory row")
        playlist_id, count, name = parts
        if playlist_id in playlists:
            fail(f"Music returned duplicate playlist ID {playlist_id}")
        playlists[playlist_id] = Playlist(playlist_id, name, int(count))
    return playlists


def build_plan(manifest: Manifest, inventory: dict[str, Playlist]) -> dict[str, Any]:
    keep = inventory.get(manifest.keep.id)
    if keep is None:
        fail(f"retained playlist ID {manifest.keep.id} does not exist")
    if keep.name not in {manifest.keep.expected_name, manifest.stable_title}:
        fail(
            f"retained ID {keep.id} is named {keep.name!r}, expected "
            f"{manifest.keep.expected_name!r} or {manifest.stable_title!r}"
        )
    if keep.track_count != manifest.keep.expected_track_count:
        fail(
            f"retained ID {keep.id} has {keep.track_count} tracks, expected "
            f"{manifest.keep.expected_track_count}"
        )

    delete_ids = {target.id for target in manifest.delete}
    deletion_plan: list[dict[str, Any]] = []
    for target in manifest.delete:
        current = inventory.get(target.id)
        if current is None:
            deletion_plan.append({"id": target.id, "status": "already_absent"})
            continue
        if current.name != target.expected_name:
            fail(
                f"delete ID {current.id} is named {current.name!r}, expected "
                f"{target.expected_name!r}"
            )
        if target.expected_track_count is not None and current.track_count != target.expected_track_count:
            fail(
                f"delete ID {current.id} has {current.track_count} tracks, expected "
                f"{target.expected_track_count}"
            )
        deletion_plan.append(
            {
                "id": current.id,
                "name": current.name,
                "trackCount": current.track_count,
                "status": "delete",
            }
        )

    collisions = [
        playlist
        for playlist in inventory.values()
        if playlist.name == manifest.stable_title
        and playlist.id != manifest.keep.id
        and playlist.id not in delete_ids
    ]
    if collisions:
        details = ", ".join(f"{item.id}:{item.name}" for item in collisions)
        fail(f"stable title already belongs to unmanaged playlist(s): {details}")

    protection_plan: list[dict[str, Any]] = []
    for target in manifest.protect:
        current = inventory.get(target.id)
        if current is None:
            fail(f"protected playlist ID {target.id} does not exist")
        if current.name != target.expected_name:
            fail(
                f"protected ID {current.id} is named {current.name!r}, expected "
                f"{target.expected_name!r}"
            )
        if target.expected_track_count is not None and current.track_count != target.expected_track_count:
            fail(
                f"protected ID {current.id} has {current.track_count} tracks, expected "
                f"{target.expected_track_count}"
            )
        protection_plan.append(
            {
                "id": current.id,
                "name": current.name,
                "trackCount": current.track_count,
                "action": "preserve",
            }
        )

    return {
        "operation": "apple_music_playlist_reconciliation",
        "mode": "dry_run",
        "stableTitle": manifest.stable_title,
        "keep": {
            "id": keep.id,
            "currentName": keep.name,
            "trackCount": keep.track_count,
            "action": "keep" if keep.name == manifest.stable_title else "rename",
        },
        "delete": deletion_plan,
        "protect": protection_plan,
    }


def apply_plan(manifest: Manifest, inventory: dict[str, Playlist]) -> None:
    present_deletions = [target for target in manifest.delete if target.id in inventory]
    args = [
        manifest.keep.id,
        manifest.stable_title,
        manifest.keep.expected_name,
        str(manifest.keep.expected_track_count),
        str(len(present_deletions)),
    ]
    for target in present_deletions:
        args.extend(
            [
                target.id,
                target.expected_name,
                "" if target.expected_track_count is None else str(target.expected_track_count),
            ]
        )
    run_osascript(APPLY_SCRIPT, args)


def verify_receipt(manifest: Manifest, inventory: dict[str, Playlist]) -> dict[str, Any]:
    keep = inventory.get(manifest.keep.id)
    if keep is None or keep.name != manifest.stable_title:
        fail("read-back did not find the retained playlist under the stable title")
    if keep.track_count != manifest.keep.expected_track_count:
        fail("read-back track count does not match the manifest")
    remaining = [target.id for target in manifest.delete if target.id in inventory]
    if remaining:
        fail(f"read-back found superseded playlist IDs still present: {', '.join(remaining)}")
    same_title = [item.id for item in inventory.values() if item.name == manifest.stable_title]
    if same_title != [manifest.keep.id]:
        fail(f"read-back expected one stable-title playlist, found IDs {same_title}")
    protected_receipt: list[dict[str, Any]] = []
    for target in manifest.protect:
        current = inventory.get(target.id)
        if current is None or current.name != target.expected_name:
            fail(f"read-back did not preserve protected playlist ID {target.id}")
        if target.expected_track_count is not None and current.track_count != target.expected_track_count:
            fail(f"read-back changed protected playlist ID {target.id}")
        protected_receipt.append(
            {
                "id": current.id,
                "name": current.name,
                "trackCount": current.track_count,
                "unchanged": True,
            }
        )
    return {
        "status": "reconciled",
        "platform": "Apple Music",
        "playlist": {
            "id": keep.id,
            "name": keep.name,
            "trackCount": keep.track_count,
        },
        "deletedIds": [target.id for target in manifest.delete],
        "protected": protected_receipt,
        "verified": True,
    }


def print_json(value: Any) -> None:
    print(json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    inventory_parser = subparsers.add_parser("inventory", help="list user playlists without changing Music")
    inventory_parser.add_argument("--contains", help="only show playlist names containing this text")

    reconcile_parser = subparsers.add_parser("reconcile", help="plan or apply a stable-title reconciliation")
    reconcile_parser.add_argument("manifest", type=Path)
    reconcile_parser.add_argument("--apply", action="store_true", help="perform the verified rename and deletions")

    args = parser.parse_args()
    inventory = read_inventory()

    if args.command == "inventory":
        playlists = sorted(inventory.values(), key=lambda item: (item.name.casefold(), item.id))
        if args.contains:
            needle = args.contains.casefold()
            playlists = [item for item in playlists if needle in item.name.casefold()]
        print_json(
            [
                {"id": item.id, "name": item.name, "trackCount": item.track_count}
                for item in playlists
            ]
        )
        return 0

    manifest = parse_manifest(json.loads(args.manifest.read_text(encoding="utf-8")))
    plan = build_plan(manifest, inventory)
    if not args.apply:
        print_json(plan)
        return 0

    apply_plan(manifest, inventory)
    print_json(verify_receipt(manifest, read_inventory()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
