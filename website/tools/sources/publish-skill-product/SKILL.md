---
name: publish-skill-product
description: "Finish self-authored skills through user-perspective review, comparable-skill research, tested improvements, and verified GitHub publication. Use when creating, materially updating, or releasing an owned skill, and for skill discovery experiments."
---

# Publish Skill Product

Make a finished skill easy to understand, install, and verify. Separate a working
release from evidence that people discovered or used it.

## Finish the whole skill

For new or materially updated self-authored skills, read
[lifecycle.md](references/lifecycle.md). Review the skill from a new user's seat,
inspect the nearest comparable skills, apply useful improvements, and validate the
result before release. Scale the review to the change; do not invent findings or
copy another skill's constraints just because it is popular.

Ming's request to create or finish a usable self-authored skill includes this complete
workflow and publication by default. Only an explicit draft/private/do-not-publish
instruction or a real unresolved blocker pauses release. The agent saying "done"
is not evidence that the lifecycle ran. Preserve unrelated drafts.

## Choose the relevant work

- **Release or repair:** read [release-workflow.md](references/release-workflow.md).
  Use the repository's existing publisher and committed source boundary. Existing
  authorization to fix published products covers the necessary verified repair.
- **Discovery or promotion:** read [growth-experiments.md](references/growth-experiments.md).
  Focus on products the owner uses or has selected, then improve a concrete example
  or discovery obstacle. Read [SEO/GEO criteria](references/seo-geo-criteria.md)
  when an external search claim or public-page change needs it.
- **Read-only audit:** inspect only the requested surfaces. Do not run the entire
  release sequence merely to give feedback.

## Keep authority and identity clear

The live registry instructions and repository remote establish the source path.
For Ming, the current registry is `/Users/m1nga/Desktop/🛠️ Skills工坊/ming-skills`.
Preserve unrelated dirty or ambiguous work. An authorized skill-building request supplies release authority; a conversation ending by itself does not.
Never publish private task notes, invented results, or third-party source material.

Keep `name`, directory, and repository slug stable. Make display names and product
headings explain the actual task in plain language. A literal title formula is an
editorial starting point, not proof of clarity or search performance. Align README,
manifest, UI metadata, and implemented behavior. Retain existing install links.

## Evidence tools

- `scripts/review_gate.py <registry> <skill>` checks that user review, comparable-skill
  research and validation evidence match the exact current skill and product metadata.
  `--committed` checks the committed release; `--fingerprint` prints its content digest.
  The gate verifies evidence structure and freshness, not human truth or market demand.


- `scripts/audit_product_page.py <skill-dir> --product-manifest <path>` checks the
  package and product metadata. It cannot judge market demand or writing quality.
- `scripts/check_release_source.py <registry> <skill>` rejects dirty target source
  or metadata before publication while allowing unrelated local work.
- `scripts/discovery_snapshot.py <owner/repo> --query '<fixed query>' --out <file>`
  records live GitHub metadata and search results. Run `--help` for optional traffic
  and before/after comparison. Requires authenticated `gh`; uses no paid SEO service.
  Store private snapshots outside the public package.

Report changed behavior, validation, source and product commits, and observed
discovery separately. A passed release check or a search result is not an acquired
user. Reuse a successful release receipt instead of repeating the same install and
clone checks without new evidence of failure.
