/* Opt-in local embeddings. Only public model assets are fetched, never save text. */
import {pipeline,env} from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';
env.allowLocalModels=false;
env.backends.onnx.wasm.numThreads=1;
let extractor,loading;const vectors=new Map();
async function load(){
 if(!loading)loading=pipeline('feature-extraction','Xenova/paraphrase-multilingual-MiniLM-L12-v2',{revision:'2c4055b12046f11709e9df2c122e59ffbdc2f900',dtype:'q8',device:'wasm',progress_callback:p=>{if(p.status==='progress')postMessage({progress:'Downloading AI model: '+Math.round(p.progress||0)+'%'});}}).then(p=>extractor=p).catch(e=>{loading=null;throw e;});
 return loading;
}
self.onmessage=async({data:m})=>{try{
 await load();
 if(m.action==='load'){postMessage({id:m.id,ready:true});return;}
 const rows=m.rows.slice(0,300);const missing=rows.filter(r=>!vectors.has(r.text));
 for(let i=0;i<missing.length;i+=4){const batch=missing.slice(i,i+4);const out=await extractor(batch.map(x=>x.text),{pooling:'mean',normalize:true});out.tolist().forEach((v,j)=>vectors.set(batch[j].text,v));postMessage({progress:'Reading saved text: '+Math.min(i+4,missing.length)+' / '+missing.length});}
 const q=(await extractor(m.query,{pooling:'mean',normalize:true})).tolist()[0];
 const ranked=rows.map(r=>({id:r.id,kind:r.kind,score:vectors.get(r.text).reduce((s,v,i)=>s+v*q[i],0)})).sort((a,b)=>b.score-a.score);
 if(vectors.size>1000)vectors.clear();
 postMessage({id:m.id,ranked:ranked.slice(0,12)});
 }catch(e){postMessage({id:m.id,error:'The AI model could not run. Check your connection, device memory or browser support. Your library is unchanged.'});}};
