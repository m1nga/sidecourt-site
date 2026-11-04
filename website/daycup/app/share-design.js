// Private composition data. Stored separately from the measured brew.
const legacyFields=['bean','dose','output','time','gear','origin','grind','taste','date','note','brand'];
export const shareFields=['brand','bean','taste','dose','output','time','machine','grinder','origin','grind','date','note','gear'];
export function defaultShareDesign(){return {version:4,logo:{x:.82,y:.14,scale:1,rotation:0},format:'portrait',photo:'',scene:'',background:{x:0,y:0,scale:1,rotation:0,flip:false,shade:.3},sticker:{x:.5,y:.5,scale:1,rotation:0,color:'#302c26',opacity:1,font:'serif',align:'left'},fields:Object.fromEntries(shareFields.map(id=>[id,{visible:['bean','taste','dose','output','time'].includes(id),x:0,y:0,scale:1,rotation:0,color:'',opacity:1,text:null}])),mood:'today',note:''};}
// Read old backups without mutating them. Preserve custom text and transforms.
export function normalizeShareDesign(value){
 validateShareDesign(value);const p=JSON.parse(JSON.stringify(value));if(p.version===4)return p;
 const d=defaultShareDesign();Object.assign(d,p,{version:4,scene:p.scene||'',logo:d.logo,fields:{...d.fields,...p.fields}});
 if(d.fields.brand.text===null)d.fields.brand.visible=false;
 if(p.version>=2)return d;
 const taste=p.fields.taste;if(!taste.visible&&taste.text===null&&taste.x===0&&taste.y===0&&taste.scale===1&&taste.rotation===0&&taste.color===''&&taste.opacity===1)d.fields.taste.visible=true;
 const gear=p.fields.gear;if(gear.visible&&gear.text===null){for(const id of ['machine','grinder'])d.fields[id]={...gear};d.fields.gear.visible=false;}
 return d;
}
export function validateShareDesign(p){
 const bad=()=>{throw Error('This share design is incomplete. Keep your original backup.');};
 const num=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
 if(!p||![1,2,3,4].includes(p.version)||!['portrait','story','square'].includes(p.format)||typeof p.photo!=='string'||p.photo.length>240000||p.photo&&!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(p.photo)||!['today','keeper','dialing','exploring'].includes(p.mood)||typeof p.note!=='string'||p.note.length>64)bad();
 if(p.version>=3&&(typeof p.scene!=='string'||p.scene!==''&&!/^[a-z0-9-]{1,50}$/.test(p.scene)||p.scene&&p.photo))bad();
 const b=p.background,s=p.sticker;if(!b||!s||!num(b.x,-1,1)||!num(b.y,-1,1)||!num(b.scale,1,4)||!num(b.rotation,-180,180)||typeof b.flip!=='boolean'||!num(b.shade,0,.85)||!num(s.x,0,1)||!num(s.y,0,1)||!num(s.scale,.25,1.5)||!num(s.rotation,-180,180)||!/^#[0-9a-f]{6}$/i.test(s.color)||!num(s.opacity,.1,1)||!['serif','sans','mono'].includes(s.font)||!['left','center','right'].includes(s.align))bad();
 if(p.version===4&&(!p.logo||!num(p.logo.x,0,1)||!num(p.logo.y,0,1)||!num(p.logo.scale,.65,1.8)||!num(p.logo.rotation,-180,180)))bad();
 const fields=p.version===1?legacyFields:shareFields;
 if(!p.fields||Object.keys(p.fields).length!==fields.length)bad();
 for(const id of fields){const f=p.fields[id];if(!f||typeof f.visible!=='boolean'||!num(f.x,-500,500)||!num(f.y,-700,700)||!num(f.scale,.4,2.5)||!num(f.rotation,-180,180)||typeof f.color!=='string'||f.color!==''&&!/^#[0-9a-f]{6}$/i.test(f.color)||!num(f.opacity,0,1)||f.text!==null&&(typeof f.text!=='string'||f.text.length>240))bad();}
 return p;
}
export function shareHeight(format){return {portrait:1350,story:1920,square:1080}[format]||1350;}
export function sharePoint(x,y,box){const a=-(box.rotation||0)*Math.PI/180,dx=x-box.x,dy=y-box.y;return {x:(Math.cos(a)*dx-Math.sin(a)*dy)/box.scale,y:(Math.sin(a)*dx+Math.cos(a)*dy)/box.scale};}
