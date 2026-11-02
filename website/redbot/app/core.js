/* Shelf: shared import, search and library rules. No network or model calls. */
(function(root){
'use strict';
const TOPICS=['Design','AI & tools','Creative','Marketing','Food & coffee','Fitness','Life','Film & culture','Finance','Parenting','Work & learning','Style','Unsorted'];
const RULES=[['Design',/design|interface|typograph|ppt|react|html|css|网站|组件|设计|审美|交互|配色|字体|figma|\bui\b|\bux\b|taste|网页|界面|油画/i],['Fitness',/筋膜|崴脚|热身|barre|腰|骨盆|骶髂|柔软|俯卧撑|动物流|呼吸|滾筒|燃脂|开练|高翻|hyrox|健身|减脂|增肌|训练|运动|拉伸|髋|踝|膝|深蹲|下肢|力量|体能|壶铃|跑步|弹跳|卧推|核心|肩|背部|腹肌|复合动作/i],['Food & coffee',/recipe|cooking|奶泡|拉花|配方|提拉米苏|燕麦|蘸酱|面包|蛏子|鸡饭|咖喱|主厨|喝点|餐厅|煲粥|拌面|咖啡|冲煮|豆子|美食|做饭|食谱|料理|coffee/i],['Film & culture',/盗火线|黑暗骑士|侯孝贤|张艺谋|杨德昌|电影|电视剧|演员|hacks|小城日常|千禧年|插翅|可能的爱/i],['Finance',/选股|量化|金融|美股|交易|投资|股票|致富/i],['Parenting',/宝宝|孩子|婴幼儿|奶嘴|亲子|带娃|坐月子|8-9个月/i],['Work & learning',/面试|招聘|课程|活动策划|学习/i],['Style',/时装|秀场|acne|帽子|古货|手表|穿搭/i],['Creative',/音乐|配乐|视频|剪辑|suno|strudel|摄影|音效|播客/i],['Marketing',/营销|获客|seo|geo|传播|增长|品牌/i],['AI & tools',/openclaw|clawdbot|notebooklm|gemini|谷歌|mac mini|reddit|提示词|prompt|token|源码|李飞飞|\bai\b|agent|skill|codex|claude|grok|模型|记忆|开源|github|自动化|工作流|大模型|工具/i],['Life',/生活|旅行|装修|收纳|衣服|穿搭|房子|地面|瓷砖|厨房|露营|酒店|家装|旅游|家具|人生|关系|穿搭/i]];
const clean=x=>typeof x==='string'?x.slice(0,200000):'';
function safeURL(x){try{const u=new URL(x);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}}
function imageURL(x){return /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i.test(x||'')?x:safeURL(x);}
function classify(title){return RULES.find(r=>r[1].test(title))?.[0]||'Unsorted';}
function normalize(x,i=0){
 const c=x.noteCard||{}, n=x.data?.note||x.note||x;const title=clean(x.title||c.displayTitle||n.title)||'Untitled save';
 const raw=clean(x.url||x.href||x.post_url);const id=clean(x.id||n.noteId)||(raw.match(/(?:explore|discovery\/item)\/([a-f0-9]{24})/)||[])[1]||('link-'+hash(raw||title));
 let url=safeURL(raw.startsWith('/')?'https://www.xiaohongshu.com'+raw:raw);if(!url&&/^[a-f0-9]{24}$/.test(id))url='https://www.xiaohongshu.com/explore/'+id;
 if(url){let u=new URL(url);for(const k of ['xsec_token','xsec_source','xhsshare','app_platform','share_from_user_hidden'])u.searchParams.delete(k);url=u.href;}
 const description=clean(x.description||n.desc||c.desc),summary=clean(x.summary||x.method||x.lesson);
 return {id,title,url,author:clean(typeof x.author==='string'?x.author:n.user?.nickname||c.user?.nickname),image:imageURL(x.image||c.cover?.urlDefault||c.cover?.url||n.imageList?.[0]?.urlDefault||''),type:['video','note','link'].includes(x.type||c.type)?x.type||c.type:(c.type==='normal'?'note':'link'),category:TOPICS.includes(x.category)?x.category:classify(title),tags:(Array.isArray(x.tags)?x.tags:[]).filter(t=>typeof t==='string').slice(0,30),description,summary,readingNotes:clean(x.readingNotes||x.application),limits:clean(x.limits||x.corrections),resources:(Array.isArray(x.resources)?x.resources:Array.isArray(x.sources)?x.sources:[]).map(safeURL).filter(Boolean).slice(0,30),anchors:(x.anchors||[]).filter(t=>typeof t==='string').slice(0,40),videoURL:safeURL(x.videoURL),transcript:clean(x.transcript),duration:Number(x.duration)||0,research:x.research&&typeof x.research==='object'?{points:(Array.isArray(x.research.points)?x.research.points:[]).filter(p=>Array.isArray(p)&&p.length===2).slice(0,40).map(p=>p.map(clean)),decision:clean(x.research.decision),limits:clean(x.research.limits)}:null,position:Number.isFinite(x.position)?x.position:i,hasContent:Boolean(x.hasContent||description||summary||x.transcript),coverage:clean(x.coverage),importedAt:clean(x.importedAt)||new Date().toISOString()};
}
function hash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return(h>>>0).toString(36);}
function extract(x){if(Array.isArray(x))return x;if(!x||typeof x!=='object')throw Error('This file does not contain a save library.');for(const k of ['items','feeds','posts','bookmarks'])if(Array.isArray(x[k]))return x[k];for(const k of ['data','result'])if(x[k]){try{return extract(x[k]);}catch{}}for(const c of x.content||[]){try{return extract(JSON.parse(c.text));}catch{}}throw Error('No saves found. Import a RedBot backup, a bookmark HTML file, CSV, or a Xiaohongshu JSON export.');}
function mergeItems(before,incoming){let map=new Map(before.map(x=>[x.id,x]));let urls=new Map(before.filter(x=>x.url).map(x=>[x.url,x.id]));let added=0;for(const raw of incoming){const n=normalize(raw,map.size);if(!n.url&&!n.description&&!n.summary)continue;const id=map.has(n.id)?n.id:urls.get(n.url)||n.id;let old=map.get(id);if(old){const next={...old};for(const [k,v]of Object.entries(n))if(v!==''&&v!=null&&(!Array.isArray(v)||v.length))next[k]=v;next.id=id;next.position=old.position;next.hasContent=old.hasContent||n.hasContent;map.set(id,next);}else{map.set(id,n);if(n.url)urls.set(n.url,id);added++;}}return {items:[...map.values()],added};}
const synonyms=[['设计','design','界面','交互','ui','ux'],['咖啡','coffee','冲煮','espresso','手冲'],['健身','fitness','运动','训练'],['记忆','memory','上下文'],['工作流','workflow','自动化'],['营销','marketing','seo','geo'],['音乐','music','配乐'],['视频','video','剪辑'],['agent','智能体'],['收藏','bookmark']];
function score(item,annotation,query){let q=query.trim().toLowerCase();if(!q)return 1;const title=item.title.toLowerCase(), all=[item.title,item.author,item.category,item.description,item.summary,item.readingNotes,item.transcript,JSON.stringify(item.research||''),...item.tags,annotation?.note,annotation?.category].join(' ').toLowerCase();const terms=q.split(/\s+/).filter(Boolean);let total=0;for(const t of terms){let group=synonyms.find(g=>g.includes(t));let variants=group||[t];let best=0;for(const v of variants){if(title.includes(v))best=Math.max(best,20+(v===t?10:0));else if(all.includes(v))best=Math.max(best,5+(v===t?3:0));}if(!best)return 0;total+=best;}return total;}
function filterItems(items,state,view,filter,query,sort){const ann=state.annotations||{};let list=items.map(x=>({item:x,annotation:ann[x.id]||{},score:score(x,ann[x.id],query)})).filter(({item:x,annotation:a,score:s})=>{
 if(!s)return false;if(view==='trash')return a.trashed;if(a.trashed)return false;if(view==='archived'){if(!a.archived)return false;}else if(a.archived)return false;
 if(view==='unread'&&a.read)return false;if(view==='favorite'&&!a.favorite)return false;if(view.startsWith('topic:')&&(a.category||x.category)!==view.slice(6))return false;if(view.startsWith('collection:')&&!(a.collections||[]).includes(view.slice(11)))return false;
 if(filter==='video'&&x.type!=='video')return false;if(filter==='note'&&x.type==='video')return false;if(filter==='content'&&!x.hasContent)return false;return true;
 });list.sort((a,b)=>query?b.score-a.score:sort==='title'?a.item.title.localeCompare(b.item.title):sort==='recent'?b.item.importedAt.localeCompare(a.item.importedAt):a.item.position-b.item.position);return list.map(x=>x.item);}
function sharedLinks(text){
 const lines=String(text).slice(0,200000).split(/\r?\n/);const found=[];const seen=new Set();
 for(const line of lines){const matches=[...line.matchAll(/https?:\/\/[^\s<>"“”]+/gi)];for(const m of matches){const raw=m[0].replace(/[),.;!，。；！）】]+$/u,'');const url=safeURL(raw);if(!url)continue;const n=normalize({url,title:line.replace(m[0],'').replace(/^\s*[-*\d.]+\s*/,'').trim()||new URL(url).hostname});if(!seen.has(n.url)){seen.add(n.url);found.push(n);}}}
 return found.slice(0,500);
}
function normalizeGuide(g){if(!g||typeof g!=='object'||!g.id||!g.title)return null;return {id:clean(g.id).slice(0,120),title:clean(g.title),category:clean(g.category),provenance:clean(g.provenance),method:clean(g.method),steps:(Array.isArray(g.steps)?g.steps:[]).filter(x=>typeof x==='string').slice(0,12).map(clean),prompt:clean(g.prompt),limit:clean(g.limit),sourceIds:(Array.isArray(g.sourceIds)?g.sourceIds:[]).filter(x=>typeof x==='string').slice(0,30),resources:(Array.isArray(g.resources)?g.resources:[]).map(safeURL).filter(Boolean).slice(0,30)};}
/* Goal routing is evidence-bounded and local. It does not call a model. */
const INTENTS=[
 {id:'web-polish',label:'Make an existing page feel polished',pattern:/clutter|messy|plastic|cheap|polish|refin|质感|廉价|塑料|杂乱|精修|不好看|高级感/i,reason:'You want to improve an existing page, so start with a focused refinement rather than a new visual direction.',next:'Choose one section. Change its hierarchy, spacing or emphasis, then compare the same section before and after.'},
 {id:'web-direction',label:'Choose a visual direction',pattern:/visual direction|look.and.feel|art direction|style|风格|视觉方向|整体感觉/i,reason:'Your question is about the overall visual direction. This guide starts with real content and a small reference comparison.',next:'Choose one reference and describe the exact layout or visual relationship you want to transfer.'},
 {id:'web-system',label:'Make the interface consistent',pattern:/consistent|design system|typograph|font|palette|spacing system|一致|统一|字体|配色|设计系统|间距规范/i,reason:'You need consistent interface choices. This route connects type, color, spacing and component states.',next:'Apply one set of roles to a real page and check its empty and error states.'},
 {id:'product-states',label:'Help a first-time user finish the task',pattern:/onboard|first.?use|first.?time|新手|第一次|首次|用户.*(?:卡|不懂|不会)|人.*卡住|loading|empty state|error state|报错|错误状态|引导/i,reason:'Your goal is a usable first session. Start with the main task and its feedback and recovery states.',next:'Run one new user task from an empty start to a useful result. Fix the first observed point where the user cannot continue.'},
 {id:'product-model',label:'Clarify the product structure',pattern:/data model|objects|relationships|product structure|对象|数据模型|业务逻辑|产品结构|理顺/i,reason:'You need to clarify what the product contains and how a real task changes it.',next:'Name one user, one goal, the objects involved and the state change that counts as success.'},
 {id:'product-continuity',label:'Make the product useful on return',pattern:/return|everyday|keep using|回访|长期用|持续使用|日常使用/i,reason:'Your goal concerns repeat use. This route follows a realistic input through capture, edit, use and return.',next:'Use one realistic item through the whole loop, close the product and check that returning is useful.'},
 {id:'product-sidecourt',label:'Improve a SideCourt visit',pattern:/sidecourt/i,reason:'This is a SideCourt-specific question. Use the saved guide tied to that product rather than generic growth advice.',next:'Choose one visitor need and one small useful action, then check the real response or reason to return.'},
 {id:'web-scroll',label:'Build a scrolling interaction',pattern:/scroll|parallax|sticky|滚动|视差|吸顶/i,reason:'You named a scrolling interaction. This route starts with the movement and trigger, not a whole component catalog.',next:'Build one section with real content, then check mobile behavior and reduced motion.'},
 {id:'web-components',label:'Adapt an interactive component',pattern:/component|glass|组件|毛玻璃/i,reason:'You want a specific component. Inspect the relevant source and dependencies before adapting one example.',next:'Select one component and verify its actual interaction in the current project.'},
 {id:'web-effects',label:'Recreate one web effect',pattern:/effect|动画效果|网页效果|动效/i,reason:'You want a particular effect. Name the trigger, movement and parameters before implementation.',next:'Implement one small effect with real content and a reduced-motion alternative.'},
 {id:'web-reference',label:'Find a reference for one page region',pattern:/reference site|参考网站|找参考|footer|navigation|页脚|导航/i,reason:'You need a reference for a concrete part of the page. Start with that region rather than browsing an entire inspiration library.',next:'Pick one region and transfer one useful relationship into the existing page.'},
 {id:'shared-diagram',label:'Explain a flow with a diagram',pattern:/diagram|architecture|流程图|架构图|关系图|画清楚/i,reason:'You want to explain relationships or a flow. This guide selects a diagram by the question it needs to answer.',next:'Write the one question the diagram must answer, then verify its labels against the actual system.'},
 {id:'shared-verification',label:'Check whether the product really works',pattern:/verif|test|actually work|验收|验证|测试|能不能用|真的能用/i,reason:'You want evidence that the product works. Start with the actual task and a recovery path.',next:'Run the task with realistic data and record the result and remaining gaps.'},
 {id:'shared-search',label:'Help Google find my public page',pattern:/\bseo\b|indexing|search engine|google.*(?:find|search)|收录|搜索引擎|谷歌|Google.*搜|搜.*到/i,reason:'Your goal is discovery through conventional search. Check one intended public page and indexing evidence first.',next:'Choose one public product URL and inspect its actual access, content and indexing signals.'},
 {id:'promotion-geo',label:'Make my product usable in AI answers',pattern:/\bgeo\b|ai answer|ai.*(?:mention|recommend)|chatgpt|AI.*(?:回答|提到|推荐)|(?:回答|答案).*提到|大模型.*推荐/i,reason:'You want your product represented in AI answers. Start with a specific audience question and verifiable public product facts.',next:'Choose one engine and one real question, record its current answer and cited sources, then inspect the factual gaps.'},
 {id:'promotion-positioning',label:'Choose who to reach and what to say',pattern:/positioning|content angle|audience|定位|内容角度|受众|向谁|卖点|文案|marketing copy/i,reason:'You need a clear audience and message before choosing a distribution format.',next:'Write one audience, one current problem and one benefit that the product can actually demonstrate.'},
 {id:'video-shotcraft',label:'Create a short product introduction',pattern:/product video|product demo|介绍视频|介绍.*视频|演示视频|30\s*(?:秒|s|second)|宣传片|产品视频|镜头|做.*视频|制作.*视频/i,reason:'You want a new product video. Start with real product evidence, one viewer and a timed shot plan.',next:'Inventory real screens and write a short shot plan for one demonstrated product action.'},
 {id:'video-source',label:'Revise an existing promotional video',pattern:/video source|video code|existing.*video|revise.*video|视频源码|改.*(?:视频|宣传片)|修改.*(?:片|视频)|现有宣传片|视频代码|复用.*视频/i,reason:'You already have a video or source project. Identify what is editable and change one concrete shot first.',next:'Provide the existing project or clip and one timestamped change; check assets and rights before reuse.'},
 {id:'video-editable',label:'Make editable video variations',pattern:/hypit|editable video|视频变体|批量视频|多语言.*视频|可编辑.*视频/i,reason:'You want repeatable script or language variations. Verify one editable result before multiplying it.',next:'Select one script change and one available asset set, then inspect a single variation.'}

];
const GOAL_STOP=new Set(['want','need','help','please','how','my','i','to','do','make','improve','use','now','a','the','can','with','is','it','me','and','for','some','this','that','look','better','find','saved','save','note','notes','post','posts','collection','collections','remember','something','read','show','where','was','from','about']);
function goalTerms(goal){
 const out=new Set();for(const t of goal.toLowerCase().match(/[a-z0-9-]{2,}/g)||[])if(!GOAL_STOP.has(t))out.add(t);
 const stripped=goal.replace(/我想要?|想要|帮我|一下|怎么|如何|这个|那个|现在|可以|一些|一个|没有|什么|我要|希望|做得|收藏|笔记|保存|找回|找到/g,' ');
 for(const run of stripped.match(/[\u3400-\u9fff]{2,}/g)||[])for(let i=0;i<run.length-1;i++)out.add(run.slice(i,i+2));
 for(const t of ['髋','肩','腰','咖啡','健身','设计','视频','记忆'])if(goal.includes(t))out.add(t);
 return [...out].slice(0,80);
}
function normalizeGoalState(x){x=x&&typeof x==='object'?x:{};const skips={};for(const [key,val] of Object.entries(x.skips||{}).slice(-50))if(/^[a-z0-9-]{1,80}$/.test(key)&&Array.isArray(val))skips[key]=val.filter(v=>typeof v==='string').slice(0,30).map(v=>v.slice(0,120));const p=x.plan;return {skips,plan:p&&typeof p==='object'&&typeof p.goal==='string'?{goal:clean(p.goal).slice(0,1000),choice:clean(p.choice).slice(0,120),status:p.status==='done'?'done':'ready'}:null};}
function hasResearch(x){return !!(x.research?.decision?.trim()||x.research?.points?.some(p=>p[1]?.trim()));}
function hasText(x){return !!(x.summary||x.readingNotes||x.description||x.transcript);}
function chooseStart(items,guides,state,goal,choice=''){
 goal=String(goal||'').trim().slice(0,1000);const ann=state.annotations||{},gs=normalizeGoalState(state.goalState),key=hash(goal.toLowerCase()),skips=new Set(gs.skips[key]||[]);
 const live=items.filter(x=>!ann[x.id]?.trashed&&!ann[x.id]?.archived),liveBy=new Map(live.map(x=>[x.id,x]));
 const routes=guides.map(normalizeGuide).filter(Boolean).filter(g=>!skips.has(g.id)&&(g.sourceIds.some(id=>liveBy.has(id))||(!g.sourceIds.length&&g.resources.length)));
 if(!items.length)return {status:'empty',message:'Add your own saves first. I will choose from the material in your library, not invent a recommendation.'};
 if(!goal)return {status:'clarify',question:'What would you like to get done?',options:[]};
 let matched=INTENTS.filter(i=>i.pattern.test(goal)&&routes.some(g=>g.id===i.id));
 if(matched.some(i=>i.id==='video-source'))matched=matched.filter(i=>i.id!=='video-shotcraft');
 if(matched.some(i=>i.id==='video-editable'))matched=matched.filter(i=>!['video-shotcraft','video-source'].includes(i.id));
 if(!choice&&!matched.some(i=>/^(promotion-|video-)|shared-search/.test(i.id))&&/promot|market my product|launch my product|宣传|推广|获客|营销/i.test(goal)){
  const options=[['promotion-positioning','Decide who to reach and what to say'],['shared-search','Help people find me on Google'],['promotion-geo','Help AI answers describe my product'],['video-shotcraft','Show the product in a short video']].filter(([id])=>routes.some(g=>g.id===id)).map(([choice,label])=>({choice,label}));
  if(options.length)return {status:'clarify',question:'What should this promotion help someone do?',options};
 }
 if(matched.some(i=>i.id==='product-sidecourt'))matched=matched.filter(i=>!['product-continuity','product-states'].includes(i.id));
 // Explicit choice is a response to a visible clarification, not an inferred preference.
 if(choice)matched=INTENTS.filter(i=>i.id===choice&&routes.some(g=>g.id===i.id));
 if(matched.length>1&&!choice)return {status:'clarify',question:'Which part should we tackle first?',options:matched.slice(0,3).map(i=>({label:i.label,choice:i.id}))};
 if(skips.size&&!matched.length)return {status:'no_match',message:'The previous choice was not a fit. I do not have another reviewed route for this goal yet. Tell me what was missing, such as a different tool, level or constraint.'};
 if(!matched.length&&!choice&&(/(?:优化|改进|改善|提升).*?(?:页面|网页|设计|网站|产品)|(?:页面|网页|网站|设计|产品).*(?:更好|好一点|优化)/i.test(goal)||/^(?:设计|网页|网站|产品|健身|咖啡|视频|design|website|product|fitness|coffee|video|make my website better|improve my website)[。.!?\s]*$/i.test(goal))){
  const domain=/fitness|健身/i.test(goal)?'fitness':/coffee|咖啡/i.test(goal)?'coffee':/video|视频/i.test(goal)?'video':/product|产品/i.test(goal)?'product':'design';
  const choices={design:[['web-polish','It looks messy or unfinished'],['product-states','People do not know what to do next'],['web-reference','I need a reference to start from']],product:[['product-states','People get stuck on their first visit'],['product-continuity','There is no reason to come back'],['product-model','I need to clarify what I am building']],video:[['video-shotcraft','Plan the shots for a product video'],['video-source','Adapt an existing video project'],['video-editable','Make editable variations']],fitness:[],coffee:[]}[domain];
  return {status:'clarify',question:domain==='fitness'?'What specific movement or fitness topic are you researching?':domain==='coffee'?'What do you want to make or improve?':'What feels wrong or missing right now?',options:choices.filter(([id])=>routes.some(g=>g.id===id)).map(([choice,label])=>({choice,label}))};
 }
 if(matched.length){
  const intent=matched[0],guide=routes.find(g=>g.id===intent.id);
  const sources=guide.sourceIds.map(id=>liveBy.get(id)).filter(Boolean).sort((a,b)=>Number(hasResearch(b))-Number(hasResearch(a))||Number(!!(b.description||b.transcript))-Number(!!(a.description||a.transcript)));
  const source=sources[0]||null;
  return {status:source&&!hasResearch(source)&&!hasText(source)?'needs_reading':'ready',kind:'guide',goal,key,guide,source,reason:intent.reason,next:intent.next,observations:(intent.id==='shared-search'?source?.research?.points?.filter((_,i)=>[0,2,3].includes(i)):source?.research?.points?.slice(intent.id==='promotion-positioning'?5:0,intent.id==='promotion-positioning'?7:2))||[],external:!source,limitations:source?.research?.limits||guide.limit};
 }
 if(skips.size&&INTENTS.some(i=>i.pattern.test(goal)))return {status:'no_match',message:'That prepared route was not a fit. I do not have another reviewed route for this goal yet. Describe what was wrong or add the missing constraint.'};
 const terms=goalTerms(goal);let candidates=live.filter(x=>!skips.has(x.id)).map(x=>{
  const title=x.title.toLowerCase(),body=[x.description,x.summary,x.transcript,x.readingNotes,JSON.stringify(x.research||''),ann[x.id]?.note].join(' ').toLowerCase();
  const contains=(text,term)=>/^[a-z0-9-]+$/.test(term)?new RegExp('(^|[^a-z0-9-])'+term+'(?=$|[^a-z0-9-])').test(text):text.includes(term);let titleHits=terms.filter(t=>contains(title,t)),bodyHits=terms.filter(t=>contains(body,t));return {source:x,rank:titleHits.length*4+bodyHits.length*2,hits:[...new Set([...titleHits,...bodyHits])].slice(0,5)};
 }).filter(x=>x.rank>0).sort((a,b)=>b.rank-a.rank||Number(!!b.source.research)-Number(!!a.source.research));
 if(!candidates.length)return {status:'no_match',message:skips.size?'There is no other supported starting point for this goal in your current library. Describe the missing requirement or add a relevant source.':'I cannot support a useful choice from your current library for this goal. Try a concrete outcome, or add a relevant save.'};
 const {source,hits}=candidates[0],readable=hasResearch(source)||hasText(source);
 return {status:readable?'ready':'needs_reading',kind:'save',goal,key,source,reason:readable?'This save contains text or research related to your goal. The saved passage below is the basis for this choice.':'The title is related to your goal, but I have not read the content. I cannot choose a useful part from its title alone.',next:source.research?.decision||'Read the matching passage, then decide whether it supports your next step.',observations:source.research?.points?.slice(0,2)||[],limitations:source.research?.limits||source.coverage||'Only the content already saved in your library was considered.'};
}

function semanticStart(items,guides,state,goal,ranked){
 const gs=normalizeGoalState(state.goalState),key=hash(goal.toLowerCase()),skip=new Set(gs.skips[key]||[]);
 const live=items.filter(x=>!state.annotations?.[x.id]?.trashed&&!state.annotations?.[x.id]?.archived);
 const hits=ranked.filter(h=>h.score>=0.28&&!skip.has(h.id));
 for(const h of hits){
  if(h.kind==='guide'){
   const g=guides.find(g=>g.id===h.id);if(!g)continue;
   const r=chooseStart(items,guides,state,goal,h.id);
   if(['ready','needs_reading'].includes(r.status))return {...r,reason:'On-device AI found this saved method semantically related to your goal. Check the evidence below; similarity is not proof of usefulness.',semantic:true};
  }else{
   const x=live.find(x=>x.id===h.id);if(!x)continue;
   const related=guides.find(g=>g.sourceIds.includes(x.id)&&hits.some(t=>t.kind==='guide'&&t.id===g.id&&t.score>=h.score-0.05));if(related){const r=chooseStart(items,guides,state,goal,related.id);if(r.source?.id===x.id&&['ready','needs_reading'].includes(r.status))return {...r,semantic:true,reason:'On-device AI matched your goal to this saved source and its linked method. Review the evidence before acting.'};}
   const note=state.annotations?.[x.id]?.note||'';const source=note?{...x,readingNotes:[x.readingNotes,note].filter(Boolean).join('\n')}:x;
   const readable=hasResearch(source)||hasText(source);
   return {status:readable?'ready':'needs_reading',kind:'save',goal,key,source,reason:readable?'On-device AI matched the meaning of your goal to this saved text. Review the passage before acting.':'AI found a related title, but the content has not been read.',next:source.research?.decision||'Read the saved passage and check whether it supports your next action.',observations:source.research?.points?.slice(0,2)||[],limitations:'Semantic similarity over saved text only. No automatic reading of the original page or video.',semantic:true};
  }
 }
 return {status:'no_match',message:'AI did not find a strong enough match in the saved text. Add a useful note or describe a more concrete goal.'};
}
root.ShelfCore={semanticStart,chooseStart,goalTerms,normalizeGoalState,sharedLinks,normalizeGuide,TOPICS,clean,safeURL,imageURL,classify,normalize,extract,mergeItems,score,filterItems,hash};if(typeof module!=='undefined')module.exports=root.ShelfCore;
})(typeof window!=='undefined'?window:globalThis);
