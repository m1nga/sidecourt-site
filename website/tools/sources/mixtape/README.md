# Playlist Builder — Get a Verified Playlist You Can Actually Import

**Your own playlist, made by your AI.**

Everyone's library is full of playlists made by strangers and algorithms. Mixtape is
an [agent skill](https://www.thepromptindex.com/how-to-use-ai-agent-skills-the-complete-guide.html)
for **Claude Code** and **OpenAI Codex** that turns a described mood, a handful of
seed songs, or your actual listening taste into a real playlist in your streaming
account — delivered as a one-click [Soundiiz](https://soundiiz.com) import link.
No platform API keys, no developer accounts.

> "Playlist for cooking on a Friday night, city pop, ~20 tracks, YouTube Music"
> → a numbered tracklist with an arc, and a link. Open → confirm → it's in your library.

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
| Spotify, YouTube Music, YouTube, Deezer, Tidal | ✅ preselected |
| Apple Music | one extra tap on the import page |

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

Apple catalog confirmation checks recording identity in the selected storefront.
It does not prove Spotify, YouTube Music or another destination will match every
track. The local fingerprint detects tracklist edits after that check; it is not
a cryptographic signature or independent attestation. Final delivery still needs
the destination import result and, for revisions, the library read-back.

The 15 bundled offline tests passed on 2026-09-07 (Asia/Shanghai), including wrong-artist
rejection and exact-ID reconciliation. Run `python3 -m unittest discover -s tests -v`
from the installed skill directory. This is fixture evidence, not a new live import.
