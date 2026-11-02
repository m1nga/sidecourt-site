"""Owned product entry points. Additive static hosting, no account or work mutations."""
import html,json,shutil
from pathlib import Path

STYLE='''*{box-sizing:border-box}body{margin:0;color:#f2f0df;background:#102b23;font:16px/1.65 system-ui}a{color:inherit}main{max-width:1120px;margin:0 auto;padding:45px 24px 80px}nav{display:flex;gap:24px;flex-wrap:wrap;align-items:center;padding-bottom:30px;border-bottom:1px solid #ffffff25}nav img{width:130px}h1{font:clamp(38px,6vw,76px)/1.06 Georgia,serif;max-width:850px;margin:45px 0 22px}h2{font:30px/1.2 Georgia,serif}p{max-width:730px;color:#d0d8c7}.eyebrow,small{font-size:12px;letter-spacing:.1em;text-transform:uppercase}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin:30px 0}.card{display:flex;flex-direction:column;border:1px solid #ffffff25;padding:24px;border-radius:14px;background:#ffffff06;text-decoration:none;min-width:0}.card h2{font:25px/1.2 Georgia,serif;margin:12px 0}.card p{font-size:14px;flex:1}.card span{font-size:13px;color:#bbd0aa}.card:hover{background:#ffffff10}.card[hidden]{display:none}.actions{display:flex;flex-wrap:wrap;gap:12px;margin:26px 0}.button,button{border:1px solid #b9caa2;background:#dce9c5;color:#102b23;padding:12px 18px;border-radius:8px;font:inherit;text-decoration:none;cursor:pointer}.secondary{background:transparent;color:#f2f0df}input{width:100%;padding:14px;background:#ffffff0d;color:#fff;border:1px solid #ffffff45;border-radius:8px;font:inherit}pre{background:#071d16;padding:20px;white-space:pre-wrap;overflow-wrap:anywhere;border-radius:8px}footer{border-top:1px solid #ffffff25;margin-top:45px;padding-top:20px;font-size:13px}li{margin:12px 0}.legacy{opacity:.75}#count{margin-top:10px;display:block}@media(max-width:780px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:520px){.grid{grid-template-columns:1fr}main{padding:24px 18px}nav{gap:16px}nav img{width:110px}}'''

def page(title,description,url,body,schema=None):
 esc=html.escape
 structured='' if schema is None else '<script type="application/ld+json">'+json.dumps(schema).replace('</','<\\/')+'</script>'
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+' · SideCourt</title><meta name="description" content="'+esc(description,quote=True)+'"><link rel="canonical" href="https://sidecourt.space'+url+'"><meta property="og:title" content="'+esc(title,quote=True)+'"><meta property="og:description" content="'+esc(description,quote=True)+'"><meta property="og:url" content="https://sidecourt.space'+url+'"><link rel="icon" href="/favicon.svg"><style>'+STYLE+'</style>'+structured+'</head><body><main><nav><a href="/" aria-label="SideCourt home"><img src="/assets/logo-cream.svg" alt="SideCourt"></a><a href="/drops/">All drops</a><a href="/tools/">Tools & skills</a></nav>'+body+'<footer>Made by Ming (<a href="/people/m1nga/">@m1nga</a>) · <a href="/">SideCourt</a> · <a href="/tools/">All tools and skills</a> · Updated November 3, 2026</footer></main></body></html>'

def card(x):
 e=html.escape
 return '<a class="card '+('legacy' if x['status']=='Legacy' else '')+'" href="'+x['url']+'" data-entry="'+e((x['name']+' '+x['description']+' '+x['kind']).lower(),quote=True)+'"><small>'+e(x['kind'])+' · '+e(x['status'])+'</small><h2>'+e(x['name'])+'</h2><p>'+e(x['description'])+'</p><span>See how it works ↗</span></a>'

def inject_home_tools(document):
 if 'id="home-ming-tools"' in document:return document
 body='''<section class="section sc-owned-tools" id="home-ming-tools" aria-labelledby="ming-tools-title"><p class="eyebrow">MADE BY <a href="/people/m1nga/">@m1nga</a> · ON SIDECOURT</p><h2 id="ming-tools-title">Small tools. Useful work.</h2><p>Find a saved note, brew a coffee, or make your next project easier.</p><div class="sc-owned-cards"><a href="/drops/redbot/">RedBot<span>Find the useful thing you saved.</span></a><a href="/drops/daycup/">DayCup<span>A starting recipe and a place for your brew notes.</span></a><a href="/cleanpause/">CleanPause<span>A little pause while you clean your device.</span></a></div><a class="text-link" href="/tools/">Explore all tools & skills ↗</a></section>'''
 marker='<section class="section" id="home-season">'
 if marker not in document:raise ValueError('Expected home section boundary missing; do not silently overwrite the homepage.')
 document=document.replace(marker,body+marker,1)
 prefix,tail=document.split('<main id="main-home"',1)
 prefix=prefix.replace('<a href="/drops">DROPS</a>','<a href="/drops">DROPS</a><a href="/tools/">TOOLS</a>')
 document=prefix+'<main id="main-home"'+tail
 css='<style>.sc-owned-tools{padding-block:40px}.sc-owned-tools h2{font-size:clamp(32px,4vw,56px);margin:14px 0}.sc-owned-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:24px 0}.sc-owned-cards a{display:block;padding:22px;border:1px solid currentColor;border-radius:10px;color:inherit;text-decoration:none;font-size:24px}.sc-owned-cards span{display:block;font:14px/1.5 system-ui;margin-top:10px;opacity:.8}@media(max-width:650px){.sc-owned-cards{grid-template-columns:1fr}}</style>'
 return document.replace('</head>',css+'</head>',1)

