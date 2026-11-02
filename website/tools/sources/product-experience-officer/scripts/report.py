#!/usr/bin/env python3
"""Validate and render evidence-led UX findings. Does not perform a user test."""
import argparse,json,sys
from pathlib import Path
from report_page import save_page,esc,text,rows

def build(d):
    product=text(d.get('product'),'product');persona=text(d.get('persona'),'persona');verdict=text(d.get('verdict'),'verdict')
    mode=d.get('mode');review=d.get('review_type')
    if mode not in ('live','screenshots','text_only','simulation'):raise ValueError('mode must describe actual evidence')
    if review not in ('context_aware','independent_agent','human_user'):raise ValueError('review_type must identify the actual reviewer type')
    limits=text(d.get('limits'),'limits');coverage=rows(d.get('tasks'),'tasks');findings=rows(d.get('findings'),'findings');unknown=rows(d.get('to_verify'),'to_verify')
    if not coverage or not unknown:raise ValueError('Include tested tasks and explicit remaining verification')
    log=rows(d.get('experience_log'),'experience_log')
    if not log:raise ValueError('Experience log is required before diagnosis')
    body='<small>FIRST-USE EXPERIENCE REPORT</small><h1>'+esc(product)+'</h1><p><span class="tag">'+esc(mode)+'</span> <span class="tag">'+esc(review.replace('_',' '))+'</span></p><p><b>Who this represents:</b> '+esc(persona)+'</p><section><h2>Verdict</h2><p>'+esc(verdict)+'</p><p class="muted">'+esc(limits)+'</p></section><h2>Experience log</h2><ol>'+''.join('<li>'+esc(text(x,'log entry'))+'</li>' for x in log)+'</ol><h2>Task completion and recovery</h2>'
    for t in coverage:
        goal=text(t.get('goal'),'task goal');status=t.get('result')
        if status not in ('passed','failed','not_tested'):raise ValueError('Task result must be passed, failed or not_tested')
        evidence=text(t.get('evidence'),'task evidence')
        body+='<section><b>'+esc(goal)+'</b><p>'+esc(status.replace('_',' '))+' · '+esc(evidence)+'</p></section>'
    body+='<h2>Prioritized findings</h2>'
    severity={'blocker':0,'major':1,'minor':2,'polish':3}
    for f in findings:
        if f.get('severity') not in severity:raise ValueError('Unknown severity')
        for key in ['title','observed','evidence','impact','fix','retest']:text(f.get(key),'finding '+key)
        if f.get('effort') not in ('S','M','L'):raise ValueError('Effort must be S, M or L')
    for f in sorted(findings,key=lambda f:severity[f['severity']]):
        body+='<section><span class="tag">'+esc(f['severity'])+' · '+esc(f['effort'])+'</span><h3>'+esc(f['title'])+'</h3>'
        for key,label in [('observed','What happened'),('evidence','Evidence'),('impact','User consequence'),('fix','Recommended fix'),('retest','How to verify the fix')]:body+='<p><b>'+label+'</b><br>'+esc(f[key])+'</p>'
        body+='</section>'
    if not findings:body+='<p>No supported findings in this bounded run. This does not certify the whole product.</p>'
    body+='<h2>What worked</h2><ul>'+''.join('<li>'+esc(text(x,'strength'))+'</li>' for x in rows(d.get('strengths',[]),'strengths'))+'</ul><h2>To verify</h2><ul>'+''.join('<li>'+esc(text(x,'to_verify'))+'</li>' for x in unknown)+'</ul><p class="muted">Agent inspection is not recruited human usability research. This renderer validates report structure, not the truth of observations or the independence of the reviewer. It does not fix the product.</p>'
    return body

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--input',required=True);p.add_argument('--out',required=True);a=p.parse_args()
    try:
        d=json.loads(Path(a.input).read_text());out=save_page(a.out,d['product']+' — first-use report',build(d));print(json.dumps({'ok':True,'output':out,'findings':len(d['findings']),'test_execution':'not_performed_by_renderer'}));return 0
    except (OSError,ValueError,KeyError,TypeError) as e:print(json.dumps({'ok':False,'error':str(e)}),file=sys.stderr);return 2
if __name__=='__main__':sys.exit(main())
