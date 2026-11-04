// The existing DayCup app artwork is the source of truth, never a generated substitute.
let logoAsset, logoPending;
export async function loadShareLogo(){
 if(logoAsset)return logoAsset;
 if(!logoPending)logoPending=new Promise((resolve,reject)=>{
  const image=new Image();image.onload=()=>{logoAsset=image;resolve(image);};
  image.onerror=()=>reject(Error('The DayCup logo could not load. Please try again.'));
  image.src=globalThis.DAYCUP_BUNDLE?.logo||new URL('./icon-512.png',document.baseURI).href;
 }).catch(error=>{logoPending=null;throw error;});
 return logoPending;
}
export function loadedShareLogo(){if(!logoAsset)throw Error('The DayCup logo could not load. Please try again.');return logoAsset;}
export function shareLogoBox(design,width,height){
 const a=design.logo,w=200,h=200*386/333,scale=a.scale,rotation=a.rotation,angle=rotation*Math.PI/180;
 const halfX=(Math.abs(Math.cos(angle))*w+Math.abs(Math.sin(angle))*h)*scale/2;
 const halfY=(Math.abs(Math.sin(angle))*w+Math.abs(Math.cos(angle))*h)*scale/2;
 const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
 return {id:'logo',x:clamp(a.x*width,halfX+24,width-halfX-24),y:clamp(a.y*height,halfY+24,height-halfY-24),w,h,scale,rotation};
}
export function drawShareLogo(context,image,box){
 context.save();context.translate(box.x,box.y);context.rotate(box.rotation*Math.PI/180);context.scale(box.scale,box.scale);
 context.globalAlpha=1;context.shadowColor='rgba(0,0,0,.15)';context.shadowBlur=8;
 // Crop only the packaging surround; wordmark, three beans and slogan remain the original pixels.
 context.drawImage(image,88,65,333,386,-box.w/2,-box.h/2,box.w,box.h);context.restore();
}
