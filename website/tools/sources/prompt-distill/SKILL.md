---
name: prompt-distill
description: "Turn rough or dictated input into a reusable prompt when explicitly asked: 把这段整理成 prompt / 提炼成提示词 / 帮我写成可复用的指令 / turn this into a prompt. Preserve corrections, intent, examples, and constraints; keep the user's language. Do not intercept a task the user wants executed, and do not fire on ordinary requests that merely contain instructions."
---

# Prompt Distill

Extract the intent; do not redesign the request.

## Default behavior

- Preserve the user's framing, priorities, examples, language, and level of
  directness.
- Remove transcription noise, repetition, abandoned thoughts, and contradictions
  the user clearly corrected.
- Surface the actual outcome, essential requirements, and meaningful constraints.
- Keep useful ambiguity visible instead of silently inventing details.
- Prefer a small edit over a comprehensive rewrite. If the original is already
  clear, say so or return it nearly unchanged.

Trust the current model to reason. Do not add personas, generic expertise claims,
step-by-step reasoning commands, motivational language, or obvious quality
instructions.

## Choose the response mode

### Direct task

If the skill was invoked but the user is actually asking the agent to do something
rather than asking for a rewritten prompt, resolve minor input noise internally and
perform the task. Do not make the user review an intermediate prompt.

### Reusable prompt

When the user explicitly wants a prompt to reuse elsewhere, return a polished
version in the language of their input (or the language they name). Use natural
prose or the smallest structure that improves execution.

For a complex request, include only the sections that add value:

- **Core objective** — the result the user actually wants.
- **Requirements** — distinct deliverables or decisions.
- **Context or constraints** — only details that affect the result.
- **Open point** — only a genuinely blocking ambiguity.

Do not force headings for a simple request. Do not append a translation or summary
unless requested.

## Interpretation rules

- Treat a corrected thought as replacing the earlier version.
- Treat "or should I…?" alternatives (in Chinese: "还是…？") as a request to
  compare and make or support a decision.
- A quick either/or inside a distill request is handled inline; an open-ended
  dilemma the user wants to explore belongs to thinking-partner.
- Treat examples as evidence of preference unless the user says they are
  exhaustive requirements.
- Treat "make the call" (in Chinese: "你看着来") as permission to choose within
  the stated scope, not permission to expand the scope.
- Keep separate projects separate when one dictation contains unrelated tasks.
- Resolve obvious speech-to-text errors from context; preserve uncertain names and
  flag them only when they matter.
- Use available conversation or workspace context when the user refers to earlier
  work. Do not manufacture missing history.

Preserve temporal meaning: "this week" is a calendar period, while "the last
7 days" is a rolling interval. Do not substitute one for the other. Keep an
unspecified time zone or week boundary visible when it affects execution.

## Quality check

Before responding, verify:

1. The core objective survived unchanged.
2. No real requirement, example, or boundary was lost.
3. The result is shorter or clearer than the input — not merely more formatted.
4. Nothing was added just to make the prompt look professional.
