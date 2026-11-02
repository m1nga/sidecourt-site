# CLI operating reference

Requires Python 3.10+; standard library only, no network or model calls. Resolve symlinked
workspace paths first (on macOS, `/var/...` commonly resolves to `/private/var/...`).
In the examples, `SCRIPT_DIR` means the installed skill's `scripts` directory, and
`ROOT` is the actual project root. JSON files should be private and live outside the skill.
Commands produce JSON. Engine errors use stderr and exit 2; other scripts report errors
in JSON. Check exit code and `ok`, not just whether an output file exists.

## Enter, initialize, and find

```sh
python3 SCRIPT_DIR/memory.py status --root ROOT
python3 SCRIPT_DIR/memory.py init --root ROOT
python3 SCRIPT_DIR/registry.py register --root ROOT --label "Project name"
python3 SCRIPT_DIR/registry.py list
python3 SCRIPT_DIR/registry.py locate --query "Project name"
python3 SCRIPT_DIR/registry.py recall --project "Project name" --query "review policy" --limit 8
python3 SCRIPT_DIR/memory.py recall --root ROOT --query "review policy" --limit 8
```

`init` is explicit and idempotent. The registry stores paths/identity only. If the selected
project has several registered locations, select one exact root; do not merge copies.
`recall --explore` also includes ideas, proposals, candidate/trial lessons. Default recall
excludes these, superseded/retired/rejected/suspended records, and changed/missing sources.
Text-only evidence cannot detect updates elsewhere. Retrieval is lexical, including Chinese
characters/bigrams, not semantic search: vary terms or inspect bounded current records if
the first query is empty. Never claim “it does not exist” from one query miss.

## Capture a delta

```sh
python3 SCRIPT_DIR/memory.py capture --root ROOT --input capture.json
```

```json
{
  "key": "review-policy",
  "kind": "decision",
  "authority": "user",
  "actor": "current-agent",
  "summary": "Low-risk typo corrections need one reviewer; safety-sensitive changes still need two.",
  "source": {"text": "The user's exact relevant instruction or a faithful bounded excerpt.", "locator": "conversation/turn identifier"},
  "applicability": "This project's review policy only",
  "tags": ["review", "policy"]
}
```

`source` requires exactly one of `text` or `path`, plus `locator`. File sources must be UTF-8,
inside ROOT, not symlinks or secret-bearing files, and at most 1 MiB. Their contents are
snapshotted and hashed. Use small dedicated evidence files instead of large logs.

Kinds: `decision`, `fact`, `open`, `idea`, `preference`, `lesson`.
Authorities: `user`, `observed`, `assistant`. `actor` is who is recording, not fabricated
approval. Cite a real user source for `authority:user`. Assistant decisions/preferences stay
proposed; observed facts may be confirmed. Every lesson starts candidate.

Updating the same `key` requires `expected_revision` and `supersedes_reason`. Identical
content is deduplicated. Do not evade a revision conflict with a new key; reconcile the
latest version. Different keys can still contradict semantically: the agent must check.

## Learning with a real outcome

Use the same `memory.py COMMAND --root ROOT --input FILE` shape:

1. `capture`: a `lesson` with context, mechanism, boundary and source episode.
2. `review`: `{"id":"...","revision":1,"reviewer":"independent-reviewer","action":"trial","rationale":"...","checks":[{"text":"actual check","locator":"..."}],"counterexample":{"text":"boundary test","locator":"..."}}`.
3. `use`: `{"id":"...","revision":1,"actor":"executor","context":"actual application","expected_outcome":"testable expectation","turn_key":"optional stable key"}`. Candidate lessons must first enter trial.
4. `observe`: `{"use_id":"returned UUID","actor":"observer","verdict":"improved","baseline":"prior comparison","result":"observed result","evidence":{"path":"evidence/result.txt","locator":"test run"}}`.
5. `review` with `action:promote`, independent reviewer, rationale, concrete `checks` and
   `counterexample`. Promotion requires trial status and beneficial evidence for this revision.

Other verdicts: `neutral`, `harmful`, `inconclusive`. Harmful suspends the current lesson.
Outcomes are immutable and tied to a real use; corrections require a new use/revision with
explanation, never rewriting inconvenient evidence. A different string is not a real reviewer.

`review action:reject|retire` demotes without an independent reviewer. All reviews require
check evidence. Non-lessons support `retire` only: decisions/preferences require `authority:user`;
facts/open items require `user|observed`; ideas may use `assistant`. Retiring an indexed record
does not cancel a product decision or delete its authoritative document.

## Checkpoint and coverage

```json
{
  "turn_key": "host:session:actual-turn-id-or-explicit-logical-key",
  "actor": "current-agent",
  "summary": "What actually changed and what was verified",
  "next_action": "Concrete next step, or no further action",
  "record_ids": ["saved-record-id"],
  "no_change": false,
  "session_id": "actual-session-if-known",
  "host": "codex"
}
```

Run `checkpoint` with this input. `no_change:true` requires an empty `record_ids` array.
Use real IDs when exposed; otherwise label a logical key and leave unknown session fields
out. Do not invent an actual host turn ID. Only the exact receipt key counts as host coverage.
See `host-integration.md` for receipt reconciliation. `status` shows pending lessons/outcomes,
staleness, counts and last checkpoint; status is evidence about records, not work completion.

## Take the valuable work away

```sh
python3 SCRIPT_DIR/memory.py export --root ROOT --out NEW_PROJECT_DIRECTORY
python3 SCRIPT_DIR/bundle.py --out NEW_BUNDLE_DIRECTORY
python3 SCRIPT_DIR/bundle.py --project "Project name" --out NEW_BUNDLE_DIRECTORY
```

Project export includes all eligible current records by default, clearly labeled options,
selected evidence snapshots and lesson verification chains. Current suspended/rejected
lessons travel separately as `cautions`, labeled `DO_NOT_REAPPLY`, with negative evidence
and freshness flags. They are not active guidance. An explicit `--limit` may
truncate and is reported. Multi-project bundle packages registered roots and a generic skill
copy; repeated `--project` selects a subset. Missing roots or stale current sources produce a partial bundle with gaps
and nonzero exit, never a fake complete handover. Neither export includes whole repositories.

All destinations must be new directories under an existing parent. Inspect `catalog.json`,
`records.json`, exclusions, pending counts and manifests before claiming completion. Keep
partial outputs for diagnosis; retry a new path. The handover is readable without the old
account. This version does not automatically import the old database into a new runtime.

## Bounded context and evidence reading

`context.py` is a read-only companion to this CLI. It works without Major Tom and never initializes
an absent database. Use the explicit actual project root (resolve installation aliases first).

```sh
python3 SCRIPT_DIR/context.py brief --root ROOT --query "current question" --mode execute --limit 5
python3 SCRIPT_DIR/context.py brief --root ROOT --query "possible directions" --mode explore
python3 SCRIPT_DIR/context.py show --root ROOT --id RECORD_ID --revision 2 --offset 0 --limit 2000
```

Brief limits are 1–20 per current/options section, with at most three relevant cautions and five
exclusion diagnostics. Text fields are clipped with flags. `context_sha256` identifies the emitted
context only; it is not a freshness guarantee for remote state or absent instructions. `show`
returns stored evidence pages (1–8000 characters per field), source checksum, current eligibility
and next offset. Older revisions remain audit-only. Review mode includes unverified options for
assessment; it never performs review or promotion itself.
