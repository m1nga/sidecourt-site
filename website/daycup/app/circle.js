import {t,currentLanguage} from './i18n.js';
import {makeSharedCup,tasteDrinks,tasteVersion} from './taste.js';

const circleEdge='https://rwbwfokdipabwjparcwy.supabase.co/functions/v1/daycup-circle';
const circleSessionKey='daycup-circle-session';
let circleSession='';
try{circleSession=sessionStorage.getItem(circleSessionKey)||'';}catch{}
function rememberCircleSession(value){circleSession=value;try{if(value)sessionStorage.setItem(circleSessionKey,value);else sessionStorage.removeItem(circleSessionKey);}catch{}}

export async function circleRequest(path='',method='GET',body) {
 const local=['127.0.0.1','localhost','[::1]'].includes(location.hostname);
 const endpoint=(local?'/api/daycup/circle':circleEdge)+path;
 if(globalThis.DAYCUP_NATIVE){
  const id=crypto.randomUUID();
  return new Promise((resolve,reject)=>{
   globalThis.daycupCircleResults||={};
   const timer=setTimeout(()=>{delete globalThis.daycupCircleResults[id];reject(Error(t("The circle took too long to respond. Your private cup is saved.")));},20000);
   globalThis.daycupCircleResults[id]=(result,error)=>{clearTimeout(timer);delete globalThis.daycupCircleResults[id];if(error){const failure=Error(t(error));failure.status=result?.status;failure.cupId=result?.cupId;reject(failure);}else resolve(result);};
   globalThis.webkit.messageHandlers.daycup.postMessage({action:'circle',id,path,method,body:body||{}});
  });
 }
 if(globalThis.DAYCUP_BUNDLE)throw Error(t("The circle needs a connected edition. Your private coffee library still works here."));
 if(!local&&location.origin!=='https://sidecourt.space')throw Error(t("Open the DayCup web edition to connect with the circle."));
 const sentSession=local?'':circleSession;
 const headers=body?{'Content-Type':'application/json'}:{};
 if(sentSession)headers['X-Daycup-Session']=sentSession;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);
 try{
  const response=await fetch(endpoint,{method,credentials:local?'same-origin':'omit',redirect:'error',headers,body:body?JSON.stringify(body):undefined,signal:controller.signal});
  const result=await response.json().catch(()=>({error:'The coffee circle is not connected at this address yet.'}));
  const receivedSession=result.session;delete result.session;
  if(!local&&response.status===401&&circleSession===sentSession)rememberCircleSession('');
  if(!response.ok){const error=Error(t(result.error||'The circle could not complete this action.'));error.status=response.status;error.cupId=result.cupId;throw error;}
  if(!local&&path==='/join'&&method==='POST'){
   if(typeof receivedSession!=='string'||!(/^[a-f0-9]{64}$/).test(receivedSession))throw Error(t("The circle could not complete this action."));
   rememberCircleSession(receivedSession);
  }
  if(!local&&path==='/leave'&&method==='POST'&&circleSession===sentSession)rememberCircleSession('');
  return result;
 }catch(error){if(error.name==='AbortError')throw Error(t("The circle took too long to respond. Your private cup is saved."));throw error;}finally{clearTimeout(timer);}
}

