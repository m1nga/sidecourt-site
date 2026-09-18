import {t} from './i18n.js';
import {validateCatalogSetup,validateBeanTaxonomy,basketMode,beanSpecies,beanCaffeine} from './catalog-extension.js';
import {knowledgeVersion,brewSources,grinderKnowledge,brewerKnowledge,equipmentKnowledge,validateBrewSetup,initialGrind,temperatureGuide,beanContext,parseGrind,nextGrind,grindScale} from './brew-knowledge.js';
export const drinks={espresso:'Espresso',americano:'Americano','iced-americano':'Iced Americano',v60:'V60 pour-over'};
export const drinkStrengths={strong:'Stronger',standard:'Balanced',light:'Lighter'};
export const methods={espresso:'Espresso',v60:'V60 pour-over'};
export const roasts={light:'Light',medium:'Medium',dark:'Dark',unknown:'Not sure yet'};
export const preferences={balanced:'Balanced',body:'Full-bodied',clarity:'Clarity'};
export const tastes={balanced:'Just right',sour:'Too sour',bitter:'Too bitter',mixed:'Sour, bitter & astringent'};
const finite=x=>typeof x==='number'&&Number.isFinite(x);
export const basis=m=>t(m==='espresso'?'pump start, including pre-infusion':'the first pour');
function knownFilterOnly(name){return name.toLowerCase().replace(/[^a-z0-9]/g,'').startsWith('fellowode')||/timemore[\s·_-]*(?:sculptor[\s·_-]*)?(?:064|078)(?![a-z0-9])/i.test(name);}
export function validateEquipment(e,checkCompatibility=true){
 if(e){validateBrewSetup(e);validateCatalogSetup(e,checkCompatibility);}
 if(e&&checkCompatibility)equipmentKnowledge(e);
 if(e?.grinderMethods!==undefined&&e.grinderMethods!==null){if(!Array.isArray(e.grinderMethods)||!e.grinderMethods.length||e.grinderMethods.some(m=>!methods[m]))throw Error(t('Invalid grinder capability information.'));if(checkCompatibility&&!e.grinderMethods.includes(e.method))throw Error(t('The manufacturer does not list this grinder for the selected method. Choose a compatible grinder or change the brew method.'));}
 for(const k of ['brewerBrandID','brewerModelID','grinderBrandID','grinderModelID'])if(e?.[k]!=null&&(typeof e[k]!=='string'||e[k].length>120))throw Error(t('Invalid equipment model reference.'));
 if(!e||!methods[e.method]||typeof e.name!=='string'||!e.name.trim()||e.name.length>200||typeof e.grinder!=='string'||!e.grinder.trim()||e.grinder.length>200||typeof e.calibration!=='string'||e.calibration.length>100||!finite(e.minDose)||!finite(e.maxDose)||e.minDose<0||e.minDose>e.maxDose||e.maxDose>50||typeof e.confirmed!=='boolean'||typeof e.nonpressurized!=='boolean')throw Error(t('Add your brewer, grinder and a valid dose range (0–50 g).'));
 if(checkCompatibility&&e.method==='espresso'&&knownFilterOnly(e.grinder))throw Error(t('This grinder is designed for filter coffee only. Choose V60 or an espresso-capable grinder.'));
}
export function validateLabel(l){
 if(!l)return;
 const ratio=l.output/l.dose;
 if(!methods[l.method]||!finite(l.dose)||!finite(l.output)||l.dose<5||l.dose>35||l.output<=0||l.output>1000||(l.method==='espresso'?(ratio<1||ratio>4):(ratio<10||ratio>22)))throw Error(t('The bag recipe is outside the supported dose or output range. Please check the units.'));
 if(l.temperatureC!=null&&(!finite(l.temperatureC)||l.temperatureC<80||l.temperatureC>100))throw Error(t('Enter the bag temperature in Celsius, from 80 to 100.'));
 if(l.timeMin!=null||l.timeMax!=null){if(!finite(l.timeMin)||!finite(l.timeMax)||l.timeMin<5||l.timeMax<l.timeMin||l.timeMax>900)throw Error(t('Enter both ends of a valid bag-recipe time range, in seconds.'));}
}
function same(a,b){if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>same(a[k],b[k]));}
function brewRequest(e,options){
 const drink=options.drink||e.method,strength=['americano','iced-americano'].includes(drink)?(options.strength||'standard'):'standard';
 if(!drinks[drink]||!drinkStrengths[strength]||(e.method==='v60'?drink!=='v60':drink==='v60'))throw Error(t('Choose a drink supported by this setup. Americano requires an espresso setup.'));
 return {drink,strength};
}
function brewServing(r,waterRatio){
 if(!['americano','iced-americano'].includes(r.drink))return null;
 const ratio=waterRatio??({strong:2,standard:3,light:4}[r.request.strength]);
 const waterG=Math.round(r.output*ratio*10)/10,iceG=r.drink==='iced-americano'?Math.round(r.output*3*10)/10:0;
 return {waterG,iceG,waterRatio:ratio,totalMassG:Math.round((r.output+waterG+iceG)*10)/10,
  note:t(r.drink==='americano'?'Daycup editorial dilution starting point. Add separately weighed hot water to the extracted espresso; never run all dilution water through the coffee puck. This is ingredient mass, not measured drink volume.':'Daycup editorial dilution starting point, not a manufacturer optimum. Total mass includes unmelted ice; it is not liquid volume or a predicted melt amount. Weigh espresso separately before adding cold water and ice.')};
}
function completeRecipe(r,request){
 const e=r.equipment,b=r.bean,label=b.labelRecipe?.method===e.method&&Math.abs(b.labelRecipe.dose-r.dose)<.01?b.labelRecipe:null;
 const plan=initialGrind(e),temperature=temperatureGuide(e,b,label),machine=brewerKnowledge[e.brewerModelID];
 r.version=knowledgeVersion;r.drink=request.drink;r.request=request;r.ratio=Math.round(r.output/r.dose*1000)/1000;
 r.grindData=plan;r.grind=plan.text;r.temperature=temperature;r.serving=brewServing(r);
 r.confidence=t('Starting reference · not yet dialed in');r.timeDiagnostic=basketMode(e)!=='pressurized';
 r.machineNote=t(machine?.note||'Confirm your actual basket or dripper capacity and use the normal manufacturer brew program. No unverified pressure or pre-infusion number is imposed.');
 r.pressureBar=machine?.pressureBar??null;
 r.contextNotes=beanContext(b);
 if(b.species&&b.species!=='unknown')r.contextNotes.push(t('Bag composition: {species}',{species:t(beanSpecies[b.species])})+(b.robustaPercent!=null?t(' · {percent}% Robusta as stated on the bag',{percent:b.robustaPercent}):''));
 if(b.variety)r.contextNotes.push(t('Variety label: {variety}. Variety is not an extraction correction factor.',{variety:b.variety}));
 if(b.caffeine&&b.caffeine!=='unknown')r.contextNotes.push(t('Caffeine label: {caffeine}. No caffeine content is calculated.',{caffeine:t(beanCaffeine[b.caffeine])}));
 if(!r.timeDiagnostic){r.pressureBar=null;r.contextNotes.push(t('Pressurized basket: target mass is a starting point. Record elapsed time, but do not compare it to the 25–32 second single-wall window or use it to infer grind changes. Follow the exact basket manual; no conversion or modification is required.'));}
if(e.waterNote)r.contextNotes.push(t('Your saved water: {note}',{note:e.waterNote}));if(e.preparationNote)r.contextNotes.push(t('Your basket/filter and preparation: {note}',{note:e.preparationNote}));if(e.method==='v60'&&label?.timeMin)r.contextNotes.push(t('Follow your bag’s pouring sequence. Its custom time takes priority, so the default timed pour schedule is not imposed.'));
 if(b.labelRecipe&&!label)r.contextNotes.push(t('The bag recipe was not applied: its method or dose differs from this request.'));
 r.sources=[...new Set([...r.sources,...plan.sources,...(machine?[machine.source]:[]),...(temperature.source.startsWith('https:')?[temperature.source]:[]),...(['americano','iced-americano'].includes(r.drink)?[brewSources.americano]:[])])];
 if(e.method==='v60'&&!label?.timeMin){
  const bloom=Math.round(r.dose*2*10)/10,first=Math.round(r.output*.6*10)/10;
  r.pours=[{at:0,until:45,totalG:bloom,label:t('Bloom: saturate the bed and swirl gently')},{at:45,until:75,totalG:first,label:t('Pour evenly to this cumulative scale reading')},{at:75,until:105,totalG:r.output,label:t('Finish pouring to this cumulative scale reading')}];
  r.contextNotes.push(t('The pour schedule is a scaled Daycup adaptation of the Hario-hosted technique. Do not overfill the dripper; let it drain before continuing. Total water is not beverage yield.'));
 }
 return r;
}
function sameBrewContext(x,e,b,preference,dose,request){return x?.recipe&&same(x.recipe.equipment,e)&&same(x.recipe.bean,b)&&x.recipe.preference===preference&&Math.abs(x.recipe.dose-dose)<.01&&same(x.recipe.request||{drink:x.recipe.equipment.method,strength:'standard'},request);}
export function captureBrewRecipe(r,f){
 const copy=structuredClone(r),value=f.grindSetting?.trim();
 if(value){parseGrind(r.equipment,value);if(copy.version===knowledgeVersion){copy.grindData={...(copy.grindData||{}),value,kind:'measured'};copy.confidence=t('Measured setting · confirm the next cup by taste');}copy.grind=t('Your measured grind setting: {value}',{value});}
 return copy;
}
export function recommend(e,b,preference,dose,brews=[],options={}){
 validateEquipment(e);
 if(!e.confirmed)throw Error(t('First confirm the brew method, grinder compatibility and dose range in Setup.'));
 if(!b||!['light','medium','dark'].includes(b.roast)||typeof b.blend!=='boolean')throw Error(t('Check the bag to confirm the roast level and whether it is a blend.'));
 if(!preferences[preference])throw Error(t('Choose how you would like your coffee to taste.'));
 if(!finite(dose)||dose<5||dose>35||dose<e.minDose||dose>e.maxDose)throw Error(t('Choose a recipe dose between 5 and 35 g, within your confirmed equipment range.'));
 if(e.method==='espresso'&&!['single-wall','pressurized'].includes(basketMode(e)))throw Error(t('Confirm whether the installed ground-coffee basket is single-wall or pressurized in a new setup. Fully automatic and capsule machines are not supported.'));
 if(e.method==='v60'&&(dose<15||dose>30))throw Error(t('V60 recipes currently support 15–30 g. Check your dripper capacity.'));
 validateBeanTaxonomy(b);validateLabel(b.labelRecipe);beanContext(b);
 const request=brewRequest(e,options),history=brews.filter(x=>sameBrewContext(x,e,b,preference,dose,request)).sort((a,b)=>b.created.localeCompare(a.created));
 const previous=history[0];
 if(previous?.recipe.version===knowledgeVersion){
  const r=structuredClone(previous.recipe);r.id=crypto.randomUUID();
  if(previous.decision.status==='keep'){r.origin=t('Your saved favorite for this exact setup, batch, dose and drink');r.confidence=t('Your tasted favorite');return r;}
  if(previous.decision.status==='one_change'&&previous.decision.parameter==='water'){
   r.serving=brewServing(r,previous.decision.nextWaterRatio);r.origin=t('Change only dilution water; repeat the same espresso, grind and ice mass.');return r;
  }
  if(previous.decision.status==='one_change'&&['finer','coarser'].includes(previous.decision.direction)){
   const current=previous.feedback.grindSetting||'';
   // Bracketing uses only measured, even, timing-confirmed cups with the same extraction targets.
   const direction=previous.decision.direction,scale=grindScale(e),n=current?parseGrind(e,current):null;
   const opposite=history.slice(1).filter(x=>{
    const f=x.feedback,q=x.recipe,d=x.decision;
    return d?.status==='one_change'&&d.parameter!=='water'&&d.direction!==direction&&['finer','coarser'].includes(d.direction)&&f.observed&&f.even&&f.timingConfirmed&&(!['americano','iced-americano'].includes(q.drink)||f.tastedBase)&&Math.abs(f.dose-q.dose)<=.3&&Math.abs(f.output-q.output)<=1&&q.output===r.output&&same(q.temperature,r.temperature)&&same(q.pours,r.pours)&&q.timeMin===r.timeMin&&q.timeMax===r.timeMax;
   }).map(x=>{try{return parseGrind(e,x.feedback.grindSetting||'');}catch{return null;}}).filter(x=>n!=null&&x!=null&&scale&&((direction==='finer')===(scale.finer==='lower')?x<n:x>n)).sort((a,b)=>Math.abs(a-n)-Math.abs(b-n))[0];
   const change=nextGrind(e,current,direction,opposite);
   r.grindData={value:null,start:change.value,kind:change.mode||'calibration-needed'};
   r.grind=change.value!=null?t('Next trial: {value} — {reason}',{value:change.value,reason:change.reason}):change.mode==='boundary-review'?change.reason:t(direction==='finer'?'From your last brew, go a little finer. {reason}':'From your last brew, go a little coarser. {reason}',{reason:change.reason});
   r.origin=t('Change only the grind. Keep dose, output, temperature, water and preparation unchanged.');
   r.confidence=t('Measured adjustment · next cup still needs tasting');return r;
  }
  r.origin=t('Repeat the same targets and review the last cup: {message}',{message:previous.decision.message});return r;
 }
 // Legacy favorites remain valid snapshots; do not invent their historical temperature or grind.
 if(previous?.decision.status==='keep')return {...structuredClone(previous.recipe),id:crypto.randomUUID(),origin:t('Your saved favorite for this exact setup and batch of beans')};
 let ratio=e.method==='espresso'?(b.roast==='light'?2.5:2):500/30;
 if(e.method==='espresso'){if(preference==='clarity')ratio+=.25;if(preference==='body'&&b.roast!=='light')ratio=1.75;}
 else {if(preference==='body')ratio=15;if(preference==='clarity')ratio=17;}
 const label=b.labelRecipe?.method===e.method&&Math.abs(b.labelRecipe.dose-dose)<.01?b.labelRecipe:null;
 const r={id:crypto.randomUUID(),equipment:structuredClone(e),bean:structuredClone(b),preference,dose,output:label?label.output:Math.round(dose*ratio*10)/10,timeMin:label?.timeMin??(e.method==='espresso'?25:180),timeMax:label?.timeMax??(e.method==='espresso'?32:240),origin:t(label?'Uses the recipe you entered from this bag, ahead of taste preferences. Other numbers remain clearly labeled starting guidance.':'A source-backed recipe framework with editable Daycup starting choices, ready to refine through measured tasting'),sources:e.method==='espresso'?[brewSources.espresso,brewSources.ratios]:[brewSources.v60]};
 return completeRecipe(r,request);
}
export function adjust(r,f){
 const review=message=>({status:'review',message});
 if(f.grindSetting)parseGrind(r.equipment,f.grindSetting);
 if(!tastes[f.taste])return review('Choose the taste you observed.');
 if(['americano','iced-americano'].includes(r.drink)&&!f.tastedBase)return review('Taste a small sample of the espresso before dilution. Finished-drink strength alone must not trigger a grinder change.');
 if(!f.observed||![f.dose,f.output,f.seconds].every(x=>finite(x)&&x>0)||f.seconds>3600||f.dose>100||f.output>2000)return review('Record the actual dose, output and time, then confirm you have tasted the coffee.');
 if(r.timeDiagnostic!==false&&!f.timingConfirmed)return review('Use a consistent timer start: '+basis(r.equipment.method)+'.');
 if(!f.even||f.taste==='mixed')return review('Check distribution, channeling or pour evenness first. Keep the recipe unchanged while the cup tastes both sour and bitter.');
 if(Math.abs(f.dose-r.dose)>.3||Math.abs(f.output-r.output)>1)return review('The measured dose or output differs from the recipe. Match both targets on your next brew before comparing taste.');
 if(f.taste==='balanced'&&['americano','iced-americano'].includes(r.drink)){
  if(!f.servingConfirmed||!finite(f.waterG)||!finite(f.iceG)||Math.abs(f.waterG-r.serving.waterG)>1||Math.abs(f.iceG-r.serving.iceG)>1)return review('Confirm the measured dilution water and ice (zero for hot Americano) match the recipe before comparing drink strength.');
  if(['weak','strong'].includes(f.strength)){
   const next=Math.round((r.serving.waterRatio+(f.strength==='weak'?-.5:.5))*10)/10;
   if(next<1||next>8)return review('Dilution has reached the supported range. Keep your espresso unchanged and review the drink size.');
   return {status:'one_change',parameter:'water',direction:f.strength==='weak'?'less':'more',nextWaterRatio:next,message:t('Your espresso tastes right. Next time change only dilution water to {water} g; keep the espresso recipe, grinder setting and ice mass unchanged.',{water:Math.round(r.output*next*10)/10})};
  }
 }
 if(f.taste==='balanced')return {status:'keep',message:t('This one is a keeper. Choose the same batch and setup next time to start from this recipe.')};
 if(r.timeDiagnostic===false)return review('Pressurized basket: do not infer a grinder correction from elapsed time. Check the basket manual, preparation and weighed dose/yield first; keep variables stable.');
 const finer=f.taste==='sour'&&f.seconds<r.timeMin,coarser=f.taste==='bitter'&&f.seconds>r.timeMax;
 if(!finer&&!coarser)return review('Time and taste do not point to one clear adjustment yet. Check water temperature, the bag recipe and puck preparation or pouring.');
 return {status:'one_change',parameter:'grind',direction:finer?'finer':'coarser',message:t(finer?'On your next brew, go a little finer with the grind. Keep the dose, target output, water temperature and {technique} unchanged. Use the smallest repeatable adjustment your grinder allows.':'On your next brew, go a little coarser with the grind. Keep the dose, target output, water temperature and {technique} unchanged. Use the smallest repeatable adjustment your grinder allows.',{technique:t(r.equipment.method==='espresso'?'pre-infusion and distribution':'pouring technique')})};
}
function text(value,max=200){return typeof value==='string'&&value.length<=max;}
function validBean(p){
 if(p)validateBeanTaxonomy(p);
 return p&&text(p.name)&&p.name.trim()&&['light','medium','dark','unknown'].includes(p.roast)&&typeof p.blend==='boolean'&&text(p.batch)&&['origin','process','roastedOn'].every(k=>p[k]===undefined||p[k]===null||text(p[k]));
}
export function validateEntry(e){
 if(!e||typeof e.id!=='string'||!/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(e.id)||!['bean','equipment','brew'].includes(e.kind)||typeof e.created!=='string'||Number.isNaN(Date.parse(e.created))||typeof e.payload!=='string'||new TextEncoder().encode(e.payload).length>=64000)throw Error(t('This backup contains an invalid record.'));
 const p=JSON.parse(e.payload);if(!p||p.id!==e.id)throw Error(t('The record IDs do not match.'));
 if(e.kind==='equipment')validateEquipment(p,false);
 if(e.kind==='bean'){if(!validBean(p))throw Error(t('A bean record is incomplete.'));validateLabel(p.labelRecipe);}
 if(e.kind==='brew'){
  const r=p.recipe,f=p.feedback,d=p.decision;
  if(!r||!f||!d)throw Error(t('A brew record is incomplete.'));
  validateEquipment(r.equipment,false);
  validateRecipeExtras(r,f,d);
  // Imported snapshots are untrusted input, including values displayed in recipe cards.
  if(!validBean(r.bean)||![r.dose,r.output,r.timeMin,r.timeMax,f.dose,f.output,f.seconds].every(x=>finite(x)&&x>0)||r.dose>35||r.output>1000||r.timeMin>r.timeMax||r.timeMax>3600||f.dose>100||f.output>2000||f.seconds>3600||!['balanced','sour','bitter','mixed'].includes(f.taste)||!text(d.message,4000)||!['keep','one_change','review'].includes(d.status)||!text(r.grind,2000)||!text(r.origin,4000)||!text(r.version,200)||!text(p.created,100)||Number.isNaN(Date.parse(p.created))||!Array.isArray(r.sources)||r.sources.length>100||r.sources.some(x=>!text(x,2000))||(f.notes!==undefined&&!text(f.notes,2000)))throw Error(t('A brew record is incomplete or contains invalid values.'));
 }
 return p;
}

