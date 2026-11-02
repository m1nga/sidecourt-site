import datetime as dt
import importlib.util
from pathlib import Path
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location('snapshot', Path(__file__).resolve().parents[1] / 'scripts/snapshot.py')
s = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(s)
NOW = dt.datetime(2026, 9, 11, 0, 0, tzinfo=dt.timezone.utc)
ROWS = [{'ticker':'TEST', 'shares':2, 'avg_cost':80}]

def q(**kw):
    return {'TEST':dict(price=100,currency='USD',observed_at=NOW.isoformat(),source='https://example.org',**kw)}

class Tests(unittest.TestCase):
    def test_nav_denominator(self):
        r=s.build(ROWS,q(),50,NOW)
        self.assertEqual(r['net_asset_value'],250)
        self.assertEqual(r['holdings'][0]['account_weight_pct'],80)
        self.assertEqual(r['holdings'][0]['unrealized_pnl'],40)
    def test_unknown_cash(self):
        r=s.build(ROWS,q(),None,NOW)
        self.assertIsNone(r['net_asset_value'])
        self.assertIsNone(r['holdings'][0]['account_weight_pct'])
    def test_bad_prices(self):
        for price in [None,0,-2,float('nan'),float('inf'),True]:
            quotes=q();quotes['TEST']['price']=price
            r=s.build(ROWS,quotes,50,NOW)
            self.assertIsNone(r['net_asset_value'])
            self.assertIsNone(r['holdings'][0]['unrealized_pnl'])
    def test_missing(self):
        r=s.build(ROWS,{},50,NOW)
        self.assertEqual(r['holdings'][0]['quote_status'],'missing')
        self.assertEqual(r['holdings'][0]['thesis_status'],'unreviewed')
    def test_stale(self):
        quotes=q();quotes['TEST']['observed_at']='2026-01-01T00:00:00Z'
        r=s.build(ROWS,quotes,50,NOW)
        self.assertEqual(r['holdings'][0]['quote_status'],'stale')
        self.assertIsNone(r['net_asset_value'])
    def test_invalid_metadata(self):
        for key,value in [('observed_at','2026-09-12T00:00:00Z'),('observed_at','2026-09-11T00:00:00'),('currency','HKD'),('source','')]:
            quotes=q();quotes['TEST'][key]=value
            self.assertIsNone(s.build(ROWS,quotes,50,NOW)['net_asset_value'])
    def test_flat(self):
        self.assertEqual(s.build([],{},100,NOW)['net_asset_value'],100)
    def test_bad_cash(self):
        for cash in [-1,float('nan'),float('inf')]:
            with self.assertRaises(ValueError):s.build(ROWS,q(),cash,NOW)
    def test_csv(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'positions.csv'
            for body in ['ticker,shares,avg_cost\nA,1,1\nA,2,2\n','ticker,shares,avg_cost\nA,1.5,1\n','x,y,z\n']:
                p.write_text(body)
                with self.assertRaises(ValueError):s.holdings(p)
            p.write_text('ticker,shares,avg_cost\n')
            self.assertEqual(s.holdings(p),[])

if __name__=='__main__':unittest.main()