def publish_tools(root,out):
 data=json.loads((root/'tools/catalog.json').read_text());items=data['items'];e=html.escape
 shutil.copytree(root/'tools',out/'tools',dirs_exist_ok=True)
 intro='<p class="eyebrow">TOOLS BY MING</p><h1>What do you want<br>to get done?</h1><p>Find something you saved. Make a better starting cup. Pick up a project without starting over.</p><p>Web apps open in your browser. Skills run in a compatible AI assistant; the code remains on GitHub. Legacy skills are retained for reference.</p><label for="tool-search">Find a tool or a task</label><input id="tool-search" type="search" placeholder="Try saved links, coffee, handoff or design"><small id="count" role="status">'+str(len(items))+' tools and skills</small>'
 schema={'@context':'https://schema.org','@type':'ItemList','name':'Tools and skills by Ming on SideCourt','itemListElement':[{'@type':'ListItem','position':i+1,'name':x['name'],'url':'https://sidecourt.space'+x['url']} for i,x in enumerate(items)]}
 search='<script>document.querySelector("#tool-search").oninput=e=>{let n=0;for(const card of document.querySelectorAll("[data-entry]")){card.hidden=!card.dataset.entry.includes(e.target.value.toLowerCase().trim());if(!card.hidden)n++;}document.querySelector("#count").textContent=n?`${n} tools and skills`:"No match. Try a different task or clear the search.";};</script>'
 (out/'tools/index.html').write_text(page('Tools & Skills by Ming','Try useful products and install AI-assistant skills, all through SideCourt.','/tools/',intro+'<div class="grid">'+''.join(card(x) for x in items)+'</div>'+search,schema))
 urls=['https://sidecourt.space/tools/']
 for x in items:
  if 'install' not in x:continue
  slug=x['slug'];folder=out/'skills'/slug;folder.mkdir(parents=True,exist_ok=True)
  body='<p class="eyebrow">'+e(x['name'])+' · AI ASSISTANT SKILL · '+e(x['status'])+'</p><h1>'+e(x['description'])+'</h1><p><strong>Bring:</strong> '+e(x.get('bring','Your task and relevant source material.'))+'</p><p><strong>Get:</strong> '+e(x.get('result','A result within the skill’s documented scope.'))+'</p>'
  if x['status']=='Legacy':body+='<p>This legacy skill remains available for reference. It is not a current default workflow.</p>'
  if slug=='redbot':body+='<div class="actions"><a class="button" href="/drops/redbot/app/">Try RedBot preview</a><a class="button secondary" href="/drops/redbot/">Product & privacy</a><a class="button secondary" href="/drops/redbot/test/">User test</a></div>'
  if x.get('example'):body+='<h2>Try a real request.</h2><blockquote>'+e(x['example'])+'</blockquote>'
  body+='<h2>Use it with your AI assistant.</h2><p>Install the skill in a compatible assistant, then describe the task and give it access only to the material you want it to use. A skill is instructions and supporting tools; it is not a separate chat service or a model subscription.</p><pre id="install">'+e(x['install'])+'</pre><div class="actions"><button id="copy">Copy install command</button><a class="button secondary" href="'+x['package']+'" download>Download skill package</a></div><p id="copy-status" role="status"></p><h2>Read the exact instructions.</h2><p><a href="/tools/sources/'+slug+'/SKILL.md">Skill instructions</a> · <a href="/tools/sources/'+slug+'/README.md">Full guide and examples</a> · <a href="'+x['repository']+'" rel="noopener noreferrer">Source code on GitHub ↗</a></p><p>The package is sourced from the public registry at commit '+e(data['source_commit'][:12])+'. Product-specific permissions, dependencies and limits are in its guide. Installing does not grant permission to publish, send messages, spend money or access unrelated files.</p>'
  body+='<script>document.querySelector("#copy").onclick=async()=>{try{await navigator.clipboard.writeText(document.querySelector("#install").textContent);document.querySelector("#copy-status").textContent="Copied. Paste into your terminal to install.";}catch{document.querySelector("#copy-status").textContent="Copy the command above manually.";}};</script>'
  (folder/'index.html').write_text(page(x['title'],x['description'],'/skills/'+slug+'/',body,{'@context':'https://schema.org','@type':'SoftwareSourceCode','name':x['title'],'description':x['description'],'url':'https://sidecourt.space/skills/'+slug+'/','codeRepository':x['repository'],'author':{'@type':'Person','name':'Ming','url':'https://sidecourt.space/people/m1nga/'}}))
  urls.append('https://sidecourt.space/skills/'+slug+'/')
 shutil.copytree(root/'redbot',out/'drops/redbot',dirs_exist_ok=True)
 urls += ['https://sidecourt.space/drops/redbot/','https://sidecourt.space/drops/redbot/app/','https://sidecourt.space/drops/redbot/test/']
 # Familiar route aliases enter the same canonical platform page.
 for path,target in [('products','/tools/'),('redbot','/drops/redbot/')]:
  folder=out/path;folder.mkdir(exist_ok=True);(folder/'index.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><title>SideCourt</title><link rel="canonical" href="https://sidecourt.space'+target+'"><meta http-equiv="refresh" content="0;url='+target+'"><a href="'+target+'">Continue to SideCourt</a></html>')
 print('Published',len(items),'owned product entries and',sum('install' in x for x in items),'skill packages.')
 return urls
