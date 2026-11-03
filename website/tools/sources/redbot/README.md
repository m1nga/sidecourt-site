# RedBot — Find the Good Thing You Saved

You remember saving something useful. Now you need it, but cannot remember which post it was or which part matters. Tell RedBot what you want to do. It helps you find **one useful source, the relevant passage and a next step**.

**[Try RedBot on SideCourt](https://sidecourt.space/drops/redbot/) · [Open the preview](https://sidecourt.space/drops/redbot/app/) · [Five-minute user test](https://sidecourt.space/drops/redbot/test/)**

**Version 1.6 is an interaction preview.** Connecting your own Xiaohongshu account is being built. The public webpage cannot sync your account yet. Its original example notes let you try the experience without uploading anything.

## Who it's for

People who save ideas for later and then struggle to find something useful when they need it. Open the mobile webpage to try the interface. Use the companion skill when you already have saved notes or a RedBot backup that you want your AI assistant to work with.

## Start with the preview

1. Open RedBot and choose **Try with example notes**. Examples are added only when you ask, and do not replace your existing library.
2. Describe a need, such as “Make my page less cluttered.” A rough description is enough.
3. Read one suggested starting point, the saved passage behind it and a concrete next action. Open the original source when you need more context.
4. Choose **Save for later** to leave a plan you can continue next visit. **Try another** changes the recommendation; if nothing supports a choice, RedBot says so.
5. Choose **Short version & use** for a short extract, cost/promotion cues and an editable prompt for Codex or Claude Code. Try “Check a free AI tool before trying it” for a clearly fictional practice example.
6. **My saves** is there when you want to browse or search the whole library. Organizing and backups are secondary controls.

Optional **Search by meaning** downloads a multilingual model and runs it on your device. Basic matching works without this download or a new AI API key. Title-only sources remain **Needs reading**; a saved link is not evidence that RedBot has read the post or watched its video.

The intended everyday setup is connect your account, bring in your saves, then ask for what you need. Manual import remains a backup/recovery route, not the planned primary onboarding. The present public preview has no account service. An existing local Mac connector can report its sign-in state and run a bounded scan; that is not a complete or isolated public account connection.

## What it does

| Need | Available now |
|---|---|
| Too many saves to choose from | A goal, one clarification when needed, one supported starting point |
| Cannot remember the exact words | Optional on-device semantic retrieval over saved text |
| Do not know which part to read | A saved passage, note or time anchor next to its source |
| Reading never turns into doing | One next action; editable source-grounded Codex or Claude Code prompt |
| A “free” tool may have strings attached | Quoted wording cues, explicit unknowns and optional live GitHub repository facts |
| Too much text to reread | A bounded short extract with notes/text/video/comment coverage stated |
| Have to start again next visit | A saved plan and notes in the same browser |
| Want to browse or organize | Search, collections, favorites, read status, archive and recoverable trash |
| Want help inside an AI assistant | A read-only companion skill for an authorized backup or local Mac library |

The web app retrieves existing text and curated guidance; it does not generate an answer from unseen content. Semantic search covers up to 300 current saves and methods and can miss or misrank results. A relevant topic alone is not enough to support a recommendation.

## Install

Start from the [SideCourt skill page](https://sidecourt.space/skills/redbot/) or install directly:

```sh
npx skills add m1nga/redbot
```

Then ask your AI assistant:

```text
Use $redbot with /path/to/my-redbot-backup.json.
My goal is to make the first task in my app easier to understand.
Choose one saved source, show the useful passage and give one next action.
```

You can also supply selected notes. The bundled Python reader returns a short lexical shortlist; the assistant reads the selected full item and reasons from that evidence. The host assistant's account, privacy settings and permissions apply. This skill does not connect an account or grant access to somebody else's library.

For an explicitly selected, running local Mac app:

```sh
python3 /path/to/installed/redbot/scripts/read_library.py --live --query "first task"
```

This reads the Mac's localhost service. A phone's localhost is not your Mac. If the file or service is unavailable, provide selected notes or a compatible backup instead; there is no automatic remote access.

## Example: a goal to an action

You ask: “The screen feels busy; I need the main action to be obvious.”

The original layout example can supply a passage about competing headings and controls, followed by an action: change the emphasis in one section and compare it at the same viewport. This is illustrative guidance, not evidence of improved conversion. If only a saved title exists, RedBot shows that it needs reading instead of inventing a passage.

## Check a claim, then use the method

Open **Short version & use** on a save or recommendation. The short version is an extract of existing text or notes, not a newly generated AI summary. Expand the wording cues to inspect free claims, payment conditions, promotion and strong promises. Cues identify what to check; they do not decide whether a project is fake.

**Check GitHub now** retrieves public license, archive status and last-push facts for up to three identified repositories. Only repository names are sent to GitHub; GitHub receives ordinary network request information. No post text, account login or API token is sent. Errors and rate limits remain unverified. These facts do not establish current pricing, every dependency's license or working functionality.

Edit the useful method and your project goal, choose Codex or Claude Code, then create and review the prompt. Copy it or download it as text. It carries the selected evidence, unresolved checks, a default $0 budget and acceptance requirements. Personal notes are excluded unless you choose to include them. Creating a prompt does not launch an assistant or execute code.

Inside an authorized AI assistant, the companion skill can also summarize a selected post, answer a specific question, and inspect available comments for clarifications or counterexamples. It reports what was actually read. The webpage does not fetch comments or silently use the developer's source account.

## Privacy and account limits

Your public-preview library stays in this browser's IndexedDB, with a local-storage recovery fallback. It is not automatically synchronized with your other devices. Clearing browser storage may remove it; export a backup from **My data and settings → Library & backups** first. The example notes are original demonstration material, not the developer's personal collection.

Semantic retrieval uses Transformers.js 3.8.1 and `Xenova/paraphrase-multilingual-MiniLM-L12-v2` at revision `2c4055b12046f11709e9df2c122e59ffbdc2f900`. The first model download is roughly 120 MB plus runtime. Hugging Face and jsDelivr receive ordinary asset requests, such as IP/browser information; saved text is processed on your device rather than sent to an inference API. An older phone or restricted network may fail to load it. Basic matching remains available.

The app shell and model assets may be cached. Offline behavior and installation vary by browser. Do not post private backups, cookies or credentials in GitHub issues. The feedback page downloads only the answers you enter; sharing them is your choice.

## What is not available yet

- Public, isolated Xiaohongshu sign-in, complete collection enumeration and same-phone account authorization.
- Automatic reading or transcription of every post and video.
- Cloud synchronization, shared libraries, scheduled reminders or paid video generation.
- Browser-generated AI summaries or automatic comment reading, verified retrieval accuracy across large libraries, or guaranteed search visibility.

Before a source-connected beta can be called ready, it needs a fresh user's real account flow, reliable continuation of partial scans, preserved notes and plans, and demonstrated separation between users. Connecting an API by itself does not prove these behaviors.

## Moving from GitHub Pages

SideCourt is the product's primary home. Browser storage belongs to its original website and does not move automatically. The earlier GitHub Pages address offers an export of the library stored there. Keep that original backup, open RedBot through SideCourt, and import it through **Library & backups**. Confirm the saves, notes and plan before removing anything. The migration page never uploads or deletes the original library. Legacy starter links remain migration entry points.

## Why

The original problem was not a lack of categories. The owner had organized saves and still did not know what to open. RedBot starts with the current need and makes the next choice smaller. The 1.6 interface keeps two primary destinations, **For now** and **My saves**, with source evidence beside the suggested action. Organizing is available when needed, rather than being the first task.

## Validation

[BETA-VALIDATION.md](BETA-VALIDATION.md) records actual automated and builder-operated checks, including mobile-width navigation and saving a plan across a reload. These are not independent user research, proof of a working public account connection, sales or market demand. Physical phone testing and unaided trials with new users remain necessary.

## Search visibility

The SideCourt pages provide crawlable descriptions, concrete steps, examples, limitations, authorship and canonical metadata that match this preview. Internal semantic search is separate from external SEO/GEO. [Google's AI-feature documentation](https://developers.google.com/search/docs/appearance/ai-features) says its ordinary search practices still apply. Metadata does not guarantee indexing, ranking or AI recommendations.

## Author

Built by [Ming](https://sidecourt.space/people/m1nga/). Application and original skill source are MIT licensed. Transformers.js and the embedding model retain their own upstream licenses and notices. Third-party saved content belongs to its creators.
