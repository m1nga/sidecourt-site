# Lower-cost source-video continuation

Set `output_mode` to `lipsync` in the existing [production contract](production.md). The existing audio/avatar defaults remain unchanged. This route uses MiniMax Speech 2.8 HD for the already-selected voice and `fal-ai/latentsync` for video. It does not choose a model automatically or enroll a voice from a reference clip. An existing permitted custom voice ID is required to preserve a particular speaker's voice.

## Prepare the material

For each speaker add the following fields to the existing speaker entry:

```json
{
  "speaker_id": "host",
  "voice_type": "custom",
  "voice_id": "YOUR_EXISTING_PERMITTED_VOICE_ID",
  "permission": {"allowed": true, "proof_ref": "permissions/host-voice.txt"},
  "source_video": "shots/host-single-speaker.mp4",
  "source_video_permission": {"allowed": true, "proof_ref": "permissions/host-video.txt"},
  "single_speaker_reviewed": true,
  "motion_reuse_acknowledged": true
}
```

These values illustrate the contract; they are not evidence or permission. The agent must inspect the real shot and only record these declarations when justified. Supply an already-trimmed shot containing exactly one visible face throughout its entire duration. Single-speaker audio is insufficient: a later cut to two visible faces can cause the wrong person’s mouth to be modified. The CLI validates files and declarations; it does not detect faces or crop a wide two-person shot. Different speakers must use distinct reviewed shots, not the same uncropped file. Use the existing `script.turns` speaker mapping to alternate speakers. Preserve source timestamps and attribution in the project evidence.

Group each speaker's uninterrupted speech into roughly 40–90 second turns when the content supports it. Every frozen turn over 90 seconds blocks video generation; revise and independently review the script before starting a new run. Many five-second turns are expensive because each request has a minimum charge. Do not pad the actual spoken script just to meet a price threshold.

Run the normal offline `produce` check, then `--execute` within the authorized budget. Keep the same run folder for recovery; `--resume` performs GET-only reconciliation. A later `--execute` can collect a completed result and continue the original run. If an accepted submission has no request ID, preserve its reservation and reconcile with the provider; do not switch endpoints or create a new run to escape that unknown.

## What the route does

1. Freeze the exact synthesized turn audio and retain its hash. Append 0.8 seconds of silent protection audio only to the video driver.
2. Reserve the account's current per-second quote times `max(40, ceil(duration + 0.8) + 1)`. The extra second is conservative rounding headroom. Unknown and unbilled calls retain their reservations.
3. Cache uploads by content hash; submit each immutable generation specification at most once. The payload uses the documented `video_url`, `audio_url`, `loop_mode: loop`, and `seed: 42` fields. Original provider files remain intact.
4. Compare downloaded video audio with the original frozen turn at 1000 Hz. Require raw correlation greater than 0.90, absolute offset at most 80 ms, every target sample covered, and a remaining audio tail no louder than 3% of target RMS. A shortened protected tail is acceptable only when all original speech remains covered. Missing audio or insufficient signal blocks assembly.
5. Remove the verified protection tail, mux the original frozen audio without retiming, assemble the ordered turns, and burn in `AI-GENERATED CONTINUATION - SOURCE MOTION REUSED` on the export.

The alignment check proves audio coverage, not visible lip synchronization or voice likeness. Inspect the rendered faces, mouths, hands, seams and pronunciation before delivery. Looping reuses recorded gestures and background motion. It is lower-cost editing of an existing performance, not a newly generated full-body performance. Source frame quality limits output detail; normalizing the export to 1280×720 does not recover lost detail.

## Cost model, not a price promise

The [official LatentSync page](https://fal.ai/models/fal-ai/latentsync) observed on 2026-10-24 lists $0.20 through 40 seconds and $0.005 per output second thereafter. At that quote, twenty 60-second turns reserve $6.20 of video cost; sixty reserve $18.60. Add the separate TTS quote multiplied by actual characters, any initial voice enrollment, repeated rejected/failed work that is billed, taxes, storage/hosting and the host agent's cost. A $10–50 target can fit this source-motion route; it is not a guaranteed all-in cost or a promise of cinema-quality novel acting.

Each run has its own ledger and cap. Multiple run folders do not share an account-wide limit: the host must subtract existing spending and unknown reservations before allocating another run's budget. The runtime never recharges an account or manages a payment card.

The [API schema](https://fal.ai/models/fal-ai/latentsync/api) is the source for request fields. Current authenticated per-second pricing is checked on execution; the documented 40-second minimum is an explicit contract in this release. Recheck that minimum before production if provider terms change.

## Local requirements

Python 3.10+ on macOS/Linux, `fal-client==1.0.3`, `imageio-ffmpeg==0.6.0`, and FFmpeg with H.264/AAC and `drawtext` font support are needed. Bootstrap installs the pinned Python dependencies. The imageio package supplies FFmpeg where supported; a system build can be selected through `REVIVAL_FFMPEG` (and `REVIVAL_FFPROBE` if available). If the installed FFmpeg lacks font support, install a full FFmpeg build before rendering. Actual release media checks ran on macOS; Linux is an intended platform, not a verified release execution.
