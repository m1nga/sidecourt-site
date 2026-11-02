# AI Instruction Stress Test — Find Trigger and Behavior Failures Before Release

**Find out how your SKILL.md fails before a real session pays for it.**

Wind-tunnel testing for instruction text — skills, system prompts, CLAUDE.md rules,
agent definitions, plugin commands. It casts a small set of personas from your real
contexts, replays realistic utterances against the trigger surface alone, then walks
the body line-by-line per scenario and reports what actually happens. Every finding is
anchored to a line number; description problems come with a paste-ready rewrite.

## What it does

- Predicts selection from the target harness's pre-load metadata, commonly the
  name and description. Always-loaded prompts have no selection step; unknown
  loader behavior is stated as an assumption.
- Hunts named failure classes: false-fires, missed triggers, sibling-skill collisions,
  stale-world assumptions, silent failures (flows that "succeed" and deliver a wrong
  result), and stranger-usability gaps.
- Reports verdict-first: the first paragraph answers "would you ship this today, and
  what is the one fix."
- Stays read-only: it reports on the artifact, never edits it.
- Optionally emits `traces.jsonl` so failure clusters can feed an eval pipeline.

## When it fires

- "Probe this skill before I publish it."
- "Wind-tunnel this system prompt."
- "Will this description misfire on unrelated requests?"
- "I just rewrote my agent definition — stress-test it."
- 「帮我风洞一下这个 skill」
- 「这个 description 会不会误触?」

## Install

```
npx skills add m1nga/scenario-probe
```

## Reproducible simulation fixture

Authored illustration, not an independent agent run. Give the probe this complete
miniature instruction:

```text
description: Use when asked to summarize the provided meeting notes.
body: Summarize only the notes in three bullets. If notes are absent, request them.
      Do not invent owners, dates, or decisions.
```

Try “summarize these notes”, “uh, recap these meeting notes in three points”,
“translate this sentence”, and “summarize my meeting” with no notes. Expected
predictions: hit, hit, sleep, then request the missing input. Add any actual
co-installed sibling to check overlap; without its metadata, collision status is
unknown. If nothing else fails, zero findings is a valid bounded result.

## Longer example (illustrative)

> **You:** I rewrote the description of my `deploy-checklist` skill. Wind-tunnel it
> before I push.
>
> **Claude** casts four personas (you dictating on your phone, you mid-deploy, a fresh
> machine with no config files, a stranger who installed only this skill), writes nine
> utterances, predicts fires/sleeps from the description alone, then walks the body for
> each scenario that fires. The report opens: "Not yet — 'deploy' is claimed so broadly
> that this collides with your `release-notes` skill on 'prep the release', and the
> rollback section reads a file that does not exist on a fresh install, with no defined
> fallback." Each finding cites a line; the description fix is ready to paste.

## Works well with

- `claude plugin eval` — the probe's `traces.jsonl` is trace supply for products with no production traffic
  yet: failure clusters become grader criteria for an eval suite.
  Wind-tunnel → judge → calibration is a pipeline.
- [`product-experience-officer`](https://github.com/m1nga/product-experience-officer/) — the cousin seat.
  A runnable product with a UI gets PEO; instruction text gets scenario-probe. Both distinguish simulated predictions from observed execution; a supported
  zero-finding result is allowed.

## Design notes

This methodology was extracted from a real audit, not designed in the abstract. Before
publishing, it ran across a solo builder's private library of 23 skills — 140+
persona × scenario runs in one pass. That audit surfaced problems no single-skill
review had caught: systemic trigger-layer debt (descriptions written for the author's
own phrasing, so paraphrases slept), a family of silent failures (skills that reported
"saved" with nowhere to save, or invented numbers to satisfy a mandated output schema),
and split-brain copies (the same skill duplicated across two harnesses, drifted apart,
each copy auditing clean on its own).

Three opinionated choices follow from that audit:

- **Trigger surface first, body later.** Most findings were first-5-seconds failures —
  the wrong skill fired, or none did. Reading the body before predicting triggers
  contaminates the prediction, so the phases are ordered to make that impossible.
- **Personas come from the owner's real contexts, not a fixed checklist.** The
  highest-yield persona in the original audit was "the owner at their messiest" —
  dictated input, goal buried in the last sentence. A generic cast would not have
  included it. The stranger persona is mandatory only when publishing, because that is
  the moment it can change the verdict.
- **Check coverage without forcing defects.** If a clean simulation missed a
  meaningful boundary, recast once. Otherwise report zero findings, with real
  trigger selection and tool execution still unverified.

## Evidence

### Historical scenario probes (simulated)

Probed 7 scenarios across 4 personas · 3 fired correctly · 3 correctly stayed quiet · the 7th run was the probe auditing itself.

> **"帮我 stress-test 一下这个上线计划"** ("stress-test my launch plan") → stayed quiet. Plans are thinking-partner's interview mode; this skill only takes instruction text — and the exclusion lives in the description, where triggering actually happens.

> **"I just rewrote my CLAUDE.md commit rules — stress-test them before I rely on it."** → fired: cast four personas, predicted triggers from the description alone, then walked the rule body line-by-line per scenario.

> **"测一下这个产品"** ("test this product for me") → stayed quiet. Runnable products belong to product-experience-officer; the probe practices the boundary it preaches.

Run on its own SKILL.md, it flagged that its description sits 17 characters under the 1024 loader cap — with the NOT-clauses last in line to be truncated. It got the same treatment as everything else.

Probe method: [scenario-probe](https://github.com/m1nga/scenario-probe/)

## Author

Built and maintained by [Ming](https://github.com/m1nga).
