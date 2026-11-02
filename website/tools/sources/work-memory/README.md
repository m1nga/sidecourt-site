# Work Memory — Recover Current Context and Learn from Outcomes

Keep useful project knowledge between sessions without carrying every conversation into the next.
Work Memory retrieves current sourced decisions, preserves ideas for exploration, and keeps failed
methods visible as cautions instead of allowing them to return as active guidance.

## New: an output you can use

Before relying on remembered work, run a read-only readiness check:

```sh
python3 SKILL_DIR/scripts/doctor.py --root ROOT --query "current task"
python3 SKILL_DIR/scripts/doctor.py --root ROOT --query "current task" --out memory-readiness.html
```

The result separates a missing database, stale file evidence, pending learning outcomes and a bounded current brief. It does not initialize an absent project or silently repair anything. A report can be opened without a server and refuses to overwrite another file. Review private evidence and paths before sharing. `ok: true` means diagnostics ran; it does not certify memory completeness or authorize applying a candidate lesson.

## What it does

- Stores selective, sourced records in a private project-local SQLite database with revision checks.
- Produces small task briefs with separate current evidence, exploratory options and cautions.
- Reads an exact source snapshot in pages, with checksums and explicit freshness limits.
- Applies direct user corrections without making them experiments; reusable lessons follow a
  bounded trial, observation and independent review path.
- Supports project discovery, checkpoints and portable exports without copying account sessions.

It needs Python 3.10+ only. There are no model API calls, embeddings service, background agent or
scheduler. Metadata-only host adapters are optional and do not prove learning or full coverage.

## Who it's for

Use during substantive ongoing work, meaningful corrections, prior-decision retrieval and handover.
Skip one-off questions and ordinary chatter. Existing TaskDock and repository documents remain
authoritative; memory keeps a selective index and learning trail. Major Tom is optional.

## Install

```sh
npx skills add m1nga/work-memory
```

Ask: `Use $work-memory to recover the current decision for this project and its source.`
Replace SCRIPT_DIR with the installed scripts directory and ROOT with the actual project root.
Initialize only a project that merits continuity, then register it once for later lookup.

```sh
python3 SCRIPT_DIR/memory.py init --root ROOT
python3 SCRIPT_DIR/registry.py register --root ROOT --label "Project name"
python3 SCRIPT_DIR/context.py brief --root ROOT --query "page layout" --mode execute
python3 SCRIPT_DIR/context.py brief --root ROOT --query "page layout" --mode explore
python3 SCRIPT_DIR/context.py show --root ROOT --id RECORD_ID --revision 2
```

See the [command reference](https://github.com/m1nga/skills/blob/main/work-memory/references/commands.md) for sourced capture JSON,
revision updates and lesson testing. A read-only brief does not create a missing database.

## Example

A user selects a page direction, then changes it after seeing the real screenshot. Record both
with provenance, superseding the older decision under the same key. Execution retrieves the current
choice; exploration can also retrieve an untried alternative. The old source remains available for
audit, explicitly ineligible as current guidance. The visual artifact stays in the project, linked
from a text evidence note; this tool does not inspect image pixels.

## Design notes

Layered reading is useful only when the small view leads back to trustworthy evidence. This design
uses bounded summaries and exact source snapshots, rather than global personality inference or
automatic transcript ingestion. Direct decisions and experimental lessons have different lifecycles.

Canonical maintained source: [m1nga/skills](https://github.com/m1nga/skills/tree/main/work-memory).
The initial implementation was recovered from the published
[m1nga/skill-builder source](https://github.com/m1nga/skill-builder/tree/8926217d18fb4a3ef19dcee770d283210e942064/skills/work-memory).
Optional coordinator: [Major Tom](https://github.com/m1nga/major-tom).

## Validation

73 isolated Python tests passed: evidence/revisions, concurrent capture, learning boundaries,
exports, registry routing, host adapter fixtures and the new context/evidence reader. Cases include
stale sources, superseded decisions, harmful lessons, separate exploration, read-only access and
missing projects. User-scenario walkthroughs are author simulations. Long-term benefit and automatic
host selection remain unproven; fixture adapter tests are not real host-delivery receipts.

```sh
python3 -B -m unittest discover -s skills/work-memory/scripts -p 'test_*.py'
```

## Privacy and limits

Runtime data belongs in the project's `.work-memory/`, not the skill. Keep its protective gitignore.
Retrieval is lexical, so a missed query is not proof of absence. Text snapshots cannot detect later
contradictions elsewhere; source-file checks cannot detect changed images linked only from text.
A distinct reviewer name is not authentication. Without actual independent review, lessons remain
pending. Export is explicit and does not migrate a remote account or install a background listener.

## Author

Built and maintained by [Ming](https://github.com/m1nga).