function validateRecipeExtras(r,f,d){
 if(f.grindSetting!==undefined&&(typeof f.grindSetting!=='string'||f.grindSetting.length>100))throw Error(t('Invalid recorded grind setting.'));
 if(f.grindSetting)parseGrind(r.equipment,f.grindSetting);
 if(![knowledgeVersion,'daycup-brewing-2.0.0'].includes(r.version)){if(['temperature','pours','serving','grindData','request'].some(k=>r[k]!=null))throw Error(t('This recipe has unsupported versioned fields. Keep the original backup and update Daycup.'));return;}
 if(r.version===knowledgeVersion&&r.timeDiagnostic!==(basketMode(r.equipment)!=='pressurized'))throw Error(t('Invalid basket timing mode.'));
 if(r.version==='daycup-brewing-2.0.0'&&(r.drink==='americano'||r.timeDiagnostic===false))throw Error(t('Fields do not match the historical recipe version.'));
 if(!drinks[r.drink]||!r.request||!drinkStrengths[r.request.strength]||r.request.drink!==r.drink||r.drink==='v60'&&r.equipment.method!=='v60'||r.drink!=='v60'&&r.equipment.method!=='espresso')throw Error(t('Invalid drink or setup in this recipe.'));
 if(!r.temperature||!finite(r.temperature.targetC)||r.temperature.targetC<80||r.temperature.targetC>100||!['kettle','adjustable','unknown','thermostat','machine-managed'].includes(r.temperature.mode)||r.temperature.settingC!==null&&(!finite(r.temperature.settingC)||r.temperature.settingC<80||r.temperature.settingC>100)||!text(r.temperature.note,2000)||!text(r.temperature.source,2000)||!text(r.temperature.basis,2000)||!text(r.machineNote,2000)||!text(r.confidence,200)||!finite(r.ratio)||Math.abs(r.ratio-r.output/r.dose)>.002||r.pressureBar!==null&&(!finite(r.pressureBar)||r.pressureBar<1||r.pressureBar>15))throw Error(t('Invalid temperature, pressure or recipe metadata.'));
 if(!Array.isArray(r.contextNotes)||r.contextNotes.length>20||r.contextNotes.some(x=>!text(x,2000))||!r.grindData||!text(r.grindData.kind,100)||r.grindData.value!=null&&!text(r.grindData.value,100)||r.grindData.start!=null&&!(finite(r.grindData.start)||text(r.grindData.start,100)))throw Error(t('Invalid recipe context or grind reference.'));
 if(['americano','iced-americano'].includes(r.drink)){
  const v=r.serving;
  if(!v||![v.waterG,v.iceG,v.totalMassG,v.waterRatio].every(finite)||v.waterG<=0||(r.drink==='americano'?v.iceG!==0:v.iceG<=0)||v.totalMassG>2500||v.waterRatio<1||v.waterRatio>8||Math.abs(v.waterG-r.output*v.waterRatio)>.11||Math.abs(v.totalMassG-(r.output+v.waterG+v.iceG))>.11||!text(v.note,2000))throw Error(t('Invalid Americano water or ice measurements.'));
  if(f.strength!==undefined&&!['balanced','weak','strong'].includes(f.strength))throw Error(t('Invalid drink strength feedback.'));
  for(const key of ['waterG','iceG'])if(f[key]!==undefined&&(!finite(f[key])||f[key]<0||f[key]>2000))throw Error(t('Invalid measured dilution.'));
 }
 if(r.pours){if(r.equipment.method!=='v60'||!Array.isArray(r.pours)||r.pours.length!==3)throw Error(t('Invalid pour schedule.'));let last=0,until=0;for(const p of r.pours){if(![p.at,p.until,p.totalG].every(finite)||p.at<until||p.until<p.at||p.until>900||p.totalG<=last||p.totalG>r.output||!text(p.label,200))throw Error(t('Invalid cumulative pour targets.'));last=p.totalG;until=p.until;}if(Math.abs(last-r.output)>.01)throw Error(t('Pour targets must finish at total water.'));}
 if(d.parameter==='water'&&(!['americano','iced-americano'].includes(r.drink)||!finite(d.nextWaterRatio)||d.nextWaterRatio<1||d.nextWaterRatio>8))throw Error(t('Invalid next dilution target.'));
 for(const k of ['tastedBase','servingConfirmed'])if(f[k]!==undefined&&typeof f[k]!=='boolean')throw Error(t('Invalid drink confirmation.'));
 const computed=adjust(r,f);for(const k of ['status','parameter','direction','nextWaterRatio'])if(d[k]!==computed[k])throw Error(t('The saved decision does not match the recorded brew measurements.'));
 for(const k of ['observed','timingConfirmed','even'])if(typeof f[k]!=='boolean')throw Error(t('Invalid brew confirmation.'));
}

