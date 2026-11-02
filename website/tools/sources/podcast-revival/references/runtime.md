# Runtime handoff

The runtime is a versioned wheel in `assets/`, pinned by `assets/runtime.json`. Its source remains the Podcast Revival product repository; the skill contains no editable fork of that core.

## Record the brief

The host uses the bundled runtime's offline brief importer, for example:

```bash
python3 <skill-directory>/scripts/bootstrap.py --project <working-directory> -- brief --text-file <notes.txt> --out <new-production-directory> --duration 180 --tone skeptical --viewpoint "compare both explanations before concluding"
```

For a website-exported brief, use `brief --input <brief.json> --out <new-production-directory>`. Supply actual local attachments with repeated `--material <file>` arguments when the exported JSON contains only filenames. Check installed `brief --help` for its exact contract.

`brief_ready` records duration, tone/stance, viewpoint, language and source references. `renderable_config=null` means the host must still inspect materials, establish source/speaker permissions, research and write/review the script, then prepare a supported production configuration. The importer does not silently turn a text request into the historical two-language video-restoration experiment. Do not manufacture a source file or mark an unreviewed brief render-ready.

Missing budget blocks spending rather than local intake. Reuse an existing authorized budget and its proof when preparing the production configuration. Do not put API keys in any brief, argument, source file or authorization record.

## Bootstrap and commands

Use a Python 3.10+ interpreter. Some macOS installations still map `python3` to 3.9; select an installed supported interpreter rather than retrying an incompatible setup.

```bash
python3 <skill-directory>/scripts/bootstrap.py --project <directory> -- --help
python3 <skill-directory>/scripts/bootstrap.py --project <directory> -- preflight --config <directory>/project.json
python3 <skill-directory>/scripts/bootstrap.py --project <directory> -- serve --config <directory>/project.json
```

The first use creates `<directory>/.podcast-revival/runtime-<wheel-hash>`, verifies the wheel hash and installs its pinned dependencies. Internet access may be needed for those packages. Later runs reuse the verified environment. `--install-only` stops after installation. A developer may use `--no-deps` only for an isolated package/CLI test; that is not a full media setup.

Use the installed CLI's actual commands. The adapter contract includes `brief`, `produce`, `plan`, `ingest`, `draft`, `review`, `preflight`, `render`, `resume`, `reconcile`, `report` and `serve`. Read [production.md](production.md) for the new single-language audio/avatar/source-video route. `draft` exports prompts; it does not itself run a model to write the finished episode. The host must perform the requested analysis, research, writing and independent review. `resume` reconciles existing requests without creating fresh generation; `reconcile` reads actual bills.

Video-source restoration requires source timestamps, confirmed speakers, independently held-out calibration quotes and permitted portrait/voice references. For text-only/stock-speaker work, the host prepares the reviewed script and uses `produce`; do not manufacture a source video to make the restoration path accept it.

The local page starts no paid work on load. Keep credentials in `FAL_KEY` or the runtime's supported local store. Other provider keys are only needed for optional tools the user has chosen. The source/permission evidence and raw receipts remain in the user's local project, not this public skill package.

A field described as a URL does not necessarily accept an inline data URI. In particular, the Chatterbox multilingual custom `voice` reference needs a provider-accessible hosted URL in the observed runtime. Reuse the exact reference bytes/hash when changing only transport. A definite input rejection is different from an uncertain submission; never use a transport change to bypass an earlier unknown job. Keep upload timeouts finite and do not enable the installed SDK's unbounded legacy storage fallback.

## Wheel binding for release

Release 0.3.0 binds the product wheel to its exact filename/version/SHA-256 in `assets/runtime.json`. Any later release must replace that binding, install the exact wheel into a fresh isolated environment, and rerun normal/failure checks. An absent or altered wheel blocks bootstrap and public release; never substitute a developer checkout or an unverified download.
