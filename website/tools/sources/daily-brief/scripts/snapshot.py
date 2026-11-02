#!/usr/bin/env python3
"""Read-only portfolio evidence collector. No trade advice, brokerage or messaging."""
import argparse
import csv
import datetime as dt
import json
import math
import re
import urllib.request
from pathlib import Path


def number(value, positive=False):
    if isinstance(value, bool):
        raise ValueError('boolean is not a number')
    n = float(value)
    if not math.isfinite(n) or n < 0 or (positive and n == 0):
        raise ValueError('expected finite nonnegative number')
    return n


def holdings(path):
    result, seen = [], set()
    with Path(path).open(newline='', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        if not {'ticker', 'shares', 'avg_cost'} <= set(reader.fieldnames or []):
            raise ValueError('positions requires ticker,shares,avg_cost')
        for row in reader:
            ticker = row['ticker'].strip().upper()
            if not re.fullmatch(r'[A-Z][A-Z0-9.-]{0,14}', ticker) or ticker in seen:
                raise ValueError('invalid or duplicate ticker')
            seen.add(ticker)
            shares = number(row['shares'])
            if not shares.is_integer():
                raise ValueError('whole shares required')
            if shares:
                result.append(dict(ticker=ticker, shares=int(shares), avg_cost=number(row['avg_cost'])))
    return result


def quote(ticker):
    url = f'https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=5d'
    request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(request, timeout=20) as response:
        item = json.load(response)['chart']['result'][0]
    meta = item['meta']
    return dict(price=meta.get('regularMarketPrice'), currency=meta.get('currency'),
                observed_at=dt.datetime.fromtimestamp(meta['regularMarketTime'], dt.timezone.utc).isoformat(),
                source=url, session='regular_market_quote', fetched_at=dt.datetime.now(dt.timezone.utc).isoformat())


def build(rows, quotes, cash=None, now=None, max_age_hours=96):
    now = now or dt.datetime.now(dt.timezone.utc)
    cash = None if cash is None else number(cash)
    results = []
    for row in rows:
        q = dict(quotes.get(row['ticker'], {}))
        status, price = 'missing', None
        try:
            price = number(q['price'], positive=True)
            observed = dt.datetime.fromisoformat(q['observed_at'].replace('Z', '+00:00'))
            if observed.tzinfo is None or q.get('currency') != 'USD' or not q.get('source'):
                raise ValueError('quote needs timezone, USD and source')
            age = (now - observed).total_seconds() / 3600
            status = 'current' if 0 <= age <= max_age_hours else 'stale' if age > max_age_hours else 'invalid'
        except (KeyError, ValueError, TypeError, OverflowError):
            status, price = 'invalid' if q else 'missing', None
        value = round(row['shares'] * price, 2) if status == 'current' else None
        results.append({**row, 'quote': q, 'quote_status': status, 'market_value': value,
                        'unrealized_pnl': round(value - row['shares'] * row['avg_cost'], 2) if value is not None else None,
                        'thesis_status': 'unreviewed'})
    complete = all(r['market_value'] is not None for r in results)
    securities = round(sum(r['market_value'] for r in results), 2) if complete else None
    nav = round(securities + cash, 2) if securities is not None and cash is not None else None
    for r in results:
        r['account_weight_pct'] = round(r['market_value'] / nav * 100, 2) if nav and r['market_value'] is not None else None
    return dict(schema_version=1, generated_at=now.isoformat(), holdings=results, cash=cash,
                securities_value=securities, net_asset_value=nav,
                account_status='complete' if nav is not None else 'incomplete',
                freshness_policy=f'{max_age_hours} calendar hours; verify exchange session before action',
                notice='Cash is supplied, never inferred from original capital. Quotes are not executable prices. Thesis checks require new evidence.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--positions', type=Path, required=True)
    parser.add_argument('--cash', type=float, help='Known current USD cash, not original capital')
    parser.add_argument('--quotes', type=Path, help='Offline JSON mapping tickers to evidence quotes')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--max-age-hours', type=float, default=96)
    args = parser.parse_args()
    if not math.isfinite(args.max_age_hours) or args.max_age_hours <= 0:
        parser.error('max-age-hours must be finite and positive')
    try:
        rows = holdings(args.positions)
        if args.quotes:
            quotes = json.loads(args.quotes.read_text())
        else:
            quotes = {}
            for row in rows:
                try:
                    quotes[row['ticker']] = quote(row['ticker'])
                except Exception as e:
                    quotes[row['ticker']] = {'error': type(e).__name__}
        result = build(rows, quotes, args.cash, max_age_hours=args.max_age_hours)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        # Exclusive creation preserves prior evidence and makes accidental reruns visible.
        with args.output.open('x', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2, allow_nan=False)
        print(json.dumps({'output': str(args.output), 'account_status': result['account_status']}))
    except (ValueError, OSError, TypeError, KeyError) as e:
        parser.exit(2, f'snapshot failed: {e}\n')


if __name__ == '__main__':
    main()
