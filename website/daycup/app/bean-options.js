import {t,hasTranslation} from './i18n.js';
// Metadata choices only: choosing an origin or process never infers a recipe.
export function searchable(value){return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,'').toLowerCase();}
export function originChoices(directory,query=''){
 const terms=searchable(query).trim().split(/\s+/).filter(Boolean);
 return directory.origins.map(origin=>{
  const all=[{value:origin.country,label:t('Country / origin only'),search:origin.country+' '+t(origin.country)},...origin.regions.map(region=>({value:origin.country+' · '+region,label:t(region),search:origin.country+' · '+region+' '+t(origin.country)+' '+t(region)}))];
  // Search matches the stored English value and the translated names, so 云南 finds Yunnan in Chinese mode.
  return {country:origin.country,choices:all.filter(choice=>terms.every(term=>searchable(choice.search).includes(term)))};
 }).filter(group=>group.choices.length);
}
// Stored origins stay English ('China · Yunnan'); display each part in the active language.
export function originLabel(value){
 const text=String(value||'');if(!text)return '';
 const [country,...rest]=text.split(' · '),region=rest.join(' · ');
 if(!region)return t(country);
 return t(country)+' · '+(hasTranslation(region)?t(region):rest.map(part=>t(part)).join(' · '));
}
export function processChoices(directory,query=''){
 const terms=searchable(query).trim().split(/\s+/).filter(Boolean);
 return directory.processes.filter(item=>terms.every(term=>searchable(item.label+' '+item.detail+' '+t(item.label)+' '+t(item.detail)).includes(term)));
}
export function localToday(date=new Date()){
 return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
}
