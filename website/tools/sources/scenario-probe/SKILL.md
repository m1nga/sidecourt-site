---
name: scenario-probe
description: Wind-tunnel any instruction text that configures AI behavior — a SKILL.md, system prompt, CLAUDE.md rule, agent definition, or plugin command — by projecting it into persona × scenario simulations before it ships. Derives personas from the owner's real contexts, predicts trigger decisions from the target harness’s pre-load routing metadata, walks the body line-by-line per scenario, and reports false-fires, missed triggers, sibling-skill collisions, stale-world failures, silent-failure paths, and stranger-usability gaps, each with line-anchored fixes. Use for "probe / wind-tunnel / stress-test this skill, prompt, or instruction", "will this description misfire?", 风洞 / 场景推演 / 会不会误触, or after writing/editing any SKILL.md or long-lived prompt. NOT for experiencing a runnable product with a UI (use product-experience-officer), NOT for interrogating a plan (thinking-partner's interview mode), NOT for evaluating model outputs (write an eval grader instead), NOT for unbuilt ideas (thinking-partner).
---

# Scenario Probe（场景风洞）

Instruction text fails in ways its author cannot see: it triggers on requests it was
never meant for, sleeps through the phrasing its owner actually uses, collides with a
sibling skill, or executes perfectly inside a world that no longer exists. This skill
finds those failures by simulation — before a real session pays for them.

The object is always **text that configures behavior**: a SKILL.md, a system prompt, a
CLAUDE.md standing rule, an agent definition, a plugin command. Never a running product
(that is product-experience-officer's seat) and never the model's outputs (that is the
evals pair's seat).

## The two working rules

1. **Predict from the actual pre-load routing surface.** Identify the metadata the
   target harness exposes before loading the body (often the name and description).
   Base Phase 1 on that surface alone; do not use body exclusions to repair a
   metadata-only prediction. If the harness is unspecified, state that assumption.
   A system prompt that is always loaded may have no selection step: mark triggering
   not applicable and test its behavior. Do not assume every engine routes alike.
2. **Simulate the model, not the author.** Predict what a model *reading this text*
   would actually do — including obeying a bad hard constraint, padding a mandated
   output format with invented numbers, or "helpfully" improvising when a referenced
   file is missing. What the author hoped is evidence of intent, not of behavior.

## Phase 0 — Cast the personas

Derive presets from the owner's real contexts — their projects, input habits (voice
dictation? mixed languages?), environments, and publishing plans. If you don't know the
owner's contexts, ask before casting. Do not use a fixed cast; use the *smallest* cast
whose disagreements change the verdict (2–6 is typical). Slots that almost always earn
their place:

- **The owner at their messiest** — dictated, self-correcting input, real goal buried
  in the last sentence, wrong-but-plausible vocabulary.
- **The owner in their main build** — deep in the current project, allergic to ceremony,
  contamination-sensitive.
- **The wrong world** — the artifact's baked-in assumptions (a brand, a sprint, a
  hardware rig, a sibling skill) are stale or absent. Every artifact has a world; ask
  what happens when the world moved on.
- **The bare machine** — fresh install: data files, fingerprints, sibling skills gone.
  Walk every mode's degradation path; "improvise the missing data" is a finding.
- **The stranger who installed only this** — zero owner context, possibly a different
  language. MANDATORY when the artifact will be published. Includes reading the
  trigger surface as a store page: would they even understand what this does?
- **The second engine** — the same text running in another harness (a different agent
  CLI, bare API): which named tools/mechanisms silently don't exist there?

## Phase 1 — Trigger audit (before reading the body)

If the auditor already read the body, disclose that contamination. Restrict the
prediction to the trigger surface but do not call it a blind or first-impression
test. Real harness selection remains unverified until a fresh live run.

For each persona, write 1–3 realistic utterances (dictated ones must read like real
transcription, noise included) and judge from the trigger surface ALONE:

- **Fires / sleeps / coin-flip** — quoting the exact description phrase responsible.
- **First-impression misread** — what you briefly thought this artifact does. Record it
  immediately; confusion is perishable evidence and cannot be re-experienced later.
- **Sibling collision** — with the full trigger map of co-installed artifacts in view
  (names + descriptions), which siblings also raise their hand for this utterance, and
  who *should* win? A request two skills claim is a coin-flip the user pays for.

