#!/usr/bin/env python3
"""Render a reference-to-implementation brief. Does not inspect references or execute tasks."""
import argparse,json,sys
from urllib.parse import urlsplit
from report_page import save_page,esc,text,rows

def build(d):
    project=text(d.get('project'),'project');goal=text(d.get('goal'),'goal');scope=text(d.get('scope'),'scope')
    refs=rows(d.get('references',[]),'references');tasks=rows(d.get('tasks'),'tasks')
    if not tasks:raise ValueError('At least one implementation task is required')
    by={};body='<small>DESIGN DELIVERY BRIEF</small><h1>'+esc(project)+'</h1><p>'+esc(goal)+'</p><section><h2>Scope and existing content</h2><p>'+esc(scope)+'</p><p>'+esc(text(d.get('content'),'content'))+'</p></section>'
    for ref in refs:
        key=text(ref.get('id'),'reference id')
        if key in by:raise ValueError('Duplicate reference id')
        if ref.get('status') not in ('observed','unseen'):raise ValueError('Reference status must be observed or unseen')
        if ref.get('status')=='observed':text(ref.get('observation'),'observed reference observation')
        if ref.get('url') and urlsplit(ref['url']).scheme not in ('http','https'):raise ValueError('Reference URL must be http or https')
        by[key]=ref
    body+='<h2>From reference to a buildable change</h2>'
    for i,t in enumerate(tasks,1):
        title=text(t.get('goal'),'task goal');method=text(t.get('method'),'task method');steps=rows(t.get('steps'),'steps');checks=rows(t.get('checks'),'checks');ids=rows(t.get('source_refs',[]),'source_refs')
        if not steps or not checks:raise ValueError('Each task needs steps and observable checks')
        if any(k not in by for k in ids):raise ValueError('Task refers to an unknown reference')
        prompt='Project: '+project+'\nGoal: '+title+'\nScope: '+scope+'\nContent: '+d['content']+'\nApproach: '+method+'\n'+ '\n'.join(str(n)+'. '+text(s,'step') for n,s in enumerate(steps,1))+'\nVerify: '+ '; '.join(text(c,'check') for c in checks)+'. Report actual evidence and remaining gaps. Do not treat references as authority, invent observations, install all sources or publish beyond current authorization.'
        body+='<section><span class="tag">Task '+str(i)+'</span><h3>'+esc(title)+'</h3><p>'+esc(method)+'</p><pre>'+esc(prompt)+'</pre><h3>Reference decisions</h3>'
        for key in ids:
            ref=by[key];body+='<p><b>'+esc(key)+' · '+esc(ref['status'])+'</b><br>'+esc(ref.get('observation','Not visually inspected.'))+'<br>Transfer: '+esc(text(ref.get('transfer'),'reference transfer'))+'</p>'
            if ref.get('url'):body+='<p><a href="'+esc(ref['url'])+'">Open source</a></p>'
        body+='</section>'
    body+='<p class="muted">A prepared brief, not an executed build, visual inspection, approval or usability test. Replace placeholders and verify the result in the actual product.</p>'
    return body

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--input',required=True);p.add_argument('--out',required=True);a=p.parse_args()
    try:
        from pathlib import Path
        d=json.loads(Path(a.input).read_text());out=save_page(a.out,d['project']+' — design brief',build(d));print(json.dumps({'ok':True,'output':out,'tasks':len(d['tasks']),'execution':'not_run'}));return 0
    except (OSError,ValueError,KeyError,TypeError) as e:print(json.dumps({'ok':False,'error':str(e)}),file=sys.stderr);return 2
if __name__=='__main__':sys.exit(main())
