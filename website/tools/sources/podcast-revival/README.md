# Podcast Video Maker — Turn Source Material into a Directed Conversation

## What it does

Give your agent a video, notes, a script, or mixed source material. Tell it how long the conversation should be, how it should sound, and which questions or viewpoints matter. Podcast Revival helps the agent prepare a source-grounded script and make its voiced video with a local, recoverable media runtime. Reuse a permitted existing recording when arranging another recording session is the main obstacle. The new source-video route preserves the recorded scene and motion while generating revised lip movements, with an explicit AI disclosure.

## Who it's for

Use it when you want a voiced video conversation from source material, with a specific length, attitude or editorial question. An existing recording can become a carefully attributed continuation; notes can become a new scripted discussion. For a transcript or summary alone, use a simpler transcription or writing tool.

## Install

```bash
npx skills add m1nga/podcast-revival
```

Then ask naturally:

> Use $podcast-revival to turn these notes into a three-minute discussion. Keep a curious, skeptical tone, compare both explanations, and end with what the evidence cannot tell us.

The skill needs a capable local agent, Python 3.10+, FFmpeg with H.264/AAC and drawtext font support, internet access for setup/provider calls, and your own fal account/key. The release was exercised on macOS; Linux is intended but not release-tested. Installing the skill does not include hosted generation credits. The agent handles setup; you do not need to write JSON or operate a command line after installation.

## What you receive

A finished run produces the actual video, its matching audio track, the script and source references, and an honest status/cost report. Existing-video work keeps source timestamps and speaker attribution. New text or mixed-material work starts from the requested editorial direction and an explicit speaker/voice plan.

The host agent performs material analysis, research, writing and review. The bundled runtime handles supported media steps, current prices, budget reservations and recovery. It does not independently turn arbitrary material into a complete episode without an agent, and it does not impersonate a person's endorsement.

## Continue a recording at lower cost

> Use $podcast-revival to continue this permitted interview for twenty minutes. Keep the speakers’ existing voices, investigate the unanswered question, and cap this run at $10. Reuse the source motion and label the video as AI-generated.

The agent prepares distinct single-speaker shots, a reviewed speaker-mapped script and existing permitted voice IDs, then selects `output_mode: "lipsync"`. The bundled route freezes speech, adds a short protection tail, sends the exact driver to LatentSync, checks complete audio coverage, trims only a verified quiet tail and assembles a labeled MP4. It keeps a ledger and resumes original jobs without duplicating unknown submissions. See the [input and recovery contract](https://github.com/m1nga/podcast-revival/blob/main/skills/podcast-revival/references/lipsync.md).

At the [LatentSync quote](https://fal.ai/models/fal-ai/latentsync) checked on 2026-10-24, twenty 60-second turns reserve $6.20 for video; sixty reserve $18.60. Speech synthesis, initial voice enrollment, any billed failures, host-agent work and hosting are extra. These are planning examples, not all-in prices or measured episode costs. Many short turns raise costs because every video request has a 40-second minimum. The runtime checks current account prices and enforces the authorized run cap.

The tradeoff is visible: recorded gestures and camera movement repeat. This is not a newly acted full-body performance. Every source shot must contain exactly one visible face for its entire duration; a single speaking voice over a two-face shot is insufficient. The CLI requires a review declaration but does not automatically count faces. Human or model inspection of actual mouth movement, likeness and seams is still necessary.

## Limits and spending

Use material and voices you have permission to process. Explicitly authorize a total budget before paid media. The runtime keeps uncertain submissions reserved until the original request is reconciled; a timeout is not a reason to pay for a duplicate. Keys stay in a supported local store or process environment, never in the browser or production brief.

Private generation does not authorize public publication. Text and mixed-material jobs use the single-language production route after the agent prepares and reviews the script. Stock voices are synthetic presenters, not a recreation of the original author; existing custom voices require permission evidence.

## Design notes

Source preservation, editorial direction and media generation have different responsibilities. Keeping a brief, evidence, exact script review and frozen audio separate makes a revision traceable and lets a failed step resume without discarding completed work. A versioned wheel supplies the media runtime; the skill does not carry a second editable fork.

## Validation

Release 0.3.0 binds its runtime wheel by version and SHA-256 in `assets/runtime.json`. The core passed 116 local tests, including seven new source-video tests using a fake provider and real FFmpeg. They exercise complete audio coverage and shortened protection tails, minimum billing, retained unknown submissions, upload reuse, changed-driver rejection, single-speaker declarations and multiple-speaker source isolation.

The exact wheel was installed with dependencies into a fresh directory outside the source repositories. Installed CLI brief/default-production/stale-review checks and all seven new local media tests passed there. Four separate bootstrap tests cover installation/reuse, missing or modified wheels, and preservation of an unowned directory. These release checks made no paid generation calls. They verify pipeline behavior and recovery, not full-episode perceptual quality, human preference or a universal model winner.

## Author

Built by [Ming](https://github.com/m1nga). Runtime and skill behavior are maintained together; user materials, private scripts and provider receipts remain outside this public package.
