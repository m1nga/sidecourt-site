# New audio, avatar or source-video production

Use this route after the host has interpreted the brief, inspected the sources, written the exact script and completed an independent editorial review. It supports one language per production and does not require a source video or the restoration experiment's two-language calibration.

## Input contract

Create a private `production.json` with:

- `language`: the actual output language, such as `en` or `zh`.
- `target_seconds`, `tone`, `viewpoint`: preserve the user's requested direction. The target is planned; actual speech duration must be measured and reported.
- `output_mode`: `audio`, `avatar` or `lipsync`. For `lipsync`, follow [the source-video contract](lipsync.md) and supply a reviewed single-speaker shot for each speaker.
- `script.turns`: ordered `{turn_id, speaker_id, text}` records with unique turn IDs.
- `script.editorial_review`: actual `{decision, reviewer_type, script_hash}` from a separate model or human review. The `approved` decision must bind the exact canonical `revival.content.script_hash(script)`; never fill approval just to pass validation.
- `speakers`: each `{speaker_id, voice_type: "stock", voice_id: "Wise_Woman"}` uses a documented stock synthesis voice. Choose other stock voices only after verifying their current IDs. A `custom` voice needs its already-created `voice_id` and `permission: {allowed: true, proof_ref: <real local permission file>}`. A reference audio alone does not enroll a custom voice.
- `budget`: `{total_usd: <authorized cap>, authorization_ref: <real local authorization file>}`. The total and proof come from the user's existing authorization; the proof must be an existing local file relative to this input or an absolute file. The runtime hashes it. A placeholder string is not proof.
- `allow_paid_calls`: set `true` only within the user's actual authorization. Offline planning does not spend.

For `avatar`, add a real local `portrait` and `portrait_permission: {allowed: true, proof_ref: <real local evidence file>}` per speaker. Keep custom IDs, proofs and input snapshots private.

## Execute the correct stage

First run the default offline check through bootstrap:

```bash
python3 <skill-directory>/scripts/bootstrap.py --project <project> -- produce --input <production.json> --out <run-directory>
```

`--dry-run` also explicitly selects this non-generative path. A valid dry run is `dry_run_ready`, not generated media or proof of factual correctness.

Within the authorized budget, add `--execute` to generate. The runtime verifies account prices, reserves costs, freezes each turn's audio and uses that exact audio for its avatar. Do not replace the runtime's ledger with direct untracked provider requests. A turn longer than the supported avatar duration stops that segment; prepare a reviewed segmentation revision rather than silently truncating the words.

Use `--resume` to GET existing requests only. It does not reserve/upload/POST and can reconcile stored jobs even when current inputs disappear. After results are recovered, a subsequent authorized `--execute` downloads and advances the same production. Keep its original identity and cost reservation; do not change the fingerprint to retry unknown submissions.

## What inspection proves

The runtime preserves the original provider video. Audio synchronization checks may trim a narrowly verified silent tail and mux the frozen audio only when coverage, offset and signal checks pass. These measurements do not score visible mouth movements, identity resemblance or natural acting. Inspect the actual output for those qualities, record the inspected ranges and reviewer type, and keep human ratings empty unless a real human supplied them.
