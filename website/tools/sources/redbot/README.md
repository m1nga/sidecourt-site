# RedBot — Find the Good Thing You Saved

You saved something useful, but cannot find it when you need it. RedBot helps you choose **one relevant source, see the useful part and take a next step**.

**[Try RedBot on SideCourt](https://sidecourt.space/drops/redbot/) · [Open the app](https://sidecourt.space/drops/redbot/app/) · [User test](https://sidecourt.space/drops/redbot/test/)**

**Version 1.7 is an invitation-only account test.** Connect your own Xiaohongshu account, scan saved cards and read selected post text. Chinese-first interface with an English switch. The small test host must be online; full collection coverage and same-phone QR sign-in are not yet verified.

## Who it's for

People who collect design references, methods or tools and then struggle to decide what to use. Use the web app for your own saves. Use the companion skill inside an authorized AI assistant for a selected post, supplied notes or a RedBot backup.

## Start with your account

1. Open the app, choose **连接小红书 / Connect Xiaohongshu** and enter the invitation you received from Ming.
2. Review how the test stores your data. Scan the login code with Xiaohongshu and confirm in that app.
3. RedBot scans your saved-card list and shows the count, time and partial coverage. You do not need to upload files or copy cookies.
4. Describe what you want to do in **现在想做 / For now**, or browse **我的收藏 / My saves**.
5. Open a relevant save and choose **读取这篇正文 / Read this post**. A list scan does not read every post or video.
6. Read the useful text, inspect cost/promotion cues, save a plan or create an editable prompt for your project.

An invitation opens a test slot; a separate random session credential protects each visitor's data. The default host supports three simultaneous sessions. No invitation? Original example notes let you try the interface without signing in. Manual JSON backup is a recovery option.

## What it does

| Need | What RedBot does |
|---|---|
| Too many saves to choose from | Starts with a goal and one supported suggestion |
| Cannot remember the exact words | Optional on-device multilingual semantic matching |
| Do not know which part matters | Shows a bounded extract of text already retrieved |
| “Free” may have conditions | Quotes cost/promotion cues and can check public GitHub facts |
| Want to use an idea in a project | Builds an editable, source-grounded Codex or Claude Code prompt |
| Want to continue later | Keeps a plan and personal notes in this browser |
| Want to organize | Search, topics, collections, favorites, read state, archive and recoverable trash |

A cue is not a fraud verdict. A public repository or MIT license does not prove zero API costs, all dependency terms or working functionality. GitHub lookup sends only identified repository names; ordinary network request information still reaches GitHub. Errors remain unverified.

Prompts include your goal, the selected evidence, unresolved checks, a default $0 spending limit and acceptance requirements. Chinese interface produces Chinese instructions; the target project's language rules still apply. Personal notes are excluded unless selected. Copying a prompt does not launch an assistant or execute code.

## Install

~~~sh
npx skills add m1nga/redbot
~~~

Then ask your AI assistant:

~~~text
Use $redbot with /path/to/my-redbot-backup.json.
My goal is to make the first task in my app easier to understand.
Choose one saved source, show the useful passage and give one next action.
~~~

Or select a post already accessible through your own authorized connector:

~~~text
Use $redbot to summarize this saved post. Check which “free” conditions
matter for my project, then prepare a small implementation brief.
Keep unread comments and video steps explicit.
~~~

The skill checks available tools and the actual account before retrieval. It can use supplied material without forcing a new installation. The Python reader returns a bounded lexical shortlist, then the host assistant reads the chosen item. Installing this skill does not install an account service or grant access to someone else's library.

For an explicitly selected, running legacy Mac app:

~~~sh
python3 /path/to/installed/redbot/scripts/read_library.py --live --query "first task"
~~~

This reads that Mac's localhost service. A phone's localhost is not your Mac. Missing service or file: use selected notes or a compatible backup; no hidden remote access.

## Example

You ask: “The screen feels busy; make the main action clearer.”

A saved layout passage can suggest reducing emphasis on competing controls, followed by a small action: adjust one section and compare it at the same screen width. The optional original example demonstrates this flow; it is not a user testimonial or conversion result. If the source is title-only, RedBot asks to read it before describing its method.

## What sync means

This is an unofficial browser connection built on [xiaohongshu-mcp](https://github.com/xpzouying/xiaohongshu-mcp), not official favorites OAuth. Each visitor has a separate process, cookies, identity check and library. The adapter exposes login, saved-card scanning and selected text reads only; no posting, likes, comments or native collection changes.

Scans stop at bounded limits: 2,000 observed cards, 100 scroll steps or a 150-second page timeout. Every result remains marked partial. Interrupted current scans can recover private checkpoints; the next scan starts at the top and deduplicates. Old saves absent from a scan remain intact.

When enabled, opening the app checks the connection and a visible page can scan every 15 minutes. Closing it stops new scans; a started job may finish. No source webhook or always-on background scheduler is implied.

**Scanning and deduplication use no LLM calls.** Optional semantic search runs locally after a roughly 120 MB model download plus runtime and matches up to 300 entries. It uses bandwidth, memory and battery. Asking an AI assistant to reason over a library consumes that assistant's usage. The webpage does not generate new AI summaries, read comments or transcribe videos.

## Privacy and recovery

The invitation test stores separate login sessions and retrieved text on Ming's host for up to seven days. Remote access is forwarded through Cloudflare; local access stays local. Host downtime prevents new sync. Disconnect deletes that session's server data and keeps a device copy for export.

Personal notes, plans and organizing choices stay in this browser's IndexedDB. Account libraries and old device libraries are separate. Export JSON through **设置与我的数据 / Settings and my data** before switching devices or clearing storage. No automatic phone-to-computer note sync.

Semantic matching downloads Transformers.js 3.8.1 and the multilingual MiniLM model pinned to revision 2c4055b12046f11709e9df2c122e59ffbdc2f900. Hugging Face and jsDelivr receive ordinary asset requests; saved text is processed on device rather than sent to an inference API. Basic matching remains available if loading fails.

Never post backups, cookies, access tokens or login codes in public issues. Feedback downloads only what you type and is not sent automatically.

## Run your own test host

The distribution includes [application source](source/README.md), the adapter, its tests and a pinned upstream patch. See [connector provenance and build steps](source/connector/UPSTREAM.md). Binary/browser dependencies are not bundled. Use a new private runtime directory and your own endpoint configuration; never attach public visitors to an existing personal MCP.

The previous native Mac package is a separate build and is not updated by this web release.

## Validation

[BETA-VALIDATION.md](BETA-VALIDATION.md) records automated tests and builder trials. One real sign-in returned 289 cards; a repeat scan introduced no duplicates. An interrupted scan recovered, one selected post's caption was retrieved, and a 390-pixel browser layout was checked. These do not prove all favorites were found, the video was watched, two real accounts were isolated, or an unaided user can finish.

Same-phone QR login, distinct real-user isolation, independent user trials and production uptime remain unverified. This is a small invitation test, not a production sync service.

## Moving from GitHub Pages

SideCourt is the product's primary home. Earlier GitHub Pages and starter links retain a non-deleting export bridge. Export from the old origin, keep the backup, then restore it in SideCourt's **Settings and my data**. Verify saves, notes and plan before removing anything. Website storage does not move automatically.

## Why

The owner already had categories but still did not know which save to open. The two main destinations—what you want to do and your saves—keep the choice small. Account connection removes manual export from the everyday setup. Source coverage stays visible so a tidy result never pretends to have read more than it has.

## Search visibility

SideCourt pages provide descriptive text, real steps, limitations and canonical metadata matching the implemented product. Internal semantic retrieval is separate from external SEO/GEO. Crawlable content does not guarantee indexing, ranking, AI citations or customers.

## Author

Built by [Ming](https://sidecourt.space/people/m1nga/). Original RedBot code and skill are MIT licensed; the upstream source connector is Apache-2.0. Dependencies retain their own terms. Saved content belongs to its creators.

After trying RedBot, [browse what people are making on SideCourt](https://sidecourt.space/drops/). You can share something you made and describe the feedback that would help you use it better.
