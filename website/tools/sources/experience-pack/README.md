# Project Lessons Log — Reuse Lessons Without Carrying Old Decisions

Record project lessons while they are fresh, then distill only what another
project can safely reuse.

## Quick answers

- **What problem does it solve?** Project lessons are easy to lose after an
  incident, while ordinary lessons-learned documents can accidentally preserve
  stale product decisions.
- **What does it create?** A dated `EXPERIENCE.md` ledger for concrete incidents
  and, after a five-part boundary test, a separate layer of reusable lessons.
- **What is allowed to travel?** Mechanisms, failure patterns, and reusable
  constraints; product choices, proper nouns, and sunk-cost arguments stay in
  the source project.
- **Is it a decision log?** No. Decisions remain in the project's own truth
  files and are never promoted into portable project memory.
- **How are private notes protected?** In a public repository, the concrete
  ledger is gitignored with an explicit private backup path; only the distilled
  portable layer is eligible to be published.

## What it does

Keeps a dated `EXPERIENCE.md` ledger in each project (what happened, what we
did, what it cost — written the same day, as a gate on "done", not a diary).
Then, on request, runs each entry through a five-part boundary test —
substitution, mechanism-vs-choice, re-derivation, sunk-cost, verifiability —
to decide what is portable experience and what is a dead decision. Portable
lessons travel to other projects with provenance tags; everything else stays
put or dies. It also ships a reference pack of pre-distilled lessons from a
project that was rebuilt five times because old context kept leaking back in.

## When it fires

- "Let's do a post-mortem on this project."
- "Write down what we learned before we forget it."
- "Record this incident so we don't repeat it."
- "What lessons from the last project apply here?"
- 「把这次的教训沉淀下来」
- 「给这个项目建个经验文件」

It does not fire on "review this conversation" (a plain recap covers that) and
it refuses to become a decision register — decisions live in the project's own
truth files.

## Install

```bash
npx skills add m1nga/experience-pack
```

## Try it on one incident

After installing, ask: `Use $experience-pack to record this incident in this
project, then show which lesson can travel to another project.`

Illustrative input, not a measured incident:

> The migration took the whole afternoon because staging used the old bucket.
> We corrected the endpoint and reran the migration successfully. Record it.

Expected ledger excerpt:

```text
What happened: Staging used a stale bucket endpoint during migration.
What we did: Corrected the endpoint and reran the migration successfully.
What worked / what failed: The corrected endpoint worked; the stale one delayed the migration.
Cost: One afternoon, as reported; exact duration unknown.
Portable? not yet
```

On a later distillation pass, the portable lesson can be: *Verify each
environment's external endpoints before migrating; stale endpoints can survive
configuration changes.* The bucket identity and this project's endpoint choice
stay in the private ledger. This example illustrates the boundary, not a claim
that the check prevents every migration failure.

If no project is open, the agent asks where the incident belongs and can return
a copyable entry. It does not create a ledger at the Desktop root. In a public
repo, the private ledger needs an explicit backup or sync destination; gitignore
alone is not a backup.

If this helps you preserve a useful lesson, a star on this repository is welcome.

## Works well with

- [`diagnose-project-rebuild`](https://github.com/m1nga/diagnose-project-rebuild/) — when a project
  direction is replaced, that skill takes exactly one input from history:
  this skill's portable layer.
- [`iteration-close`](https://github.com/m1nga/iteration-close/) — owns the
  closure ritual; runs this skill's distillation pass inside it.

## Design notes

The two-layer split exists because of a specific, repeated failure: a solo
builder rebuilt the same product five times, and every restart the abandoned
strategy leaked back in — through summaries, archive maps, and "lessons" with
prospect lists still attached. The fix that finally held was a hard rule,
**experience inherits, decisions die**, enforced by a written test instead of
judgment in the moment. Ambiguous items die by default (the ledger keeps them
recoverable), because every optimistic "this one's probably fine" was how
contamination got back in. The binding rules — recording as a gate on done,
declared bootstrap imports, a mandatory backup channel for gitignored ledgers
— each trace to an incident an adopter project actually hit.

## Field-tested

Probed 8 scenarios across 5 personas · 6 fired correctly · 1 correctly stayed quiet · 1 logged as a follow-up note.

> **"复盘一下刚才这几轮对话" ("recap the last few rounds of this chat")** → stays quiet. Conversation recaps are the host's own job; this skill only claims post-mortems that outlive the conversation.

> **"That refactor ate two days — write down what we learned before we forget."** → fires. Appends a dated ledger entry — what happened, the response, the cost — with a `Portable?` flag for the next distillation pass.

> **"记录经验" (dictated from the Desktop, no project open)** → fires, then refuses to drop an `EXPERIENCE.md` on your Desktop — it asks which project the lesson belongs to, and if no project can be established it hands you the formatted entry instead of silently losing it.

Probe method: [scenario-probe](https://github.com/m1nga/scenario-probe/)

## Author

Built and maintained by [Ming](https://github.com/m1nga). The design notes
above explain the real failure and tradeoffs that shaped this skill.