// Explain the calculation from stored targets. No hidden model/price/genetic coefficient.
export function explainRecipe(r){
 const e=r.equipment,b=r.bean,notes=[t('Confirmed working dose D = {dose} g, within this setup’s {min}–{max} g capacity.',{dose:r.dose,min:e.minDose,max:e.maxDose}),t('{quantity} = D × R = {dose} × {ratio} ≈ {output} g.',{quantity:t(e.method==='espresso'?'Espresso yield E':'Total brew water W'),dose:r.dose,ratio:Math.round(r.output/r.dose*1000)/1000,output:r.output})];
 const label=b.labelRecipe;
 notes.push(label?.method===e.method&&Math.abs(label.dose-r.dose)<.01?t('R comes from your bag recipe at the same method and dose; this overrides the taste-preference table.'):t('R is a Daycup starting choice for {roast} roast and {preference} preference. It is not a claim that a specific bean variety extracts to a known percentage.',{roast:t(roasts[b.roast]||b.roast),preference:t(preferences[r.preference]||r.preference)}));
 if(r.serving){notes.push(t('Dilution water = E × k = {output} × {ratio} = {water} g. It is added after extraction, not run through the puck.',{output:r.output,ratio:r.serving.waterRatio,water:r.serving.waterG}));notes.push(t('Total ingredient mass = espresso + water + ice = {output} + {water} + {ice} = {total} g. This is not a cup-volume or ice-melt prediction.',{output:r.output,water:r.serving.waterG,ice:r.serving.iceG,total:r.serving.totalMassG}));}
 if(e.method==='v60')notes.push(t('Brew water is the water poured, not the beverage yield. Bloom and cumulative pours are part of that total, never added on top.'));
 notes.push(t('Machine and grinder select valid capabilities, temperature controls and safe adjustment references. Basket capacity limits dose; roast and preference set the starting ratio; measured taste and flow guide the next trial.'));
 if(r.timeDiagnostic===false)notes.push(t('Pressurized basket: the normal single-wall espresso timing window does not apply. No time-to-grind correction is calculated.'));
 return notes;
}
