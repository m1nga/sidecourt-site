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
