// Shipped artwork only. No runtime generation, account or photo upload.
let sceneCatalog;
export async function shareBackgrounds(){
 if(!sceneCatalog)sceneCatalog=(async()=>{
  const bundle=globalThis.DAYCUP_BUNDLE?.backgrounds;
  const rows=bundle||(await (await fetch('./backgrounds/manifest.json')).json()).backgrounds;
  if(!Array.isArray(rows)||rows.length<1||rows.length>50)throw Error('Background collection unavailable');
  return rows.map(row=>{
   if(!/^[a-z0-9-]+$/.test(row.id)||!/^\d\d-[a-z0-9-]+\.jpg$/.test(row.filename))throw Error('Invalid background');
   return {...row,src:bundle?row.data:new URL('./backgrounds/'+row.filename,document.baseURI).href};
  });
 })().catch(error=>{sceneCatalog=null;throw error;});
 return sceneCatalog;
}
export async function shareBackgroundSource(design){
 if(design.photo)return design.photo;
 if(!design.scene)return '';
 const scene=(await shareBackgrounds()).find(item=>item.id===design.scene);
 if(!scene)throw Error('This background is unavailable. Your saved design is unchanged.');
 return scene.src;
}
