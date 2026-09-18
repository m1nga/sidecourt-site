import {t} from './i18n.js';
import {addCatalogEntries,everydayBeans,compatibleCatalogModel} from './catalog-extension.js';
// Editorial entry points, not a worldwide sales ranking or a price feed.
// Manufacturer pages checked 2026-09-18. No network/API is used at runtime.
export const curationVersion='daycup-curation-2026-09-18';
const source=(url,title)=>({url,title,checked_at:'2026-09-18'});
const model=(id,name,methods,url,notes=[])=>({id,name,series:name,release_year:null,release_status:'unverified',availability_evidence:'Listed on the linked manufacturer page when checked on 2026-09-18. Match your own hardware revision.',price:{currency:'USD',amount:null,usd_min:null,usd_max:null,kind:'unknown',label:'USD price unverified',note:'No current price is asserted. Check the manufacturer for your region, voltage and warranty.',source_url:null},methods,method_status:'verified',sources:[source(url,'Manufacturer model and intended use')],notes,budget_bucket:'unknown'});
export const additionalBrands=[
 {id:'niche',name:'Niche',category:'grinder',monogram:'N',coverage_note:'Single dosing. Match your actual model and burr set.',models:[model('niche-zero','Niche Zero',['espresso','v60'],'https://www.nichecoffee.co.uk/products/niche-zero',['A stepless adjustment has no universally correct numbered starting point. Calibrate on your own grinder.'])]},
 {id:'1zpresso',name:'1Zpresso',category:'grinder',monogram:'1Z',coverage_note:'Manual grinders. K-Ultra is an all-rounder; Daycup supports ZP6 Special for V60, not espresso.',models:[model('1zpresso-k-ultra','K-Ultra',['espresso','v60'],'https://1zpresso.coffee/k-ultra/'),model('1zpresso-zp6-special','ZP6 Special',['v60'],'https://1zpresso.coffee/zp6/',['Filter-focused burrs. Espresso compatibility is not verified for Daycup.'])]},
 {id:'gaggia',name:'Gaggia',category:'espresso_machine',monogram:'G',coverage_note:'Choose the E24 revision. Confirm which basket you actually installed.',models:[model('gaggia-classic-e24','Classic E24',['espresso'],'https://www.gaggia.com/manual-machines/classic-e24-color-vibes/',['Confirm whether you installed the traditional single-wall or pressurized basket; Daycup uses separate feedback rules.'])]},
 {id:'profitec',name:'Profitec',category:'espresso_machine',monogram:'P',coverage_note:'GO generations differ. Match the display and features on your own machine.',models:[model('profitec-go-current','GO · current OLED version',['espresso'],'https://www.profitec-espresso.com/en/products/go',['The current manufacturer page describes an OLED revision. Do not assume the same functions on an older GO.'])]}
];
export function curatedDirectory(original){
 const value=structuredClone(original),ids=new Set(value.brands.flatMap(b=>[b.id,...b.models.map(m=>m.id)]));
 for(const brand of additionalBrands){for(const id of [brand.id,...brand.models.map(m=>m.id)]){if(ids.has(id))throw Error('Duplicate curated equipment ID: '+id);ids.add(id);}value.brands.push(structuredClone(brand));}
 return addCatalogEntries(value);
}
export const featuredEquipment=[
 {id:'breville-bes500',tier:'Everyday',note:'Compact home espresso'},
 {id:'delonghi-ec260',tier:'Everyday',note:'Stilosa; confirm actual basket and dose'},
 {id:'delonghi-ec685',tier:'Everyday',note:'Dedica Style; exact revision matters'},
 {id:'delonghi-ec890',tier:'Everyday',note:'Dedica Duo; separate grinder'},
 {id:'breville-bcg820',tier:'Everyday',note:'Independent electric grinder'},
 {id:'timemore-c3-esp',tier:'Everyday',note:'Hand grinder; fine-step ESP dial'},
 {id:'baratza-encore-original',tier:'Everyday',note:'Original Encore; filter profile'},
 {id:'gaggia-classic-e24',tier:'Everyday',note:'Confirm single-wall or pressurized basket'},
 {id:'profitec-go-current',tier:'Enthusiast',note:'Verify the GO revision'},
 {id:'lelit-pl162t-eu',tier:'Enthusiast',note:'Bianca; match your model code'},
 {id:'lm-linea-micra',tier:'Enthusiast',note:'Premium home machine'},
 {id:'lm-linea-mini-r',tier:'Enthusiast',note:'Mini R is a distinct revision'},
 {id:'baratza-encore-esp',tier:'Everyday',note:'Espresso and filter'},
 {id:'fellow-opus-original',tier:'Everyday',note:'Original Opus; not Opus 2'},
 {id:'1zpresso-k-ultra',tier:'Everyday',note:'Manual; espresso and filter'},
 {id:'fellow-ode-gen-2',tier:'Enthusiast',note:'Filter only; not espresso'},
 {id:'1zpresso-zp6-special',tier:'Enthusiast',note:'Manual; V60 support only'},
 {id:'niche-zero',tier:'Enthusiast',note:'Stepless single dosing'},
 {id:'mazzer-philos-i200d',tier:'Enthusiast',note:'Match the installed I200D burrs'}
];
export function featuredChoices(directory,category,method){
 const byId=new Map(directory.brands.filter(b=>b.category===category).flatMap(brand=>brand.models.map(m=>[m.id,{brand,model:m}])));
 return featuredEquipment.flatMap(item=>{const found=byId.get(item.id);return found&&compatibleCatalogModel(found.model,category,method)?[{...item,...found}]:[];});
}
export const beanProfiles=[
 ...everydayBeans,
 {id:'daily-medium',name:'My medium-roast coffee',roast:'medium',blend:false,tier:'Profile',note:'Chocolate / balanced starting profile. Choose only if this describes your bag; confirm whether it is a blend.'},
 {id:'light-filter',name:'My light-roast coffee',roast:'light',blend:false,tier:'Profile',note:'Light-roast starting profile for a brighter cup. Not a fixed recipe for every origin.'},
 {id:'dark-body',name:'My dark-roast coffee',roast:'dark',blend:false,tier:'Profile',note:'Traditional, fuller-bodied starting profile. Match the roast level printed on your bag.'},
 {id:'hair-bender',name:'Stumptown · Hair Bender',roast:'unknown',blend:true,tier:'Roaster selection',note:'A year-round espresso blend, also used for filter. Confirm this bag’s roast; blend components can change.',url:'https://www.stumptowncoffee.com/collections/featured'},
 {id:'holler-mountain',name:'Stumptown · Holler Mountain',roast:'medium',blend:true,tier:'Roaster selection',note:'The roaster describes this organic blend as medium roast. Check the actual bag and batch.',url:'https://www.stumptowncoffee.com/collections/featured'},
 {id:'southern-weather',name:'Onyx · Southern Weather',roast:'medium',blend:true,tier:'Specialty selection',note:'The roaster’s Moderate profile corresponds to medium. A filter-focused house blend; origins rotate.',url:'https://onyxcoffeelab.com/products/southern-weather'},
 {id:'red-brick',name:'Square Mile · Red Brick',roast:'unknown',blend:true,tier:'Specialty selection',note:'Seasonal espresso blend. Copy the roast and recipe from this bag rather than an older release.',url:'https://shop.squaremilecoffee.com/products/red-brick'},
 {id:'special-lot',name:'My special single-origin lot',roast:'unknown',blend:false,tier:'Specialty selection',note:'For a Geisha, competition lot or experimental process: record the actual label. Price and variety do not determine the recipe.'}
];
