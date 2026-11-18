---
name: mixtape
description: Make the user an authored playlist and check its recordings in Apple Music and deliver a Soundiiz import link for Apple Music, YouTube Music, Spotify, Deezer, or Tidal without platform API keys. Supports quick orders from a scene or mood, expansion from seed songs, and taste-profile curation from playlists the user shares. Use for "make me a playlist," "songs for late-night coding," 给我来个歌单, 根据这几首帮我扩展, 找类似的歌, 分析我的听歌口味, or any request for songs to listen to. Not for audio narration, transferring an existing playlist unchanged, or controlling playback.
---

# Mixtape · 亲手做的歌单

Everyone's library is full of playlists made by strangers and algorithms. A mixtape
is different: it is *authored*. The user brings the taste; you are the hands that do
the hours of searching, matching, and arranging they never have time for. Everything
below serves that one feeling — "this playlist is MINE" — so never pad with generic
chart hits when the request implies specificity, and always be able to say why a
track earned its slot.

Reply in the user's language. Playlist titles should sound like something the user
would name, not like an algorithm ("周五晚·华语摇滚快车", not "Chinese Rock Mix #1").

## State: ~/.mixtape/

Persistent memory lives outside this package in `~/.mixtape/` (create it and the
files on first use):

| File | Holds | Touch when |
|---|---|---|
| `taste.md` | 平台默认 · 硬性偏好(语言/年代/风格) · 细读发现(制作/人声/能量) · 挚爱曲目与艺人 · 雷区 | Read before EVERY generation; update after profile analysis or feedback |
| `history.md` | One section per mixtape: date, title, mode, platform, tracklist, feedback | Append after every delivery |
| `misses.md` | Tracks that failed to match on a platform: `- 歌名 — 艺人 (平台, 日期)` | Read before generating (avoid repeats); append when user reports 缺歌 |

