---
name: experience-pack
description: >
  Two-layer experience system for any project: keep a per-project EXPERIENCE.md
  ledger (dated entries: what happened, what we did, what it cost), then distill
  it through an experience-vs-decision boundary test into portable, noun-free
  lessons that other projects can safely reuse — experience inherits, decisions
  die. Ships a reference pack distilled from a real five-rebuild contamination
  saga plus five prevention advices. Use for project-level retrospectives and
  incident recording, or right after an incident that cost real time or money —
  "let's do a post-mortem on this project", "write down
  what we learned before we forget", "record this incident so we don't repeat
  it", "what lessons from the last project apply here", "start an experience
  log for this repo"; Chinese: 经验包 / 记录经验 / 项目复盘 / 沉淀经验 /
  经验文件 / 这次的教训. NOT on reviewing the
  current conversation's rounds (the host recaps that itself), NOT on closing an
  iteration (use iteration-close), and NOT a decision register — decisions
  stay in the project's own truth files.
---

# Experience Pack

One sentence: every project keeps its own experience ledger; a boundary test
distills the portable part; only the portable part travels between projects.

Works with typed or dictated input: messy, colloquial, mixed-language
descriptions of "what just went wrong" are valid raw material for a ledger
entry — the skill structures them, the user only confirms.

## The two layers

| Layer | File | Owner | Content rules |
|---|---|---|---|
| Ledger | `EXPERIENCE.md` in the project root | the project | dated, concrete, project specifics allowed; process experience only — never product truth, never a decision register |
| Portable | the project's portable-lessons file (e.g. `LESSONS.md`) and/or this skill's reference pack | travels | abstract, product-noun-free, true in a DIFFERENT project read by a stranger |

Pipeline: something happens → ledger entry (same day, while it hurts) →
periodic distillation pass → portable lessons. Strategy and product decisions
never travel: **experience inherits, decisions die.**

## Protocol A — RECORD (ledger)

**Root adjudication first.** The ledger lives at the project root — so confirm
there IS a project root before writing. If the current working directory is a
home directory, Desktop, Downloads, or any other non-project location, ask
which project this experience belongs to and write the ledger there. Never
create an `EXPERIENCE.md` in a home or Desktop directory. If no project
directory can be established, or the target is not writable, do not silently
drop the entry: output the fully formatted entry as copyable text and tell the
user where it should eventually live.

Create `EXPERIENCE.md` at the project root on day one (or on first use).
Append an entry when any of these happen: an incident cost real time/money/
trust; a method visibly worked; an independent reviewer caught something the
author missed; a collaboration pattern succeeded or failed; the user corrected
the agent's course.

Entry format:

```
### YYYY-MM-DD — title
**What happened:** facts, concrete.
**What we did:** the response, concrete.
**What worked / what failed:** both, honestly.
**Cost:** time / tokens / trust / rework.
**Portable?** yes → <lesson-slug> | not yet | no (project-specific).
```

Rules: record process experience, not product facts; if the workspace has
contamination-hygiene rules (banned nouns), the ledger obeys them; never
backdate or rewrite old entries — append corrections as new entries. Write
ledger entries in whatever language the project lives in (follow the user's
existing habit; if unknown, ask once).

