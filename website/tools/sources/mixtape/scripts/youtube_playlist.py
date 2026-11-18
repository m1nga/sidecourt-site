#!/usr/bin/env python3
"""Export exact YouTube URLs or verify a saved playlist against a pinned mixtape."""

import argparse
from collections import Counter
import json
import os
from pathlib import Path
import re
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from canonicalize import tracklist_fingerprint


def expected_ids(manifest):
    tracks = manifest["tracklist"]
    evidence = manifest["_mixtape"]
    if not tracks or evidence.get("catalogVerified") is not True or (
        tracklist_fingerprint(tracks) != evidence.get("tracklistSha256")
    ):
        raise ValueError("Use the complete, unchanged catalog-verified tracklist.")
    ids = []
    for index, track in enumerate(tracks, 1):
        video_id = track.get("youtubeVideoId")
        if not isinstance(video_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id):
            raise ValueError(f"Pin the YouTube recording for track {index}: {track['title']}")
        ids.append(video_id)
    return ids


def read_playlist(playlist_id, token):
    if not re.fullmatch(r"PL[A-Za-z0-9_-]+", playlist_id):
        raise ValueError("Use the PL ID of the saved destination playlist.")
    if not token:
        raise ValueError("Destination read-back requires an authorized YOUTUBE_ACCESS_TOKEN.")
    params = {"part": "snippet,contentDetails", "playlistId": playlist_id, "maxResults": 50,
              "fields": "nextPageToken,pageInfo/totalResults,items(snippet/position,contentDetails/videoId)"}
    by_position = {}
    seen_tokens = set()
    total = None
    while True:
        url = "https://www.googleapis.com/youtube/v3/playlistItems?" + urlencode(params)
        request = Request(url, headers={"Authorization": f"Bearer {token}"})
        with urlopen(request, timeout=20) as response:
            page = json.load(response)
        page_total = page["pageInfo"]["totalResults"]
        if type(page_total) is not int or page_total < 0 or (total is not None and total != page_total):
            raise ValueError("Playlist count changed or was invalid during read-back. Read it again.")
        total = page_total
        for item in page["items"]:
            position = item["snippet"]["position"]
            if position in by_position:
                raise ValueError("Playlist positions changed during read-back. Read it again.")
            by_position[position] = item["contentDetails"]["videoId"]
        next_token = page.get("nextPageToken")
        if not next_token:
            break
        if next_token in seen_tokens:
            raise ValueError("YouTube repeated a page token. Read-back is incomplete.")
        seen_tokens.add(next_token)
        params["pageToken"] = next_token
    if sorted(by_position) != list(range(total)):
        raise ValueError("YouTube returned an incomplete list of positions. Read it again.")
    return [by_position[index] for index in range(len(by_position))]


def compare(playlist_id, expected, actual):
    return {
        "status": "verified" if actual == expected else "mismatch",
        "playlistId": playlist_id,
        "expectedCount": len(expected),
        "actualCount": len(actual),
        "expectedVideoIds": expected,
        "actualVideoIds": actual,
        "missingVideoIds": list((Counter(expected) - Counter(actual)).elements()),
        "unexpectedVideoIds": list((Counter(actual) - Counter(expected)).elements()),
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--write-urls", type=Path, help="write one watch URL per recording")
    action.add_argument("--playlist-id", help="read a saved YouTube PL playlist")
    args = parser.parse_args(argv)
    try:
        ids = expected_ids(json.loads(args.manifest.read_text(encoding="utf-8")))
        if args.write_urls:
            urls = [f"https://www.youtube.com/watch?v={video_id}" for video_id in ids]
            with args.write_urls.open("x", encoding="utf-8") as output:
                output.write("\n".join(urls) + "\n")
            print(json.dumps({"status": "prepared", "tracks": len(ids), "file": str(args.write_urls)}))
            return 0
        actual = read_playlist(args.playlist_id, os.environ.get("YOUTUBE_ACCESS_TOKEN"))
        receipt = compare(args.playlist_id, ids, actual)
    except (OSError, URLError, ValueError, TypeError, KeyError) as error:
        print(json.dumps({"status": "blocked", "reason": str(error)}, ensure_ascii=False))
        return 2
    print(json.dumps(receipt, indent=2))
    return 0 if receipt["status"] == "verified" else 1


if __name__ == "__main__":
    raise SystemExit(main())
