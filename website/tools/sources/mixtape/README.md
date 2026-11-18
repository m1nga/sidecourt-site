# Mixtape Playlist Builder — Build a Mood Playlist for Apple Music or Spotify

**Your own playlist, made by your AI.**

Everyone's library is full of playlists made by strangers and algorithms. Mixtape is
an [agent skill](https://www.thepromptindex.com/how-to-use-ai-agent-skills-the-complete-guide.html)
for **Claude Code** and **OpenAI Codex** that sequences a playlist around your
mood, seed songs, or listening taste. It checks the recordings against an Apple
Music storefront and gives you a temporary [Soundiiz](https://soundiiz.com)
import link. Choose Apple Music, Spotify, YouTube Music, or another supported
service in Soundiiz, or name one in your request to preselect it. Review the
tracklist and confirm the transfer there. Creating the link requires no platform
API keys. Saving requires a Soundiiz account and a connected music service, and
depends on service eligibility and plan limits.

Want the studio recording rather than a live version or cover? State that in the
request. Mixtape checks the selected recordings in the named Apple storefront,
then keeps the destination import pending until it has a receipt. Soundiiz
[documents why transfers can still choose another version](https://support.soundiiz.com/hc/en-us/articles/32567703886098-Wrong-Track-Matches-Causes-How-to-Fix-Them);
check the destination count and recordings after import.

> "Use $mixtape to make a five-song late-night electronic playlist. Start with
> 'A Walk' by Tycho, build gently, and finish somewhere quiet. Check the US Apple
> Music catalog and give me one link where I can choose Apple Music or Spotify."

One sample result, **Low Light, Steady Hands**:

1. Tycho — A Walk
2. Yppah — Never Mess With Sunday
3. Bonobo — Kerala
4. Four Tet — Two Thousand and Seventeen
5. Brian Eno — An Ending (Ascent)

| Check | Sample status |
|---|---|
| Apple catalog | 5 of 5 recordings confirmed in the US storefront |
| Soundiiz import preview | Soundiiz accepted all 5 tracks and opened the playlist preview without a preset destination |
| Destination library | Awaiting user confirmation and a transfer result |

Each Soundiiz import link expires after 24 hours. To try the same example, use
[the sample tracklist](skills/mixtape/examples/low-light.json) from a fresh
checkout of this repository. Run these commands from its root to check the catalog
and create your own preview link:

```bash
mixtape_preview=$(mktemp -d)
python3 skills/mixtape/scripts/canonicalize.py skills/mixtape/examples/low-light.json \
  --country us --out "$mixtape_preview/playlist.json" --report "$mixtape_preview/catalog.json"
bash skills/mixtape/scripts/post_playlist.sh "$mixtape_preview/playlist.json"
```

After import, compare the count and recording versions in your destination.
If the link fails, Mixtape can give you a paste-ready `Artist - Title` list for
[Soundiiz's plain-text import](https://support.soundiiz.com/hc/en-us/articles/37958924057234-How-to-Import-a-Playlist-from-a-URL-CSV-File-or-Plain-Text).

## What it does

Mixtape turns a mood, a few seed songs, or the playlists you already love into a
sequenced playlist you authored. Before it hands anything to Soundiiz, it checks
every title **and artist** against the selected Apple Music storefront, rejects
wrong covers/remixes/DJ-mix versions, and produces a catalog evidence report. A
fingerprint check then prevents unverified or subsequently edited tracklists from
being posted. Iterations keep one stable library identity: revision labels stay in
the private history, while the streaming playlist keeps its human title and
superseded Mixtape versions are reconciled away by exact platform ID.

That matching layer matters. A beautiful 33-track recommendation is still a broken
product when only eight songs arrive in the user's library.

## When it fires

- Describe a scene: “late-night coding, warm electronic, 90 minutes.”
- Give seed tracks: “these are the three kinds of rock I mean—expand them.”
- Share existing playlists: “work out what I actually like, then mix familiar songs
  with discoveries.”
- Report a failed import: Mixtape records misses, repairs the matcher, and updates
  one complete playlist instead of making you manage fragments or duplicate
  version-numbered playlists.

## Design notes

A mixtape is the opposite of an algorithmic playlist: it's *authored*. You bring the
taste; the agent does the hours of picking, matching, and sequencing you never have
time for. The goal is the feeling of "this playlist is MINE."

## Three modes

| Mode | Say something like |
|---|---|
| **Quick order** | "Make me a rainy-Sunday jazz playlist, 25 tracks, Spotify" |
| **Seed expansion** | "I like two kinds of rock — these 2 songs are one kind, these 2 are the other. Expand to 30." |
| **Taste profile** | "Here are my existing playlists — figure out what I actually like, then curate for me." |

The taste profile persists in `~/.mixtape/` (plain Markdown, stays on your machine).
Over time the agent blends songs you already love with adjacent discoveries — and
remembers what failed to match and what you vetoed.

## Install

Install the standalone skill with the Skills CLI:

```bash
npx skills add m1nga/mixtape
```

Or clone it directly for a specific agent:

```bash
git clone https://github.com/m1nga/mixtape.git ~/.agents/skills/mixtape
```

Then just ask for a playlist in a session — no command to memorize.

**Requirements**: `curl` + `python3` (present on macOS/Linux by default), and a free
[Soundiiz](https://soundiiz.com) account with your streaming platform connected
(that's where the import authorization lives).

## Supported destinations

| Platform | Import link preselect |
|---|---|
| Apple Music | `applemusicapp` |
| Spotify | `spotify` |
| YouTube Music | `ytmusic` |
| YouTube, Deezer, Tidal | `youtube`, `deezer`, `tidal` |
| Choose in Soundiiz | Leave the destination unset |

## How it works

The agent generates and sequences the tracklist (real, released recordings only —
it verifies when unsure), then checks every title+artist pair against the requested
Apple Music storefront. The canonicalizer writes the official display metadata, a
catalog evidence report, and a fingerprint. Only that fingerprinted payload can reach
Soundiiz's free, key-less Playlist Import API.

The Soundiiz contract is deliberately enforced at the last mile: its field is
`artists` (plural), as an array or string. Sending `artist` appears to work because
the endpoint accepts the JSON, but the artist is silently ignored and matching
falls back to the title alone. Mixtape migrates legacy payloads but never sends the
wrong field.

You get a link valid for 24 hours; the confirmation click doubles as your
preview/veto step. Limits: ≤200 tracks per link and 10 requests/min.

For Apple Music on macOS, the included reconciliation helper inventories the local
library, dry-runs an exact-ID plan, then (only with `--apply`) renames the retained
playlist, deletes explicitly named predecessors, and reads the library back. It
refuses stale names, unexpected track counts, and unrelated playlists that happen
to share the final title. Optional protected IDs are also checked and returned as
unchanged in the final receipt.

## Field-tested

The bug that prompted the strict pipeline was a two-hour running mix where only
8/33 tracks transferred despite Apple Music carrying almost all of them. The first
“fix” reported 0 unconfirmed but had actually changed `The Less I Know the Better —
Tame Impala` into a similarly titled song by ALB and `Raw Control — Discip` into a
DubMabs track. The revised matcher now rejects both cases, blocks the post, and
shows the catalog evidence needed to choose a real replacement. The verified
replacement imported all 33 tracks; the final read-back kept one 33-track playlist
named `跑步` and removed the two superseded managed versions.

## 中文说明

Mixtape 是给 Claude Code / Codex 用的歌单 skill：一句话描述场景（「周五晚做饭的
City Pop，20首」）、给几首种子歌，或让它分析你已有歌单；它负责选歌、编排、逐首
核对 Apple Music 曲库，再给出 Soundiiz 一键导入链接。它会同时校验歌名和歌手，
找不到或疑似错版就停止发布，不再让“33 首只进去 8 首”到最后一步才暴露。口味档案
存在本机 `~/.mixtape/`，越用越懂你。迭代时平台里的歌单名称保持不变，版本号只写进
内部历史；成功导入后按精确 ID 清理旧版，并回读确认只剩一个当前歌单。

## Notes

- Not affiliated with Soundiiz; uses their public Playlist Import API.
- Song selection quality depends on the model running the skill.
- Local taste files are not uploaded by the bundled scripts. Catalog lookups send
  song queries to Apple; Soundiiz receives the playlist title, description,
  destination and `{title, artists}` entries. Your agent provider also processes
  what you put in the conversation.

MIT © [m1nga](https://github.com/m1nga)

## What “verified” covers

For a saved YouTube playlist, a playback queue is insufficient evidence. Pin the
intended video IDs, export their exact URLs and compare the saved `PL...` playlist
against the full ordered list. The read-only helper reports missing tracks,
unexpected tracks and order changes. Private-library access requires an authorized
runtime token; without access, the check stays blocked.
See the [YouTube workflow](skills/mixtape/SKILL.md#youtube-saved-playlists).

The Soundiiz response count is also checked: accepting 1 of 12 tracks is a failure
even when the service labels its response successful. No live private playlist was
read or changed during this release.

On 2026-11-10, 23 offline tests passed, including partial acceptance, a one-track
saved result for a twelve-track intention, pagination, changed counts, order,
duplicates, missing authorization and protection of an existing URL export.
Provider responses in these cases are fixtures, not live destination receipts.

Apple catalog confirmation checks recording identity in the selected storefront.
It does not prove Spotify, YouTube Music or another destination will match every
track. The local fingerprint detects tracklist edits after that check; it is not
a cryptographic signature or independent attestation. Final delivery still needs
the destination import result and, for revisions, the library read-back.

The 15 bundled offline tests passed on 2026-09-07 (Asia/Shanghai), including wrong-artist
rejection and exact-ID reconciliation. Run `python3 -m unittest discover -s tests -v`
from the installed skill directory. This is fixture evidence, not a new live import.
