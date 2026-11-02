# Release and repair workflow

Before this release sequence, complete the user-perspective and comparable-skill
review in [lifecycle.md](lifecycle.md), including a current content-bound receipt.
For Ming, a request to build or finish a usable owned skill includes publication;
explicit draft/private restrictions still take precedence.

## Start from the live release contract

1. Read repository instructions, status, remote, default branch, product manifest, and documented
   release commands.
2. Prefer the repository's existing publisher over reimplementing GitHub operations. For Ming's
   registry, use `/Users/m1nga/Desktop/🛠️ Skills工坊/ming-skills`, `products.json`,
   `scripts/verify-products`, and `scripts/publish-skill`.
   Outside Ming's registry, if no publisher exists, first confirm the repository owner, public
   target, and standing release policy; then build the smallest equivalent committed-source
   publisher rather than improvising a one-off working-tree copy.
3. Preserve unrelated dirty files. A release may include only the named skill, its product
   metadata, and release-system changes required for that skill.
4. Use committed source as the publication boundary unless the owner explicitly authorizes a
   working-tree release.

## Build the individual product page

Use [the product README template](../assets/product-readme-template.md) as a completeness model, not
as mandatory boilerplate. Keep sections only when they add real information.

Make the page answer, in this order:

1. What human problem does this solve and what outcome does it produce?
2. When should someone use it, and when should they not?
3. What does the skill actually do?
4. How is it installed and invoked?
5. What does a realistic input-to-output example look like?
6. Why was it built this way? Use the owner's real incident or design constraint.
7. What evidence exists that it works? Separate tests, field use, and unverified claims.
8. Who made and maintains it?

Lead with the problem, not the author's collection, taxonomy, or biography. Keep authorship visible
but secondary. Do not invent a founder story, usage numbers, quotations, statistics, testimonials,
search rankings, or test results.

Keep the machine identity stable and make every human-facing surface direct:

- `name`, the directory, and the repository slug are stable install identifiers. Do not rename
  them merely for SEO; an explicit migration plan is required.
- Use a plain task-and-outcome title for the product and README H1. The identity
  says what the skill is; the outcome says what becomes easier or finished.
- Set `agents/openai.yaml` `display_name` to two to five plain-language words. Do not rely on an
  internal metaphor, project codename, or bare slug to explain the skill.
- Set `short_description` to 25–64 characters and state the input, action, or result plainly.
- Set the repository description to a factual 50–200 character input-to-result explanation.
- Keep the manifest title and description, README H1, and `agents/openai.yaml` aligned.

Apply a three-second stranger test before release: after seeing only the display name and short
description, can someone say what this does, when they would use it, and what result they receive?
If not, the naming is not ready even when the internal slug is accurate.

Read [SEO/GEO criteria](seo-geo-criteria.md) before writing or materially changing a
public product page. Treat discoverability as an evidence problem:

- use a problem-led H1, repository description, and focused topics;
- keep one primary intent per product repository;
- write unique first-hand content and extractable definitions, steps, comparisons, and evidence;
- cite primary sources only for factual claims that need outside support;
- avoid keyword variants, fake mentions, empty FAQs, and AI-search folklore;
- do not claim indexing or ranking until a live search proves it.

## Release the product

1. Validate `SKILL.md`, bundled resources, and `agents/openai.yaml`, including the direct naming
   contract and the 25–64 character UI description limit.
2. Run the repository's product-page audit. If none exists, run
   `scripts/audit_product_page.py <skill-dir> --product-manifest <manifest>` from this skill.
3. For a new public skill, run a trigger/body probe when `scenario-probe` is available. Fix release
   blockers before publishing; record only tests that actually ran.
4. Add or update manifest metadata: problem-led title, search-oriented description, and 3–20
   focused topics. Keep descriptions factual and normally 50–200 characters.
5. Commit and push only relevant source-registry changes.
6. Invoke the confirmed publisher. For Ming's registry:

   ```bash
   scripts/verify-products
   scripts/publish-skill <skill-name>
   ```

   The publisher must not report success until its post-publish named-product monitor and direct
   Skills CLI discovery check both pass.

7. Verify the standalone repository is public and contains:
   - the product `README.md` at the repository root;
   - `skills/<skill-name>/SKILL.md` and every required bundled resource;
   - `LICENSE` and accurate repository metadata;
   - the canonical direct install command.
8. Confirm the publisher's `npx skills add <owner>/<skill-name> --list` check found exactly the
   intended skill. Internal verification must set `DISABLE_TELEMETRY=1` or `DO_NOT_TRACK=1` so it
   does not inflate the public skills.sh install count. Rerun it manually only when diagnosing a
   failed release receipt, with the same telemetry guard.
9. Check the repository's exact-name search result and skills directory presence. Record
   `not indexed yet` as a valid observation, not a release failure. Do not open third-party issues,
   request indexing, or create promotional posts without owner authority.

If `gh`, git authentication, the skills CLI, or live network access is unavailable, stop at the
last verified boundary and name every remote or install check that remains unproven.

## Run monitor repair safely

Use the monitor's persisted source cursor and remote evidence. For every detected product:

1. Classify it as `no-op`, `new-ready`, `changed-ready`, `source-dirty`, `remote-drift`,
   `metadata-drift`, `install-broken`, `not-indexed`, or `blocked`.
2. Deduplicate by skill name plus committed source tree hash.
3. Auto-repair only committed, ready, self-authored skills within the standing publication policy.
   In Ming's registry, a skill is monitor-ready only when its required files and `products.json`
   entry are present together on the upstream default branch; that manifest entry is the explicit
   release marker established by the repository contract.
4. Leave dirty or ambiguous skills untouched and report the exact blocker.
5. Verify the actuator by re-reading the remote repository and rerunning the relevant checks.
6. Advance the source cursor only after verification passes; a failed run must preserve the last
   good cursor.
7. Treat a no-change run as a successful, cheap no-op.

The monitoring loop may repair publication drift. It may not silently rewrite the product's
purpose, author story, claims, protected release policy, or the tests that define readiness.

Treat GitHub clone counts as operational diagnostics, not audience counts: release scripts,
GitHub Actions checkout, Skills CLI discovery, and other automated fetches can all increase clones
and apparent unique cloners. Use stars, forks, page views, referrers, and telemetry-clean external
install deltas as growth evidence, while still stating what each signal cannot identify.

## Report completion

Report separately:

- source commit and registry verification;
- standalone product URL and install verification;
- SEO/GEO changes actually made;
- current discovery evidence (`found`, `not found`, or `not checked`);
- skipped dirty work, pending third-party indexing, or authority still needed.

Never compress `published locally`, `pushed to the source registry`, and `verified as a standalone
product` into one claim.
