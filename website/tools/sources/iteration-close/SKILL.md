---
name: iteration-close
description: >-
  Close out a development iteration, sprint, or milestone in any repo, distill chat-born decisions
  into the repo's own record, then shed superseded files — git history is the archive (no _archive
  dirs, .bak, or legacy- renames), the full deletion list needs the user's explicit yes before
  anything is removed, and untracked files are quarantined, never rm'd. Verify two separate readiness
  channels (a confirmed upload AND a tested zero-context takeover probe), rehearse the one-command
  bootstrap on a fresh clone, then tag and seed the next iteration. Runs the cleanup phase alone when
  the user only wants dead files cleared. Trigger on: "close out this iteration", "wrap up this sprint
  and clean out the dead files", "could a fresh machine take this over?", "clear the superseded files
  from the repo", "milestone's done — tidy and tag it", 收口 / 迭代收口 / 迭代收尾 / 收尾 / 封版 / 甩包袱 / 清旧账 / 蜕壳 /
  这个迭代做完了 / 可以发版了 / 这版可以发版了 / 收尾上云. NOT a casual end-of-day sign-off; NOT how-to-publish-a-package
  questions. Works in Claude Code and Codex.
---

# iteration-close — distill, shed, prove takeover, rehearse bootstrap, seed next

A product that iterates forever accumulates two silent debts, and this skill pays both down at
every iteration boundary — safely (nothing is lost) but ruthlessly (nothing dead is kept):
- Dead files linger and rot into two-truths — a deprecated tree sits around for weeks; a runbook
  keeps claiming a component is "not built" long after it shipped.
- Knowledge that lives only in a chat window dies with it — whole working pipelines have died in
  scratchpads; hard-won decisions die with the session. Keep the lesson, not the artifact.

It is generic: it works on any repo by reading that repo's own conventions, and where a
convention is absent it creates the minimum rather than assuming or erroring. "A fresh window or
new machine can continue" is a HOPE until it is TESTED; being current (pull) is always safe, but
publishing (push) is a deliberate choice. Respond in the language the user is working in.

## Two ways to run

- **Full close** (default): all five phases, in order. Use when an iteration/slice is done and
  the user wants it closed out end to end.
- **Shed-only** (standalone cleanup): when the user only asks to clear old/dead/superseded files,
  run Phase 2 alone — do NOT force the full five-act close on them. Preconditions still apply:
  run Step 0 (orient), the fail-closed refusal checks, and a Phase 1 spot-check scoped to the
  deletion inventory — any item whose lesson or decision lives only in chat gets distilled into a
  tracked file first, or stays out of the inventory. Every Phase 2 rule applies unchanged,
  including the explicit-yes gate and the quarantine rule.

## Step 0 — orient to THIS repo (discover, else plan to create)

Read whichever entry doc exists — `CLAUDE.md` / `AGENTS.md` / `README` / a `docs/` index — and
discover six things. Use what you find; where something is absent, note it as a gap this close
will fill (each phase below says how), never invent a path that isn't there.

1. **Lesson/decision record** — where does this repo bank decisions? (`CHANGELOG`, `docs/adr/`,
   `DECISIONS.md`, or a repo-specific register.) If none, Phase 1 creates a single `DECISIONS.md`.
2. **Confirmed-upload command** — a deliberate push step (`bin/sync`, `make deploy`, a documented
   `git push` discipline)? If yes, that IS the upload channel; never bypass it. If none, Phase 3a
   uses plain `git push` after a diffstat + confirm.
3. **Bootstrap command** — how does a fresh clone come alive? (`bin/bootstrap`, `bin/sync-setup`,
   `install.sh`, `make setup`, a package-manager install.) If none, Phase 4 creates one.
4. **Test command** — from CI config, `package.json` scripts, a Makefile, or the language default
   (`pytest` / `go test` / `cargo test` / `npm test`). If none is discoverable, the repo has no
   runnable suite yet: treat that as an explicit state below — never read it as "green", never
   REFUSE on a repo that legitimately has none.
5. **Grounding / gate skill** — a product-grounding or pre-build gate skill? If so, its
   "after-build" checklist is your pre-close gate. (Product-specific gates live inside the product
   repo; this skill stays generic and defers to them.)
6. **Declared data / recovery / quarantine directories** — directories the entry doc names as
   holding real data, recovery material, or quarantined files. These are exempt from every
   "archive-shaped dirs must not exist" rule below and must never appear on a deletion inventory.

## Refuse to run (fail-closed)

Do not close mid-iteration — you lose skin AND flesh. REFUSE (in both run modes) if: the
directory is not a git repository (stop and say so — running `git init` is the user's
decision); the test
suite exists and is actually FAILING (an absent suite is not a failing one — see Step 0.4); an
adversarial gate, if the repo has one, is pending or CHANGES-REQUIRED; or another agent/lane has
uncommitted mid-slice work in paths you'd touch. Say what's blocking and stop.

