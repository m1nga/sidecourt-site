# Decision Thinking Partner — Clarify Ambiguous Choices Without Fake Certainty

Routes ambiguous requests to the question actually being decided — and refuses to fake convergence when the evidence isn't there.

## What it does

- Detects when the real deliverable is judgment rather than output, and switches into structured thinking without being asked.
- Separates what you said, what the evidence shows, what it infers, and what is still unknown — so you can disagree with a specific claim instead of a vibe.
- Keeps plausible alternatives with a test that would distinguish them; the number depends on the decision.
- When convergence is earned, gives one recommendation, its main trade-off, and why the alternatives lost; when it isn't, names the next learning step.
- Handles dictated, messy, mixed-language input — corrections and decisions arriving in one stream.

## When it fires

- "Help me think this through."
- "I'm torn between X and Y."
- "Am I even asking the right question?"
- "What am I missing here?"
- 「你帮我想想」
- 「我在纠结要不要…」
- 「拷问我」/ "grill me on this plan" (interview mode)

No magic words — it triggers on meaning. It stays out of the way for research, building, review, and status work, and applies only to the unresolved fork in mixed requests.

## Install

```
npx skills add m1nga/thinking-partner
```

## Example: choose a next step with missing evidence

Authored demonstration, not a real project diagnosis.

**Input:** “I maintain the sync module alone and need to avoid downtime. Should I
rewrite it or patch it? I have no regression history to share. Diagnosis only.”

**Possible output:** “Start with a bounded diagnosis of the failing path. A patch
is preferable if the defect can be isolated and checked; a rewrite becomes plausible
if failures cross the module boundary and a safe cutover can be demonstrated.
The regression record is missing, so neither path has earned a reliability claim.
Inspect the recent failure and its direct dependencies before committing.”

The solo-maintainer and downtime constraints come from the input. No files change
because the request is diagnosis only. If the same request omits those constraints,
they remain unknown; the skill cannot borrow them from this example.

**Recovery:** If the user later confirms a local defect and authorizes a patch,
continue into the patch and its checks rather than reopening the rewrite debate.

## Works well with

- **Interview mode (built in)** — say 拷问我 or "grill me on this plan" and this skill interrogates the build plan one question at a time, then locks a scoped plan with explicit non-goals.
- **prompt-distill** — once thinking converges, distill the outcome into a reusable prompt.

## Design notes

Written by a solo builder after real incidents where an assistant "found" a deeper need that wasn't there and the work went confidently sideways. That produced the two hard rules: accurate surface understanding before depth (an eloquent sentence is not evidence of an underlying need), and convergence must be earned (a recommendation without a distinguishing test is a guess in a suit).

Perspectives are selected, not enumerated — a viewpoint only enters when its disagreement would change the verdict, and the skill must say what that viewpoint has no authority to decide. Low-risk reversible defaults are decided by the agent; only identity, values, irreversible commitments, and material external consequences go back to the user. The skill deliberately does not stop work: once the fork is resolved, it continues into whatever was already authorized.

## Field-tested

Historical simulation: 6 scenarios across 5 personas · 4 fired correctly · 2 correctly stayed quiet.

> **"这个项目我现在有两个方向嘛……呃不对,是先把底座锁死再切,你帮我想想,我有点纠结"** → Fired. Untangled the dictated self-correction (later wording overrides earlier), kept both paths alive, and named the one test that would settle them — no fake convergence.

> **"帮我想想办法把这个 CSV 转成 JSON"** → Stayed quiet. "想想" alone isn't a thinking request when the deliverable is a file — the execution exclusion held, and even on a misfire the body routes straight to "build it, no thinking prelude."

> **"方案我大概想好了,帮我想想还有没有漏洞,然后我们开工"** → Switches to interview mode: one question at a time with a recommended answer each, then a locked plan with explicit non-goals before work starts.

Probe method: [scenario-probe](https://github.com/m1nga/scenario-probe)

## September 2026 behavior check

An independent agent simulation checked a scoped usage scenario after the instruction
cleanup. This checks instruction behavior, not human adoption or measured time savings.
