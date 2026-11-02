from html import escape as esc
from pathlib import Path
import json

def save_page(out, title, body):
    path=Path(out).expanduser()
    if not path.parent.is_dir(): raise ValueError('Output parent must exist')
    page='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+'</title><style>body{font:16px/1.6 system-ui,sans-serif;background:#f6f7f3;color:#243021;max-width:900px;margin:auto;padding:32px}h1{font-size:36px;line-height:1.15;letter-spacing:-1px}h2{font-size:23px;margin-top:36px}h3{font-size:18px}section{background:white;border:1px solid #dce2d8;border-radius:12px;padding:22px;margin:18px 0}small,.muted{color:#64715d}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.7 ui-monospace,monospace;background:#edf1e9;padding:18px;border-radius:8px}li{margin:9px 0}a{color:#416b31}.tag{display:inline-block;padding:3px 10px;border:1px solid #bbc9b1;border-radius:100px;font-size:12px}button{font:inherit;padding:10px 18px;border:0;border-radius:8px;background:#35572b;color:white;cursor:pointer}@media print{body{background:white;padding:0;max-width:none}section{break-inside:avoid}button{display:none}}@media(max-width:600px){body{padding:20px}h1{font-size:30px}}</style><body>'+body+'</body></html>'
    with path.open('x',encoding='utf-8') as f: f.write(page)
    path.chmod(0o600)
    return str(path.resolve())

def text(value,label):
    if not isinstance(value,str) or not value.strip(): raise ValueError(label+' must be nonempty text')
    if len(value)>30000: raise ValueError(label+' is too long')
    return value

def rows(value,label):
    if not isinstance(value,list): raise ValueError(label+' must be a list')
    return value