Binding rules (distilled from the pack's adopter projects):

- **Recording is part of done.** An incident's fix may not be declared complete
  until its ledger entry exists — the ledger is a gate, not a diary. (An early
  adopter backfilled 8 entries in one day because nothing forced writing at
  incident time; firefights never leave time for diaries.)
- **Bootstrap imports are legitimate, silent backdating is not.** When adopting
  the pack on a project with history: date each entry by its INCIDENT date and
  declare the import in a dated note at the top of the ledger. An entry dated in
  the past without a declared import is fabrication.
- **Distribution hygiene.** The ledger contains project internals. In a repo
  with a public remote, gitignore `EXPERIENCE.md` by default; publish only the
  boundary-tested portable layer.
- **Discoverability.** Add one pointer line to the project's primary truth file
  (CLAUDE.md / AGENTS.md / system map / state doc) so a zero-context agent can
  FIND the ledger; an undiscoverable ledger records nothing for the next
  session.
- **A gitignored ledger needs a declared escape route.** Gitignoring the ledger
  (rule above) also removes it from clone/push recovery. A gitignored ledger
  MUST have a declared backup or sync channel — a private repo or branch, a
  synced folder, a scheduled copy; the user chooses — recorded as one line in
  the ledger's header note. Without it, a machine change or re-clone silently
  erases the project's memory: switching machines becomes amnesia nobody
  notices until the next incident repeats.

## Protocol B — DISTILL (boundary test)

For each ledger entry marked "Portable? yes/not yet", run the tests in order:

1. **Substitution test** — strip every proper noun and specific number. Does
   the statement still teach something? Collapses → it is a decision, dies.
2. **Mechanism vs choice** — does it say how things work or fail (mechanism →
   inherit), or who/what/how much was chosen (choice → dies)?
3. **Re-derivation test** — could a smart stranger re-derive it from the new
   project's own context? If it could only come from the old project's
   strategy, it is the old strategy talking — dies.
4. **Sunk-cost test** — is its only value that effort was spent on it? Dies.
5. **Verifiability test** — does checking it require a dead noun? Abstract it
   or let it die.

Survivors are rewritten as one abstract imperative line + why + how to apply,
tagged with provenance ("prior project, distilled · date"). Write the portable
layer in English (or bilingually): the ledger may use any language the project
lives in, but portable lessons travel to strangers — project-local idiom
strands them. Ambiguous items
default to DIE — the ledger keeps them recoverable for a later pass.
DOWNGRADE (rare): a strategy-shaped artifact re-enters another project only as
an explicit HYPOTHESIS with a re-validation condition, and only by the user's
call — never silently.

## Protocol C — SHARE / APPLY (another project learns from this one)

1. In the receiving project: read `references/rebuild-experience-pack.md`
   (this skill's packaged saga) and/or the source project's portable-lessons
   file — never the source project's ledger, truth files, or strategy.
2. Bootstrap the receiving project's own `EXPERIENCE.md` (Protocol A,
   including root adjudication).
3. Walk the pack's **five advices** as a setup checklist; adopt what applies;
   record deviations as the receiving project's first ledger entry.
4. Adopted lessons enter the receiving project tagged with provenance; they
   are engineering constraints, not user decisions — the user may re-class
   any of them.

## Boundaries — what this skill never does

- Never copies strategy, product facts, personas, pricing, channels, client
  names, or account identities between projects — in either direction.
- Never treats the ledger as a decision register; decisions live in the
  project's own truth/decision files with their own provenance rules.
- Never edits other skills or the user's global config.
- Never reads a project's quarantined/archived material to "enrich" a pack;
  distillation input is the ledger and the live files only.

## Relationship to adjacent skills

- **The host's own recap** — reviewing the current conversation's rounds. A user
  saying "复盘" or "let's review" about THIS conversation gets a plain recap; this
  skill owns project-level post-mortems that outlive the conversation.
- **iteration-close** — closes an iteration of a continuing direction (distill,
  delete baggage, tag, seed). Run experience-pack's Protocol B as part of it if
  both are installed; iteration-close owns the closure ritual. **Caveat both
  skills must honor:** "git history is the archive" holds ONLY for tracked
  files. Untracked/gitignored material (private IP in a public repo) has no
  archive — quarantine it under an explicit local rule (e.g. `_retired/`)
  before any purge; deleting it is permanent loss, not cleanup.
- **diagnose-project-rebuild** — when a direction is REPLACED, the boundary
  test here is the same test used to decide what survives; the rebuild skill
  owns diagnosis and purge mechanics, and takes ONLY this skill's portable
  layer as input.
- This skill is product-agnostic and must stay that way: if a project's noun
  ever appears in this file or its references, that is a defect — remove it.

## Engine notes

Nothing here depends on one vendor's runtime. "Fresh session" and
"zero-context probe" mean any agent instance started without the prior
context — a new chat, a sub-agent, or a second tool. Where a skills runtime
is absent, apply the protocols manually: the file formats and tests above are
the skill.

## Reference

`references/rebuild-experience-pack.md` — the packaged, noun-free experience
from a real five-rebuild contamination saga: the six contamination doors, the
source-lock reset method, the three-probe verification stack, the multi-AI
collaboration protocol, and the five prevention advices.
