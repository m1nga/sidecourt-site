# Iteration Cleanup & Handoff — Preserve Decisions and Remove Dead Work

Close an iteration so nothing is lost and nothing dead survives — and prove, with an actual test, that a stranger could take the repo over.

## What it does

Runs a five-phase close at the end of an iteration, sprint, or milestone. It distills chat-born
decisions into the repo's own record, then deletes superseded files — after showing you the full
deletion list and getting your yes (untracked files go to a quarantine directory, never straight
to `rm`, because git history can't recover what was never committed). It verifies upload and
knowledge-completeness as two separate channels, including a cold-start probe: a fresh agent
reads the repo with zero context and must answer four questions correctly, or the docs get fixed
and it runs again. Then it rehearses the one-command bootstrap on a fresh clone, tags the
iteration, and hands you a paste-ready kickoff prompt for the next one. If all you want is the
cleanup, it runs that phase alone.

## When it fires

- "Let's close out this iteration."
- "Wrap up this sprint and clear out the dead files."
- "We shipped the slice — could a fresh machine pick this up tomorrow?"
- "Clean the superseded files out of the repo."
- 「这个迭代做完了，收口」
- 「甩包袱，清旧账」

It stays quiet on a casual "calling it a day" and on questions about how to publish a package —
those aren't iteration closes.

## Install

```
npx skills add m1nga/iteration-close
```

## Try a scoped cleanup

After installing, ask: `Use $iteration-close in shed-only mode. List the
superseded files and what replaces each one; keep everything until I approve
the exact list.`

Illustrative fixture, not a recorded production cleanup:

| Candidate | Evidence | User decision | Expected action |
|---|---|---|---|
| Tracked `docs/old-flow.md` | Replaced by current `docs/flow.md`; no remaining references | Approve | Remove with `git rm` after banking any unique decision |
| Untracked `scratch-notes/` | Contains notes worth retaining | Approve quarantine | Move to the declared, gitignored quarantine directory |
| Tracked `legacy-parser.ts` | Replacement is not yet verified | Keep | Leave untouched |

The result is one tracked removal, one recoverable quarantine, and one retained
file. The agent checks references and runs the repo's test suite if present.
Shed-only mode ends there; a full close separately checks upload, a context-free
takeover, bootstrap, tagging, and the next-iteration seed.

If the test suite is failing or another worker owns unfinished changes in a
candidate path, the skill reports that blocker before cleanup. A missing test
suite is recorded as missing, never reported as passing.

If this helps you close an iteration with a clear handoff, a star on this
repository is welcome.

## Works well with

- [`diagnose-project-rebuild`](https://github.com/m1nga/diagnose-project-rebuild) — when the repo is too tangled to close, diagnose it first; close later.
- [`map-product-system`](https://github.com/m1nga/map-product-system) — the architecture note Phase 1 keeps current pairs naturally with a full product-system map.

## Design notes

This skill exists because of two real losses in a solo builder's history: a working pipeline that
lived only in a scratchpad and died with the session, and a deprecated directory that sat around
for weeks until the docs told two different truths. Each opinionated rule traces back to a scar:

- **Distill before delete.** Nothing is removed until its lesson is banked in a tracked file. The
  phase order is the safety mechanism, not a style preference.
- **Git history is the only archive.** `_archive/` dirs and `.bak` files rot into second truths.
  Recovery for tracked files is one `git revert` away — so tracked files may die cleanly.
- **Untracked files get quarantined, not deleted.** Git can't resurrect what was never committed.
  That asymmetry is the data-safety line, and the skill refuses to cross it.
- **The agent never presses irreversible buttons.** The complete deletion list is shown, and
  nothing runs without an explicit yes. Partial approval works — it deletes only what you approved.
- **"Anyone could take over" is tested, not hoped.** A context-free reader either scores 4/4 on
  the takeover probe, or every miss is treated as a documentation bug and fixed before re-running.

## Field-tested

Probed 9 scenarios across 5 personas · 5 fired correctly · 2 correctly stayed quiet · 2 flagged (one degraded-world path, one coin-flip; fixes queued).

> **"今天收工了，明天见" ("calling it a day — see you tomorrow")**
> → Correctly stayed quiet. An end-of-day sign-off is not an iteration close; the description now excludes it by name.

> **"清旧账，把没用的旧文件清一清" ("clear out the old junk files")**
> → Fired in shed-only mode: built the full deletion inventory, waited for an explicit yes before removing anything, and moved untracked files to quarantine instead of `rm` — git history can't resurrect what was never committed.

> **"how do I publish an npm package?"**
> → Correctly stayed quiet. Publish-a-package questions are explicitly excluded — this skill closes iterations, it doesn't teach packaging.

Probe method: [scenario-probe](https://github.com/m1nga/scenario-probe/)
