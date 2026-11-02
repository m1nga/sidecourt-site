# From a request to a useful result

Use the existing task record. This reference does not require another planning document.

## Entry and capability selection

Start from the requested result and the uncertainty that prevents it. Choose the lightest route:

| Situation | Route | Useful completion evidence |
|---|---|---|
| Clear change, one executor | Direct execution | Changed artifact and relevant check |
| Direction still open | Explore alternatives | Comparable outputs and a reasoned choice |
| Several owners or dependent actions | Coordinate | Owner results, native receipts and remaining dependency |

Select a skill only for a concrete gap. First inspect the host's capability metadata. If local
skills are missing from that view, run the bundled metadata reader with explicit installed roots:

```sh
python3 SCRIPT_DIR/capabilities.py --root INSTALLED_SKILL_ROOT --query "memory recall" --limit 5
```

Repeat `--root` for another known root. The tool reads one directory level, follows installed
aliases, reports conflicting versions and missing roots, and never searches the whole computer.
A catalog path is not proof of host availability. Read the chosen SKILL.md; verify its tools only
when needed. Empty lexical results warrant alternate terms or a bounded inventory, not an
immediate request that the user resend something already accessible. Do not install a candidate
merely because it was mentioned in a saved article.

## Use memory without making a second task record

When work-memory is available, call its `context.py brief` for the actual project root and current
question. Choose execute, explore or review deliberately. It returns current evidence, separate
options, relevant failed-lesson cautions, source IDs/revisions and bounded freshness diagnostics.
Read `context.py show` for material evidence. If absent or uninitialized, use the existing project
state/source documents directly; initialize only when ongoing work warrants it.

- TaskDock/project records own the goal, plan, current state and native result locations.
- Major Tom selects work and checks whether it serves the goal.
- Memory indexes useful deltas and maintains the learning evidence; do not mirror whole files.
- Executors produce work and native receipts. Coordination does not require repeated re-reading
  of all specialist outputs or an additional reviewer for deterministic checks.

For an external handoff, give the owner only the relevant original instruction, necessary current
rules, exact source excerpts and their purpose. A memory brief alone is not a complete instruction
or authorization. If using the packet validator, save selected read-only memory output in the
original case and include its path/hash as a `reference`; record project ID, record ID and revision
in its purpose. Re-read that revision and live evidence before consequential use. A valid packet
checks bytes and structure, not semantic truth or permission.

Keep the current baseline context visible when comparing new deltas. Equal context hashes do not
prove no new user instruction, current permission or remote state changed.

## Apply the useful part of a reference

A design reference can inform a small comparison: use the same real content, contrast composition,
typography or visual hierarchy, then inspect the actual result at relevant sizes. Store selected
screenshots in the project, with the exact user's choice, the reason and applicability. Memory
indexes a text evidence note pointing to those images; it does not interpret or store image pixels.
A local visual choice is a decision, not a global brand rule or proof of improved conversion.

For other tools, choose one actual unmet need, one bounded trial and a baseline such as rework,
quality or time. Skip trials when the current tool already meets the need. Do not copy claimed
percentage savings or infer subscription capacity from token measurements.

## Close the feedback path

At the normal result checkpoint, identify which layer the feedback changes:

- User correction: update the affected current interpretation/decision now, with exact provenance.
- New fact or native receipt: save the observation and its date; separate delivery from outcome.
- Promising mechanism: record a candidate with a future check, not a new universal instruction.
- Harmful lesson: suspend it and retain negative evidence; do not silently reapply it.
- Tool failure: fix or record the specific failure instead of burdening every task with a new rule.

Persist once in the original authoritative location; memory keeps a pointer or bounded excerpt.
Check pending outcomes when re-entering related work. A result that has not arrived remains pending.
Use the user's existing priorities to choose the next action; tool availability alone is no reason
to create work. Judge improvement by fewer repeated corrections, useful outcomes and less rework,
with actual comparisons and explicit uncertainty, not counts of packets or memory records.
