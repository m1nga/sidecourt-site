---
name: diagnose-project-rebuild
description: >
  Diagnose a confused, inherited, partially lost, repeatedly rebuilt, or
  direction-changing project and establish the safest evidence-based foundation
  for what comes next. Use when the user says things like "I inherited a mess",
  "should I just rewrite this from scratch", "this project is chaotic /
  polluted by old decisions", "can this still be saved", "only an older version
  survives", "I keep rebuilding this and the old plan keeps coming back", "fix
  it or start over?", or wants to restart without importing the prior
  direction's strategy; Chinese triggers: 乱了 / 被污染 / 推倒重来 / 还能不能救 /
  接手的烂摊子 / 修还是重建. Adapts the route (recover / clarify / repair /
  rebuild / continue / hold) to the project's actual failure mode rather than
  forcing a universal sequence. NOT for tidying files or folders, and NOT for
  mapping a healthy product's structure (use map-product-system).
---

# Diagnose Project Rebuild

Diagnose first; intervene second. Rebuild is one possible treatment, not the default.

## Restore the real job

Accept rough conversation, dictated or mixed-language notes, old files,
surviving versions, code, screenshots, and partial memories as evidence.
Restore the user's actual decision question before organizing the project.

Separate:

- the product's purpose;
- current user decisions;
- AI proposals;
- observed behavior and validation;
- implementation that may still be useful;
- process experience that may travel;
- old strategy that has no current authority;
- missing or destroyed evidence.

Do not treat document volume, code volume, test count, or effort already spent as proof that the direction is right.

## Diagnose by condition, not stage

Inspect only enough live evidence to classify the limiting condition. Read
[diagnostic-lenses.md](references/diagnostic-lenses.md) when the project has multiple histories,
missing sources, contradictory truth files, or unclear authority.

Choose one primary route:

- **Recover** — important source evidence is missing or damaged; preserve and reconstruct before redesign.
- **Clarify** — artifacts exist, but the product purpose, user, or promised change is not stable enough to govern work.
- **Repair** — the direction is still valid, while documents, architecture, workflow, or implementation contradict it.
- **Rebuild** — the direction was replaced or active context is too contaminated to repair safely in place.
- **Continue** — purpose and authority are coherent; the next need is a real vertical slice or external validation.
- **Hold / retire** — neither evidence nor expected value justifies more construction now.

Use secondary routes when necessary, but name one current bottleneck. Do not turn the diagnosis
into a checklist in which every project must visit every route.

## Build the smallest evidence boundary

Before reading history broadly, establish:

- which paths, sources, people, and dates are in scope;
- which source currently has authority and why;
- which artifacts are primary evidence versus interpretation;
- what must not be imported automatically;
- what is missing and cannot honestly be reconstructed;
- which actions are reversible.

When evidence is fragile, preserve before interpreting. When context is contaminated, let a
history-reading session produce a separated evidence bundle; let a fresh session establish the
new foundation from that bundle.

Never read another project's private experience ledger, truth files, strategy, or client data as
rebuild input. Import only its boundary-tested portable lessons.

## Select the smallest intervention

Choose the intervention that changes the limiting condition:

- recover exact artifacts or build a provenance-marked reconstruction;
- ask purpose-defining questions and distinguish decision from hypothesis;
- map contradictions and repair only affected dependents;
- create a clean source bundle and one new active foundation;
- run a real value or feasibility probe before more architecture;
- stop work and preserve evidence for later.

Use [foundation-patterns.md](references/foundation-patterns.md) for optional output shapes. Create
only the artifacts the chosen route requires. A project does not need a mandated file tree to be
considered understood.

## Run an adaptive evidence loop

Move among these actions as evidence requires:

```text
observe current evidence
→ diagnose the limiting condition
→ propose one intervention and its trade-off
→ obtain authority for consequential choices
→ execute or specify the bounded intervention
→ challenge it with fresh evidence or an independent probe
→ replace active truth cleanly
→ reassess
```

Skip irrelevant actions. Repeat only when the new evidence changes the diagnosis. Stop when the
project has one grounded current foundation and a next action that can produce real evidence.

Do not:

- interpret user silence as acceptance of a non-trivial design;
- edit active truth before showing the reasoning when judgment is material;
- let the author certify its own clean rebuild;
- confuse a document review with product validation;
- keep superseded instructions active beside replacements;
- send a stale handoff prompt after the foundation changes.

## Use experience across the lifecycle

If `experience-pack` is available:

- **On entry:** read portable lessons only, bootstrap this project's own `EXPERIENCE.md`, and record which lessons were adopted or rejected.
- **During work:** record costly incidents, effective methods, reviewer catches, and user course corrections as part of done.
- **At a turning point:** distill candidates through the experience-vs-decision boundary test before any lesson travels.
- **At closure:** let `iteration-close` (if installed) own the closure ritual and invoke experience distillation within it.

Experience may improve how the project is investigated, verified, handed off, and learned from. It
may not define the receiving project's purpose, customer, strategy, pricing, channels, or product
architecture.

## Handle external AI as evidence, not authority

For every external analysis or collaborator response:

1. show what it actually said;
2. triage consequential items as adopt, correct, reject, defer, or ask;
3. state the reason and evidence;
4. let the user see non-trivial judgment before mutating the active foundation;
5. synchronize the next handoff question with the accepted foundation.

Use a fresh reviewer or zero-context probe for a clean rebuild — any agent
instance started without the prior context qualifies (a new chat, a sub-agent,
or a second tool; nothing here requires one vendor's runtime). A reviewer must
not edit the files it certifies.

## Protect irreversible boundaries

Before any delete, purge, overwrite, or broad migration:

- resolve every target literally by exact path or identifier;
- identify the independent product/purpose and owner of every target;
- prove what recovery source exists;
- separate creation and verification of the new foundation from deletion of the old source;
- obtain target-specific user authority;
- use an independent scope check.

Similar names, shared history, nearby folders, and inferred relationships never grant scope.
Ambiguity stops the destructive action.

## Deliver a decision-ready result

Answer in the user's language. Return the smallest useful set:

1. **Current diagnosis** — facts, inference, proposals, and unknowns kept distinct.
2. **Primary route** — recover, clarify, repair, rebuild, continue, or hold; explain why.
3. **Source boundary** — what may inform the next foundation and what may not.
4. **Intervention** — one recommendation, trade-offs, and acceptance evidence.
5. **Surviving value** — mechanisms/evidence worth testing, not inherited decisions.
6. **Open authority** — only decisions the user must make.
7. **Next evidence** — the smallest action that can change the diagnosis.
8. **Confidence and flip condition** — a rough confidence percentage in the primary route, plus the single piece of evidence that, if it surfaced, would most likely flip the diagnosis.

If the user asked to build, implement the accepted bounded intervention and verify it. If the user
asked to think, audit, or diagnose, do not mutate files or purge material.
