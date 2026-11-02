# Evidence contract

Every decision-relevant financial number needs a source URL, period/date, unit,
retrieval time, and verification status. An API supplies structured data, not a
truth guarantee. Prefer issuer/SEC filings for fundamentals and a named price
provider for quotes. Cross-check conflicts that could reverse the decision.

For fundamentals distinguish quarter vs year vs trailing twelve months, GAAP vs
non-GAAP, gross vs operating margin, debt vs liabilities, and reported vs estimated.
Do not compare mismatched periods. Keep filing date and fiscal-period end separately.
Use at least three comparable quarters to test two consecutive quarter declines.
A filing's recent retrieval timestamp cannot make an old financial period current.
Issuer-specific metrics (cloud growth, backlog conversion, guidance withdrawal) need
actual issuer disclosures; a generic margin proxy cannot resolve them.

For each thesis check record criterion, metric, comparison, evidence date/URL,
result (triggered/not_triggered/unknown) and reasoning. Qualitative conditions can
be evaluated by the model with explicit evidence. Never mechanically convert an
unimplemented condition to false.

For valuation, state the mechanism (earnings multiple, cash-flow scenario, etc.),
assumptions and sensitivity. Avoid target prices invented from technical levels.
For forecast scoring preserve the original probability, wording and resolution
rule, append evidence, then calculate (probability - binary outcome)^2. No outcome
means no score. Do not treat correlated daily statements as independent successes.

The collector's optional `--quotes` input is a JSON object, for example:

```json
{"EXAMPLE":{"price":100,"currency":"USD","observed_at":"2026-01-02T21:00:00+00:00","source":"https://example.org/quote","session":"regular_close"}}
```

This is a fictional schema illustration, not market evidence. Offline fixtures
must be labeled as tests. Missing/null/nonfinite price, unknown currency, absent
source, naive timestamp and future timestamp do not support portfolio valuation.
Stale quotes remain visible as evidence but do not enter current NAV. A complete
numerical snapshot still does not verify the account date or investment thesis.