In a full close, run the phases IN ORDER. Each has an exit test; never proceed past a failed exit.

## Phase 1 — DISTILL (salvage gate: nothing dies before its lesson is banked)

1. Sweep this iteration's chat-born decisions into the repo's decision record (Step 0.1), each
   with its status and source. **If the repo banks decisions nowhere yet, creating the record is
   part of this phase — a single `DECISIONS.md` at repo root is enough.** A decision that exists
   only in a chat window does not exist; do not leave distilled decisions with no tracked home.
2. New invariants/rules discovered this iteration → the repo's contracts file, or lacking that the
   decision record — ideally each as a test. If neither exists, create the decision record and put
   them there. Delete the artifact, keep the invariant.
3. Session-only-capability check: did this iteration rely on anything living ONLY in a prompt, a
   scratchpad, or someone's memory? Promote it into the repo (code / skill / doc) or record its
   deliberate exclusion. Name each one explicitly — this is where pipelines die.
4. If the STRUCTURE changed, update — or, if none exists and the structure is now nontrivial,
   create — a short architecture/system note so it still describes reality. Bring any status board
   (e.g. a progress doc) current if the repo has one.

EXIT TEST: grep this iteration's key decisions and invariants inside the repo — every one findable
in a tracked file. Anything findable only in chat = Phase 1 not done.

## Phase 2 — SHED (ruthless deletion; git history is the ONLY archive)

1. Build a deletion inventory with evidence, one line each: `path | why dead | what supersedes it`.
   Cover superseded modules/specs, dead/empty dirs, dev residue (scratch files, `mktemp`-style
   junk, test rows in real-shaped stores), completed plan/TODO docs, and STALE DOCS — run a
   docs-vs-code contradiction pass; a doc that asserts what the code contradicts is worse than none.
   Mark each line TRACKED or UNTRACKED (`git ls-files --error-unmatch <path>`), because the two
   have different fates (rules 3 and 4).
2. **Present the COMPLETE inventory to the user and wait for an explicit yes before deleting
   anything.** Partial approval is fine — act only on approved lines. The agent never presses
   irreversible buttons on its own; "the user asked for a cleanup" authorizes building the list,
   not executing it.
3. Tracked files: `git rm` only. NO `_archive/` dirs, NO `.bak`, NO `old-`/`legacy-` renames, NO
   commented-out corpses. Recovery = git history, one `git revert` away — that is the archive; a
   checkpoint commit before deleting makes it bulletproof.
