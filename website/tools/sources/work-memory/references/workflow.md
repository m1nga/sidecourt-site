# Memory in ordinary work

Memory supports the executor. It is not another owner, approval chain or always-running agent.

## Start from the current question

Resolve the actual project root, read its current authoritative state, and obtain a bounded brief:

```sh
python3 SCRIPT_DIR/context.py brief --root ROOT --query "page layout" --mode execute --limit 5
python3 SCRIPT_DIR/context.py brief --root ROOT --query "page layout" --mode explore --limit 5
python3 SCRIPT_DIR/context.py show --root ROOT --id RECORD_ID --revision 2 --limit 2000
```

Execute includes current eligible records. Explore and review also include candidates and ideas
in a separate options list. All modes expose matching rejected/suspended lesson cautions marked
DO_NOT_REAPPLY; their presence never makes them guidance. A caution may itself have stale sources.
The brief reports bounded exclusions, truncation and exact revisions. Use `show --offset N` to
page the stored source, summary and applicability. A historical or stale source remains auditable
but is explicitly ineligible for current execution context. Text snapshots cannot prove live
freshness. The tool reads an existing store only; it never initializes, captures or promotes.

Retrieval is lexical. Try alternate language/domain terms or a small unfiltered inventory when
needed. Capture useful bilingual terms as tags when appropriate. Do not add a vector service or
re-ingest transcripts before actual miss cases justify the cost. Applicable constraints may not
match the query, so the brief never replaces current instructions and project state.

## Record only the meaningful change

| What happened | Record type | Treatment |
|---|---|---|
| User corrected a goal or local choice | decision / preference | Apply in explicit scope; no experimental approval |
| A result or receipt was independently observed | fact | Save source/time; do not infer unmeasured outcomes |
| A reference suggests a possible direction | idea | Retrieve during exploration; not an instruction |
| A method might work again | lesson | Candidate, bounded trial, observation, independent promotion |
| Outcome is delayed or a dependency unresolved | open | Owner and next check in existing state; no extra scheduler |

Do not duplicate TaskDock STATE/PLAN or product requirements. Use the existing canonical source
plus a small excerpt. Update the existing record key with expected_revision when corrected.
Reference drift or an ambiguous root needs reconciliation; do not silently select the newest copy.

## Preserve concrete design choices

Keep screenshots, editable artifacts and reference material in the project. Write a short text
note with their relative paths, the actual chosen version, what the user accepted and why, and
whether the choice is local or explicitly broader. Capture that note as a decision source.
An image path proves neither visual inspection nor user acceptance. If pixels change without the
note changing, the memory source hash cannot detect that; inspect the linked visual when needed.
Do not store invented visual judgments or infer a universal preference from one accepted example.

## Evidence and effort

A direct correction does not wait for a reviewer. A proposed reusable lesson does. Without an
already-authorized independent reviewer, leave it candidate/pending and keep doing ordinary work.
Do not manufacture a promotion, appoint the same agent under another name or turn every fact into
a five-step experiment. Follow the existing learning contract when actually testing a lesson.

When Major Tom is present, it chooses the work and consumes relevant IDs/revisions; this store
owns the selective learning trail. With no coordinator, the executor does the same recall/capture
at natural boundaries. Existing EXPERIENCE ledgers can supply evidence; do not copy their entire
history. No change worth retaining means one compact checkpoint, without a user-facing report.

A useful pilot asks: did a new session recover the current choice and its evidence, avoid the
superseded choice, preserve an unresolved question, and keep ideas available during exploration?
Measure real rework/corrections where observed. A passing script test proves mechanics only.