The profile is what makes the agent smarter over time. A one-line update after each
session beats a perfect schema. Two rules keep it honest: what the user says *now*
always beats what the files remember (update the file, don't argue), and a single
scene order is not taste evidence — a first-time "City Pop for cooking" records the
platform default, not "likes City Pop".

## Pick the mode

| Signal in the request | Mode |
|---|---|
| A scene/mood/genre described in words ("健身摇滚", "深夜写代码") | **快速点单** — generate directly |
| Example songs given, possibly grouped ("我喜欢的朋克是这几首、英伦是这几首") | **种子扩展** — anchor on the examples |
| User shares existing playlists, or asks 分析我的口味 / "what do I actually like" | **口味档案** — analyze first, then curate |

Modes stack: a quick order from a user with a taste profile on file should still be
filtered through that profile.

**快速点单.** Parse genre, scene, mood, era, language, count, platform. Default 25
tracks. Ask at most one clarifying question, and only if the answer would genuinely
change the songs; otherwise decide and go — the import page is itself a preview, so
a wrong guess costs one click, not a conversation.

**种子扩展.** The examples are evidence of what the user *actually* means by a genre
word. For each group, state in one line what you infer the seeds share (era?
production? vocal style? energy?) — this shows your reasoning and lets the user
correct it cheaply. Then generate neighbors per group, keeping the groups'
proportions. Include the seeds themselves unless asked for all-new songs; a
requested count is the total *including* seeds. Seed artists may recur, but keep
them under about a third of the list — expansion should widen the circle, not loop
it. Weave the groups into one arc rather than leaving them as contiguous blocks,
unless the user asks for separated chapters.

**口味档案.** Ingest whatever the user can give: pasted track lists, an exported
file, a public playlist URL (fetch it), or walk them through Soundiiz's export to
text. Look past the user's own label — they may say 抒情, but what the tracks
actually share might be "90s 港台 production + male falsetto + piano intros". Write
the findings to `taste.md`, then curate playlists that blend **已听过的挚爱 (~40%)**
with **没听过但相邻的发现 (~60%)** — ratio adjustable, and tag which is which when
presenting so the user sees both comfort and discovery.

## Generation rules

- **Real songs only.** Every track must be a real, released recording. The bar for
  "sure": you could name the album or era it came from. Below that bar, verify with
  a web search — an invented song silently becomes a wrong match on import, which
  is worse than one fewer track.
- **Canonical form matches best**: main title + the real artist credit. Keep
  collaborating artists as separate values in the `artists` array; drop "feat.",
  "(Live)", and "(Remix)" qualifiers unless the user wants that specific version.
  For non-Latin catalogs, use the form streaming platforms dominantly list
  (Japanese/Chinese titles usually stay in the original script).
- Check `misses.md`; don't re-recommend a track that already failed on the target
  platform.
- **Order is authorship.** Arrange an arc that fits the scene: workout ramps up,
  late-night descends, 通勤 stays level. A shuffled list is a search result, not a
  mixtape.
- ≤200 tracks per link (API cap). More → split into volumes (Vol.1, Vol.2), one
  link each, mind the 10 requests/min rate limit.

## Delivery

1. Show the numbered tracklist in chat (with 已听/新 tags in profile mode, and the
   one-line group inferences in seed mode).
2. Write the payload to a JSON file in the session scratchpad (or any temp dir):
   ```json
   {"title": "...", "description": "...", "sourceName": "Mixtape",
    "tracklist": [{"title": "...", "artists": ["...", "..."]}]}
   ```
3. **Canonicalize before posting**: `python3 <skill-dir>/scripts/canonicalize.py
   payload.json --country <storefront>`. The script verifies title **and artist**,
   rejects wrong artists and unwanted versions, rewrites confirmed tracks to the
   Apple catalog's displayed metadata, and writes an evidence report. It exits
   nonzero when any track is unconfirmed; replace those tracks and rerun. Use the
   user's storefront country (record it in `taste.md`, e.g. GB).
   If free-text search misses a song but an official Apple Music song page proves
   it exists, add its numeric URL ID as `"appleMusicId": 1702056850` on that track
   and rerun. The script looks that ID up in the target storefront and still
   verifies its title+artist; this is evidence, never a bypass.
   Apple confirmation covers recording identity in the named storefront. The
   fingerprint detects later track edits. Destination matches require their own
   evidence from the transfer result or destination library.

4. POST only the fingerprinted canonical file: `bash
   <skill-dir>/scripts/post_playlist.sh payload.canonical.json`. The poster refuses
   unverified or post-verification edits, strips internal evidence metadata, and
   sends Soundiiz its documented `artists` field. **Never send `artist` (singular):
   Soundiiz accepts the request but ignores that field, leaving it to match by title
   alone.** The script prints the import link and expiry on success.
5. Hand over the link with: 有效期 24 小时;打开 → 确认目标平台 → 导入。That
   confirmation click doubles as the user's preview/veto step — do not try to
   automate it away.
6. In the handoff, give three short statuses: **Apple catalog** (storefront
   and confirmed count), **Import link** (ready with expiry, or unavailable),
   and **Destination library** (awaiting confirmation, reported by the user, or
   directly verified). With a receipt, report the matched count and any wrong
   version or missing track. Without one, keep the destination pending. If the
   user shares a receipt later, compare recording identity and count before
   labeling the playlist complete. For a saved YouTube playlist, compare the complete
   ordered native recording IDs using the read-back route below. A temporary queue
   or a source accepted count does not prove that the full playlist was saved.
7. For an iteration, finish the platform-side reconciliation below after the
   import succeeds. A new import link is an implementation detail, not permission
   to leave duplicate or version-numbered playlists in the user's library.

**Destination preselect** (`destination` field): verified corenames `spotify`,
`ytmusic` (YouTube Music), `youtube` (plain YouTube video playlist — prefer
`ytmusic` when the user says "YouTube" but means music), `deezer`, `tidal`.
Use `applemusicapp` for Apple Music, as documented by the
[public import API](https://support.soundiiz.com/hc/en-us/articles/36613501259922--API-Let-your-users-import-any-tracklist-to-Soundiiz).
If the user asks for either Apple Music or Spotify, asks to choose during import,
or has no platform preference, omit `destination`. Soundiiz then lets them
choose any eligible service. An explicit choice to decide later takes precedence
over a saved preference. Remember an explicitly selected platform in `taste.md`.

## YouTube saved playlists

Pin each chosen recording to an observed YouTube video ID. Check its artist,
version and approximate duration. Copy the canonical payload to `youtube.json`,
add a `youtubeVideoId` to every track, and retain the approved order and catalog
fingerprint. The fingerprint covers titles and artists, not independent proof of
the added YouTube identities; retain the source of those choices with the manifest.

```bash
python3 <skill-dir>/scripts/youtube_playlist.py youtube.json --write-urls tracks.txt
python3 <skill-dir>/scripts/youtube_playlist.py youtube.json --playlist-id PL...
```

The first command writes one exact watch URL per line to a new file for
Soundiiz → Import Playlist → From Plain Text. Review the selected entries and the
destination (YouTube or YouTube Music). The normal Soundiiz POST matches titles
and artists; the local video IDs identify the YouTube recordings expected later.

A `watch_videos?video_ids=...` link is a temporary playback queue, not a saved
playlist receipt. Obtain the saved playlist's own `PL...` ID. If an authorized
Google OAuth read connection is available, supply its token through the runtime's
`YOUTUBE_ACCESS_TOKEN` environment variable. Keep tokens out of messages, files and
command arguments. Do not ask the user to paste credentials into chat.
The second command reads all pages using [YouTube's playlistItems API](https://developers.google.com/youtube/data/reference/rest/v3/playlistItems/list)
and checks sequence and count. Exit 0 means a match, 1 means mismatch, and 2 means
read-back is blocked. Without a supported authorized connection, retain that gap
and let the user inspect the saved playlist; do not invent a successful read.

If only one of twelve tracks arrived, retain the intended twelve and the existing
playlist. Report missing recordings and complete an authorized repair or supply
the full URL list for import. Read back again before reporting verified completion.

## Iteration: one living playlist with a stable identity

A revision is never a patch, a restart, or a second product. Start from the
previous tracklist in `history.md`, keep every track the user has not vetoed, and
apply swaps, ratio changes, or extensions to the complete list. The user's
confirmed-loved tracks are the asset being built.

Keep the accepted user-facing title stable across revisions. **Never add v2/v3/v4,
“修复版”, or similar release bookkeeping to the title in the streaming library
unless the user explicitly asks for it.** Record revision numbers and lineage only
inside `history.md`. If direct in-place editing is unavailable and Soundiiz must
create a replacement, that replacement is temporary until the library is
reconciled: the user should end with exactly one current playlist under the stable
title, not a stack of versions and not a patch playlist.

After the replacement import succeeds:

1. Read the platform library and resolve the retained playlist plus every
   Mixtape-managed predecessor by exact platform ID, current name, and track count.
2. Preserve unrelated playlists even when their names look similar. Never delete
   by a fuzzy title search or by an unresolved variable/glob.
3. Check the retained playlist has the expected complete track count, rename it to
   the stable title, and delete only the explicitly resolved predecessor IDs.
4. Read the library again. Completion requires one playlist with the stable title,
   the expected track count, and no predecessor IDs. Log this receipt in
   `history.md`; do not claim success from the mutation call alone.

On macOS Apple Music, use the guarded helper rather than hand-written destructive
AppleScript:

```bash
python3 <skill-dir>/scripts/reconcile_apple_music.py inventory
python3 <skill-dir>/scripts/reconcile_apple_music.py reconcile manifest.json
python3 <skill-dir>/scripts/reconcile_apple_music.py reconcile manifest.json --apply
```

Manifest shape:

```json
{"stableTitle":"跑步",
 "keep":{"id":"6073","expectedName":"梦想感起跑 v4","expectedTrackCount":33},
 "delete":[{"id":"6059","expectedName":"梦想感起跑 v3","expectedTrackCount":8}],
 "protect":[{"id":"5334","expectedName":"I wonder if you know","expectedTrackCount":1}]}
```

It names the stable title, retained ID/name/count, and exact predecessor
IDs/names/counts. Add must-not-change playlists to optional `protect`; they are
checked before the plan and reported unchanged in the final receipt.
Reconciliation is dry-run by default; `--apply` refuses stale names, wrong counts,
unmanaged title collisions, or an ID listed in conflicting roles, then prints a
verified read-back receipt. Use another authorized platform API/connector for
other services with the same preflight → mutate → read-back contract. If no
authorized write surface exists, say so plainly and leave the reconciled state
unclaimed rather than telling the user a duplicate is “the new version.”

## After the import (lightweight, never nagging)

One line when delivering: 导入后如果有没匹配上或踩雷的歌，说一声。When they report:

- **缺歌** → append to `misses.md`; repair the matcher or replace the failures in
  the next complete iteration. A top-up link is allowed only when the user
  explicitly asks to manage a patch separately.
- **踩雷** → record to `taste.md` 雷区 with the *reason* if given (太吵? 年代不对?).
- Log the mixtape to `history.md` either way.

## When things break

- Tracks still 未找到 on import despite canonical names → treat it as a failed
  delivery, not user cleanup. Re-check the target storefront, replace or pin the
  unresolved catalog IDs, regenerate the **complete** fingerprinted playlist, then
  reconcile it back to the stable platform identity. Do not default to a top-up
  fragment.
- `Too many requests` → wait 60s, retry once.
- API error or format change → deliver the ordered tracklist as one
  `Artist - Title` entry per line. Give the [Soundiiz plain-text import steps](https://support.soundiiz.com/hc/en-us/articles/37958924057234-How-to-Import-a-Playlist-from-a-URL-CSV-File-or-Plain-Text)
  and keep the import link and destination statuses separate. The manual route
  still needs the user's confirmation and a destination match check.
- Free Soundiiz converts one playlist (≤200 tracks) per transfer — normal personal
  use never hits this; only mention limits if the user does.
