# RedBot 1.4 beta: verification record

Updated 2026-11-02. Builder-operated checks are not recruited-user research.

## Executed checks

- 17 JavaScript tests cover original import/search/research handling, goal clarification, promotion routing and semantic recommendation boundaries: unread titles, personal notes, discarded sources and weak similarities.
- 3 standard-library Python tests exercise the skill reader with a temporary real backup, exact evidence retrieval, title-only results, removed sources and malformed input. Backup bytes are preserved.
- The skill reader was run from a different working directory against a real selected backup (private result not published). A missing file returned exit 2 with recovery guidance.
- Live Chrome loaded the actual pinned Transformers.js/model into a Web Worker and completed inference, with no model API key. An indirect English goal about a calmer screen retrieved the original layout example (cosine similarity about 0.304); an overly high initial threshold missed it and was adjusted. This is a small functional check, not a calibrated accuracy benchmark.
- The new UI keeps AI loading separate from completed no-match results. Title-only saves remain unread. Source/helper validation does not establish truth of external content.
- The preceding release's live goal/source/copy/plan/mobile checks are history; current AI and hosted-beta results are reported separately in the release receipt.

## Limits still requiring user trials

- Unaided use by nontechnical people; physical iPhone/Android performance and assistive technology.
- Retrieval accuracy across larger personal libraries and multiple languages.
- Slow or restricted networks, device memory, cache eviction and model download failure. Basic matching remains available.
- Independent confirmation of indexing, search ranking, AI citations or customer acquisition.

The public example contains original illustrative material only. No private collection, browser cookies or connector credentials are distributed.
