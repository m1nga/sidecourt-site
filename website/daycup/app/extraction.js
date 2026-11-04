// Offline, mass-based percolation measurement. No image/time-to-extraction model.
export const extractionSources = Object.freeze({
 chart: 'https://static1.squarespace.com/static/587af1d4db29d69a1a226b95/t/60aece65e4f2134d99f6e646/1622068839009/SCA%2BBrewing%2BChart%2B-%2BRevised%2BMarch%2B2019-US-Letter.pdf',
 science: 'https://sca.coffee/sca-news/coffee-decoded-14-dialling-in',
 research: 'https://coffeecenter.ucdavis.edu/news/uc-davis-coffee-center-contributes-research-new-brewing-control-chart',
 formula: 'https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0219906'
});
export const filterReference = Object.freeze({tdsPercent:Object.freeze([1.15,1.35]),extractionYieldPercent:Object.freeze([18,22]),source:extractionSources.chart,basis:'classic-filter-reference'});
const zh=language=>String(language).startsWith('zh');
const copy=(language,en,cn)=>zh(language)?cn:en;
const missing=x=>x===undefined||x===null||x==='';
const positive=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
const band=(n,[low,high])=>n<low?'below':n>high?'above':'within';

/** Recipe references only. V60 recipe.output means poured water, not collected beverage. */
export function extractionReference(recipe,language='en') {
 const method=recipe?.equipment?.method??recipe?.method;
 if(!['espresso','v60'].includes(method))throw new Error('Unsupported extraction method.');
 const valid=positive(recipe.dose)&&positive(recipe.output),ratio=valid?recipe.output/recipe.dose:null;
 return {
  method,ratio,ratioBasis:method==='v60'?'water-to-dose':'beverage-to-dose',
  title:copy(language,'Extraction reference','萃取参考'),
  ratioLabel:copy(language,method==='v60'?'Coffee : poured water':'Coffee : espresso yield',method==='v60'?'咖啡粉 : 注水量':'咖啡粉 : 浓缩液重'),
  ratioText:ratio===null?'—':`1:${Number(ratio.toFixed(2))}`,
  reference:method==='v60'?filterReference:null,
  note:copy(language,method==='v60'
   ?'Classic SCA filter reference: TDS 1.15–1.35%, extraction yield 18–22%. Your recipe ratio uses poured water; weigh the collected coffee separately for extraction measurement. This is a reference, not a taste score.'
   :'Espresso ratios describe dry coffee to espresso mass before water, ice or milk. The filter Golden Cup concentration range does not apply to espresso. Follow your bag recipe and measured taste.',
   method==='v60'?'SCA 经典滤泡参考：TDS 1.15–1.35%，萃取率 18–22%。配方比例使用注水量；测量萃取率需另称成杯咖啡液重。这是参考，不是口味评分。':'意式比例指干粉与加水、冰或奶之前的浓缩液重。滤泡金杯的浓度区间不适用于意式。以豆袋配方和实测口感为准。'),
  sources:[extractionSources.chart,extractionSources.science,extractionSources.research]
 };
}

/** TDS in percentage points (1.25 means 1.25%). Never pass Brix or a water-meter ppm reading.
 * beverageMassG must be the same undiluted collected brew as the TDS sample.
 * Optional values must be omitted/null/empty, never coerced from arbitrary strings.
 */
export function analyzeExtraction({method,doseG,beverageMassG,tdsPercent,waterMassG}={},language='en') {
 const errors=[];
 if(!['espresso','v60'].includes(method))errors.push(copy(language,'Choose espresso or V60.','请选择意式或 V60。'));
 if(!positive(doseG))errors.push(copy(language,'Enter a positive dry coffee dose in grams.','请输入大于零的干粉克重。'));
 for(const [value,en,cn] of [[beverageMassG,'Weigh collected coffee in grams.','请以克称量成杯咖啡液。'],[waterMassG,'Enter poured water in grams.','请输入注水克重。']])if(!missing(value)&&!positive(value))errors.push(copy(language,en,cn));
 if(!missing(tdsPercent)&&(!positive(tdsPercent)||tdsPercent>100))errors.push(copy(language,'Enter measured coffee TDS as a percentage, e.g. 1.25, not ppm or Brix.','请输入实测咖啡 TDS 百分数，例如 1.25；不能填 ppm 或 Brix。'));
 const hasBeverage=!missing(beverageMassG),hasTds=!missing(tdsPercent);
 if(hasTds&&!hasBeverage)errors.push(copy(language,'A TDS reading also needs the collected coffee mass.','填写 TDS 后，还需填写成杯咖啡液重。'));
 const ey=errors.length||!hasTds||!hasBeverage?null:beverageMassG*tdsPercent/doseG;
 if(ey!==null&&(!Number.isFinite(ey)||ey>100))errors.push(copy(language,'These measurements imply more dissolved coffee than the dry dose. Check mass and TDS units.','这些数据算出的溶解物超过干粉总重，请核对液重和 TDS 单位。'));
 const valid=!errors.length,extractionYieldPercent=valid?ey:null;
 return {
  valid,errors,status:!valid?'invalid':extractionYieldPercent===null?'ratio-only':'measured',
  beverageRatio:valid&&hasBeverage?beverageMassG/doseG:null,
  waterRatio:valid&&!missing(waterMassG)?waterMassG/doseG:null,
  tdsPercent:valid&&hasTds?tdsPercent:null,extractionYieldPercent,
  comparison:valid&&method==='v60'&&extractionYieldPercent!==null?{tds:band(tdsPercent,filterReference.tdsPercent),extraction:band(extractionYieldPercent,filterReference.extractionYieldPercent)}:null,
  note:copy(language,extractionYieldPercent===null
   ?'TDS is optional. Without a coffee refractometer reading and collected coffee mass, only ratios are available. Photos, flow and time cannot measure extraction yield.'
   :'Extraction yield = collected coffee mass × TDS% ÷ dry dose. Measure a representative, mixed sample with a coffee refractometer using its preparation instructions. Use the same undiluted brew for mass and TDS; the average does not reveal channeling or guarantee taste.',
   extractionYieldPercent===null?'TDS 可不填。没有咖啡折射仪读数和成杯液重，只显示比例；照片、流速和时间不能测得萃取率。':'萃取率 = 成杯咖啡液重 × TDS% ÷ 干粉量。按咖啡折射仪说明处理并测量混匀后的代表性样本；液重和 TDS 必须来自同一份未稀释咖啡。平均值不能揭示通道效应，也不保证好喝。'),
  sources:[extractionSources.formula,extractionSources.research]
 };
}
