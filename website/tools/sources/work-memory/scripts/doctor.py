#!/usr/bin/env python3
"""Read-only readiness report for a selected project memory. Never initializes or repairs."""
import argparse,json,sys,sqlite3
from pathlib import Path
import context,memory
from report_page import save_page,esc

def inspect(root,query=''):
    root=Path(root).expanduser().resolve()
    if not (root/'.work-memory/memory.sqlite3').is_file():
        return {'ok':False,'state':'not_initialized','root':str(root),'next_action':'Select the correct project root. Initialize only if this project needs ongoing memory. No files were created.'}
    reader=context.Reader(str(root))
    try:
        status=reader.status(); brief=context.brief(reader,query,'execute',5)
    finally:reader.db.close()
    issues=[]
    if status['stale']:issues.append('Some current evidence files changed or are missing. Read the source before relying on them.')
    if status['pending_outcomes']:issues.append('Some recorded uses have no observed outcome. Do not call them successful lessons.')
    if status['pending_lessons']:issues.append('Some lessons are candidate, trial or suspended. Their status is not approval.')
    if not status['last_checkpoint']:issues.append('No checkpoint is recorded. Read the authoritative task state to choose a next action.')
    return {'ok':True,'state':'review_needed' if issues else 'bounded_context_available','root':str(root),'issues':issues,'status':status,'brief':brief,'next_action':brief['next_action'],'limits':'Read-only local diagnostics, not automatic capture, authenticated review, semantic recall or proof of current external state.'}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--root',required=True);p.add_argument('--query',default='');p.add_argument('--out');a=p.parse_args()
    try:
        d=inspect(a.root,a.query)
        if a.out:
            body='<small>PRIVATE PROJECT MEMORY · READ-ONLY</small><h1>Can the next session trust this context?</h1><p>'+esc(d['state'].replace('_',' '))+'</p><section><h2>Next action</h2><p>'+esc(d['next_action'])+'</p></section>'
            for issue in d.get('issues',[]):body+='<p>• '+esc(issue)+'</p>'
            body+='<section><h2>Evidence and coverage</h2><pre>'+esc(json.dumps(d,ensure_ascii=False,indent=2))+'</pre></section><p>Review private notes and paths before sharing this report.</p>'
            d['output']=save_page(a.out,'Project memory readiness',body)
        print(json.dumps(d,ensure_ascii=False));return 0 if d['ok'] else 1
    except (OSError,ValueError,memory.MemoryError,sqlite3.Error) as e:print(json.dumps({'ok':False,'error':str(e)}),file=sys.stderr);return 2
if __name__=='__main__':sys.exit(main())
