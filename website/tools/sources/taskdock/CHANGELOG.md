# Changes

## 2026-09-19 — Transaction notes and selected-path recovery (plugin 2026.9.21)

- Optional `notes` in the organization spec journals this operation's control-file
  updates with its moves. Each update requires the hash of the content actually read.
- Keep all existing read/write conflict guards, including control notes. Genuine later
  edits still prevent destructive exact rollback. Old receipts are not rewritten.
- Add read-only `recovery --path SELECTED_COPY --operation ID` to validate identity and
  preimages and regenerate shell-free arguments for an explicitly selected location.
- Add 11 deterministic regressions for integrated notes, stale-input rejection,
  post-write interruption, guarded newer work, and copy recovery leaving the original
  untouched. Existing 52 tests remain. No fresh live-model result is claimed.
- Separate immutable source evidence from working link repairs in the prospective
  continuity rubric; do not retroactively rescore the original pilot.

## 2026-09-19 — Recovery patch (plugin version 2026.9.20)

- Keep operation ID, recovery location, shell-free rollback arguments and an explicitly
  labelled shell command after apply or verification failures. No automatic rollback.
- Save recovery details before mutation. Resume discovers pending operations read-only,
  recalculates paths after a folder move, and reports bounded-scan limitations.
- Refuse non-UTF-8 reference files before modifying work files rather than silently
  skipping them and failing after a move.
- Do not report partial execution as unchanged. A write before its journal entry is
  treated as potentially applied, not as proof that nothing happened.
- POSIX and Windows PowerShell command rendering are separate; argv is the portable
  interface. Metadata reads explicitly use UTF-8; existing artifact modes are retained.
- Add fault-injection and executable shell recovery tests, and a cross-platform CI suite.
- Preserve nested evaluation READMEs in the publisher overlay. Document the limits of
  the earlier four-case model evaluation; no new model-effectiveness claim is made.
- Existing task IDs, operations, control files and preview/apply/rollback remain compatible.

## 2026-09-19 — Claude Code plugin, Python-free fallback, measurable evals

- New `organize` command: plan, apply, structure check and a ready-to-paste report with
  the rollback command in one call. Added after the eval showed the multi-step route ran
  out of turns before reporting; `plan` / `apply` remain for previewed changes.
- The trigger description now names the real job: one portable folder that a later
  session, another agent (Claude Code, Codex, ChatGPT) or another machine can resume,
  find after a move and reorganize reversibly. Chinese trigger phrases and an explicit
  "not for" clause were added; hosts now cover generic "continuing work" natively.
- `python3` unavailable is no longer a dead end: the skill tries the other interpreters
  on the machine, then writes control files by hand from `references/control-files.md`.
  Found on the maintainer's own Mac, where an unaccepted Xcode license blocks `/usr/bin/python3`.
- Installable as a Claude Code plugin: `claude plugin marketplace add m1nga/taskdock`,
  then `claude plugin install taskdock@taskdock`. The Skills CLI path is unchanged.
- `evals/` suite for `claude plugin eval` with a with/without ablation (four cases).
- `PRIVACY.md`, `SECURITY.md` and a pinned, read-only scanner workflow for the HOL registry.
- No change to task identity, control files, commands or recovery data. Existing folders
  keep working; nothing is reorganized by installing the update.


## 2026-09-13 — Current work and reversible organization

TaskDock now helps maintain the relationship between the current result, its decisions
and its files, in addition to creating and finding portable task folders.

- `record` / `reconcile`: distinguish explicit approval from actual use, detect changed
  or missing artifacts, and preserve replacement relationships.
- `inventory` / `plan`: inspect content identities and common relative references;
  preview individual moves, identical-copy merges and required link repairs.
- `apply` / `rollback`: retain original bytes, journal progress, resume after an
  interruption and refuse to overwrite conflicting new work.
- A runnable sample with design, release and research contexts proves its own undo path.
- Existing UUIDs, control files and commands remain compatible. New generated task
  notes default to English; working records can follow the user's language.

Recovery data remains local in `.taskdock/`. The organizer is for ordinary local files,
not cloud storage or complete archival metadata. No automatic cleanup or background
service is installed. Windows locking is implemented but not tested on Windows in this release.
