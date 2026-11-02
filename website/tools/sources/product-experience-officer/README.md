# First-Time User Tester — See Where Your Product Confuses New Users

A reviewer that experiences your unreleased product as a total stranger first — and only afterwards puts the expert hat on to tell you what broke, why it hurt, and what to fix first.

## New: an output you can use

Produce a self-contained client report with explicit evidence limits:

```sh
python3 SKILL_DIR/scripts/report.py --input SKILL_DIR/examples/report.json --out first-use-report.html
```

The included fixture is labeled simulation and makes no claim that a real product was tested. Replace it with the actual experience log, tested tasks, recovery evidence, severity-ranked findings and retests. Live, screenshot, text-only and simulated runs remain distinct; prior product context is explicit. Missing evidence or an unknown severity fails before creating a report. A generated report validates structure, not the truth or independence of a test. No account, server or paid API is required.

## What it does

Runs your product (or reads your screenshots) in two phases. Phase 1: follow the public entry path and record confusion before consulting internal specifications or code. A README or help screen that users naturally encounter is part of that experience. If the reviewer already knows the product, disclose that context; the run cannot honestly be called a fresh independent test. Phase 2: a product/UX expert who reads the code and docs to explain each confusion and prescribe a fix. The output is a single report: a one-paragraph verdict up top ("would a stranger come back tomorrow?"), a first-person experience log, severity-ranked findings with evidence, one recommended fix each, and effort estimates, plus an honest list of what this round couldn't verify.

## When it fires

- "Walk through my app as a first-time user."
- "Does this onboarding make sense?"
- "UX audit these screenshots."
- "Pretend you've never seen this and try it."
- "帮我从用户视角体验一下这个产品"
- "看看新用户会怎么想"

It does not fire for debugging a specific error from a screenshot, or for code review — it evaluates the experience, it doesn't repair the build.

## Install

```
npx skills add m1nga/product-experience-officer
```

## Try an evidence-bound review

After installation, ask your agent to use `product-experience-officer` on your
product's public entry point and one core task. Supply a disposable profile for
any action that writes data.

Illustrative recovery case: a text-only walkthrough shows the task completing
and invalid input returning a useful error. No major defect is observed. The
report should say **zero evidenced major findings in this tested path**, record
the actions and outputs, and leave visuals and untested paths under To verify.
It must not manufacture a blocker to sound rigorous or claim retention from one
session. If the reviewer read the spec earlier, the report must disclose that.

This example describes expected behavior; it is not a user study or a claim that
an application was tested here.

## Example

> **You:** I just finished the onboarding flow for my journaling app. Walk through it as a first-time user — here's the local dev command.
>
> **Claude:** launches the app cold, freezes on the first screen ("I see a text box and the word 'begin'. I don't know what this app is for yet"), wanders off the happy path, answers a prompt with "idk", pastes 2000 words, quits mid-flow and comes back. Then reads the code and reports: verdict first, then findings like — 🟠 Major: the first screen never says what the product does before asking for personal writing; evidence quoted verbatim; fix: one line of promise copy above the input; effort S.

## Works well with

- [`map-product-system`](https://github.com/m1nga/map-product-system/) — map what the product actually is before or after an experience run.
- [`diagnose-project-rebuild`](https://github.com/m1nga/diagnose-project-rebuild/) — when the report's Blockers point at structural rot rather than surface fixes.

## Design notes

The methodology is opinionated on purpose, and each rule comes from real reviews of solo-built products:

- **Two phases, never mixed.** A builder cannot un-know their product; neither can a reviewer who read the spec first. The stranger must run before the expert, because confusion is perishable evidence.
- **Verdict first.** A solo builder reading the report needs one decision ("is this ready, and what do I fix now?"), not a flat list of twenty items. Prioritization is the deliverable, not a garnish.
- **One recommended fix per finding.** Listing three options without a pick pushes the decision cost back onto the person who asked for help. The skill always recommends, with a reason, and labels taste as taste.
- **Treat the developer's data as production.** Live runs happen on the builder's own machine, next to their real files. The skill refuses writes that touch pre-existing user data and records the attempt as a finding — a rule written after runs where the product cheerfully offered to overwrite the builder's real archive.
- **Degrade honestly.** No browser? Copy and flow get reviewed; every visual claim moves to a to-verify checklist instead of being guessed from HTML. A smaller honest report beats a complete fabricated one.

## Field-tested

Probed 7 scenarios across 5 personas · 5 fired correctly · 2 correctly stayed quiet.

> **"Does this onboarding make sense? Here are three screenshots."** → Fired in Mode A — and an English-speaking user gets an English report. (An earlier probe caught this skill answering English builders in Chinese; that fix is now verified green.)

> **"Here's a screenshot of the error my app throws on login — what's wrong?"** → Correctly stayed quiet. A screenshot is not automatically a UX review: the description's NOT-clause sends debugging elsewhere, a boundary added after a real false-fire.

> **"Run my web app and review it as a first-time user"** — in an environment with no browser or screenshots → Fired, and degraded honestly: copy and flow reviewed from text, every visual dimension moved to an explicit To-verify checklist, and inferring "the spacing is probably fine" from CSS is banned as fabricated evidence.

Probe method: [scenario-probe](https://github.com/m1nga/scenario-probe/)
