import {t} from './i18n.js';
// Added water, ice and milk only. Extraction dose/yield/time keep their own strict rules.
export function servingMeasurementKeys(drink){return {americano:['waterG'],'iced-americano':['waterG','iceG'],milk:['milkG']}[drink]||[];}
export function servingMeasurementLabel(drink,key){return key==='milkG'?t('Milk'):key==='iceG'?t('Ice'):t(drink==='americano'?'Hot water':'Cold water');}
export function servingAmountsMeasured(drink,feedback){
 const keys=servingMeasurementKeys(drink);
 return keys.length>0&&keys.every(key=>typeof feedback[key]==='number'&&Number.isFinite(feedback[key])&&(!feedback.servingMeasurements||feedback.servingMeasurements[key]==='measured'));
}
export function readServingMeasurements(drink,formData){
 const keys=servingMeasurementKeys(drink);if(!keys.length)return {};
 const result={servingMeasurements:{}};
 for(const key of keys){
  const mode=formData.get(key+'Mode');
  if(!['unmeasured','estimated','measured'].includes(mode))throw Error(t('Choose how you recorded the added amount.'));
  result.servingMeasurements[key]=mode;
  if(mode==='unmeasured')continue;
  const raw=formData.get(key);
  if(typeof raw!=='string'||!raw.trim())throw Error(t('Enter an amount, or choose By feel.'));
  const amount=Number(raw);
  if(!Number.isFinite(amount)||amount<0||amount>2000)throw Error(t('Use an amount from 0 to 2000 g.'));
  result[key]=amount;
 }
 // Hot Americano has no ice; do not ask people to enter a redundant zero.
 if(drink==='americano')result.iceG=0;
 return result;
}
export function validateServingMeasurements(drink,feedback){
 const modes=feedback.servingMeasurements;if(modes===undefined)return;
 const keys=servingMeasurementKeys(drink),bad=()=>{throw Error(t('Invalid added-amount record.'));};
 if(!keys.length||!modes||typeof modes!=='object'||Array.isArray(modes)||Object.keys(modes).length!==keys.length||Object.keys(modes).some(key=>!keys.includes(key)))bad();
 for(const key of keys){
  const mode=modes[key],amount=feedback[key];
  if(!['unmeasured','estimated','measured'].includes(mode))bad();
  if(mode==='unmeasured'){if(amount!==undefined)bad();}
  else if(typeof amount!=='number'||!Number.isFinite(amount)||amount<0||amount>2000)bad();
 }
 if(feedback.servingConfirmed&&!servingAmountsMeasured(drink,feedback))bad();
 if(drink==='americano'&&feedback.iceG!==0)bad();
}
export function servingMeasurementSummary(drink,feedback){
 return servingMeasurementKeys(drink).map(key=>{
  const mode=feedback.servingMeasurements?.[key],amount=feedback[key];
  if(mode==='unmeasured')return servingMeasurementLabel(drink,key)+': '+t('By feel');
  if(typeof amount!=='number'||!Number.isFinite(amount))return '';
  return servingMeasurementLabel(drink,key)+': '+(mode==='estimated'?'≈ ':'')+amount+' '+t('g');
 }).filter(Boolean).join(' · ');
}
