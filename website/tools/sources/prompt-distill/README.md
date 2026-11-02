# Prompt Cleaner — Turn Dictated Notes into Reusable Prompts

Turns a rambling, self-correcting, mixed-language draft into a prompt that says the same thing — shorter, not fancier.

## What it does

- Strips transcription noise, repetition, abandoned thoughts, and contradictions you already corrected.
- Preserves your framing, priorities, examples, and directness — it edits, it does not redesign.
- Keeps genuine ambiguity visible instead of silently inventing details to fill it.
- Refuses cargo-cult additions: no personas, no "think step by step", no motivational padding.
- If the original is already clear, it says so and returns it nearly unchanged.

## When it fires

Explicit asks only:

- "Clean up this prompt."
- "Make this reusable."
- "Turn my ramble into a prompt."
- 「把这段整理成 prompt」
- 「优化这个 prompt」

It does not activate just because a request is long or conversational — that is the agent's normal job.

Follow [a complete input/output example](https://github.com/m1nga/prompt-distill/blob/main/skills/prompt-distill/examples/prompt-cleanup.md) to see what this preserves and what it leaves open.

## Install

```
npx skills add m1nga/prompt-distill
```

## Example

**Input (dictated):** "ok so I want a script that, no wait, first check if the folder exists, 就是那个 exports 文件夹, if not create it, then move all the PNGs — actually only ones from this week — move them in and print how many. Make this reusable."

**Output:** "Check whether ./exports exists; create it if not. Move PNG files modified this week into it. Print the count of files moved."

“This week” stays a calendar period; it is not silently changed to a rolling seven-day window. The corrected thought ("only ones from this week") replaced the earlier one; the code-switched folder reference resolved to its referent.

## Works well with

- **thinking-partner** — when the ramble contains an unresolved decision rather than a task: think first, distill after.

## Design notes

The quality bar is subtractive: the result must be shorter or clearer than the input, and every addition must be traceable to something the user said. This comes from a solo builder repeatedly watching "prompt optimization" produce longer prompts that execute worse. The four-item quality check at the end of the skill — objective survived, nothing lost, shorter or clearer, nothing added for looks — exists because each item has failed in practice at least once.

The interpretation rules are explicit about dictation reality: later corrections override earlier wording, "or should I…?" means compare-and-decide rather than transcribe-both, and "make the call" grants choice within the stated scope, never scope expansion.

## Field-tested

Probed 8 scenarios across 7 personas · 4 fired correctly · 3 correctly stayed quiet · 1 boundary flagged for tightening.

> **"把这段整理成 prompt,我要发给另一个 session"** (dictated, messy, mixed-language) → fired, returned a shorter prompt with the corrected thought winning over the abandoned one — nothing added.
>
> **"Just check if the exports folder exists, move this week's PNGs in, and count them."** → stayed quiet. A long, messy request is the agent's normal job, not a reason to interrupt you with a rewritten prompt.
>
> **"Polish this grader prompt I use to score my model outputs."** → stayed quiet. Judge prompts belong to an eval suite's graders; this skill knows what it isn't for.

Historical probe method: [scenario-probe](https://github.com/m1nga/scenario-probe)

## September 2026 behavior check

An independent agent simulation checked a scoped usage scenario after the instruction
cleanup. This checks instruction behavior, not human adoption or measured time savings.
