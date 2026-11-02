# Map an import retry without inventing an enterprise platform

An agent-simulated scenario, not a report of a shipped application or user study.

## Input

Map the retry path after an import fails in a personal bookmark tool with no login.

## Proposed path

Choose file → parse and validate → save → show result.

- Invalid format: explain the error, allow a corrected file, then validate again.
- Temporary write failure: retain valid input and allow retry.
- Partial success: show saved and failed counts; retry only failed records and
  check duplicates at save time.
- Cancel: return to the list and explain which records have already been saved.

The UI explains the failure and offers retry/change file/back. Parsing distinguishes
an unreadable file from invalid individual records. Persistence owns save results
and duplicate prevention. Disable repeated retries while one is in progress.

## What remains unknown

The existing importer may be atomic. If it commits all or nothing, retrying the
whole batch can be enough; per-record recovery should not be added without a need.
No tenant policy or multi-agent system is assumed.

## Acceptance scenario

For partial-save behavior: save two records, fail a third, then retry. The final
list contains exactly three records, no duplicates, and an accurate result state.
This is a proposed check; it was not executed against a real product here.
