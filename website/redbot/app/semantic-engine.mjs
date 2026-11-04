// Local-only retrieval. Model scores are ranking signals, never applicability evidence.
export const MODEL='Xenova/paraphrase-multilingual-MiniLM-L12-v2';
export const REVISION='2c4055b12046f11709e9df2c122e59ffbdc2f900';
export const IDENTITY=`${MODEL}@${REVISION}:q8:mean:normalized:tokens100-overlap20:v1`;
export function chunks(text,tokenizer){
 const ids=tokenizer.encode(String(text||''),{add_special_tokens:false});
 const out=[];
 for(let i=0;i<ids.length;i+=80){out.push(tokenizer.decode(ids.slice(i,i+100),{skip_special_tokens:true}));if(i+100>=ids.length)break;}
 return out;
}
export async function digest(text){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');}
export class VectorCache{
 constructor(indexedDB){this.indexedDB=indexedDB;this.persistent=false;this.db=null;}
 async open(){try{this.db=await new Promise((resolve,reject)=>{const r=this.indexedDB.open('redbot-local-vectors',1);r.onupgradeneeded=()=>r.result.createObjectStore('vectors',{keyPath:'key'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('Cache blocked'));});this.persistent=true;}catch{this.persistent=false;}return this;}
 async operation(mode,fn){if(!this.db)return;try{return await new Promise((resolve,reject)=>{const tx=this.db.transaction('vectors',mode);const result=fn(tx.objectStore('vectors'));tx.oncomplete=()=>resolve(result?.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}catch{this.persistent=false;return;}}
 async get(key){return this.operation('readonly',s=>s.get(key));}
 async put(key,scope,vector){return this.operation('readwrite',s=>s.put({key,scope,vector}));}
 async prune(scope,keep){return this.operation('readwrite',s=>{const r=s.openCursor();r.onsuccess=()=>{const c=r.result;if(c){if(c.value.scope===scope&&(!keep||!keep.has(c.key)))c.delete();c.continue();}};});}
}
export async function retrieve({rows,query,scope,extractor,cache,progress=()=>{},cancelled=()=>false}){
 const check=()=>{if(cancelled())throw Error('Search cancelled. Completed batches are cached locally.');};
 const namespace=await digest(scope);const keep=new Set();let totalChunks=0,indexedChunks=0,cacheHits=0;const ranked=[];
 const qchunks=chunks(query,extractor.tokenizer);if(!qchunks.length)return {ranked:[],coverage:{rows:rows.length,totalChunks:0,indexedChunks:0,cacheHits:0,persistentCache:cache.persistent}};
 const q=[];for(let offset=0;offset<qchunks.length;offset+=4){check();q.push(...(await extractor(qchunks.slice(offset,offset+4),{pooling:'mean',normalize:true})).tolist());}
 for(let rowIndex=0;rowIndex<rows.length;rowIndex++){
  check();const row=rows[rowIndex],parts=chunks(row.text,extractor.tokenizer);totalChunks+=parts.length;let score=-Infinity,bestChunk=0;
  for(let offset=0;offset<parts.length;offset+=4){
   check();const batch=parts.slice(offset,offset+4);const keys=await Promise.all(batch.map(async text=>`${namespace}:${IDENTITY}:${await digest(text)}`));keys.forEach(k=>keep.add(k));
   const cached=await Promise.all(keys.map(k=>cache.get(k)));const missing=[];const vectors=cached.map((v,i)=>{if(v?.vector?.length===q[0].length&&v.vector.every(Number.isFinite)){cacheHits++;return v.vector;}missing.push(i);return null;});
   if(missing.length){const output=(await extractor(missing.map(i=>batch[i]),{pooling:'mean',normalize:true})).tolist();check();for(let j=0;j<missing.length;j++){const i=missing[j];vectors[i]=output[j];await cache.put(keys[i],namespace,output[j]);}}
   for(let i=0;i<vectors.length;i++)for(const queryVector of q){const value=vectors[i].reduce((s,v,j)=>s+v*queryVector[j],0);if(value>score){score=value;bestChunk=offset+i;}}
   indexedChunks+=batch.length;progress({rows:rowIndex+1,totalRows:rows.length,indexedChunks,totalChunks,cacheHits});
   await new Promise(r=>setTimeout(r,0));
  }
  if(parts.length)ranked.push({id:row.id,kind:row.kind,score,chunks:parts.length,bestChunk});
 }
 check();await cache.prune(namespace,keep);
 return {ranked:ranked.sort((a,b)=>b.score-a.score).slice(0,12),coverage:{rows:rows.length,totalChunks,indexedChunks,cacheHits,persistentCache:cache.persistent,complete:true}};
}
