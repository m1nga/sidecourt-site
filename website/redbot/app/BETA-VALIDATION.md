# RedBot 1.12.0: recent saves first

Opening or returning to the app and Refresh latest check the source’s first observed favorites page separately from the uncapped Scan all saves action. The homepage exposes three recent saves. Existing text and personal annotations remain usable while updates arrive.

Opening an unread save first reads its text and returned comments. A short local Qwen request produces an overview and up to two source-supported methods. Video speech/OCR remains an explicit action; a caption never claims full-video coverage. Sources over 6,000 characters retain the complete chunked path. Missing methods remain missing. The entire library is not preprocessed.

Two real-source trials on 2026-11-07, using an isolated copy of the owner’s authorized account, returned the recent source page in 4.3–6.6 seconds after verification. Selected text plus short understanding took 3.4 seconds for a 309-character video caption and 5.7 seconds for a 1,018-character text post. Fresh identity verification added 5.4–5.7 seconds. These are two host-side measurements, not a phone-network SLA or full-video timing. Host availability and source conditions still matter.

Regression fixtures cover preservation of full-scan provenance, old saves and notes, changed-cookie identity rejection, deduplication, selected-video text without media processing, AI failure retaining text, evidence requirements, long-source fallback, late account responses and refresh metadata. The adapter patch applies to the pinned existing source; account cookies and private trials are excluded from releases.

--- Previous validation ---

# RedBot1.7 — invitation-only account test

Checked 2026-11-03. Builder-operated checks, with one user-confirmed native sign-in; not independent research, all-account coverage or production readiness.

- 27 JavaScript tests passed: source-grounded matching, Chinese goal routing and prompt language, private-note and credential exclusion, cost/ad ambiguity, unavailable-source handling and retained plan/research behavior.
- 15 connector tests passed using a fake source: independent sessions and libraries, login/identity checks, known-save access, origin/host/auth boundaries, expiry and disconnect, current-checkpoint recovery and rejection of stale checkpoints. These fixtures are not two real people.
- 3 legacy sync regression tests passed. The existing owner's 241-save/21-guide library and local state were kept separate.
- One real account completed Xiaohongshu confirmation. A timed-out scan recovered 289 observed cards from its current private checkpoint. A second scan returned 289 unchanged cards, zero duplicates and no interruption. Every scan remains explicitly partial.
- A selected real saved post returned its caption text. Video content and comments were not read. The returning source appeared in place and an unsaved note draft remained intact; the test draft was not saved.
- Chinese/English UI, browser-library recovery, Chinese goal selection, saved-plan continuation and copied editable prompt were exercised. The app does not run Codex or Claude Code when creating a prompt.
- IAB viewport390x844: document and scroll width390, detail dialog352, no horizontal overflow. The Chrome viewport control did not apply, so that earlier attempt is not counted. Physical-phone and same-phone QR recognition remain unverified.
- Public API capability and unauthenticated401 responses checked through the temporary HTTPS relay; full SideCourt deployment is verified separately after release.

Limits: two distinct real-account isolation, same-phone authorization, complete enumeration and unaided human usability are still open. Scans restart from the top, deduplicate and retain omitted older items; no resumable pagination claim. New scans start only while the page is open/visible. The host and temporary relay must stay online. Seven-day retention and disconnect deletion are part of the test adapter, not a third-party hosting SLA.

The web app extracts retrieved text and assembles prompts; it does not generate new AI summaries or read comments. Scanning and deduplication make no LLM calls. Optional local semantic matching and host-assistant reasoning have separate resource/cost boundaries. No publishing, likes, native comments, paid calls or Claude execution were performed.

Application source: 83a1b254c6143b83fe4b2832c2250505f126936d. SideCourt remains the primary web entry. The original GitHub migration/export bridge is byte-preserved. The prior native Mac package is not rebuilt.
