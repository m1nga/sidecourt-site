# Organize work without losing its history

Use these tools for an explicit organization request or a concrete version/entry
conflict. Ordinary work only needs the short resume path. Run scripts from the
installed skill directory (use an absolute path when your shell is elsewhere).

## Read the actual work first

Identify the user-selected outcome, its implementation or delivery version, and the
files this task owns. Approval, actual use, and publication are separate facts.
When current code contains a rejected choice, report both facts. Do not infer that
an unused asset was rejected or a same-hash delivery copy is unnecessary.

`inventory --path TASK` is read-only. It lists local hashes, identical-content groups,
and common relative Markdown/HTML/CSS references. It skips symlinks, nested Git
repositories, `.taskdock`, dependency/cache folders; 10,000 files is a hard limit.
Reference parsing skips files larger than 2 MiB and non-UTF-8 text. Dynamic code,
absolute/root-relative URLs, Office documents, cloud objects and permissions need
separate inspection. A missing static reference never establishes that deletion is safe.

## Record a few consequential artifacts

The agent prepares this JSON from actual evidence. The user should not have to fill
out a taxonomy form. Store the input in the task, not the installed skill.

```json
{"items":[
  {"id":"homepage","path":"web/index.html","role":"runtime",
   "decision":"approved","used_in":["local-review-v2"],
   "evidence":"User selected this local version; production deployment unverified",
   "replaces":["homepage-v1"]}
]}
```

```bash
python3 scripts/taskdock.py record --path TASK --spec artifacts-input.json
python3 scripts/taskdock.py reconcile --path TASK
```

`role`: source / working / runtime / delivery / reference / history.
`decision`: proposed / approved / rejected / superseded / unknown.
`used_in` names actual versions or contexts; it is not approval. `replaces` refers
to artifact IDs. Record old choices when their reason matters, with an evidence pointer.
The record command upserts only specified IDs and captures their current hashes.
Re-record after reviewing a changed artifact; do not automatically bless every new hash.

`reconcile` reports missing/changed content, unknown replacement IDs and rejected or
superseded objects still used in a recorded context. It does not understand whether
all prose in STATE is up to date. The agent compares relevant records and corrects
current prose within its ownership. Keep historical wording in the evidence layer.

## Plan the whole change, including links

One call does the whole thing when no preview is needed:

```bash
python3 scripts/taskdock.py organize --path TASK --spec moves.json
```

It plans, applies, runs the structure check and returns `report` lines plus the exact
`rollback` command. Use `plan` first when the user wants to review before anything moves.
A path can appear in only one operation per call: merge a duplicate into its survivor
first, then move the survivor in a second call.


A plan spec lists individual files, not recursive directory moves:

```json
{"operations":[
  {"type":"move","from":"draft.md","to":"results/current.md",
   "reason":"User selected this result"},
  {"type":"merge","from":"download-copy.png","to":"assets/original.png",
   "reason":"Identical download with no independent purpose"}
],"preserve":["sources","history","history-note.md"]}
```

```bash
python3 scripts/taskdock.py plan --path TASK --spec organize-input.json
```

This is a dry run for work files. It creates a plan and private preimages in
`.taskdock/operations/ID/`. Read the returned changes, reasons, link repairs and
coverage before executing. Already-authorized changes do not need a second routine
approval; unresolved ownership or scope needs resolution for the affected operation.

All sources and targets must be ordinary files inside this task. Control files stay
at the root; their links may be repaired. Traversals, symlink paths, overlapping moves,
case aliases, occupied destinations and nested repositories are rejected. Merges
require identical content and a reason that their purposes are redundant.

`preserve` defaults to top-level `sources`, `history`, and `历史`. If their relative
links would need changes, planning stops rather than rewriting originals. Keep the
original in place, supply a separate reading copy, or explicitly narrow this list
only when the text is a working document. Plan also updates registered artifact paths;
its old evidence hash remains so substantive or link edits can be reviewed honestly.

## Include this operation's notes, not a later self-conflicting edit

If the move also changes the task's entry/state/plan, put those changes in the same
spec. `notes` is optional; update only the files that need a real change. Each key is
an existing `README.md`, `STATE.md`, `PLAN.md`, `AGENTS.md` or `INDEX.md`:

```json
{"operations":[{"type":"move","from":"cover.svg","to":"assets/cover.svg",
 "reason":"Keep the asset findable"}],
 "notes":{"STATE.md":{"expected_sha256":"<SHA-256 of the exact existing bytes>",
 "text":"# State\nCover organized; publication remains unverified. [Cover](cover.svg)\n"}}}
```

