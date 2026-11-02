# Complete skill lifecycle

Ming's request to make or materially improve a usable self-authored skill authorizes
review, improvement, validation and publication. Do not stop at a local install or
ask for publication again. Explicit drafts, private work and "do not publish" stay
unpublished. Apply another owner's actual release policy in their environment.

## 1. Use it from the user's seat

Start with only the public description and a realistic request. Check whether the
purpose, trigger, setup, result and recovery path make sense without owner context.
Then perform a normal use and a meaningful boundary or failure case. Execute bundled
scripts in an isolated task-owned test directory when available. Check file-changing
skills preserve existing work and work from a different current directory.

Label a reasoning walkthrough as simulated; do not call it real user research or
an independent test. Use a fresh reviewer when explicitly authorized and worthwhile,
not for every small wording change. Include trigger-only and sibling-collision cases
when instruction routing changes. Inspect outcome usefulness, not just file existence.

## 2. Learn from the closest comparable skills

Search current public skill sources and inspect the actual relevant SKILL.md or
script, preferably two close alternatives. Use author repositories and record source
URLs plus revision or access date. Similar names and star counts do not establish
better behavior. Existing trusted comparisons can be reused for a small follow-up if
they still address the changed scope; state what was rechecked.

For each useful difference, record adopt, adapt or reject, and why it fits the user's
work. Do not force a code change when the comparison confirms the current design.
Borrow ideas without copying protected source; honor the license and attribution when
actual code is reused. Do not install third-party skills merely to inspect them.
If research is unavailable, record the real limitation and continue independent work;
do not mark the required stage passed or claim the release is complete.

## 3. Improve, validate, publish

Apply the justified changes and rerun affected scenarios and tests. Keep the evidence
small: one sanitized JSON receipt at `ops/skill-quality/reviews/<skill>.json` in the
registry. Private raw task notes and user files stay in the Desktop task workspace.
The receipt contains:

- `schema_version: 1`, `skill`, `reviewed_at`, and `source_sha256`;
- `user_review.method` and at least two `scenarios`, each with `request`, `expected`,
  `observed`, `kind` (executed/simulated), and `result` (pass/fixed);
- `similar_skills`: source `url`, `checked_at`, `learned`, `decision` (adopt/adapt/reject)
  and `reason`;
- `validation`: actual `command`, `result: pass`, and `observed` evidence;
- `unresolved_blockers: []` only when no release blocker remains.

After final source and product metadata edits, get the digest with:

```bash
python3 publish-skill-product/scripts/review_gate.py . SKILL_NAME --fingerprint
```

Write the receipt from work actually performed; a populated form is not a review.
Run `scripts/verify-products`, commit and push relevant source and receipts, then
`scripts/publish-skill SKILL_NAME`. The publisher independently checks committed
quality evidence, remote content and direct Skills CLI discovery. Source or metadata
changes invalidate the receipt. Do not edit the legacy baseline to bypass this gate.
Existing unchanged releases are grandfathered, not falsely certified as reviewed.

Complete the task only after reporting source commit, product URL, install command
and actual validation result. A blocked release retains the next recovery step in
STATE.md. Do not add a recurring job or external promotional message to enforce this
workflow; ordinary skill creation runs it in the same task.
