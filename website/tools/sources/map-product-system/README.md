# Product System Map — Connect User Journeys to What You Need to Build

One traceable map from user intent to system outcome — built from whatever you actually have: a rough idea, a doc pile, or a codebase.

## What it does

Builds a product system model that connects journeys, capabilities, decisions,
data, actors, states, and failure handling end to end, in three jobs: Discover
(first coherent model from an early idea), Audit (find the gaps and accidental
architecture in what already exists), Evolve (place a new feature and trace its
downstream effects). Every claim carries an evidence label — Known, Inferred,
Proposed, Unknown — so you can tell what was observed from what was invented.
It ends with ranked decisions and sequenced delivery slices, not an
architecture poster.

## When it fires

- "How does this all hang together?"
- "Help me see the big picture of my app."
- "What's missing in my product?"
- "Map the whole product before we commit to this feature."
- 「梳理一下产品架构」
- 「检查用户旅程和功能分支」

It does not design the runtime control loop of an autonomous workflow; the host's
scheduler, /loop or Workflow tooling does that. This skill covers static architecture
and responsibility contracts.

Follow [a complete input/output example](https://github.com/m1nga/map-product-system/blob/main/skills/map-product-system/examples/import-retry.md) to see what this preserves and what it leaves open.

## Install

```
npx skills add m1nga/map-product-system
```

## Example

> **User:** I have half a spec and a Django repo. What's actually missing
> before we onboard a second customer?
>
> **Agent:** Reads the repo and spec as evidence, not as intent. Traces each
> actor's journey against the coverage lenses and returns: the product spine,
> a journey-to-capability-to-owner trace, and a ranked gap register — e.g.
> "customer data has no deletion propagation path (Unknown consumer)" and
> "tenant scoping exists in the ORM but nothing enforces it at the export
> endpoint (Known, file cited)". Then it splits the gaps into what blocks
> customer two versus what can wait, with the tradeoff stated for each call.

## Works well with

- [`diagnose-project-rebuild`](https://github.com/m1nga/diagnose-project-rebuild/) — when the audit finds the architecture is
  accidental rather than incomplete, that skill decides whether to rebuild.

## Design notes

- **Evidence labels are mandatory, not decorative.** The expensive failures
  this skill was built against came from a model presenting an invention as an
  existing fact. So Known claims must trace to a source, and anything recalled
  from model memory — however plausible — is at best Inferred.
- **The mandate stack is conditional.** Platform/customer/runtime mandate
  layering only applies when the product makes governed or customer-specific
  decisions. A note-taking app does not get a governance layer bolted on.
- **Verdict before options.** The skill recommends and states the tradeoff
  instead of listing unranked alternatives. For a solo builder, an unranked
  option list is just deferred work handed back to the person who asked.

## Field-tested

Probed 7 scenarios across 5 personas · 5 fired correctly · 1 correctly stayed quiet · 1 boundary noted.

> **"How does this all hang together? I've got half a spec and a Django repo."** → Fired. Read the repo as evidence (not intent), returned a journey-to-capability-to-owner trace with every claim labeled Known / Inferred / Proposed / Unknown.

> **"把这个流程变成自动循环，每天自动跑"** *("turn this into an automated daily loop")* → Correctly stayed quiet. Runtime automation is explicitly ceded to the host's scheduling tools in the description itself — the handoff is a design decision, not a coin flip.

> **"看一下产品结构"** *(a five-word "take a look at the product structure")* → Fired, and stayed proportionate: the body's depth-matching rule returns a scoped look, not a nine-lens architecture report nobody asked for.

Probe method: [scenario-probe](https://github.com/m1nga/scenario-probe/)

## September 2026 behavior check

An independent agent simulation checked a scoped usage scenario after the instruction
cleanup. This checks instruction behavior, not human adoption or measured time savings.
