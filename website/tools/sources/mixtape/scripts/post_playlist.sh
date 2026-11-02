#!/bin/bash
# POST a catalog-verified tracklist to Soundiiz's public Playlist Import API.
# Usage: post_playlist.sh payload.canonical.json [--dry-run]
set -euo pipefail

input="${1:?usage: post_playlist.sh payload.canonical.json [--dry-run]}"
mode="${2:-}"
if [[ -n "$mode" && "$mode" != "--dry-run" ]]; then
  echo "usage: post_playlist.sh payload.canonical.json [--dry-run]" >&2
  exit 2
fi

prepared=$(mktemp)
response=$(mktemp)
trap 'rm -f "$prepared" "$response"' EXIT

python3 - "$input" "$prepared" <<'PY'
import hashlib, json, sys

source, target = sys.argv[1:]
with open(source, encoding="utf-8") as handle:
    payload = json.load(handle)

tracklist = payload.get("tracklist", [])
if not payload.get("title"):
    raise SystemExit("payload missing 'title'")
if not 1 <= len(tracklist) <= 200:
    raise SystemExit(f"tracklist has {len(tracklist)} tracks, must be 1-200")

normalized = []
for index, track in enumerate(tracklist, start=1):
    title = str(track.get("title", "")).strip()
    artists = track.get("artists")
    if artists is None and track.get("artist"):
        artists = [track["artist"]]  # legacy migration; never send the wrong key
    if isinstance(artists, str):
        artists_for_hash = [artists.strip()]
        artists_for_soundiiz = artists.strip()
    elif isinstance(artists, list):
        artists_for_hash = [str(item).strip() for item in artists if str(item).strip()]
        artists_for_soundiiz = artists_for_hash
    else:
        artists_for_hash = []
        artists_for_soundiiz = []
    if not title or not artists_for_hash:
        raise SystemExit(f"track #{index} missing title/artists: {track}")
    normalized.append({"title": title, "artists": artists_for_soundiiz})

fingerprint_input = []
for track in normalized:
    artists = track["artists"]
    if isinstance(artists, str):
        artists = [artists]
    fingerprint_input.append({"title": track["title"], "artists": artists})
encoded = json.dumps(
    fingerprint_input, ensure_ascii=False, sort_keys=True, separators=(",", ":")
).encode("utf-8")
fingerprint = hashlib.sha256(encoded).hexdigest()

verification = payload.get("_mixtape", {})
if verification.get("catalogVerified") is not True:
    raise SystemExit(
        "refusing unverified payload: run canonicalize.py and replace all unconfirmed tracks"
    )
if verification.get("tracklistSha256") != fingerprint:
    raise SystemExit(
        "refusing changed payload: tracklist was edited after verification; rerun canonicalize.py"
    )

clean = {key: value for key, value in payload.items() if not key.startswith("_")}
clean["tracklist"] = normalized
with open(target, "w", encoding="utf-8") as handle:
    json.dump(clean, handle, ensure_ascii=False, indent=2)
    handle.write("\n")
PY

if [[ "$mode" == "--dry-run" ]]; then
  cat "$prepared"
  exit 0
fi

curl -sS -X POST https://soundiiz.com/go/import-playlist \
  -H "Content-Type: application/json" --data-binary @"$prepared" -o "$response"

python3 - "$response" <<'PY'
import datetime, json, sys

try:
    with open(sys.argv[1], encoding="utf-8") as handle:
        response = json.load(handle)
except Exception:
    print("ERROR: non-JSON response from Soundiiz API:", file=sys.stderr)
    print(open(sys.argv[1], encoding="utf-8").read()[:500], file=sys.stderr)
    raise SystemExit(1)

if response.get("status") != "success":
    print(f"ERROR: {response.get('message', response)}", file=sys.stderr)
    raise SystemExit(1)

expires = datetime.datetime.fromtimestamp(response["expiresAt"]).strftime("%Y-%m-%d %H:%M")
print(f"OK {response['nbTracks']} tracks")
print(f"link: {response['shareUrl']}")
print(f"expires: {expires}")
PY
