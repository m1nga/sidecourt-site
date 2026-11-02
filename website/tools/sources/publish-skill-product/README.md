# GitHub Skill Publisher — Publish Skills and Track Discovery

Turn one finished agent skill into one independent GitHub product: its own repository, problem-led
page, real origin story, direct install command, SEO/GEO metadata, and verified release evidence.

## What it does

`publish-skill-product` takes over after skill development is genuinely finished. It audits the
skill and its public story, writes or repairs the individual product metadata, uses the repository's
confirmed publisher, and verifies that the remote repository contains both a human product page and
a complete installable package. Its monitor mode also repairs committed products that drift out of
sync without touching drafts or unrelated work.

## When it fires

- “This skill is finished — publish it as its own GitHub product.”
- “Check whether every skill page has a real story and can be found independently.”
- “Monitor my skills repo and fix new products that missed SEO/GEO or standalone publishing.”
- 「这个 skill 定稿了，自动上传并做成单独产品页」
- 「检查新发的 skills 有没有独立仓库、介绍、故事和搜索入口」

It does not create the skill itself — use `skill-creator` for that. It does not publish exploratory
ideas, private context, third-party skills, ordinary code packages, or arbitrary git changes.

## Review before release

For a new or materially changed skill, the workflow first tests it from a new user's
perspective and inspects comparable public skills. It records which ideas were adopted,
adapted or rejected, fixes the useful findings, then validates and publishes.

A content-bound review receipt makes missing or stale reviews a release failure.
This verifies that evidence is present and matches the source, not that simulated
users are real customers. Unchanged legacy releases retain their existing status.

## Install

```bash
npx skills add m1nga/publish-skill-product
```

## Example

> **User:** `map-product-system` is ready. Publish it, and make sure someone searching for a way to
> understand their whole product can find the skill rather than a Ming skills collection page.
>
> **Agent:** Validates the skill and product story, updates the problem-led repository metadata,
> commits only the named source changes, publishes `m1nga/map-product-system`, proves the remote
> `skills/map-product-system/SKILL.md` package is complete, runs the direct CLI discovery check, and
> reports search/index evidence separately from release success.

## Measure one discovery experiment

Use the bundled `scripts/discovery_snapshot.py` with an owner/repository, up to
three fixed GitHub queries, and a new output file. It records timestamps, metadata,
search position, and optional private views/referrers. API failures remain unknown;
a before/after comparison never claims that the edit caused audience growth.
Keep snapshots outside your public repository. See
[the experiment workflow](https://github.com/m1nga/publish-skill-product/blob/main/skills/publish-skill-product/references/growth-experiments.md)
for the small state-folder layout and observation process.

```bash
python3 scripts/discovery_snapshot.py m1nga/prompt-distill \
  --query '"prompt cleaner"' --out /tmp/prompt-discovery.json
```

Run from the installed skill directory. This uses GitHub CLI authentication and
GitHub data; no paid keyword-data subscription is required. It does not measure
Google rankings or AI-answer citations.

## Works well with

- [`skill-creator`](https://github.com/openai/skills/tree/main/skills/.system/skill-creator) — builds
  the skill; this skill owns the public product release within the owner’s existing authorization.
- [`scenario-probe`](https://github.com/m1nga/scenario-probe) — stress-tests the public trigger and
  body before release.

## Design notes

This exists because a repository can truthfully say “every skill has a README” while still behaving
like one collection page. The first release of Ming's skills did exactly that: every skill lived in
one repository, so search engines and strangers met the collection before they met the problem each
skill solved. Splitting repositories fixed the URL boundary, but the release logic still lived in a
shell script and one global instruction. That meant it could publish code without independently
checking the product story, install package, discovery state, or future drift. This skill makes that
last mile an explicit, testable product contract.

## Field-tested

The release workflow has published 25 standalone skill repositories. In the latest live audit, all
25 public repositories passed direct Skills CLI discovery; the deterministic monitor verified 24
and correctly blocked one product with ambiguous local source changes instead of republishing it.
Publication now triggers the named product's remote verification directly, with no daily polling
automation. Search indexing remains a separately observed status, not a release claim.

## September 2026 behavior check

An independent agent simulation checked a scoped usage scenario after the instruction
cleanup. This checks instruction behavior, not human adoption or measured time savings.

The bundled release/data tools also have 21 offline regression tests (run on 2026-09-07, Asia/Shanghai), covering dirty
source rejection, unrelated-change preservation, missing API data, fixed-query
comparison, and snapshot overwrite protection. Run from the installed skill directory:

```bash
python3 scripts/test_release_tools.py
```

## Failure and recovery example

Input: `Publish my finished skill; another skill has uncommitted work.`
Expected: validate and publish only the finished skill from committed source,
preserving the unrelated draft. If the target itself changes after review, stop
at that boundary, re-review the new content and commit it before retrying.

The offline regression suite exercises dirty-target rejection, unrelated-draft
preservation and stale review detection using temporary repositories. These checks
verify release mechanics; they cannot certify review honesty or audience demand.
