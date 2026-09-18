import {t} from './i18n.js';
import {catalogRows,validateBeanTaxonomy,beanSpecies,beanCaffeine,basketMode,separateModel} from './catalog-extension.js';
// Versioned offline knowledge, not an API or a universal grind-size conversion.
// Values marked editorial are Daycup starting choices, not manufacturer guarantees.
export const knowledgeVersion = 'daycup-brewing-2.1.0';
export const knowledgeChecked = '2026-09-18';
export const brewSources = {
 espresso: 'https://www.baratza.com/en-us/blog/product-guides/dialing-in-espresso',
 filter: 'https://www.baratza.com/en-us/blog/brew-guides/hario-v60-brew-guide',
 ratios: 'https://www.lamarzocco.com/uk/en/using-espresso-brew-ratios/',
 light: 'https://www.lamarzocco.com/fr/en/dialing-in-a-modern-espresso/',
 traditional: 'https://www.lamarzocco.com/fr/fr/calibrer-un-espresso-traditionnel/',
 v60: 'https://www.hario-usa.com/blogs/recipes-and-more-from-friends/james-hoffmann-uitimate-v60-technique',
 fellow: 'https://fellowproducts.com/pages/how-to-pour-over',
 manual: 'https://1zpresso.coffee/grind-setting/',
 zp6: 'https://1zpresso.coffee/how-to-dial-in-the-perfect-grind-size-for-pour-over-coffee/',
 americano: 'https://about.starbucks.com/stories/2026/coffee-science-iced-americano-cold-brew-or-iced-coffee-whats-the-difference/'
};
// Numbers are model-local dial values, NEVER particle-size microns.
export const grinderKnowledge = {
 'baratza-encore-esp': {kind:'numeric',min:1,max:40,step:1,finer:'lower',espresso:{start:20,range:[1,20],source:brewSources.espresso,note:'The current manufacturer guide starts at the coarse end of 1–20. This is a first trial, not a dialed-in shot.'},v60:{start:25,source:brewSources.filter}},
 'baratza-encore-esp-pro': {kind:'numeric',min:0,max:null,step:null,finer:'lower',espresso:{start:40,range:[0,40],source:brewSources.espresso,note:'ESP Pro is not the original ESP. The current guide starts at 40; record a small repeatable movement on your stepless dial.'},v60:{start:50,source:brewSources.filter}},
 'baratza-vario-w-plus': {kind:'compound',v60:{start:'8M',source:brewSources.filter},espresso:{source:brewSources.espresso,note:'Record both the numbered macro lever and lettered micro lever; start the micro lever near its centre. No single-number conversion is valid.'}},
 'fellow-ode-gen-2': {kind:'numeric',min:1,max:11,step:null,finer:'lower',v60:{start:5,source:brewSources.fellow,note:'For stock Gen 2 burrs only. SSP or other burrs need their own calibration.'},filterOnly:true},
 '1zpresso-k-ultra': {requiresConfirmedRange:true,kind:'numeric',min:0.1,max:null,step:0.1,finer:'lower',espresso:{source:brewSources.manual,note:'Record the displayed number, including the turn count when applicable. One displayed 0.1 is one click; no unverified espresso starting number is supplied.'},v60:{start:8.5,range:[8,9],source:brewSources.zp6,note:'The manufacturer suggests 80–90 clicks (displayed 8–9). 8.5 is Daycup’s midpoint trial. Ten clicks equal one numbered interval; retain your safe zero reference.'}},
 '1zpresso-zp6-special': {requiresConfirmedRange:true,kind:'numeric',min:0.1,max:null,step:0.1,finer:'lower',v60:{start:4.5,range:[4,5],source:brewSources.zp6,note:'4–5 is the manufacturer pour-over reference; 4.5 is Daycup’s midpoint trial, not a measured calibration.'},filterOnly:true},
 'fellow-opus-original': {kind:'compound',espresso:{source:'https://help.fellowproducts.com/hc/en-us/articles/12697465736091-Is-Opus-1-suitable-for-grinding-espresso',note:'Record both the outer dial and inner-ring offset. Do not reuse an Opus 2 setting.'},v60:{source:brewSources.fellow,note:'Use the original Opus pour-over range on the lid; record both adjustment rings.'}},
 'niche-zero': {kind:'stepless',espresso:{source:'https://www.nichecoffee.co.uk/products/niche-zero',note:'Use your own calibrated zero and record the dial position. An unverified universal number is not supplied.'},v60:{source:'https://www.nichecoffee.co.uk/products/niche-zero',note:'Use a filter trial on your own calibrated dial; preserve the calibration reference.'}}
};
export const brewerKnowledge = {
 'lm-linea-micra': {temperature:'adjustable',pressureBar:9,source:'https://www.lamarzocco.com/ie/en/espresso-workflow/',note:'Set brew temperature using the manufacturer controls. Keep the normal pressure and pre-brew program unchanged.'},
 'lm-linea-mini-r': {temperature:'adjustable',pressureBar:9,source:brewSources.ratios,note:'Keep the installed basket and pre-brew program consistent. Brew by measured mass.'},
 'profitec-go-current': {temperature:'adjustable',pressureBar:null,source:'https://www.profitec-espresso.com/en/products/go',note:'Current OLED/GO 2.0 profile only. Use the PID and ready indication; do not copy this revision’s pre-infusion controls to older GO machines.'},
 'gaggia-classic-e24': {temperature:'thermostat',pressureBar:null,source:'https://www.gaggia.com/manual-machines/classic-e24-color-vibes/',note:'Stock thermostat machine: use the brew-ready light and the manual’s warm-up procedure. There is no numerical brew-temperature setpoint here. Nominal pump pressure is not a brew-pressure target.'},
 'breville-bes500': {temperature:'machine-managed',pressureBar:9,source:'https://www.breville.com/en-us/product/bes500',note:'Use the normal brew program and confirm the installed basket. Milk-temperature buttons are not brew-temperature controls.'}
};
for(const row of catalogRows){
 if(row.category==='espresso_machine')brewerKnowledge[row.id]={temperature:row.temperature||'unknown',pressureBar:null,source:row.source,note:row.note};
 else grinderKnowledge[row.id]={kind:'unverified-scale',filterOnly:!row.methods.includes('espresso'),...Object.fromEntries(row.methods.map(m=>[m,{source:row.source,note:row.note}]))};
}
let knowledgeIndex = new Map();
export function initializeKnowledge(directory) {
 const next = new Map();
 for (const brand of directory?.brands || []) for (const model of brand.models || []) {
  if (next.has(model.id)) throw Error('Duplicate equipment identifier: '+model.id);
  next.set(model.id, {separate:brand.category!=='espresso_machine'||separateModel(model),category:brand.category,methods:[...(model.methods||[])],verified:model.method_status==='verified',sources:(model.sources||[]).map(x=>x.url)});
 }
 knowledgeIndex = next;
 return next.size;
}
export function equipmentKnowledge(e) {
 const grinder=knowledgeIndex.get(e.grinderModelID), brewer=knowledgeIndex.get(e.brewerModelID);
 if(brewer?.separate===false)throw Error(t('Select a standalone brewer and independent grinder, not an integrated grinder or automatic machine.'));
 if(grinder && grinder.category!=='grinder') throw Error(t('The selected grinder ID is not a grinder. Save the correct setup.'));
 if(brewer && (brewer.category!=='espresso_machine'||!brewer.methods.includes(e.method))) throw Error(t('The selected brewer ID is not a brewer. Save the correct setup.'));
 for(const item of [grinder,brewer]) if(item?.verified && !item.methods.includes(e.method)) throw Error(t('This exact equipment configuration does not support the selected brew method.'));
 if(e.method==='espresso' && grinderKnowledge[e.grinderModelID]?.filterOnly) throw Error(t('This is a filter-only grinder. Use V60 or select an espresso-capable grinder.'));
 return {grinder,brewer};
}
const brewNumber=x=>typeof x==='number'&&Number.isFinite(x);
export function validateBrewSetup(e) {
 if(e.grinderConfiguration!==undefined&&!['stock','changed','unknown'].includes(e.grinderConfiguration))throw Error(t('Confirm whether your grinder has stock burrs and calibration.'));
 if(e.temperatureControl!==undefined&&!['unknown','adjustable','machine-managed'].includes(e.temperatureControl))throw Error(t('Invalid temperature control confirmation.'));
 if(e.preparationNote!==undefined&&(typeof e.preparationNote!=='string'||e.preparationNote.length>300))throw Error(t('Keep the basket/filter and preparation note under 300 characters.'));
 if(e.waterNote!==undefined&&(typeof e.waterNote!=='string'||e.waterNote.length>200))throw Error(t('Keep the water note under 200 characters.'));
 if(e.grindScale!=null){const s=e.grindScale;if(!s||![s.min,s.max,s.step].every(brewNumber)||s.min<0||s.max>10000||s.max<=s.min||s.step<=0||s.step>s.max-s.min||!['lower','higher'].includes(s.finer)||s.confirmed!==true)throw Error(t('Confirm a valid safe dial minimum, maximum, repeatable step and finer direction.'));}
}
export function grindScale(e) {
 if(e.grindScale)return e.grindScale;
 if(e.grinderConfiguration!=='stock')return null;
 const p=grinderKnowledge[e.grinderModelID];
 return p?.kind==='numeric'?p:null;
}
export function parseGrind(e,value) {
 if(value==null||value==='')return null;
 if(typeof value!=='string'||value.length>100)throw Error(t('Record the actual grinder setting in under 100 characters.'));
 const s=grindScale(e);
 if(!s)return null;
 if(!/^\d+(?:\.\d+)?$/.test(value.trim()))throw Error(t('Use the displayed numerical dial value for this scale. For changed burrs or offsets, save a new setup with the correct scale.'));
 const n=Number(value);
 if(!brewNumber(n)||n<s.min||(s.max!=null&&n>s.max)||n>10000)throw Error(t('The grind setting is outside this setup’s supported dial range. Check the model and calibration.'));
 if(s.step&&Math.abs((n-s.min)/s.step-Math.round((n-s.min)/s.step))>1e-5)throw Error(t('That grind setting is between supported steps on this setup.'));
 return n;
}
export function initialGrind(e) {
 if(basketMode(e)==='pressurized')return {value:e.calibration||null,start:null,kind:'basket-guidance',text:t('Pressurized basket: use the ground-coffee fineness specified by the machine manual, not a single-wall espresso click target.')+' '+(e.calibration?t('Your tested reference: {value}',{value:e.calibration}):t('Record your own grinder reference after a real cup.')),sources:brewerKnowledge[e.brewerModelID]?[brewerKnowledge[e.brewerModelID].source]:[]};
 const p=e.grinderConfiguration==='stock'&&!e.grindScale?grinderKnowledge[e.grinderModelID]:null, ref=p?.[e.method];
 if(e.calibration){parseGrind(e,e.calibration);return {value:e.calibration,kind:'user-reference',text:t('Your setup reference: {value} — recheck for this batch and dose',{value:e.calibration}),sources:ref?[ref.source]:[]};}
 if(ref?.start!=null)return {value:null,start:ref.start,range:ref.range||null,kind:ref.range?'manufacturer-range-trial':'manufacturer-start',text:t('First trial: {start} on this exact grinder.',{start:ref.start})+' '+t(ref.note||'Manufacturer reference; adjust after a measured brew.'),sources:[ref.source]};
 return {value:null,start:null,kind:'calibration-needed',text:t(e.method==='espresso'?'Fine espresso grind.':'Medium-fine pour-over grind.')+' '+t(ref?.note||'Record a first measured brew on your own grinder; no verified numerical starting setting is available for this configuration.'),sources:ref?[ref.source]:[]};
}
export function temperatureGuide(e,b,label) {
 const p=brewerKnowledge[e.brewerModelID],target=label?.temperatureC??(e.method==='espresso'?{light:94,medium:93,dark:90}[b.roast]:{light:98,medium:96,dark:92}[b.roast]);
 const mode=e.method==='v60'?'kettle':e.temperatureControl==='adjustable'?'adjustable':e.temperatureControl==='machine-managed'?'machine-managed':p?.temperature||'unknown';
 const adjustable=['kettle','adjustable'].includes(mode);
 return {targetC:target,settingC:adjustable?target:null,mode,source:label?.temperatureC?t('Your bag recipe'):e.method==='v60'?brewSources.v60:b.roast==='light'?brewSources.light:b.roast==='dark'?brewSources.traditional:brewSources.ratios,
  note:adjustable?t('Start at {target} °C; use only the normal user controls supported by your machine or kettle. Keep this unchanged while dialing grind.',{target}):t('{target} °C is a recipe reference, not a setting on this machine. Use the normal brew-ready program; do not modify the machine to chase this number.',{target}),
  basis:label?.temperatureC?'bag-recipe':'editorial starting temperature within source guidance'};
}
export function beanContext(b,at=new Date()) {
 const notes=[];
 if(b.roastedOn){const d=new Date(b.roastedOn+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(b.roastedOn)||Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==b.roastedOn)throw Error(t('Check the roast date on the bag.'));const today=new Date(Date.UTC(at.getFullYear(),at.getMonth(),at.getDate()));const age=Math.floor((today-d)/86400000);if(age<0)throw Error(t('The roast date is in the future. Check this batch.'));notes.push(t(age===1?'Roasted 1 day ago. Follow the roaster’s rest/storage advice; roast age alone does not prescribe a grind correction.':'Roasted {age} days ago. Follow the roaster’s rest/storage advice; roast age alone does not prescribe a grind correction.',{age}));}
 if(b.process)notes.push(t('Process: {process}. Retain this batch’s own measurements; process or origin alone does not select grinder clicks.',{process:t(b.process)}));
 if(/decaf/i.test(b.process||''))notes.push(t('Decaf is recorded as its own batch; do not reuse the regular coffee calibration.'));
 if(b.labelRecipe)notes.push(t('Bag recipes apply only to the same brew method and dose, unless you deliberately enter a new recipe.'));
 return notes;
}
export function nextGrind(e,current,direction,opposite=null) {
 const scale=grindScale(e),n=parseGrind(e,current);
 if(n==null||!scale?.step)return {value:null,reason:t('Use the smallest repeatable movement on your grinder and record its actual setting. No universal click-to-time conversion is used.')};
 const sign=(direction==='finer')===(scale.finer==='lower')?-1:1;
 let proposed=n+sign*scale.step,mode='one-step';
 if(brewNumber(opposite)&&Math.abs(opposite-n)>scale.step*1.5){const mid=scale.min+Math.round(((n+opposite)/2-scale.min)/scale.step)*scale.step;if((mid-n)*sign>0&&Math.abs(mid-n)<Math.abs(opposite-n)){proposed=mid;mode='measured-bracket';}}
 proposed=Math.round(proposed*1e8)/1e8;
 const profile=grinderKnowledge[e.grinderModelID],workingRange=profile?.[e.method]?.range;
 if(!e.grindScale&&profile?.requiresConfirmedRange&&(!workingRange||proposed<workingRange[0]||proposed>workingRange[1]))return {value:null,mode:'boundary-review',reason:t('A numerical change here would leave the manufacturer starting range, or this method has no verified range. Confirm a safe custom scale in Setup before further numerical guidance; do not force burrs or assume the printed zero is usable.')};
 if(proposed<scale.min||(scale.max!=null&&proposed>scale.max))return {value:null,mode:'boundary-review',reason:t('The next step would leave your recorded safe range. Check calibration and puck/pour preparation; do not force the burrs.')};
 return {value:String(proposed),mode,reason:t(mode==='measured-bracket'?'A trial between your measured too-fast and too-slow settings, holding the extraction recipe fixed.':'One repeatable step from the setting you actually used.')};
}
