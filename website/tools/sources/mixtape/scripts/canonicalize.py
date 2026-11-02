#!/usr/bin/env python3
"""Verify and canonicalize a Mixtape payload against Apple Music's catalog.

The public iTunes Search API exposes Apple Music catalog metadata without an API
key. This script uses the requested storefront, rejects artist mismatches and
unwanted versions, rewrites confirmed tracks to Apple's displayed title/artist,
and signs the verified tracklist for post_playlist.sh.

Usage:
  canonicalize.py payload.json [--country gb] [--out payload.canonical.json]
"""

from __future__ import annotations

import argparse
import difflib
import hashlib
import json
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from functools import lru_cache
from pathlib import Path
from typing import Any


BAD_QUALIFIERS = re.compile(
    r"\b(live|karaoke|tribute|cover|instrumental|sped up|slowed|8d|remix)\b",
    re.IGNORECASE,
)
HARD_EXCLUDE = re.compile(r"[\[(]\s*mixed\s*[\])]", re.IGNORECASE)


def norm(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", (value or "").casefold())
    without_marks = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return re.sub(r"[^\w\u3400-\u9fff]+", "", without_marks)


def track_artists(track: dict[str, Any]) -> list[str]:
    """Read the documented `artists` field, with legacy `artist` migration."""
    value = track.get("artists", track.get("artist"))
    if isinstance(value, str):
        artists = [value.strip()]
    elif isinstance(value, list):
        artists = [str(item).strip() for item in value]
    else:
        artists = []
    return [artist for artist in artists if artist]


def tracklist_fingerprint(tracklist: list[dict[str, Any]]) -> str:
    canonical = []
    for track in tracklist:
        artists = track.get("artists")
        if isinstance(artists, str):
            artists = [artists]
        canonical.append({"title": track.get("title"), "artists": artists or []})
    encoded = json.dumps(
        canonical, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def api_search(
    term: str, country: str, *, entity: str = "song", limit: int = 25
) -> list[dict[str, Any]]:
    query = urllib.parse.urlencode(
        {"term": term, "entity": entity, "country": country, "limit": limit}
    )
    url = f"https://itunes.apple.com/search?{query}"
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=20) as response:
                return json.load(response).get("results", [])
        except (OSError, ValueError, urllib.error.URLError) as exc:
            last_error = exc
            if attempt < 2:
                time.sleep(0.8 * (attempt + 1))
    raise RuntimeError(f"Apple catalog request failed for {term!r}: {last_error}")


def api_lookup(catalog_id: int | str, country: str) -> list[dict[str, Any]]:
    query = urllib.parse.urlencode(
        {"id": str(catalog_id), "entity": "song", "country": country}
    )
    url = f"https://itunes.apple.com/lookup?{query}"
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=20) as response:
                return [
                    item
                    for item in json.load(response).get("results", [])
                    if item.get("wrapperType") == "track"
                ]
        except (OSError, ValueError, urllib.error.URLError) as exc:
            last_error = exc
            if attempt < 2:
                time.sleep(0.8 * (attempt + 1))
    raise RuntimeError(f"Apple catalog lookup failed for {catalog_id!r}: {last_error}")


@lru_cache(maxsize=256)
def artist_ids(name: str, country: str) -> frozenset[int]:
    """Resolve localized artist aliases (for example 陈奕迅 → Eason Chan)."""
    wanted = norm(name)
    if not wanted:
        return frozenset()
    ids: set[int] = set()
    try:
        results = api_search(name, country, entity="musicArtist", limit=8)
    except RuntimeError:
        return frozenset()
    for result in results:
        got = norm(result.get("artistName", ""))
        similarity = difflib.SequenceMatcher(None, wanted, got).ratio()
        short_cjk_alias = (
            len(wanted) <= 4
            and len(got) <= 4
            and similarity >= 0.65
            and re.search(r"[\u3400-\u9fff]", name)
        )
        if (
            wanted == got
            or wanted in got
            or got in wanted
            or similarity >= 0.72
            or short_cjk_alias
        ):
            artist_id = result.get("artistId")
            if isinstance(artist_id, int):
                ids.add(artist_id)
    return frozenset(ids)


def artist_match(
    wanted_artists: list[str], candidate: dict[str, Any], country: str
) -> tuple[bool, str, float]:
    got = norm(candidate.get("artistName", ""))
    wanted = [norm(artist) for artist in wanted_artists if norm(artist)]
    if not wanted or not got:
        return False, "missing artist metadata", 0.0

    combined = norm(" ".join(wanted_artists))
    if got == combined:
        return True, "exact artist text", 1.0

    def word_tokens(value: str) -> set[str]:
        decomposed = unicodedata.normalize("NFKD", value.casefold())
        plain = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
        return set(re.findall(r"[\w\u3400-\u9fff]+", plain))

    wanted_tokens = word_tokens(" ".join(wanted_artists))
    got_tokens = word_tokens(candidate.get("artistName", ""))
    if wanted_tokens and wanted_tokens == got_tokens:
        return True, "reordered artist text", 0.98

    direct = [name in got or got in name for name in wanted]
    if all(direct):
        return True, "artist text", 0.88

    candidate_id = candidate.get("artistId")
    if len(wanted_artists) == 1 and isinstance(candidate_id, int):
        if candidate_id in artist_ids(wanted_artists[0], country):
            return True, "artist catalog id", 0.82
    return False, "artist mismatch", 0.0


def title_similarity(wanted: str, candidate: str) -> float:
    a, b = norm(wanted), norm(candidate)
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    ratio = difflib.SequenceMatcher(None, a, b).ratio()
    if a in b or b in a:
        ratio = max(ratio, min(len(a), len(b)) / max(len(a), len(b)))
    return ratio


