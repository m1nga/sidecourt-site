# Host entrypoints and coverage

The skill's reasoning loop and the host's completion signal are separate. Installing a hook
does not install automatic understanding. This implementation uses:

- Global agent instructions: relevant task entry → recall; meaningful delta → capture;
  actual use/outcome → learning; substantive turn ending → checkpoint.
- Metadata-only completion adapters: record an observed ending and expose missing checkpoints.
- Explicit export: produce a fresh bundle only on request, not a background migration.

No autonomous model calls, timer, daemon, polling job, transcript scan or account crawler is
part of this system. Generic skill installation alone does not edit host configuration.

## Install deliberately

First inspect existing global instructions and configuration. Preserve other hooks and
notifiers. Back up exact preexisting values to private local storage. Use actual interpreter
and skill paths on this machine; never copy another user's absolute paths.

Add a small global instruction equivalent to:

> In substantive ongoing work, use work-memory to locate the actual project root, recall
> relevant current records, capture meaningful sourced changes and checkpoint before ending.
> Record applied lessons and outcomes honestly; no useful delta means no invented lesson.
> Do not initialize unrelated one-off chats or blend project facts. Check receipt gaps on
> re-entry, and export only when asked. Read the skill before using its commands.

### Codex notify

The official notify interface invokes a command with a JSON argument for `agent-turn-complete`.
Relevant fields include `thread-id`, `turn-id`, `cwd` and `last-assistant-message`.
See [official notification documentation](https://learn.chatgpt.com/docs/config-file/config-advanced#notifications).

Save the existing notify argv verbatim as a JSON array in a private file outside the skill.
Then set notify to an argv array equivalent to:

```text
python3 -B /installed/work-memory/scripts/host_adapter.py notify --state-dir /private/state --downstream-config /private/state/original-notify.json --
```

When no previous notifier exists, omit `--downstream-config`. The adapter forwards the
original payload and argv even if its own receipt write fails. It does not shell-interpret
arguments. The original notifier retains its behavior and exit code; do not make a recursive
downstream configuration pointing back at the adapter.

### Claude Code Stop

Append (do not replace other hooks) a Stop command hook:

```json
{"type":"command","command":"python3 -B /installed/work-memory/scripts/host_adapter.py claude-stop --state-dir /private/state","timeout":5}
```

Use the host's supported `hooks.Stop[].hooks[]` configuration shape. Stop supplies JSON on
stdin, including `session_id`, `cwd`, `hook_event_name` and `last_assistant_message`, but no
turn ID. The adapter returns no decision, no stdout and exit zero. Stop does not cover user
interruptions or API-error endings. See [official Stop documentation](https://code.claude.com/docs/en/hooks#stop).

## Validate delivery rather than assuming it

Run the script tests first; then reload the host/start a new session and complete a small
real turn. Inspect:

```sh
python3 SCRIPT_DIR/host_adapter.py status --state-dir PRIVATE_STATE --root ROOT
```

An observed receipt proves hook delivery, not learning. No receipt can mean no event, an
unloaded config, an unsupported host or a failed adapter; do not equate it with inactivity.
Existing open sessions may keep old global instructions/configuration. ChatGPT web and
other machines do not receive local settings through this skill.

Receipts store only root/cwd, session/turn identifiers, timestamps, hashes and byte counts;
not prompts, replies or transcript content. The state directory must be 0700, data files
0600. Metadata remains private and must not be published with the skill.

## Reconcile honestly

Codex exact receipt key: `codex:<thread-id>:<turn-id>`. Missing turn IDs and Claude Stop use a
payload fingerprint, explicitly a weaker identity that may collapse identical events.
Checkpoint session matches are informational only. Exact key matches count as checkpointed;
neither result proves all important content was selected.

On re-entry, inspect relevant pending receipts. If the corresponding work and source are
available in the current conversation, capture any real omitted delta and write the exact
checkpoint. If nothing material changed, record `no_change` with that evidence. If the work
cannot be inspected, leave the gap visible. Never clear receipts merely to improve a score.
Do not read an entire historical transcript just because a receipt exists.

Uninitialized projects can have central receipts but are never initialized by the adapter.
Register/initialize only when relevant ongoing work needs continuity.

## Pause or remove

Restore the original Codex notify argv, remove only this adapter's Claude Stop entry, and
remove only the work-memory global instruction section. This stops future triggers without
deleting accumulated knowledge. Keep databases/backups private; deletion is a separate user
decision. A disabled loop must never restart itself through its own recorded instructions.
