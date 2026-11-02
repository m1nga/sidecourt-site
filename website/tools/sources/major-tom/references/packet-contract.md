# Minimal command packet

Use a project's existing record. Do not create these fields for a one-step local edit.

```json
{
  "case_id": "case-identifier",
  "source": {"kind": "direct_human_instruction", "text": "Exact instruction", "sha256": "SHA256 of exact UTF-8 text", "provenance": "Original human event reference"},
  "intent": {"outcome": "Observable result", "audience": "Who benefits", "supersedes": ["Old interpretation"]},
  "scope": ["existing-role-scope"],
  "owner": {"role": "existing-role", "thread_id": "verified-original-thread"},
  "authority": {"kind": "direct_human_instruction", "source_hash": "Same instruction hash", "allowed_scopes": ["existing-role-scope"], "dispatch_authorized": true},
  "rules": [{"id": "rule-id", "text": "Decision criterion", "source_kind": "direct_human_instruction", "reason": "Why relevant"}],
  "references": [{"path": "reference.txt", "sha256": "exact-file-hash", "classification": "reference", "purpose": "What decision it informs"}],
  "actions": ["Concrete bounded work"],
  "acceptance": ["Observable artifact or outcome with independent evidence"],
  "result_location": "Existing original record",
  "dispatch": {"state": "pending", "attempts": 0}
}
```

The registry maps existing role keys to exact thread IDs. The current observation contains
`thread_id`, `status` (`idle`), `turn_status` (`completed`), `error` (null), `observed_at` (ISO UTC).
The observation is obtained from a supported task tool, not guessed from a file's mtime.

```
python3 scripts/validate_packet.py PACKET --registry REGISTRY --observation OBSERVATION
```

File paths are resolved relative to the packet, or absolute. The command checks provenance,
source hashes, reference bytes, scope, exact original owner, fresh terminal observation and
no prior dispatch. It returns `dispatch_ready`; it never reserves or sends. Immediately before
sending, the real adapter must recheck and reserve under the existing record's lock. A crash
between reservation and transport is unknown until the original outcome is reconciled.

Host permission, platform identity, quota, content review, GUI lease and current business holds
remain independent gates. A structurally valid packet cannot override them.
