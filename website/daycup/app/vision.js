import {t} from './i18n.js';
// Only selected images leave the browser, and only after a per-use disclosure.
export function photoRecognitionAvailable(){return !!globalThis.DAYCUP_NATIVE||!globalThis.DAYCUP_BUNDLE&&['127.0.0.1','localhost','[::1]'].includes(globalThis.location?.hostname);}
export function parseCoffeeLabel(text) {
 const lines=String(text).split(/\n/).map(x=>x.trim()).filter(Boolean),s=lines.join('\n');
 const explicit=(name)=>s.match(new RegExp('(?:^|\\n)(?:'+name+')\\s*[:：]\\s*([^\\n]+)','i'))?.[1]?.slice(0,200)||'';
 const roast=(/(?:^|\n)roast(?: level)?\s*[:：]\s*(light|medium|dark)\b/i.exec(s)?.[1]||/\b(light|medium|dark)[ -]roast\b/i.exec(s)?.[1]||'unknown').toLowerCase();
 const processes=['Washed','Natural','Honey','Anaerobic','Wet-hulled'].filter(v=>new RegExp('\\b'+v+'\\b','i').test(s));
 const notes=['Chocolate','Caramel','Nutty','Berry','Citrus','Stone fruit','Floral','Spice','Earthy'].filter(v=>new RegExp('\\b'+v+'\\b','i').test(s));
 return {name:explicit('coffee|name')||lines[0]?.slice(0,200)||'',roaster:explicit('roaster'),roast,origin:explicit('origin|country'),process:explicit('process|processing')||processes.join(' / '),batch:explicit('batch|roasted on|roast date'),notes,text:s.slice(0,4000)};
}
async function tmPhotoImage(file,maxWidth=1600,maxLength=1400000) {
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>15000000)throw Error(t("Choose a JPEG, PNG or WebP photo under 15 MB."));
 const url=await new Promise((ok,no)=>{const reader=new FileReader();reader.onload=()=>ok(reader.result);reader.onerror=()=>no(Error(t("This photo could not be read.")));reader.readAsDataURL(file);}),img=new Image();
 try{await new Promise((ok,no)=>{img.onload=ok;img.onerror=()=>no(Error(t("This photo could not be opened. Try another image.")));img.src=url;});
  if(img.width*img.height>60000000)throw Error(t("Choose an image smaller than 60 megapixels."));
  const scale=Math.min(1,maxWidth/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
  let quality=.85,result;do{result=canvas.toDataURL('image/jpeg',quality);quality-=.1;}while(result.length>maxLength&&quality>.15);
  if(result.length>maxLength)throw Error(t("Try a closer photo of the label."));return result;
 }finally{img.src='';}
}
export async function recognizeCoffeePhoto(file,kind='bean') {
 if(!photoRecognitionAvailable())throw Error(t("Photo recognition is available in the iPhone app. Enter details manually on the web."));
 if(!globalThis.DAYCUP_NATIVE&&!confirm(t("Read this photo with AI? Only the selected image is sent through DayCup to OpenAI. Your library is not uploaded. You will review the result before saving.")))throw Error(t("Photo reading cancelled. You can enter the label yourself."));
 const image=await tmPhotoImage(file),preview=await tmPhotoImage(file,640,240000);
 if(globalThis.DAYCUP_NATIVE) {
  const requestId=crypto.randomUUID();
  const text=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{delete globalThis.daycupVisionResults[requestId];reject(Error(t("Photo reading took too long. Try a clearer label or enter the details.")));},25000);
   globalThis.daycupVisionResults||={};globalThis.daycupVisionResults[requestId]=(result,error)=>{clearTimeout(timer);delete globalThis.daycupVisionResults[requestId];error?reject(Error(error)):resolve(result);};
   globalThis.webkit.messageHandlers.daycup.postMessage({action:'recognize',requestId,image});
  });return {...parseCoffeeLabel(text),image:preview};
 }
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
 try{const response=await fetch('/api/daycup/recognize',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({image,kind}),signal:controller.signal});
  const result=await response.json().catch(()=>({error:'Photo reading is not connected here yet. Your library is unchanged; you can enter the label yourself.'}));
  if(!response.ok)throw Error(result.error||'Photo reading is unavailable. Try again later or enter the label.');
  const fields=result.fields;if(!fields||typeof fields.text!=='string')throw Error(t("The photo result was incomplete. Enter the label or try a clearer photo."));
  return {...parseCoffeeLabel(fields.text),...fields,image:preview};
 }catch(error){if(error.name==='AbortError')throw Error(t("Photo reading timed out. Nothing was saved. Try again or enter the label."));throw error;}finally{clearTimeout(timer);}
}
export async function connectPhotoService(invite) {
 const response=await fetch('/api/daycup/session',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({invite})});
 const result=await response.json().catch(()=>({error:'Photo reading has not been connected to this web address yet.'}));
 if(!response.ok)throw Error(result.error||'Could not connect.');return result;
}
