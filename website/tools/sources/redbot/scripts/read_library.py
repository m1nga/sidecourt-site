#!/usr/bin/env python3
"""Read-only, bounded RedBot library reader; standard library only."""
import argparse,json,re,sys,urllib.request
from pathlib import Path

def read(path=None,live=False):
    if live:
        with urllib.request.urlopen('http://127.0.0.1:8766/api/library',timeout=5) as response:
            raw=response.read(45*1024*1024+1)
    else:
        p=Path(path).expanduser()
        if p.stat().st_size>45*1024*1024:raise ValueError('Backup exceeds 45 MB.')
        raw=p.read_bytes()
    if len(raw)>45*1024*1024:raise ValueError('Backup exceeds 45 MB.')
    d=json.loads(raw)
    if not isinstance(d,dict) or not isinstance(d.get('items'),list):raise ValueError('Expected a RedBot JSON backup with items.')
    return d

def select(d,query='',item_id=None,limit=8):
    ann=d.get('annotations') or {};rows=[x for x in d['items'] if isinstance(x,dict) and not ann.get(x.get('id'),{}).get('trashed') and not ann.get(x.get('id'),{}).get('archived')]
    if item_id:
        item=next((x for x in rows if x.get('id')==item_id),None)
        if not item:raise ValueError('Active save not found.')
        allowed=['id','title','url','author','description','summary','transcript','readingNotes','research','coverage','resources','anchors']
        out={k:item[k] for k in allowed if k in item}
        out['personal_note']=ann.get(item_id,{}).get('note','')
        out['related_guides']=[g for g in d.get('guides',[]) if item_id in g.get('sourceIds',[])]
        encoded=json.dumps(out,ensure_ascii=False)
        if len(encoded)>32000:return {'item':{k:str(v)[:5000] for k,v in out.items()},'truncated':True,'warning':'Read the named local backup for full detail; do not infer omitted material.'}
        return {'item':out,'truncated':False}
    terms=re.findall(r'[a-z0-9_-]{2,}|[\u3400-\u9fff]{2,}',query.lower())
    terms=[t for s in terms for t in ([s[i:i+2] for i in range(len(s)-1)] if re.search(r'[\u3400-\u9fff]',s) else [s])]
    result=[]
    for x in rows:
        note=ann.get(x.get('id'),{}).get('note','')
        body=' '.join(str(x.get(k,'')) for k in ['title','summary','description','readingNotes','transcript','research'])+' '+note
        score=sum(body.lower().count(t) for t in set(terms)) if terms else 1
        if not score:continue
        research=x.get('research') or {}
        readable=bool(note or any(x.get(k) for k in ['summary','description','readingNotes','transcript']) or research.get('decision') or research.get('points'))
        result.append({'id':x.get('id'),'title':x.get('title'),'url':x.get('url'),'status':'saved_text' if readable else 'needs_reading','score':score,'excerpt':body[:450]})
    result.sort(key=lambda x:-x['score'])
    return {'mode':'lexical_shortlist','matches':result[:limit],'matched_count':len(result),'next':'Inspect a selected ID before recommending. No match is not proof of absence.'}

def main():
    p=argparse.ArgumentParser();p.add_argument('backup',nargs='?');p.add_argument('--live',action='store_true');p.add_argument('--query',default='');p.add_argument('--id');p.add_argument('--limit',type=int,default=8);a=p.parse_args()
    if bool(a.backup)==bool(a.live):p.error('Choose exactly one backup path or --live.')
    try:print(json.dumps(select(read(a.backup,a.live),a.query,a.id,max(1,min(a.limit,20))),ensure_ascii=False))
    except (OSError,ValueError,TypeError,AttributeError) as e:print(json.dumps({'error':str(e),'recovery':'Export a RedBot JSON backup or provide the correct active save ID.'}),file=sys.stderr);return 2
    return 0
if __name__=='__main__':raise SystemExit(main())
