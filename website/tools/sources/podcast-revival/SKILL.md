---
name: podcast-revival
description: Make a directed podcast video from supplied video, text, or mixed materials, with a requested duration, tone and point of view. Use for a new conversation, continuation, or source-based adaptation; a transcript summary alone does not require this skill.
---

# Podcast Video Maker

Turn the user's material and direction into a source-grounded conversation, then produce its audio and video with the bundled local runtime. This is an agent-assisted workflow: the host agent interprets the brief, researches, writes and reviews; the runtime manages supported media operations, costs and recovery. It is not an unattended hosted service.

## Begin with the actual request

Accept video/audio files or accessible links, pasted text, documents, images, an existing script, and combinations of these. Preserve the user's requested length, language, tone and viewpoints. Extract the important questions and source claims before writing. Use a three-minute analytical conversation only as a stated default when the request leaves those choices open. Ask only for information that blocks the next necessary step; continue local analysis and drafting meanwhile.

Distinguish source adaptation from new original production. With a supplied video, retain source timestamps and speaker mappings. With text or mixed material, the agent builds a cited script and an explicit speaker/voice plan; do not invent a video source, existing calibration, or original speaker. Treat a requested viewpoint as editorial direction, not proof that a real person endorses it. New claims need evidence; new first-person positions attributed to a real speaker need their actual approval or clear hypothetical framing.

Read [the runtime handoff](references/runtime.md) when creating a project or running media. Keep the user's project outside the installed skill. The bundled CLI `brief` command records website or local inputs and direction without sending files or starting paid work. Its `brief_ready` state is an intake record; the agent still prepares validated production inputs. Do not present an intake file as a finished video.

## Install and operate the runtime

Use `scripts/bootstrap.py` to verify the bundled wheel and create a project-local environment. For available command options, run:

```bash
python3 <skill-directory>/scripts/bootstrap.py --project <project-directory> -- --help
```

Then pass the relevant CLI command and the project's explicit configuration path. The bundled wheel is the runtime; do not copy or reconstruct a second editable media implementation inside the skill. For lower-cost continuation from existing footage, use `produce` with `output_mode: "lipsync"` and read [the source-video route](references/lipsync.md): it changes lips while explicitly reusing source motion. Use `produce` for a new single-language stock/custom-voice production; read [its input contract](references/production.md) when preparing that job. Use the source-restoration commands only for a real existing-video restoration. Read the actual installed CLI help before selecting commands. Missing wheel, hash mismatch, unsupported Python or dependency failure is a real setup blocker: preserve inputs and report the concrete recovery step.

A nontechnical user can describe the job in one sentence. The host agent performs setup, prepares the project, runs the appropriate commands and returns playable files plus the cost/status report; do not require the user to author JSON or learn the CLI.

## Produce within the authorized scope

Use the host's already authorized model and available research tools for source analysis, evidence, joint dialogue and independent review. When only some inputs are ready, complete the independent local work. Do not silently upgrade the user's model, add a second provider account, or treat a transcript as verified speaker attribution.

Before paid media, verify material/voice permissions, the exact reviewed script, current authenticated prices and the remaining authorized total. Reuse the user's existing explicit budget; missing budget only blocks spending, not local work. A budget is a cap including failures and unknown submissions, not a prepaid package or automatic recharge permission. Keys stay in the process environment or supported local credential store, never in briefs, scripts, browser code or public repositories. Upload only necessary, permitted crops or references.

If the user requests model comparison, run a small same-text/same-reference voice comparison and same-source-video/same-frozen-audio video comparison when comparing lip-sync models, or same-image/same-frozen-audio when comparing animated portraits within that budget. Choose from actual results and record limitations; do not claim a model is best from its marketing. Check supported schemas before making endpoint-specific requests.

For an existing-person restoration, first inspect the short calibration's actual audio and video. A real independent model or human review may approve the exact artifact hash; record who reviewed and what ranges were actually inspected. This is not a mandatory new user approval. Model review must never populate human ratings. For new fictional/stock-voice production without a source restoration, use `produce` with the actual reviewed script and speaker plan. It does not require the historical bilingual restoration calibration and does not automatically clone a reference voice. Custom voices require an already-created voice ID and its permission proof.

Freeze the exact audio before generating its video. A changed script, portrait, voice or audio invalidates the relevant review/spec; preserve successful unaffected work. Inspect complete coverage, pronunciation, identity, synchronization and actual media duration. Do not alter words or swap fresh speech onto old mouth movements just to hit the requested length.

## Recover and deliver

Resume by querying original request IDs and provider-returned URLs. A timed-out submission without an ID remains unknown: preserve its cost reservation and reconcile read-only. Never change a fingerprint, switch models or submit again to evade that unknown. Distinguish an explicit rejected request from an accepted/uncertain one, and use only confirmed receipts for actual cost.

Deliver the actual video, its frozen companion audio, script/source references and a short cost/status note. Label synthetic content and any unconfirmed attribution. For partial work, link the useful artifacts, state the exact blocker and next action. Creating private media does not authorize public publication. Installation, dry-run checks, model review and human evaluation are different evidence; report each honestly.
