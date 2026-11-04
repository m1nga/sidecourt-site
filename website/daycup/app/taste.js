import {t} from './i18n.js';
import {validateShareDesign} from './share-design.js';
// Personal evidence, not a prediction of extraction or an objective coffee score.
export const tasteVersion = 1;
export const tasteKinds = ['taste-review','taste-profile','taste-candidate','taste-choice','shared-cup','circle-share','cup-design'];
export const tasteNotes = ['Chocolate','Caramel','Nutty','Berry','Citrus','Stone fruit','Floral','Spice','Earthy'];
export const tasteDrinks = {espresso:'Espresso',americano:'Americano','iced-americano':'Iced Americano',milk:'Milk coffee',v60:'V60'};
const tmUUID = v => typeof v==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const tmText = (v,n=200) => typeof v==='string' && v.length<=n;
const tmNorm = v => String(v||'').trim().toLowerCase().replace(/\s+/g,' ');
const tmTags = a => Array.isArray(a)&&a.length<=tasteNotes.length&&new Set(a).size===a.length&&a.every(x=>tasteNotes.includes(x));
export function validateTasteRecord(kind,p) {
 const bad=()=>{throw Error('This taste record is incomplete or unsupported. Keep the original file.');};
 if(!p||p.version!==tasteVersion||!tmUUID(p.id)||!tmText(p.created,40)||Number.isNaN(Date.parse(p.created)))bad();
 if(kind==='taste-profile' && (!tasteDrinks[p.drink]||!tmTags(p.likes)||!['balanced','body','clarity'].includes(p.preference)))bad();
 if(kind==='taste-review') {
  if(!tmUUID(p.beanId)||!tasteDrinks[p.drink]||!['yes','no','unsure'].includes(p.rebuy)||!['yes','no','not-yet'].includes(p.dialed)||!tmTags(p.notes)||!tmText(p.comment,1000)||!['none','this','other','both'].includes(p.comparison)||p.comparison!=='none'&&(!tmUUID(p.otherBeanId)||p.otherBeanId===p.beanId))bad();
 }
 if(kind==='taste-candidate') {
  if(!tmUUID(p.key)||!tmText(p.name)||!p.name.trim()||!['light','medium','dark','unknown'].includes(p.roast)||!tmText(p.process)||!tmText(p.origin)||!tmText(p.roaster)||!tmText(p.batch)||!tmTags(p.notes)||!['active','bought','removed'].includes(p.status)||!['manual','photo-confirmed','shared'].includes(p.source)||!tmText(p.labelText,4000))bad();
  if(p.image!==''&&(!tmText(p.image,240000)||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(p.image)))bad();
 }
 if(kind==='taste-choice' && (!tmUUID(p.candidateKey)||!tmUUID(p.beanId)||!tasteDrinks[p.drink]||!['familiar','explore'].includes(p.intent)||!tmText(p.reason,2000)))bad();
 if(kind==='shared-cup')validateSharedCup(p.card);
 if(kind==='cup-design'){if(!tmUUID(p.brewId))bad();validateShareDesign(p.design);}
 if(kind==='circle-share'&&(!tmUUID(p.brewId)||!tmUUID(p.cupId)))bad();
 return p;
}
export function latestTaste(values,key) {
 const found=new Map();
 for(const v of [...values].sort((a,b)=>a.created.localeCompare(b.created)||a.id.localeCompare(b.id)))found.set(key(v),v);
 return [...found.values()];
}
export function tasteProfile(profiles,drink) {
 return profiles.filter(p=>!drink||p.drink===drink).sort((a,b)=>b.created.localeCompare(a.created)||b.id.localeCompare(a.id))[0]||{drink:drink||'espresso',likes:[],preference:'balanced'};
}
export function tasteReviews(reviews,drink) {
 return latestTaste(reviews,r=>r.beanId+'|'+r.drink).filter(r=>!drink||r.drink===drink);
}
export function tasteCandidates(candidates) {return latestTaste(candidates,c=>c.key).filter(c=>c.status==='active');}
export function tasteSummary(reviews,beans,drink) {
 const active=tasteReviews(reviews,drink).filter(r=>beans.some(b=>b.id===r.beanId));
 const positive=active.filter(r=>r.dialed==='yes'&&r.rebuy==='yes');
 return {reviews:active,positive,pending:active.filter(r=>r.dialed!=='yes'),notes:tasteNotes.map(note=>({note,count:positive.filter(r=>r.notes.includes(note)).length})).filter(x=>x.count).sort((a,b)=>b.count-a.count)};
}
function tmSimilar(candidate,bean,review) {
 const shared=candidate.notes.filter(n=>review.notes.includes(n));
 const reasons=shared.map(n=>t('{note} notes',{note:t(n).toLowerCase()}));
 let weight=shared.length*3;
 if(candidate.roast!=='unknown'&&candidate.roast===bean.roast){weight+=2;reasons.push(t(candidate.roast+' roast'));}
 if(candidate.process&&tmNorm(candidate.process)===tmNorm(bean.process)){weight+=2;reasons.push(t('{process} process',{process:candidate.process}));}
 // Origin alone is deliberately not a taste signal.
 return {weight,reasons};
}
export function matchCoffee(candidate,{beans,reviews,profile,intent='familiar'}) {
 const summary=tasteSummary(reviews,beans,profile.drink),evidence=[];
 for(const review of summary.reviews.filter(r=>r.dialed==='yes'&&r.rebuy!=='unsure')) {
  const bean=beans.find(b=>b.id===review.beanId),sim=tmSimilar(candidate,bean,review);
  if(sim.weight)evidence.push({beanId:bean.id,reviewId:review.id,name:bean.name,positive:review.rebuy==='yes',...sim});
 }
 const positive=evidence.filter(e=>e.positive).sort((a,b)=>b.weight-a.weight);
 const negative=evidence.filter(e=>!e.positive).sort((a,b)=>b.weight-a.weight);
 const stated=candidate.notes.filter(n=>profile.likes.includes(n));
 let score=(positive[0]?.weight||0)-(negative[0]?.weight||0)+stated.length;
 // Pairwise preferences can break ties, but never outweigh contradictory measured history.
 const preferred=new Set(summary.reviews.filter(r=>r.dialed==='yes'&&['this','other'].includes(r.comparison)&&summary.reviews.some(x=>x.beanId===r.otherBeanId&&x.dialed==='yes')).map(r=>r.comparison==='this'?r.beanId:r.otherBeanId));
 if(positive.some(e=>preferred.has(e.beanId)))score+=1;
 const reasons=positive.slice(0,2).map(e=>t('{notes} also appeared in {name}, which you would buy again.',{notes:e.reasons.join(', '),name:e.name}));
 if(!positive.length&&stated.length)reasons.push(t('Matches your stated preference for {notes}. This has not been tested in your cup.',{notes:stated.map(n=>t(n)).join(', ').toLowerCase()}));
 const cautions=negative.slice(0,2).map(e=>t('Shares {notes} with {name}, which you would not buy again.',{notes:e.reasons.join(', '),name:e.name}));
 if(!candidate.notes.length)cautions.push(t('No label tasting notes confirmed yet.'));
 if(candidate.roast==='unknown')cautions.push(t('Roast level is unknown; confirm it before making a recipe.'));
 if(!evidence.length&&!stated.length)reasons.push(t('No relevant personal comparison yet. Use this as an exploration, not a taste prediction.'));
 const familiar=positive.some(e=>e.weight>=3);
 const label=positive.length&&negative.length?t('Mixed signals'):familiar?t('Familiar territory'):positive.length?t('A small similarity'):stated.length?t('Your stated taste'):t('A new direction');
 const knownNotes=summary.notes.length?summary.notes.map(n=>n.note):profile.likes;
 const novelty=candidate.notes.filter(n=>!knownNotes.includes(n)).length;
 const rank=intent==='explore'?(negative.length?-10:novelty*2+(familiar?0:1)):score;
 return {label,reasons,cautions,evidence,rank,hasEvidence:positive.length>0,drink:profile.drink,intent};
}
export function buildTasteContext({beans,reviews,profiles,brews,candidate}) {
 const profile=tasteProfile(profiles),summary=tasteSummary(reviews,beans,profile.drink);
 const relevant=summary.reviews.slice(-6);
 return {version:1,profile,candidate: candidate?{name:candidate.name,roast:candidate.roast,process:candidate.process,notes:candidate.notes}:null,
  reviews:relevant.map(r=>({bean:beans.find(b=>b.id===r.beanId)?.name,drink:r.drink,rebuy:r.rebuy,dialed:r.dialed,notes:r.notes,comment:r.comment})),
  recentCups:brews.filter(b=>relevant.some(r=>r.beanId===b.recipe.bean.id)).sort((a,b)=>b.created.localeCompare(a.created)).slice(0,3).map(b=>({bean:b.recipe.bean.name,drink:b.recipe.drink,actual:b.feedback,decision:b.decision.status}))};
}
export function tasteBrewStart(candidate,{beans,reviews,profile,brews,equipment,selectedEquipment}) {
 const method=profile.drink==='v60'?'v60':'espresso';
 const setup=equipment.find(e=>e.id===selectedEquipment&&e.method===method)||equipment.find(e=>e.method===method);
 const start={setup,drink:profile.drink==='milk'?'espresso':profile.drink,preference:profile.preference,dose:setup?Math.max(setup.minDose,Math.min(setup.maxDose,method==='v60'?15:18)):null,reference:null};
 if(!setup)return start;
 const evidence=matchCoffee(candidate,{beans,reviews,profile}).evidence.filter(e=>e.positive).sort((a,b)=>b.weight-a.weight);
 for(const e of evidence){
  const cup=brews.filter(b=>b.recipe.bean.id===e.beanId&&b.recipe.equipment.id===setup.id&&(b.recipe.drink||b.recipe.equipment.method)===profile.drink&&b.decision.status==='keep'&&b.feedback.observed&&b.feedback.dose>=setup.minDose&&b.feedback.dose<=setup.maxDose&&b.feedback.dose>=5&&b.feedback.dose<=35&&(method!=='v60'||b.feedback.dose>=15&&b.feedback.dose<=30)).sort((a,b)=>b.created.localeCompare(a.created))[0];
  if(cup){start.dose=cup.feedback.dose;start.preference=cup.recipe.preference;start.reference={bean:e.name,cupId:cup.id};break;}
 }
 // Carry a known setup, dose and preference. New beans receive fresh recipe guidance,
 // never a copied keeper, grinder number, extraction time or predicted taste.
 return start;
}
export function makeSharedCup(brew,review,author) {
 const r=brew.recipe,f=brew.feedback;
 const card={format:'daycup-cup',version:1,author:author.trim(),created:brew.created,
  bean:{name:r.bean.name,batch:r.bean.batch,roast:r.bean.roast,origin:r.bean.origin||'',process:r.bean.process||''},
  setup:{machine:r.equipment.name,grinder:r.equipment.grinder,method:r.equipment.method},
  drink:r.drink||r.equipment.method,actual:{dose:f.dose,output:f.output,seconds:f.seconds,grindSetting:f.grindSetting||'',taste:f.taste},
  opinion:review?{rebuy:review.rebuy,dialed:review.dialed,notes:review.notes}:null,
  home:'https://sidecourt.space/drops/daycup/'};
 validateSharedCup(card);return card;
}
export function validateSharedCup(c) {
 const fail=()=>{throw Error('Choose a valid DayCup shared cup file. Your library has not changed.');};
 if(!c||c.format!=='daycup-cup'||c.version!==1||!tmText(c.author,80)||!c.author.trim()||!tmText(c.created,40)||Number.isNaN(Date.parse(c.created))||!c.bean||!c.setup||!c.actual||!tasteDrinks[c.drink])fail();
 if(!['name','batch','origin','process'].every(k=>tmText(c.bean[k]))||!c.bean.name.trim()||!['light','medium','dark','unknown'].includes(c.bean.roast)||!['machine','grinder'].every(k=>tmText(c.setup[k]))||!['espresso','v60'].includes(c.setup.method))fail();
 const a=c.actual;if(![a.dose,a.output,a.seconds].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>0)||a.dose>100||a.output>2000||a.seconds>3600||!tmText(a.grindSetting,100)||!['balanced','sour','bitter','mixed'].includes(a.taste))fail();
 if(c.opinion&&(!['yes','no','unsure'].includes(c.opinion.rebuy)||!['yes','no','not-yet'].includes(c.opinion.dialed)||!tmTags(c.opinion.notes)))fail();
 // Reconstruct whitelisted fields; imported extra fields are never trusted or forwarded.
 return {format:c.format,version:1,author:c.author,created:c.created,bean:Object.fromEntries(['name','batch','origin','process','roast'].map(k=>[k,c.bean[k]])),setup:Object.fromEntries(['machine','grinder','method'].map(k=>[k,c.setup[k]])),drink:c.drink,actual:Object.fromEntries(['dose','output','seconds','grindSetting','taste'].map(k=>[k,a[k]])),opinion:c.opinion?{rebuy:c.opinion.rebuy,dialed:c.opinion.dialed,notes:c.opinion.notes}:null,home:'https://sidecourt.space/drops/daycup/'};
}
export function sameSharedBag(card,bean) {return tmNorm(card.bean.name)===tmNorm(bean.name)&&!!tmNorm(bean.batch)&&tmNorm(card.bean.batch)===tmNorm(bean.batch)&&card.bean.roast===bean.roast;}