Minimum matrix per artifact: 2 intended hits (≥1 messy/dictated) · 1 should-NOT-fire ·
1 sibling collision · 1 wrong-world · 1 stranger. Add bare-machine and second-engine
scenarios whenever the artifact touches data files, sibling skills, or named tools.

## Phase 2 — Behavior walk (now read the body)

For each scenario that fires (or applies to an always-loaded prompt), walk the body line-by-line and narrate what actually
happens, citing line numbers. Hunt specifically for:

- **Silent failures** — the worst class: flows that complete "successfully" and deliver
  a wrong result with no error. Silent text corrections, self-scored validations,
  invented numbers to satisfy a mandated output schema, "saved!" with nowhere to save.
- **Hard constraints vs. reality** — absolute rules (bans, mandatory formats, session
  locks) meeting a case their author didn't imagine (another language's typography,
  another register, an authorized shortcut).
- **Missing-dependency behavior** — referenced files, skills, paths, commands that may
  not exist: does the text define a degradation, or will the model improvise/dead-end?
- **Conflicting rules in-context** — when this artifact and a co-loaded one both rule
  on the same object (e.g. two punctuation policies), which wins and is that ordering
  designed or accidental?
- **Mutable data location** — user data stored inside the artifact's own directory is
  a structural bug (update/reinstall wipes it). Data belongs outside; the artifact
  keeps a reference.

Verdict per scenario: ✅ helps / ⚠️ degraded / ❌ harms — one honest sentence why.

## Phase 3 — Report

Write the report in the user's language. The skeleton below shows English section names
with the canonical Chinese branch in parentheses — keep the structure and the
verdict-first order either way; omit the Chinese parentheticals when the user's
language is not Chinese:

```
# Wind-tunnel report（风洞报告）: <artifact> — <date>

## Verdict（判决）
One paragraph: would you ship/publish this artifact today? The single most
important fix?

## Auditor bias quarantine（带入的偏见）
Owner context the auditor carries; which conclusions it may have contaminated.

## Scenario runs（场景推演）
(per scenario: persona · utterance · trigger call + evidence · body walk with
line numbers · ✅⚠️❌)

## Trigger boundary exam（触发边界体检）
False-fire surface / missed-trigger surface / sibling collisions (who should
win) / keys locked inside the house

## Top N fixes（Top N 修复）
Each anchored to a line/field, ready to apply; description surgery ships a
paste-ready rewrite.

## Stranger usability（陌生人可用性）
Usable as-is / needs de-personalization (list what to extract) / private-only,
do not publish

## What static simulation cannot prove（待实测）
Real trigger selection, real load order with co-installed skills, real tool
calls — as a live-fire checklist.
```

Deliver the report in-chat. Write it to a file only when the user asks, at a path they
choose — never inside the audited artifact's directory. If a chosen path is unwritable,
fall back to in-chat copyable text.

Optionally emit `traces.jsonl` (persona, utterance, predicted_trigger, predicted_behavior,
verdict, evidence_lines, synthetic:true) — written to a path the user specifies, never
inside the audited artifact's directory. Failure clusters become grader criteria for
an eval suite (for example `claude plugin eval` LLM graders). The probe is the trace supply for
products that don't have production traffic yet.

## Mode B — live fire (optional, after the static run)

Static prediction cannot prove real trigger selection. When the harness allows: install
the artifact, replay the highest-stakes utterances in fresh sessions, record which skill
actually fired and what it did. Every divergence from Phase 1 predictions is a finding
about the simulation, not just the artifact. If no actionable findings emerge, check whether the scenarios covered a meaningful
boundary or recovery case. Recast once only if a concrete coverage gap exists. If
that check is also clean, report zero findings and the limits of the simulation;
a clean result is not evidence of auditor failure.

## Boundaries

- Read-only toward the artifact: the probe reports; it never edits the text it audits
  (the owner applies fixes — or asks separately).
- Severity is assigned from the user's seat: a trigger-layer error is a first-5-seconds
  failure and outranks any body-level elegance.
- Do not manufacture findings to look thorough; three real scenarios beat ten padded
  ones. If the artifact is genuinely tight, say so and list what only live fire can prove.
- The persona cast is a lens, not a checklist: drop any persona whose verdict cannot
  change the outcome.
