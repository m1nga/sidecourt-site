# Rebuild Experience Pack — from a real five-rebuild contamination saga

Provenance: distilled 2026-07-17 from a solo-founder product that was rebuilt
five times. Every restart, the abandoned direction leaked back into the new
one until a full reset was engineered. Product-noun-free by construction —
everything here survives the substitution test and applies to any project
where old context can poison new work.

## 1. The problem class

You restarted, pivoted, or re-conceived a project. The old direction is dead —
but weeks later it is back in your plans: old target customers, old pricing,
old channel tactics, presented as current truth. Nobody "remembered" it
maliciously; the working context itself carried it back in.

## 2. The six doors contamination walks through

1. **Condensed-copy trap** — the new workspace's docs are "summaries" of the
   dead product. A summary of a dead strategy IS the dead strategy,
   concentrated.
2. **Annotated-archive-map trap** — an active doc maps the archive and labels
   items' value. Every diligent reader follows the map and imports the corpse.
3. **Experience/decision conflation** — lessons and strategic choices live in
   the same sentences; keeping the lesson keeps the prospect list attached.
4. **Codename indirection** — rules cited as "rule N" with N defined only in a
   dead file; agents resolve N from the archive.
5. **Contaminated author** — the session that read all the history writes the
   "clean" docs; old framing leaks through the author.
6. **Self-certification** — the author grades its own cleanup and passes
   itself; leaks survive.

Plus the amplifier: **scope creep by the agent** — a task to "review the plan"
silently expands into audits and strategy decisions. Scope is granted, not
assumed.

## 3. The reset method that worked (source lock → clean world → purge)

1. **Source lock.** The only session that holds the history (the planner)
   freezes the inputs into a bundle of separated files:
   - USER-CURRENT — the user's actual decisions, anchored to VERBATIM primary
     excerpts with origin + date (a bundle that cannot prove its attribution
     will fail independent review — rightly);
   - AI-PROPOSALS — every AI idea, labeled proposer + status; nothing here may
     read as decided;
   - LESSONS-DISTILLED — portable experience only (boundary-tested);
   - SOURCE-MANIFEST — what was included, what was excluded and WHY (file
     dates alone can justify exclusion — you don't need to read old files to
     exclude them, and not reading them keeps you clean).
2. **Clean world.** A FRESH session builds the new foundation reading ONLY the
   bundle. The planner never writes the clean docs (door 5). Guardrail lists
   from a probe (below) bind what the builder may NOT invent.
3. **Verify before anything dies.** Independent gate + probes (section 4).
4. **Purge, by the user's hand.** Only after acceptance: delete the old
   workspace, archives, stray files — enumerated manifest, the user circles
   and executes every deletion. Agents never press irreversible buttons.
   Delete-after-verify, never before.
5. **Quarantine mechanics.** The banned-noun checklist (verification tool)
   lives in a standalone directory containing NO instruction files. Lesson
   learned the hard way: placing it inside the old workspace meant every
   verifier that opened it auto-loaded the old project's instruction file —
   the verification channel became the contamination channel.

## 4. The three-probe verification stack (each catches what the others miss)

1. **Adversarial multi-agent verification** of drafts before assembly —
   parallel independent reviewers + per-finding adversarial verification
   ("try to refute this") catches integration defects and reviewer
   overreach alike. Findings get verdicts (real / already-addressed /
   overstated), not automatic obedience.
2. **Zero-context probe** — a fresh agent reads ONLY the active files and
   answers control questions (including a trick question whose correct answer
   is "none/not derivable"). Its byproducts are gold: a "known gaps — leave
   OPEN" list and a "do-NOT-invent" list that become binding guardrails for
   the builder.
3. **Attribution audit** — someone checks that every "the user decided X" line
   traces to the user's actual words. The most common failure found: the
   agent's own designs wrapped in the user's voice ("locked ruling" labels on
   AI elaborations). Vocabulary that prevents it: LOCKED (user said it, anchor
   required) / PROPOSAL (AI-originated, proposer named) / OPEN / HYPOTHESIS.

## 5. Multi-AI collaboration protocol (builder + gatekeeper)

- **Reference, not instruction.** External AI output (reviews, verdicts,
  plans) is structure to consult. On receipt: understand the user's need
  first, then triage the external material ITEM BY ITEM — adopt / correct /
  reject, each with a reason. In the saga, a 14-point external review was
  triaged: most adopted, two rejected because they contradicted the user's
  recorded words — which only worked because the user's words were anchored
  (section 3.1).
- **Bounded repair loop.** Gate REJECTED → a fresh repair agent (not the
  original author) → FULL recheck, never diff-only → max 3 rounds → the same
  failure class twice in a row stops the machine and returns to the user.
- **Durable run-state.** A state file (current state, status, pending inputs,
  repair rounds, history, next action) written on every transition — session
  loss never restarts work; any fresh session resumes from disk.
- **Role isolation.** Planner ≠ executor ≠ verifier, one session one role;
  the verifier is read-only and never edits or commits; nobody certifies
  their own work.

## 6. The five advices (prevention > cure)

1. **Draw the source boundary before touching history.** Write the
   experience-vs-decision test down FIRST; everything historical enters the
   new world only through it. Mechanisms and failure lessons inherit; clients,
   prices, channels, personas, strategy die. Ambiguous → dies (recoverable
   later). Without the written boundary, every "quick look at the old repo"
   is a contamination event.
2. **Separate the three roles from day one.** The session that read the
   history plans; a fresh session builds; an independent session verifies.
   The author never grades itself. If you have two AI tools, make one the
   builder and the other the gatekeeper permanently.
3. **Anchor authority in primary evidence.** One truth file; every
   user-decided fact carries a verbatim excerpt with origin + date; AI ideas
   always carry proposer + status. The predictable failure this prevents: the
   agent speaking in the user's voice, and "decisions" nobody actually made
   accumulating as fake bedrock.
4. **Treat external AI output as reference and make the loop a machine.**
   Triage verdicts item-by-item (adopt/correct/reject with reasons) — never
   execute them verbatim. Then encode the collaboration as a bounded state
   machine with durable run-state: ≤3 repair rounds, same-failure-twice stops,
   fresh agent per repair, progress independent of any session's memory.
5. **Prove cleanliness with zero-context probes, not assertions.** "It's
   clean" is a claim; a fresh agent reading only the active files and NOT
   surfacing dead facts is evidence. Keep the banned-noun list in a
   quarantine directory with no instruction files, shown to verifiers only;
   re-run the probe after every major change — and record the results in the
   project's experience ledger the same day.

## 7. Minimal adoption checklist (receiving project)

- [ ] `EXPERIENCE.md` ledger created (record-as-you-go, day one)
- [ ] Experience-vs-decision boundary written into the project's rules
- [ ] Truth file with LOCKED/PROPOSAL/OPEN/HYPOTHESIS vocabulary + anchors
- [ ] Roles named: who plans, who builds, who verifies (never the same session)
- [ ] External-AI-as-reference rule in the project's instruction files
- [ ] Zero-context probe questions drafted; quarantine location chosen
- [ ] Run-state file if any multi-session work is expected