export function createCircleUI(host){
 const {data,save,modal,close,escape:esc,toast,bag,singleSubmit}=host;
 const q=s=>document.querySelector(s);
 let viewer=null,filter='all',author='',generation=0,items=[],next=null;
 let connection='',setupId='',origin='',cities=[];
 let city='';try{city=localStorage.getItem('daycup-circle-city')||'';}catch{}
 const normal=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
 const ownSetup=()=>data('equipment').find(e=>e.id===setupId)||data('equipment')[0];
 const originCountry=value=>String(value||'').split(' · ')[0];
 const ownOrigins=()=>[...new Set(data('bean').map(b=>originCountry(b.origin)).filter(Boolean))];
 const cityName=()=>t(cities.find(c=>c.id===city)?.name||'');
 function matches(c){const setup=ownSetup(),a=c.card;return [
  ...(setup&&normal(setup.name)===normal(a.setup.machine)?[{key:'machine',label:t('Same machine')}]:[]),
  ...(setup&&normal(setup.grinder)===normal(a.setup.grinder)?[{key:'grinder',label:t('Same grinder')}]:[]),
  ...(origin&&normal(origin)===normal(originCountry(a.bean.origin))?[{key:'origin',label:t('Same origin · {origin}',{origin:originCountry(a.bean.origin)})}]:[]),
  ...(c.sameCity?[{key:'nearby',label:t('Same city · {city}',{city:t(c.city.name)})}]:c.distanceKm?[{key:'nearby',label:t('Cities ~{distance} km apart',{distance:c.distanceKm})}]:[])
 ];}
 function connectionBar(){
  const setups=data('equipment'),origins=ownOrigins();if(!setups.some(e=>e.id===setupId))setupId=data('brew').sort((a,b)=>b.created.localeCompare(a.created))[0]?.recipe.equipment.id||setups[0]?.id||'';
  if(!origins.includes(origin))origin=origins[0]||'';
  return `<section class="circle-connect"><div class="circle-connect-title"><strong>${t("A little in common.")}</strong><button id="circle-city">${esc(cityName()||t('Add your city'))} ↗</button></div><div class="circle-connections" role="group" aria-label="${t("Find a connection")}">${[['','All cups'],['machine','Same machine'],['grinder','Same grinder'],['origin','Same origin'],['nearby','Near my city']].map(([key,label])=>`<button data-circle-connection="${key}" aria-pressed="${connection===key}" ${(key==='machine'||key==='grinder')&&!setups.length||key==='origin'&&!origins.length?'disabled':''}>${t(label)}</button>`).join('')}</div><div class="circle-match-context">${setups.length?`<label>${t("My setup")}<select id="circle-match-setup">${setups.map(e=>`<option value="${e.id}" ${e.id===setupId?'selected':''}>${esc(e.name||e.model||e.machine||t("My setup"))} · ${esc(e.grinder||e.grinderModel||t("Grinder not set"))}</option>`).join('')}</select></label>`:`<a href="#equipment">${t("Add your setup to find your people →")}</a>`}${origins.length?`<label>${t("My bean origin")}<select id="circle-match-origin">${origins.map(v=>`<option ${v===origin?'selected':''}>${esc(v)}</option>`).join('')}</select></label>`:`<a href="#beans">${t("Add a bean origin →")}</a>`}</div><p class="circle-selected-model" id="circle-selected-model">${connection==='grinder'?esc(t("Same grinder"))+': '+esc(ownSetup()?.grinder||t("Grinder not set")):connection==='machine'?esc(t("Same machine"))+': '+esc(ownSetup()?.name||''):''}</p><p class="circle-match-note">${connection==='nearby'?t("Within about 200 km of your chosen city centre. Distances are between cities, never homes."):t("Matches use shared model names and origin countries.")}</p></section>`;
 }
 function chooseCity(after=()=>page()){
  modal(`<p class="eyebrow">${t("A CITY, NOT YOUR ADDRESS")}</p><h2>${t("Find coffee people nearby.")}</h2><form id="circle-city-form"><label>${t("Your city")}<select name="city"><option value="">${t("Keep my city private")}</option>${cities.map(c=>`<option value="${c.id}" ${c.id===city?'selected':''}>${esc(t(c.name))}</option>`).join('')}</select></label><p class="field-help">${t("Choose an available city. We compare approximate city centres; DayCup does not request your GPS location. This choice stays on this device unless you choose to include it with a shared cup.")}</p><button class="primary">${t("Save city preference")}</button></form>`);
  q('#circle-city-form').onsubmit=singleSubmit(async e=>{city=new FormData(e.target).get('city');try{if(city)localStorage.setItem('daycup-circle-city',city);else localStorage.removeItem('daycup-circle-city');}catch{}if(!city&&connection==='nearby')connection='';close();after();});
 }
 function bindConnections(){
  q('#circle-city').onclick=()=>chooseCity();
  document.querySelectorAll('[data-circle-connection]').forEach(b=>b.onclick=()=>{connection=b.dataset.circleConnection;author='';if(connection==='nearby'&&!city)return chooseCity();page();});
  if(q('#circle-match-setup'))q('#circle-match-setup').onchange=e=>{setupId=e.target.value;page();};
  if(q('#circle-match-origin'))q('#circle-match-origin').onchange=e=>{origin=e.target.value;page();};
 }
 async function loadCities(){if(cities.length)return;try{cities=globalThis.DAYCUP_BUNDLE?.cities||await (await fetch('./circle-cities.json')).json();}catch{cities=[];}if(!cities.some(c=>c.id===city))city='';}

 const fresh=fields=>({id:crypto.randomUUID(),version:1,created:new Date().toISOString(),...fields});
 const nameOf=c=>c.author.name, initials=name=>name.trim().split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase();
 const home=()=>globalThis.DAYCUP_NATIVE||globalThis.DAYCUP_BUNDLE?'https://sidecourt.space/drops/daycup/app/':location.href.split('#')[0];
 const url=c=>home()+'#cup/'+c.id;
 const date=c=>new Date(c.created*1000).toLocaleDateString(currentLanguage()==='zh'?'zh-CN':'en',{month:'short',day:'numeric'});
 const iconHeart='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 5c-3-3-6-1-8 1-2-2-5-4-8-1-4 4 1 10 8 15 7-5 12-11 8-15Z"/></svg>';
 function card(c,detail=false){
  const r=c.card,a=r.actual;
  return `<article class="circle-cup" data-circle-card="${esc(c.id)}"><header class="circle-person"><button class="circle-avatar" data-circle-author="${esc(c.author.id)}" aria-label="Cups by ${esc(nameOf(c))}">${esc(initials(nameOf(c)))}</button><div><button data-circle-author="${esc(c.author.id)}">${esc(nameOf(c))}</button><p>${esc(t(tasteDrinks[r.drink]))} · ${esc(date(c))}${c.mine?t(" · You"):''}</p></div>${!c.mine?`<button class="circle-follow" data-circle-follow="${esc(c.author.id)}" aria-pressed="${c.following}">${c.following?t("Following"):t("Follow")}</button>`:''}<button class="circle-more" data-circle-more="${esc(c.id)}" aria-label="Options for ${esc(r.bean.name)}">•••</button></header>${c.parent?`<a class="circle-lineage" href="#cup/${esc(c.parent)}">${t("Brewed from another cup ↗")}</a>`:''}<a class="circle-photo${c.image?' circle-photo-composed':''}" href="#cup/${esc(c.id)}" aria-label="Open ${esc(r.bean.name)}">${c.image?`<img src="${esc(c.image)}" alt="${esc(t('Your finished cup image'))}">`:`${bag(r.bean)}<span><small>${esc(r.bean.process||t(r.bean.roast+' roast'))}</small><strong>${esc(r.bean.name)}</strong><em>${esc(r.bean.origin||t('A cup worth passing on'))}</em></span>`}</a><div class="circle-copy">${matches(c).length?`<div class="circle-match-tags">${matches(c).map(m=>`<button data-circle-match="${m.key}">${esc(m.label)} ↗</button>`).join('')}</div>`:c.city?`<p class="circle-city-label">${esc(t(c.city.name))}</p>`:''}${c.caption?`<p>${esc(c.caption)}</p>`:''}<div class="circle-measures"><span><b>${a.dose}</b>${t("g in")}</span><span><b>${a.output}</b>${t("g")} ${r.setup.method==='v60'?t("water"):t("out")}</span><span><b>${Math.round(a.seconds)}</b>${t("sec")}</span><span class="circle-taste">${esc(t(({balanced:'Balanced',sour:'Sour',bitter:'Bitter',mixed:'Mixed'})[a.taste]))}</span></div><p class="circle-gear">${esc(r.setup.machine)} · ${esc(r.setup.grinder)}</p>${detail?`<details class="circle-details"><summary>${t("Bean & brew details")}</summary><p>${esc(r.bean.batch||t('Batch not supplied'))} · ${esc(r.bean.origin||t('Origin not supplied'))}</p><p>${esc(a.grindSetting?t('Their grind setting: {value}. ',{value:a.grindSetting}):'')}${t("Grinder numbers are personal to a setup. Use your own calibration and taste your trial.")}</p><p>${t("Shared by")} ${esc(nameOf(c))}${t("; this is their reported result.")}</p></details>`:''}</div><div class="circle-actions"><button data-circle-cheer="${esc(c.id)}" aria-pressed="${c.cheered}" aria-label="${c.cheered?t("Remove cheers from"):t("Send cheers to")} ${esc(nameOf(c))}">${iconHeart}<span>${c.cheers||''} ${t("Cheers")}</span></button><button data-circle-brew="${esc(c.id)}">${t("Brew this")} <span aria-hidden="true">↗</span></button><button data-circle-share="${esc(c.id)}">${t("Share")} <span aria-hidden="true">↑</span></button></div><a class="circle-responses" href="#cup/${esc(c.id)}">${c.brewed?t('{count} cups brewed from this · See the results',{count:c.brewed}):t("Make the next cup in this story")} →</a></article>`;
 }
 function frame(){
  const own=data('brew').sort((a,b)=>b.created.localeCompare(a.created))[0];
  q('#main').innerHTML=`<div class="circle-heading"><div><p class="eyebrow">${t("YOUR COFFEE CIRCLE")}</p><h1>${t("Good coffee travels.")}</h1><p>${t("One person's good cup. Someone else's next one.")}</p></div><button class="primary" id="circle-compose">${t("Share a cup")} <span>+</span></button></div><div class="circle-layout"><section><div class="circle-filters" role="group" aria-label="${t("Cups to show")}"><button data-circle-filter="all" aria-pressed="${filter==='all'&&!author}">${t("For everyone")}</button><button data-circle-filter="following" aria-pressed="${filter==='following'&&!author}">${t("Following")}</button><button id="circle-refresh" aria-label="${t("Refresh cups")}">↻</button><button id="circle-profile-control" aria-label="${t("Your circle profile")}" disabled>${t("Join")}</button></div>${connectionBar()}<div id="circle-stream" aria-live="polite"><p class="circle-loading">${t("Finding the latest cups…")}</p></div><button id="circle-more-cups" hidden>${t("More cups")}</button></section><aside class="circle-corner"><p class="eyebrow">${t("YOUR NEXT CUP")}</p>${own?`${bag(own.recipe.bean)}<h2>${esc(own.recipe.bean.name)}</h2><p>${t("A good cup does not need a perfect photo or a long review.")}</p><button id="circle-latest">${t("Share your latest cup ↗")}</button>`:`<div class="circle-ceramic" aria-hidden="true"></div><h2>${t("Start with your daily cup.")}</h2><p>${t("Record what you brewed. Keep it for yourself, or pass it on.")}</p><a class="button" href="#brew">${t("Make a cup →")}</a>`}<div class="circle-how"><strong>${t("See it. Brew it. Pass it on.")}</strong><p>${t("Your beans and setup stay with you. A cup you share becomes a starting point for someone else.")}</p></div><div id="circle-membership"></div><a href="https://sidecourt.space/drops/daycup/support.html" target="_blank" rel="noopener">${t("Community support")}</a></aside></div>`;
  bindConnections();q('#circle-compose').onclick=chooseOwn;if(q('#circle-latest'))q('#circle-latest').onclick=()=>shareCup(own.id);
  q('#circle-refresh').onclick=()=>page();
  document.querySelectorAll('[data-circle-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.circleFilter;author='';page();});
  q('#circle-more-cups').onclick=()=>load(true);
 }
 async function page(){await loadCities();if(location.hash!=='#circle'&&location.hash) return;frame();await load();}
 async function load(more=false){
  const serial=++generation,target=q('#circle-stream');if(!target)return;
  const setup=ownSetup(),match=connection==='machine'?{machine:setup?.name||''}:connection==='grinder'?{grinder:setup?.grinder||''}:connection==='origin'?{origin}:connection==='nearby'?{nearby:'1'}:{};
  const query=new URLSearchParams({filter,...match,...(city?{city}:{}),...(author?{author}:{}),...(more&&next?{before:String(next)}:{})});
  try{
   const result=await circleRequest('?'+query);if(serial!==generation||!target.isConnected)return;
   viewer=result.viewer;const profileButton=q('#circle-profile-control');profileButton.disabled=false;profileButton.textContent=viewer?initials(viewer.name):t("Join");profileButton.setAttribute('aria-label',viewer?t("Your circle profile"):t("Join the circle"));profileButton.onclick=viewer?account:()=>join(()=>page());items=more?[...items,...result.cups]:result.cups;next=result.next;
   target.innerHTML=(author?`<button id="circle-all">${t("← Everyone’s cups")}</button>`:'')+(items.length?items.map(c=>card(c)).join(''):`<div class="circle-empty"><div class="circle-ceramic" aria-hidden="true"></div><h2>${connection?t("No cups with this connection yet."):filter==='following'?t("A circle starts with one person."):t("There is room for your cup.")}</h2><p>${connection?t("Try another connection or explore all cups. Your own cup could start this conversation."):filter==='following'?t("Follow a coffee drinker from their cup. Their next brew will appear here."):t("Share the cup you just made. Someone else can brew it and bring their own result back.")}</p><button id="circle-empty-action">${connection||filter==='following'?t("Explore cups"):t("Share the first cup")}</button></div>`);
   q('#circle-more-cups').hidden=!next;
   if(q('#circle-all'))q('#circle-all').onclick=()=>{author='';page();};
   if(q('#circle-empty-action'))q('#circle-empty-action').onclick=connection||filter==='following'?()=>{filter='all';connection='';page();}:chooseOwn;
   q('#circle-membership').innerHTML=viewer?`<p>${t("Sharing as")} <strong>${esc(viewer.name)}</strong></p><button id="circle-account">${t("Your circle profile")}</button>`:`<p>${t("Look around first. Join when you want to share or say cheers.")}</p><button id="circle-join">${t("Join the circle")}</button>`;
   if(q('#circle-join'))q('#circle-join').onclick=()=>join(()=>page());if(q('#circle-account'))q('#circle-account').onclick=account;
   bind(items);
  }catch(error){if(serial!==generation||!target.isConnected)return;target.innerHTML=`<div class="circle-empty"><div class="circle-ceramic" aria-hidden="true"></div><h2>${t("Your circle, when you connect.")}</h2><p>${esc(error.message)}</p><a class="button" href="#history">${t("Your saved cups →")}</a><button id="circle-retry">${t("Try again")}</button></div>`;q('#circle-retry').onclick=()=>page();}
 }
 async function detail(id){
  const serial=++generation;q('#main').innerHTML=`<a class="circle-back" href="#circle">${t("← Coffee circle")}</a><div id="circle-detail" aria-live="polite"><p>${t("Opening this cup…")}</p></div>`;const target=q('#circle-detail');
  try{const result=await circleRequest('/cup/'+encodeURIComponent(id));if(serial!==generation||!target.isConnected)return;viewer=result.viewer;const c=result.cup;target.innerHTML=card(c,true)+`<section class="circle-replies"><p class="eyebrow">${t("THE NEXT CUP")}</p><h2>${c.responses.length?t("Same inspiration. Their own cups."):t("Be the next to brew this.")}</h2><p>${t("Use your setup, taste the result, then share it back here.")}</p>${c.responses.map(r=>card(r)).join('')}</section>`;bind([c,...c.responses]);}catch(error){if(target.isConnected)target.innerHTML=`<h1>${t("This cup is unavailable.")}</h1><p>${esc(error.message)}</p>`;}
 }
 function refresh(){const id=location.hash.startsWith('#cup/')?location.hash.slice(5):null;return id?detail(id):page();}
 function bind(cups){
  document.querySelectorAll('[data-circle-match]').forEach(b=>b.onclick=()=>{connection=b.dataset.circleMatch;author='';if(location.hash==='#circle')page();else location.hash='circle';});
  document.querySelectorAll('[data-circle-author]').forEach(b=>b.onclick=()=>{author=b.dataset.circleAuthor;filter='all';if(location.hash==='#circle')page();else location.hash='circle';});
  document.querySelectorAll('[data-circle-brew]').forEach(b=>b.onclick=()=>brewThis(cups.find(c=>c.id===b.dataset.circleBrew)));
  document.querySelectorAll('[data-circle-share]').forEach(b=>b.onclick=()=>shareLink(cups.find(c=>c.id===b.dataset.circleShare)));
  document.querySelectorAll('[data-circle-more]').forEach(b=>b.onclick=()=>options(cups.find(c=>c.id===b.dataset.circleMore)));
  document.querySelectorAll('[data-circle-cheer]').forEach(b=>b.onclick=()=>act(b,{action:b.getAttribute('aria-pressed')==='true'?'uncheer':'cheer',target:b.dataset.circleCheer}));
  document.querySelectorAll('[data-circle-follow]').forEach(b=>b.onclick=()=>act(b,{action:b.getAttribute('aria-pressed')==='true'?'unfollow':'follow',target:b.dataset.circleFollow}));
 }
 async function act(button,value){if(!viewer)return join(()=>act(button,value));button.disabled=true;try{await circleRequest('/action','POST',value);await refresh();}catch(error){toast(error.message);button.disabled=false;}}
 function join(after){
  modal(`<p class="eyebrow">${t("A SMALL COFFEE CIRCLE")}</p><h2>${t("What should we call you?")}</h2><form id="circle-join-form"><label>${t("Your public name")}<input name="name" autocomplete="nickname" maxlength="40" required></label><label>${t("Early access invitation")}<input name="invite" type="password" autocomplete="off" minlength="16" maxlength="200" required></label><p class="field-help">${t("Your name is shown with cups you choose to share. Your private library stays on this device. The first circle is invitation-only.")}</p><p class="field-help">${t("By joining, you agree to share your own coffee experiences respectfully. No harassment, hate, sexual content or spam. Use a cup’s menu to report or hide a person.")} <a href="https://sidecourt.space/drops/daycup/support.html" target="_blank" rel="noopener">${t("Community support")}</a></p><button class="primary">${t("Join the circle")}</button><p id="circle-join-status" role="status"></p></form>`);
  q('#circle-join-form').onsubmit=singleSubmit(async e=>{const f=new FormData(e.target);try{const result=await circleRequest('/join','POST',{name:f.get('name'),invite:f.get('invite')});viewer=result.viewer;close();await after?.();}catch(error){const status=q('#circle-join-status');if(status)status.textContent=t(error.message);}});
 }
 async function ready(after){
  try{const r=await circleRequest('/me');viewer=r.viewer;if(!viewer)return join(after);return await after();}catch(error){toast(error.message);}
 }
 function chooseOwn(){
  const cups=data('brew').sort((a,b)=>b.created.localeCompare(a.created));
  modal(`<p class="eyebrow">${t("ONE CUP, SHARED ON PURPOSE")}</p><h2>${t("Which cup would you pass on?")}</h2>${cups.length?`<div class="circle-pick">${cups.map(b=>`<button data-circle-own="${b.id}"><strong>${esc(b.recipe.bean.name)}</strong><span>${b.feedback.dose} ${t("g ·")} ${b.feedback.output} ${t("g ·")} ${esc(b.created.slice(0,10))}</span></button>`).join('')}</div>`:`<p>${t("Record a cup first. Your measurements and experience give someone else a useful starting point.")}</p><a id="circle-first-brew" class="button primary" href="#brew">${t("Make your first cup")}</a>`}`);
  document.querySelectorAll('[data-circle-own]').forEach(b=>b.onclick=()=>shareCup(b.dataset.circleOwn));if(q('#circle-first-brew'))q('#circle-first-brew').onclick=close;
 }
 async function shareCup(id,composition={}){
  const brew=data('brew').find(b=>b.id===id);if(!brew)return;
  const old=data('circle-share').find(p=>p.brewId===id);
  if(old){try{await circleRequest('/cup/'+old.cupId);close();location.hash='cup/'+old.cupId;return;}catch(error){if(error.status!==404){toast(error.message);return;}await host.removeRecord(old.id);}}
  await loadCities();await ready(()=>publishPreview(brew,composition));
 }
 async function publishPreview(brew,composition={}){
  const startGeneration=generation,startRoute=location.hash;
  let photo=composition.image;
  const finished=photo!==undefined||typeof host.renderSharedImage==='function';
  if(photo===undefined)photo=typeof host.renderSharedImage==='function'?await host.renderSharedImage(brew):host.photo(brew.recipe.bean.id);
  if(startGeneration!==generation||location.hash!==startRoute)return;
  if(finished){
   if(typeof photo!=='string'||photo.length>240000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(photo))throw Error(t("This cup image could not be prepared. Try again."));
   await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>img.naturalWidth>0&&img.naturalHeight>0&&Math.max(img.naturalWidth,img.naturalHeight)<=1600?resolve():reject(Error(t("This cup image could not be prepared. Try again.")));img.onerror=()=>reject(Error(t("This cup image could not be prepared. Try again.")));img.src=photo;});
   if(startGeneration!==generation||location.hash!==startRoute)return;
  }
  const cardValue=makeSharedCup(brew,null,viewer.name),inspiration=brew.recipe.inspiredBy;
  modal(`<p class="eyebrow">${t("SHARE WITH THE COFFEE CIRCLE")}</p><h2>${esc(cardValue.bean.name)}</h2><div class="circle-publish-preview">${finished?`<img id="circle-composition-preview" src="${esc(photo)}" alt="${esc(t('Your finished cup image'))}">`:bag(cardValue.bean)}<p>${cardValue.actual.dose} ${t("g in ·")} ${cardValue.actual.output} ${t("g")} ${cardValue.setup.method==='v60'?t("water"):t("out")} · ${Math.round(cardValue.actual.seconds)} ${t("sec")}</p><p>${esc(cardValue.setup.machine)} · ${esc(cardValue.setup.grinder)}</p><p>${esc(t(tasteDrinks[cardValue.drink]))} · ${esc(t(({balanced:'Balanced',sour:'Sour',bitter:'Bitter',mixed:'Mixed'})[cardValue.actual.taste]))} · ${esc(cardValue.bean.batch||t('No batch supplied'))}</p><details><summary>${t("Everything this cup shares")}</summary><p>${esc(cardValue.bean.origin||t('No origin supplied'))} · ${esc(cardValue.bean.process||t('No process supplied'))} · ${esc(t(cardValue.bean.roast))} ${t("roast")}</p><p>${t("Grind:")} ${esc(cardValue.actual.grindSetting||t('Not recorded'))} ${t("· Brew date:")} ${esc(cardValue.created.slice(0,10))}</p></details></div><form id="circle-publish-form"><label>${t("How was it?")}<textarea name="caption" maxlength="280" rows="2" placeholder="${t("A small detail someone else might find useful.")}">${esc(composition.caption||'')}</textarea></label>${city?`<label class="check"><input name="city" type="checkbox">${t("Include")} ${esc(cityName())} ${t("· city only")}</label>`:`<p class="field-help">${t("No city is shared. You can choose a city in Circle.")}</p>`}${photo?`<label class="check"><input name="photo" type="checkbox" ${finished?'checked':''}>${finished?t("Include this finished image"):t("Include this bag photo")}</label>`:''}${inspiration?`<label class="check"><input name="inspired" type="checkbox" checked>${t("Share back to")} ${esc(inspiration.author)}${t("’s original cup")}</label>`:''}<p class="field-help">${t("Public as")} ${esc(viewer.name)}. ${t('Only this cup and the words you add above are shared. Your private notes and other cups stay here. You can remove this post later.')}</p><button class="primary">${t("Share this cup")}</button><p id="circle-publish-status" role="status"></p></form>`);
  q('#circle-publish-form').onsubmit=singleSubmit(async e=>{const f=new FormData(e.target);try{
   const result=await circleRequest('/publish','POST',{nonce:brew.id,card:cardValue,city:f.has('city')?city:'',caption:f.get('caption').trim(),image:f.has('photo')?photo:'',parent:f.has('inspired')?inspiration.id:null});
   await save('circle-share',{id:crypto.randomUUID(),version:tasteVersion,created:new Date().toISOString(),brewId:brew.id,cupId:result.id});close();const same=location.hash==='#cup/'+result.id;location.hash='cup/'+result.id;if(same)detail(result.id);
  }catch(error){const status=q('#circle-publish-status');if(!status)return;status.textContent=t(error.message);if(error.cupId){const link=document.createElement('a');link.href='#cup/'+error.cupId;link.textContent=t(" Open your shared cup →");link.onclick=close;status.append(link);}}});
 }
 function brewThis(c){
  const cardValue=c.card,method=cardValue.setup.method,setups=data('equipment').filter(e=>e.method===method),beans=data('bean');
  if(!setups.length){modal(`<h2>${t("Make this cup your own.")}</h2><p>${t("Add your")} ${method==='v60'?t("V60"):'espresso'} ${t("setup first. This cup will still be in the circle when you return.")}</p><a id="circle-add-setup" class="button primary" href="#equipment">${t("Add your setup")}</a>`);q('#circle-add-setup').onclick=close;return;}
  const match=beans.find(b=>b.name.toLowerCase()===cardValue.bean.name.toLowerCase()&&b.batch===cardValue.bean.batch);
  modal(`<p class="eyebrow">${t("INSPIRED BY")} ${esc(nameOf(c)).toUpperCase()}</p><h2>${t("Your take on this cup.")}</h2><p>${esc(cardValue.bean.name)} · ${cardValue.actual.dose} ${t("g in ·")} ${cardValue.actual.output} ${t("g")} ${method==='v60'?t("water"):t("out")} · ${Math.round(cardValue.actual.seconds)} ${t("sec.")}</p><form id="circle-brew-form"><label>${t("Your setup")}<select name="setup">${setups.map(e=>`<option value="${e.id}">${esc(e.name)} / ${esc(e.grinder)}</option>`).join('')}</select></label><label>${t("Your bag")}<select name="bean">${beans.map(b=>`<option value="${b.id}" ${b.id===(match||beans[0])?.id?'selected':''}>${esc(b.name)}${b.batch?' · '+esc(b.batch):''}</option>`).join('')}<option value="new">${t("Add")} ${esc(cardValue.bean.name)} ${t("to my shelf")}</option></select></label><label id="circle-roast-label">${t("Roast on your bag")}<select name="roast">${['light','medium','dark'].map(r=>`<option value="${r}" ${r===cardValue.bean.roast?'selected':''}>${t(r[0].toUpperCase()+r.slice(1))}</option>`).join('')}</select></label><p class="field-help">${t("Use a bag you already have, or add the same bean. We start from your equipment, your bean and your own past cups. Their grinder number is not copied.")}</p><label class="check"><input name="confirmed" type="checkbox" required>${t("I checked my bean and roast.")}</label><button class="primary">${t("Brew with my setup")}</button></form>`);
  const form=q('#circle-brew-form');const updateRoast=()=>{q('#circle-roast-label').hidden=form.elements.bean.value!=='new';};form.elements.bean.onchange=updateRoast;updateRoast();
  form.onsubmit=singleSubmit(async e=>{const f=new FormData(e.target);try{
   if(!host.canStart())return;const setup=setups.find(x=>x.id===f.get('setup'));let bean=beans.find(b=>b.id===f.get('bean'));
   if(!bean){bean={id:crypto.randomUUID(),...cardValue.bean,roast:f.get('roast'),blend:false,roastedOn:'',species:'unknown',caffeine:'unknown',variety:'',robustaPercent:null};await save('bean',bean);}
   const dose=Math.max(Math.max(setup.minDose,method==='v60'?15:5),Math.min(setup.maxDose,method==='v60'?30:35,cardValue.actual.dose));close();host.start(bean,{setup,dose,preference:'balanced',drink:cardValue.drink==='milk'?'espresso':cardValue.drink,inspiredBy:{id:c.id,author:nameOf(c),beanId:bean.id}});toast(t("Inspired by {v0}. Save your cup, then share your result back.", {v0:nameOf(c)}));
  }catch(error){toast(error.message);}});
 }
 async function shareLink(c){
  const link=url(c),title=nameOf(c)+'’s '+c.card.bean.name;
  if(globalThis.DAYCUP_NATIVE){globalThis.webkit.messageHandlers.daycup.postMessage({action:'shareLink',url:link});return;}
  try{if(navigator.share){await navigator.share({title,text:'Brew this cup with your own setup on DayCup.',url:link});return;}await navigator.clipboard.writeText(link);toast(t("Cup link copied. Anyone with the link can open this cup."));}catch(error){if(error.name==='AbortError')return;modal(`<h2>${t("Pass this cup on.")}</h2><label>${t("Cup link")}<input id="circle-link" value="${esc(link)}" readonly></label><p>${t("Copy this link and send it to someone who would enjoy this coffee.")}</p>`);q('#circle-link').select();}
 }
 function options(c){
  modal(`<h2>${t("This cup")}</h2>${c.mine?`<button id="circle-delete" class="danger">${t("Remove my shared cup")}</button>`:`<button id="circle-block">${t("Hide this person’s cups")}</button><form id="circle-report"><label>${t("Report a concern")}<textarea name="reason" maxlength="500" required></textarea></label><button>${t("Send report")}</button></form>`}<p class="field-help">${t("Your private coffee records are separate from the circle.")}</p>`);
  if(c.mine)q('#circle-delete').onclick=()=>{modal(`<h2>${t("Remove this shared cup?")}</h2><p>${t("Its public link will stop working. Your private record stays in your Journal.")}</p><button id="circle-confirm-delete" class="danger">${t("Remove shared cup")}</button>`);q('#circle-confirm-delete').onclick=async()=>{try{await circleRequest('/action','POST',{action:'delete',target:c.id});const entry=data('circle-share').find(x=>x.cupId===c.id);if(entry)await host.removeRecord(entry.id);close();location.hash='circle';page();}catch(error){toast(error.message);}};};
  else{
   q('#circle-block').onclick=async()=>{try{if(!viewer)return join(()=>options(c));await circleRequest('/action','POST',{action:'block',target:c.author.id});close();location.hash='circle';page();}catch(error){toast(error.message);}};
   q('#circle-report').onsubmit=singleSubmit(async e=>{try{if(!viewer)return join(()=>options(c));await circleRequest('/action','POST',{action:'report',target:c.id,reason:new FormData(e.target).get('reason')});close();toast(t("Report saved. You can also hide this person’s cups."));}catch(error){toast(error.message);}});
  }
 }
 function account(){modal(`<h2>${esc(viewer.name)}${t("’s circle")}</h2><p>${t("Your public cups and connections are separate from your private library.")}</p><button id="circle-my-cups">${t("See my shared cups →")}</button><button class="danger" id="circle-leave">${t("Remove my circle profile")}</button>`);q('#circle-my-cups').onclick=()=>{author=viewer.id;filter='all';close();if(location.hash==='#circle')page();else location.hash='circle';};q('#circle-leave').onclick=()=>{modal(`<h2>${t("Leave the coffee circle?")}</h2><p>${t("This removes your profile, shared cups, cheers and follows. Your private beans and brews stay on this device. Copies someone already saved cannot be withdrawn.")}</p><button class="danger" id="circle-confirm-leave">${t("Remove profile & shared cups")}</button>`);q('#circle-confirm-leave').onclick=async()=>{try{await circleRequest('/leave','POST',{});for(const r of data('circle-share'))await host.removeRecord(r.id);viewer=null;close();page();}catch(error){toast(error.message);}};};}
 return {page,detail,shareCup,clearPreferences(){city='';connection='';try{localStorage.removeItem('daycup-circle-city');}catch{}}};
}