def candidate_quality(
    candidate: dict[str, Any], wanted_title: str, wanted_artists: list[str], country: str
) -> tuple[float, str] | None:
    candidate_title = candidate.get("trackName", "")
    wanted_bad = {item.casefold() for item in BAD_QUALIFIERS.findall(wanted_title)}
    candidate_bad = {item.casefold() for item in BAD_QUALIFIERS.findall(candidate_title)}
    if HARD_EXCLUDE.search(candidate_title) and not HARD_EXCLUDE.search(wanted_title):
        return None
    if candidate_bad - wanted_bad:
        return None

    similarity = title_similarity(wanted_title, candidate_title)
    if similarity < 0.74:
        return None
    matched, method, artist_strength = artist_match(wanted_artists, candidate, country)
    if not matched:
        return None

    # Exact titles win; short/localized variants remain eligible only with a
    # confirmed artist match. Prefer shorter canonical names over long variants.
    length_penalty = min(abs(len(candidate_title) - len(wanted_title)) / 200, 0.12)
    return similarity * 3 + artist_strength * 2 - length_penalty, method


def search_terms(title: str, artists: list[str]) -> list[str]:
    terms = [f"{title} {' '.join(artists)}", f"{title} {artists[0]}", title]
    seen: set[str] = set()
    return [term for term in terms if not (term in seen or seen.add(term))]


def canonicalize_track(
    title: str,
    artists: list[str],
    country: str,
    delay: float = 0.15,
    catalog_id: int | str | None = None,
) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    candidates: dict[int | str, dict[str, Any]] = {}
    errors: list[str] = []
    if catalog_id is not None:
        try:
            for result in api_lookup(catalog_id, country):
                candidates[result.get("trackId") or str(catalog_id)] = result
        except RuntimeError as exc:
            errors.append(str(exc))
    for term in search_terms(title, artists):
        try:
            results = api_search(term, country)
        except RuntimeError as exc:
            errors.append(str(exc))
            continue
        for result in results:
            key = result.get("trackId") or (
                result.get("trackName", ""),
                result.get("artistName", ""),
            )
            candidates[key] = result
        if delay:
            time.sleep(delay)

    ranked: list[tuple[float, str, dict[str, Any]]] = []
    for candidate in candidates.values():
        quality = candidate_quality(candidate, title, artists, country)
        if quality:
            ranked.append((quality[0], quality[1], candidate))

    if not ranked:
        reason = errors[-1] if errors and not candidates else "no title+artist match"
        return None, {"status": "unconfirmed", "reason": reason}

    _, method, best = max(ranked, key=lambda item: item[0])
    canonical = {
        "title": best["trackName"],
        # Soundiiz requires the plural key. A string is explicitly supported and
        # preserves Apple's combined collaboration credit without risky splitting.
        "artists": best["artistName"],
    }
    evidence = {
        "status": "confirmed",
        "matchMethod": method,
        "catalogId": best.get("trackId"),
        "isrc": best.get("isrc"),
        "album": best.get("collectionName"),
        "url": best.get("trackViewUrl"),
        "titleSimilarity": round(title_similarity(title, best["trackName"]), 3),
    }
    return canonical, evidence


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", type=Path)
    parser.add_argument("--country", default="us")
    parser.add_argument("--out", type=Path)
    parser.add_argument("--report", type=Path)
    parser.add_argument("--delay", type=float, default=0.15)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    out = args.out or args.path.with_suffix(".canonical.json")
    report_path = args.report or args.path.with_suffix(".canonical.report.json")
    with args.path.open(encoding="utf-8") as handle:
        payload = json.load(handle)

    reports: list[dict[str, Any]] = []
    not_found: list[str] = []
    changed = 0
    normalized_tracks: list[dict[str, Any]] = []
    for index, track in enumerate(payload.get("tracklist", []), start=1):
        title = str(track.get("title", "")).strip()
        artists = track_artists(track)
        catalog_id = track.get("appleMusicId")
        if not title or not artists:
            canonical = None
            evidence = {"status": "unconfirmed", "reason": "missing title/artists"}
        else:
            canonical, evidence = canonicalize_track(
                title,
                artists,
                args.country.lower(),
                args.delay,
                catalog_id=catalog_id,
            )

        original = {"title": title, "artists": artists}
        if catalog_id is not None:
            original["appleMusicId"] = catalog_id
        report = {"index": index, "input": original, **evidence}
        if canonical is None:
            normalized_tracks.append(original)
            label = f"{title} — {', '.join(artists)}"
            not_found.append(label)
            print(f"❌ {label}: {evidence['reason']}")
        else:
            normalized_tracks.append(canonical)
            report["canonical"] = canonical
            if canonical["title"] != title or canonical["artists"] not in artists:
                changed += 1
                print(
                    f"✏️  {title} — {', '.join(artists)}\n"
                    f"    → {canonical['title']} — {canonical['artists']}"
                )
            else:
                print(f"✅ {title} — {', '.join(artists)}")
        reports.append(report)

    payload["tracklist"] = normalized_tracks
    verified = not not_found and bool(normalized_tracks)
    payload["_mixtape"] = {
        "catalogVerified": verified,
        "storefront": args.country.lower(),
        "tracklistSha256": tracklist_fingerprint(normalized_tracks),
    }
    with out.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    with report_path.open("w", encoding="utf-8") as handle:
        json.dump(
            {
                "storefront": args.country.lower(),
                "verified": verified,
                "tracks": reports,
            },
            handle,
            ensure_ascii=False,
            indent=2,
        )
        handle.write("\n")

    print(
        f"\n{changed} rewritten, {len(not_found)} unconfirmed → {out}\n"
        f"Evidence report → {report_path}"
    )
    if not_found:
        print("Replace every unconfirmed track, then run canonicalize.py again.")
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
