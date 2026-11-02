---
name: daily-brief
description: "Produce a source-backed US stock portfolio decision brief from holdings, new filings and current prices; evaluate hold, buy, trim, switch or wait, and investigate stock tips. Use for stock daily briefs, portfolio reviews and thesis checks, or when the user says 美股日报 / 看看我的持仓 / 这只该不该卖 / 财报出了帮我看 / 有人推荐了一只股票. Not general morning news, not crypto, not price alerts. Never executes trades."
---

# Stock Portfolio Brief

Answer the investor's actual decision: what action is justified now, what changed,
and what evidence would change that decision. Research quality matters more than
report length. User instructions take precedence over this skill.

## Start with the account and the question

Read the project's current investment policy, positions, recent decisions and the
last relevant brief. Treat archived strategies as history. Preserve the user's
horizon, whole-share constraint and risk limits; do not hard-code any ticker,
capital amount, price target or allocation into the skill. A holding is not proof
that its original thesis remains valid. File dates do not prove account freshness.

For a normal brief, cover actual holdings first and new opportunities only when
relevant. A bare ticker is enough to begin company research; unknown account size
blocks personalized sizing, not research. Ask only for consequential missing facts
while continuing independent work. Do not recreate an entire investor interview.

## Collect evidence, then judge

Use the available financial connector or browse for current prices, latest issuer
filings, guidance and catalyst dates. Do not assume a named plugin is installed.
Use SEC/issuer IR for financial assertions; news and social posts are leads to
verify. Read [evidence.md](references/evidence.md) for financial-period matching,
thesis checks and source conflict handling.

For a portfolio CSV (`ticker,shares,avg_cost`), the bundled read-only collector is:

```sh
python3 <skill-dir>/scripts/snapshot.py --positions <project>/positions.csv --output <project>/research/<unique-run>/snapshot.json
```

Pass `--cash` only with a known current USD cash balance. It uses the public Yahoo
chart endpoint with no key; endpoint access is not guaranteed. It records provider
and quote time, preserves missing values, and never sends messages. `--quotes`
accepts an offline evidence mapping described in the reference. Use another
available source when collection fails; never turn an old cache into fresh data.
The 96-hour default is a coarse stale-data screen, not a market calendar: check the
latest completed US session and splits/dividends before using prices for decisions.

Compute amounts, weights and scenarios with code. Cash is not initial capital minus
current position cost: realized sales, deposits, dividends and withdrawals matter.
Unknown cash means unknown buying power and full-account weights. Do not fill it
with a historical capital constant or a silent zero. An empty valid CSV is a flat
account; a malformed CSV must not fall back to a stale holdings database.

## Make a useful decision

Compare the best supported action with holding, waiting and an appropriate ETF.
Do not choose an ETF just because its share price leaves the least spare cash.
For an individual stock, explain why its prospective payoff compensates for its
concentration and business risk versus the relevant index. Index-relative returns
are not proof of skill or causal alpha. Sector ETFs can overlap heavily with stock
holdings; disclose that concentration when it affects the recommendation.

Check each holding's actual thesis-invalidating conditions separately: triggered,
not triggered on sufficient evidence, or unknown. Unknown never means safe.
A serious confirmed break takes priority over deploying spare cash. A risk-limit
signal is advice for the person, not authorization to trade.

Give one lead recommendation and only meaningful alternatives. Any proposed trade
needs: rationale and new evidence, horizon, whole-share amount within known cash
and risk limits, assumptions behind a valuation range, downside scenario, thesis
invalidation and next review event. When evidence cannot support sizing or a target,
say exactly what remains unknown; do not fabricate precision to fill a template.
A stop price is not guaranteed execution or a bound on gap losses; an ETF does not
have a guaranteed maximum drawdown. Never promise optimal returns.

For a tip, identify its falsifiable claim and seek disconfirming evidence before
endorsing it. If a new opportunity does not beat the existing alternatives on the
available evidence, say so. Do not manufacture three recommendations every day.

## Deliver and keep the record

Write in the user's language, lead with the decision in plain words, and define
necessary finance terms inline. A normal brief should be readable in a few minutes:

- What to do now, why, and confidence/limitations.
- What changed for actual holdings; source links and dates beside material claims.
- Feasible trade plan when warranted; otherwise next event or threshold to review.
- The strongest opposing evidence and unresolved data gaps.

Save the brief and source evidence under a unique run directory; link the previous
relevant decision and record whether it changed. Do not overwrite an earlier run.
Separate facts, interpretations and proposed actions. Update actual holdings only
from the user's reported executed trade, never from a recommendation. Record the
trade and rationale together; unclear execution details stay pending.

Resolve forecasts only with evidence matching their original event and deadline.
Expired but unobservable outcomes remain unresolved. Probability 50% is valid;
do not force false confidence or invent new forecasts for activity. Calibration is
record-keeping, not permission to auto-tune investment weights.

A brief request authorizes local research and deliverables, not Telegram delivery,
broker connection or scheduling. Send only when explicitly requested. If a saved
schedule is requested, inspect the existing scheduler and avoid duplicate jobs;
report whether it actually ran. Never claim background monitoring from a skill file.
