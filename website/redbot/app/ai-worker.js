/* Save text is processed locally. Only pinned public model assets use the network. */
import {MODEL,REVISION,VectorCache,retrieve,digest} from './semantic-engine.mjs';
let extractor,loading,cache;const cancelled=new Set();let queue=Promise.resolve();
async function load(){
 if(!loading)loading=(async()=>{
  // Vendored verified distribution; no runtime CDN JavaScript execution.
  const {pipeline,env}=await import('./vendor/transformers/transformers.min.js');
  env.allowLocalModels=false;env.backends.onnx.wasm.numThreads=1;
  env.backends.onnx.wasm.wasmPaths=new URL('./vendor/transformers/',import.meta.url).href;
  extractor=await pipeline('feature-extraction',MODEL,{revision:REVISION,dtype:'q8',device:'wasm',progress_callback:p=>{const download={status:String(p.status||''),file:String(p.file||'').split('/').pop(),progress:Number.isFinite(p.progress)?Math.round(p.progress):null,loaded:Number.isFinite(p.loaded)?p.loaded:null,total:Number.isFinite(p.total)?p.total:null};postMessage({progress:'Downloading AI model: '+(download.progress===null?download.status:download.progress+'%'),download});}});
  cache=await new VectorCache(self.indexedDB).open();return extractor;
 })().catch(e=>{loading=null;throw e;});
 return loading;
}
self.onmessage=({data:m})=>{
 if(m.action==='cancel'){cancelled.add(m.target);return;}
 queue=queue.then(async()=>{try{
  if(m.action==='clearCache'){cache||=await new VectorCache(self.indexedDB).open();await cache.prune(await digest(m.scope));postMessage({id:m.id,cleared:cache.persistent});return;}
  await load();if(cancelled.has(m.id))throw Error('Search cancelled.');
  if(m.action==='load'){postMessage({id:m.id,ready:true});return;}
  const result=await retrieve({...m,extractor,cache,cancelled:()=>cancelled.has(m.id),progress:p=>postMessage({id:m.id,progress:`Reading saved text: ${p.rows} / ${p.totalRows} saves; ${p.indexedChunks} chunks`,coverage:p})});
  postMessage({id:m.id,...result});
 }catch(e){postMessage({id:m.id,error:cancelled.has(m.id)?'Search cancelled. Completed batches are cached locally.':'The local AI model could not run. Check model downloads, device memory or browser support. Basic search is still available.'});}finally{cancelled.delete(m.id);}});
};
