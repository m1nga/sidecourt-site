import {t} from './i18n.js';
// Pure directory helpers shared by the picker and its regression checks.
export const budgetLabels={entry:'Under $500',mid:'$500–1,500',upper:'$1,500–3,000',cafe:'$3,000–10,000',above:'$10,000+',unknown:'Unpriced'};
export function modelYear(model){
 const year=model.release_year;
 if(model.release_status==='verified_launch'&&year)return t('{year} release',{year});
 if(model.release_status==='verified_update'&&year)return t('{year} update',{year});
 if(model.release_status==='legacy_current')return year?t('{year} · current classic',{year}):t('Current classic');
 return t('Current model · year unverified');
}
export function matchingModels(brand,query='',budget='all'){
 const norm=x=>x.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const q=norm(query.trim());
 return brand.models.filter(m=>(!q||norm(brand.name+' '+m.name+' '+(m.series||'')+' '+(m.aliases||[]).join(' ')).includes(q))&&(budget==='all'||(m.budget_bucket||'unknown')===budget));
}
export function selectionMetadata(brand,model,category){
 const prefix=category==='grinder'?'grinder':'brewer';
 const value={[prefix+'BrandID']:brand.id,[prefix+'ModelID']:model?.id||'general'};
 if(category==='grinder'&&model?.method_status==='verified'&&Array.isArray(model.methods)&&model.methods.length)value.grinderMethods=[...model.methods];
 return value;
}
export function safeSource(url){try{return new URL(url).protocol==='https:';}catch{return false;}}
