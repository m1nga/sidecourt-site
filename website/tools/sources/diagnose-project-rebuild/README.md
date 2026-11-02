# Project Rebuild Advisor — Know Whether to Repair, Recover, or Start Over

Make an evidence-based project rebuild decision before touching the project: diagnose what is
actually broken, then recover, clarify, repair, rebuild, continue, or hold.

## The rebuild decision in 30 seconds

- **Should you rewrite a confused project from scratch?** Not by default. Rebuild only when the
  direction has been replaced or active context is too contaminated to repair safely.
- **What does the diagnosis return?** One primary route, one current bottleneck, one bounded
  intervention, a rough confidence percentage, and the evidence most likely to overturn the call.
- **What stays protected?** Fragile evidence is preserved before interpretation, and no ambiguous
  file, repository, or product is deleted or broadly migrated without target-specific authority.
- **How is a clean rebuild verified?** A fresh reviewer checks the new foundation; the author does
  not certify the files or decisions it just created.

## What it does

Takes a project in bad shape — inherited, half-lost, rebuilt too many times,
or mid-pivot — and classifies its actual limiting condition instead of
defaulting to "start over". Six routes: recover, clarify, repair, rebuild,
continue, hold. It draws an evidence boundary before reading history broadly,
treats external AI opinions as evidence to triage rather than orders to
execute, and refuses irreversible actions on ambiguous scope. The output is
decision-ready: one route, one intervention, what survives, what the user must
decide, a rough confidence %, and the single piece of evidence most likely to
overturn the call.

## When it fires

- "I inherited a mess — where do I even start?"
- "Should I just rewrite this from scratch?"
- "Can this project still be saved, or do I cut my losses?"
- "Every restart, the old plan somehow comes back."
- 「这个项目彻底乱了,修还是重建?」
- 「接手了一个烂摊子,还能不能救?」

It does not fire on tidying files and folders, and mapping a healthy product
belongs to `map-product-system`.

## Install

```
npx skills add m1nga/diagnose-project-rebuild
```

## Try a repair decision

After installation, ask your agent to use `diagnose-project-rebuild`:

> Diagnose only. My current decision says exports remain free. An old proposal
> says paid-only exports, and the active setup document copied that proposal.
> The export implementation still follows the current free decision. There is
> no evidence that other documents are contaminated.

Expected result (an authored reasoning example): **Repair** the conflicting setup
document and inspect its direct dependents. Preserve the working implementation
and label the old pricing proposal as superseded. Widespread contamination is
unknown, so this fixture does not justify a clean rebuild. If the current decision
cannot be located, clarify authority before choosing which document to change.
No files are changed by this diagnosis-only request.

## Example

> **User:** third rewrite of this app and the old pricing model showed up in
> the new spec again. burn it all down?
>
> **Agent:** Diagnoses contamination, not code failure — route: **Rebuild**,
> but the intervention is a source-lock bundle, not deletion: user decisions
> with verbatim anchors, AI proposals labeled as proposals, portable lessons
> only; a fresh session builds from the bundle; a zero-context probe checks
> that no dead facts surface. Confidence: ~75%. Flip condition: if the pricing
> model turns out to be in the current spec because the user re-chose it on
> purpose, the route flips to Repair. Nothing gets deleted until the new
> foundation is verified and the user executes the purge.

## Works well with

- [`experience-pack`](https://github.com/m1nga/experience-pack/) — the only thing a rebuild imports
  from history is that skill's boundary-tested portable layer; on entry, this
  skill bootstraps the project's own experience ledger.
- `map-product-system` — for projects that are healthy and just need their
  structure made visible.
- `iteration-close` — when the diagnosis is "continue" and an iteration ends
  normally.

## Design notes

The method comes from a solo builder's five consecutive rebuilds of one
product, where the failed direction re-entered every fresh start — through
summaries, archive maps, and the very session that had read the history and
then wrote the "clean" docs. Hence the specific paranoias: the author never
certifies its own rebuild, cleanliness is proven by a zero-context probe
rather than asserted, and deletion comes last, by the user's hand, after
verification. The confidence-plus-flip-condition output exists because a
diagnosis without a stated way to be wrong just becomes the next unquestioned
strategy — the exact failure the skill was built to end.

## Field-tested

Probed 8 scenarios across 5 personas · 6 fired correctly · 1 correctly stayed quiet · 1 sibling coin-flip flagged for a description fix.

> **"这个项目彻底乱了,还能不能救?" ("this project is a total mess — can it still be saved?")** → fires. This exact phrasing slipped through an earlier version with no Chinese triggers; it now routes straight to diagnosis.

> **"My desktop is a mess — help me tidy these folders."** → stays quiet. File tidying is explicitly out of scope; a messy folder is not a sick project.

> **"Context is polluted — delete the old files and start over."** → fires, but refuses the blind purge: every target resolved by exact path, recovery source proven, new foundation verified first, and the user — never the agent — executes the deletion.

Probe method: [scenario-probe](https://github.com/m1nga/scenario-probe/)