The agent reads the existing content, computes its hash and prepares the complete
replacement text. Preserve unrelated facts; do not fabricate approval or completion.
Use pre-move link paths in proposed text; the planner relocates supported links.
A missing/stale hash, unsupported target, changed source or protected note refuses the
plan. `plan` previews notes without changing work files. `organize` applies the notes
and moves as one journaled recovery unit, not a filesystem-wide atomic transaction.
Its `notes_updated` field names the changed notes. Exact rollback restores their
pre-operation contents and supported modes along with the files.

Do not immediately edit those notes again to record this same organization. Report in
chat instead. A genuinely later decision is newer work: keep it, expect exact rollback
to refuse, and review recovery rather than ignoring guards or writing a force script.
Old receipts remain valid but cannot retroactively absorb unrecorded follow-up notes.

## Apply, resume or undo

```bash
python3 scripts/taskdock.py apply --path TASK --operation ID
python3 scripts/taskdock.py rollback --path TASK --operation ID
```

Use the real ID returned by `plan`. Apply first checks every affected file and read
dependency. New or changed reference documents invalidate the plan. It writes surviving
files before removing old paths and journals progress. Preimages retain bytes and
POSIX mode bits. Repeating a completed apply/rollback is a checked no-op.
After an interruption, run the same command and ID to resume, or rollback the partial
operation. A rolled-back plan cannot be reapplied: make a new plan against current work.

A conflict leaves new work in place. Preflight conflicts change no work files; a
mid-operation error may leave earlier journaled steps complete. Inspect the receipt
and preserve the other edits before planning recovery. Never delete a receipt or
force through a conflict to get a green check. TaskDock's lock coordinates its own
processes, not unrelated editors. Do not organize paths while another worker is
writing them; multi-file changes are recoverable, not a filesystem-wide atomic transaction.

`.taskdock` contains original bytes, not just metadata. Keep it private and include it
in your own backup. In a Git workspace, ignore it before staging. It is local recovery,
not off-device backup. Extended attributes, ACLs, timestamps, hard-link identity and
empty-directory layout are not preserved as an archival format. Do not use this file
organizer for legal archives, application bundles or files whose behavior depends on
those attributes. Windows checks run in CI with PowerShell. Windows does not preserve POSIX executable bits.

Include any organization-related entry/state/plan changes in the `notes` spec first.
Finish by checking relevant user paths and generators without an extra bookkeeping
write that would invalidate the just-issued exact rollback. `check` covers common Markdown paths; browser rendering and production
behavior require their own evidence. Report exactly what changed and how to undo it.

## Recovery reporting contract

Once a plan exists, organization failures retain `operation_id`, `recovery`,
`rollback_argv`, `rollback_shell` and `rollback`. Prefer executing the argv array with
`shell=False`. The display command is POSIX shell syntax on macOS/Linux and explicitly
PowerShell syntax on Windows; do not paste it into a different shell.

`mutation_state` distinguishes `not_started`, `applied`, `partial_or_unverified` and
`unknown`. An empty completed-entry list is not evidence of zero writes. Recovery
metadata is saved before apply. A process killed between a write and its log entry
can be discovered through `resume` and recovered with the original operation ID.
The bounded recovery scan reports when it is incomplete; it does not silently select
one operation out of an incomplete list. An applied operation is omitted from the
pending list, not deleted from disk. Recovery after a task-folder move uses its new path.

Non-UTF-8 reference files are rejected before work-file changes. The helper does not
convert user files. Unsupported dynamic/cloud/Office references still require separate
inspection. Failed checks are not a successful completion claim. Each undo covers one
operation; a merge followed by a move requires both operations undone in reverse order.

## Recover on an explicitly selected copy or moved folder

```bash
python3 "<current-skill-dir>/scripts/taskdock.py" recovery --path "<selected-task-copy>" --operation ID
```

This read-only command verifies the selected folder's task ID, receipt and preimage
hashes, then emits new `rollback_argv` for that folder and the currently used interpreter
and script. The selected copy must include TASK.json, its control files and `.taskdock`.
Keep the original untouched when testing a disposable copy. Command generation is not
proof that a rollback will pass its later conflict checks; execute and verify it.

An absolute path in the original report deliberately identifies the original task.
It is not a promise that copying the folder retargets that command. The helper/compatible
Python must exist on the recovery machine; no executable or interpreter is embedded in
the task. Do not directly copy private blobs back to work files: blobs use mode 0600 for
private storage; the transaction engine restores the work-file modes saved in the plan.