4. **Untracked or gitignored files: NEVER `rm` directly — git history cannot recover what was
   never committed. This is the data-safety line.** Move them into the repo's declared quarantine
   directory (Step 0.6) instead. If none is declared, create one now: `.iteration-quarantine/` at
   repo root, added to `.gitignore`, declared in the entry doc with one line ("quarantine for
   untracked files pending deletion — emptied manually by the user"). Emptying quarantine is the
   user's act — offer it at a future close, with its own explicit yes; never silently.
5. **Never shed the product's real DATA as if it were dev residue.** User/customer state, saved
   sessions, real archives of user content look like clutter and are the product's soul. When a
   directory could be either, treat it as data and keep it; verify before any `git rm`.
6. Commit deletions in themed groups; each message says WHY + what supersedes it.
7. Post-deletion checks (all that apply must pass): if the repo has a test suite, it is green;
   dangling-reference grep for every deleted module/symbol is empty (an import of a deleted file
   crashes at startup — a real scar); the entry doc and skill docs reference no deleted path.

EXIT TEST: `git status` clean, no archive-shaped dirs exist — except directories the entry doc
declares as data, recovery, or quarantine (Step 0.6) — dangling grep empty, and the test suite
green if one exists.

## Phase 3 — TWO READINESS CHANNELS (different needs; verify separately)

Uploading and being-continuable are NOT the same problem. Conflating them is how a repo gets
"pushed to the cloud" while its real state still lives in a chat log. Verify each on its own.

### 3a. Confirmed cloud upload (the TRANSPORT problem)
1. Secret scan on TRACKED files only (sk-ant / ghp_ / gho_ / github_pat / AKIA / xox[baprs] /
   consumer_secret / access_token / Bearer / BEGIN PRIVATE KEY / .env shapes). Any hit → stop,
   scrub, re-scan.
2. Check `git remote`. If there is NO remote, upload needs one the USER provides — adding a remote
   is a config change, so confirm it with the user or record "no remote yet — publish deferred"
   and skip to 3b rather than erroring on a bare git command.
3. With a remote: show `git log @{u}..HEAD --oneline` + diffstat (fall back to "all local commits"
   when there is no upstream yet) — exactly what will leave this machine.
4. Upload via the repo's confirmed-upload command (Step 0.2) after the user confirms; if the repo
   has none, `git push` after the diffstat and a yes. Never auto-push.

### 3b. Zero-context takeover (the KNOWLEDGE-COMPLETENESS problem) — the cold-start probe
1. Get ONE genuinely context-free reader onto the repo — in Claude Code: spawn a fresh subagent
   (Task tool); in Codex: run a fresh `codex exec` or a new session with no prior context; on any
   bare harness: open a new session and paste ONLY the repo path plus the questions, never this
   conversation. Give it only the repo path and: "Read this repo cold from its entry doc. Then
   answer: (1) what is this product, in one sentence; (2) where does the work stand (done / next);
   (3) what would you do next and why; (4) name three things you must never do here."
2. Grade its answers against the repo's canonical docs. **If the repo has no entry/canonical doc
   at all, creating a minimal one (the product in one sentence, current state done/next, three
   never-dos) is part of this close — it is the artifact the probe grades. Do not run the probe
   against nothing.**
3. Every wrong or missing answer is a TAKEOVER-DOC BUG, not the probe's fault. Fix (or create) the
   doc, re-run with a NEW fresh reader. Loop until a cold reader scores 4/4, capped at 3 rounds —
   if it still fails after 3, list the remaining gaps and hand the decision to the user.

EXIT TEST: probe passes 4/4. Only then is "any new window / machine can continue" a tested fact.

## Phase 4 — ONE-COMMAND BOOTSTRAP (rehearsed, not assumed)

1. Ensure the repo's bootstrap (Step 0.3) exists and is current — idempotent, safe to re-run:
   verify toolchain versions; wire sync/config; install deps; run the test suite if one exists;
   print the current status + the NAMES of any missing local secrets (never values, e.g.
   "config.local.json absent — needed only for live publish"); exit non-zero on any failure with a
   one-line reason. If no bootstrap exists yet, this is the iteration to create one.
2. REHEARSE it: clone the repo into a scratch dir (from the origin URL, or from the local repo path
   when there is no remote yet) and run the bootstrap there. It must end green with ZERO manual
   steps. Delete the rehearsal clone after.
3. The new-machine story must be one line and TRUE after this rehearsal:
   `git clone <origin-url> <dir> && cd <dir> && <bootstrap command>`. If no remote exists yet, note
   that this line is not yet true until the user sets one — don't publish it as if it works.

EXIT TEST: the rehearsal clone bootstraps green, untouched by hands.

## Phase 5 — CLOSE + SEED (continuity)

1. Tag the iteration: `git tag iter-<N>-<slug>` (annotated, one-line summary). N = 1 + the count of
   existing `iter-*` tags (`git tag --list "iter-*"`); the first close is iter-1.
2. Update the status board / log with one line, if the repo has one: what was distilled, how many
   files shed, probe 4/4, bootstrap rehearsed.
3. Emit the NEXT-ITERATION SEED into chat: the open questions this iteration surfaced + a
   paste-ready kickoff prompt for the next slice (goal, acceptance, and a reminder to run the
   repo's grounding gate before building, if it has one).

## Major iteration — when the STRUCTURE itself is replaced (same rules, bigger skin)

A structural overhaul — new architecture, new module tree, even "the old approach was wrong" — is
still an ITERATION of one organism, not a restart. It keeps its git history, its decisions, its
lessons; only the skin is new. Restarts bleed: every time a project is reborn in a fresh repo,
lesson-grade material gets left behind. So:

- Grow the new structure IN THIS REPO alongside the old (strangler pattern): the new tree earns
  tests and ownership first; the old tree dies in Phase 2 only once nothing references it.
- Opening a NEW repo is the expensive exception, not the default — it requires a recorded decision
  stating why THIS history must be abandoned, approved before any files move.
- Same five phases; the deletion inventory is just larger and the cold-start probe matters more —
  the new structure's docs have never met a stranger.
- If the product's name or entry command changes, Phase 4's one-line story updates in the SAME
  iteration. Two live names is a two-truths bug.

## Guardrails (non-negotiable)

- Phase order is the safety mechanism: NEVER shed (Phase 2) before distill (Phase 1) exits — in
  shed-only mode, the Phase 1 spot-check on the inventory is that gate.
- The complete deletion inventory is shown to the user, and NOTHING is deleted without their
  explicit yes. The agent never presses irreversible buttons on its own.
- Untracked or gitignored files are quarantined, never `rm`'d — git history cannot recover them.
- Deletion needs evidence of supersession, not vibes. Genuinely unsure? Keep it ONE more iteration
  and record the doubt in the decision record — not in an archive dir.
- Push is a confirmed act, always. No auto-push, no bypassing the repo's upload step.
- The cold-start reader must be genuinely context-free (fresh subagent / `codex exec` / new
  session — repo only) or the probe is theater.
- If the repo runs multiple agents/lanes in parallel, don't touch another lane's uncommitted paths;
  hand off through its board if it has one.
- When this skill and the repo disagree about the repo's conventions, the repo wins.
