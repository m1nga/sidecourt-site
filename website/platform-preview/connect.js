/* Uses the existing SideCourt session. Never writes or displays credentials. */
'use strict';
(async()=>{
 const $=id=>document.getElementById(id),cfg=window.SIDECOURT_CONFIG||{};
 const status=text=>{$('status').textContent=text;};
 const prod='https://rwbwfokdipabwjparcwy.supabase.co',review='https://enoidjoytplapekhyxye.supabase.co';
 const base=cfg.supabaseUrl+'/functions/v1/sidecourt-mcp',resource=base+'/mcp';
 const storageKey=cfg.authStorageKey||'sidecourt-auth-v1';
 let ctx=null,request=null,works=[],currentBearer='',currentUser='',busy=false,checking=false;
 function session(){try{return JSON.parse(localStorage.getItem(storageKey)||'null')}catch{return null}}
 function bearer(){const token=session()?.access_token;return typeof token==='string'?'Bearer '+token:'';}
 async function post(path,data,auth=''){
  const r=await fetch(base+path,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',...(auth?{Authorization:auth}:{})},body:JSON.stringify(data),cache:'no-store',signal:AbortSignal.timeout(25000)});
  const d=await r.json();if(!r.ok)throw Error(d.error||'REQUEST_FAILED');return d;
 }
 function allowedRedirect(raw){const u=new URL(raw),v=new URL(ctx.redirect_uri);if(u.origin!==v.origin||u.pathname!==v.pathname||u.username||u.password||u.hash||u.searchParams.get('state')!==ctx.state||u.searchParams.get('iss')!==ctx.issuer)throw Error('INVALID_REDIRECT');return u;}
 function refreshPermissions(){const w=works.find(w=>w.id===$('work').value);for(const scope of ['edit','upload','submit']){$(scope).disabled=!ctx.scopes.includes(scope)||(scope==='submit'&&!w?.is_owner);if($(scope).disabled)$(scope).checked=false;}$('approve').disabled=!w||busy;}
 async function check(){
  if(!ctx||busy||checking)return;checking=true;$('form').hidden=true;currentBearer='';
  const auth=bearer();
  if(!auth){$('login').hidden=false;$('identity').textContent='';status('Sign in to choose a work.');checking=false;return;}
  try{
   const me=await fetch(cfg.supabaseUrl+'/auth/v1/user',{headers:{apikey:cfg.publishableKey,Authorization:auth},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
   if(!me.ok)throw Error('SIGN_IN_REQUIRED');const user=await me.json();
   const choices=await post('/choices',{},auth);
   if(bearer()!==auth)throw Error('SESSION_CHANGED');
   if(!Array.isArray(choices))throw Error('REQUEST_FAILED');
   if(currentUser!==user.id){for(const scope of ['edit','upload','submit'])$(scope).checked=false;currentUser=user.id;}
   works=choices;currentBearer=auth;$('identity').textContent='Signed in as '+(user.email||'your SideCourt account');$('login').hidden=true;
   $('work').replaceChildren();for(const w of works){const option=document.createElement('option');option.value=w.id;option.textContent=w.title||'Untitled work';$('work').append(option);}
   $('form').hidden=!works.length;refreshPermissions();
   status(works.length?'Choose one work and review the permissions.':'No eligible work is available in this account. Open SideCourt to create or restore your work, then check again.');
  }catch(e){$('login').hidden=false;$('identity').textContent='';status(e.message==='SIGN_IN_REQUIRED'?'Sign in to SideCourt again, then check sign-in.':e.message==='SESSION_CHANGED'?'Your account changed. Check sign-in again.':'The connection check failed. Your work is unchanged. Check sign-in or retry after the network recovers.');}
  finally{checking=false;}
 }
 try{
  if(window.top!==window.self)throw Error('FRAME_NOT_ALLOWED');
  if(![prod,review].includes(cfg.supabaseUrl)||!cfg.publishableKey||(cfg.supabaseUrl===prod&&location.origin!=='https://sidecourt.space')||(cfg.supabaseUrl===review&&location.origin!=='https://m1nga.github.io'))throw Error('CONFIGURATION_MISMATCH');
  $('environment').textContent=cfg.supabaseUrl===review?'REVIEW ENVIRONMENT — not your production works.':'SideCourt production';
  $('endpoint').value=resource;$('cmd-claude').textContent='claude mcp add --transport http sidecourt '+resource;$('cmd-codex').textContent='codex mcp add sidecourt --url '+resource;$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(resource);status('Connection address copied.');}catch{$('endpoint').focus();$('endpoint').select();status('Copy the selected connection address.');}};
  const params=new URLSearchParams(location.search);
  if(!params.has('client_id')){$('setup').hidden=false;status('Add this connection in your AI client to begin.');return;}
  if([...params.keys()].some(k=>params.getAll(k).length!==1))throw Error('INVALID_REQUEST');
  request=Object.fromEntries(params);ctx=await post('/authorize-context',request);
  $('consent').hidden=false;$('client-title').textContent='Connect '+ctx.client_name+' to one work';
  $('intro').textContent='Review the work, permissions and expiry before connecting '+ctx.client_name+'.';
  $('cancel').onclick=()=>{if(busy)return;const u=new URL(ctx.redirect_uri);u.searchParams.set('error','access_denied');u.searchParams.set('state',ctx.state);u.searchParams.set('iss',ctx.issuer);location.assign(allowedRedirect(u.href).href);};
  $('check').onclick=check;$('recheck').hidden=false;$('recheck').onclick=check;$('work').onchange=refreshPermissions;
  $('form').onsubmit=async event=>{
   event.preventDefault();if(busy||!currentBearer)return;
   if(currentBearer!==bearer()){status('Your session changed. Check sign-in again.');await check();return;}
   busy=true;$('approve').disabled=true;$('cancel').disabled=true;status('Creating only the permissions you approved…');
   try{
    const scopes=['read',...['edit','upload','submit'].filter(s=>$(s).checked&&!$(s).disabled)];
    const r=await post('/authorize',{request,work_id:$('work').value,scopes,expires_hours:Number($('duration').value)},currentBearer);
    if(currentBearer!==bearer())throw Error('SESSION_CHANGED');
    const u=allowedRedirect(r.redirect);if(!/^sc_code_[a-f0-9]{64}$/.test(u.searchParams.get('code')||''))throw Error('INVALID_REDIRECT');location.assign(u.href);
   }catch{status('Approval did not complete or its result is unknown. Do not keep retrying. Check Connected tools in SideCourt and revoke an unwanted pending grant before starting again.');}
   finally{busy=false;$('cancel').disabled=false;refreshPermissions();}
  };
  window.addEventListener('focus',check);window.addEventListener('storage',event=>{if(event.key===storageKey)check();});await check();
 }catch{status('This connection request or site configuration is invalid. Return to your AI client and start a new connection. No access has been granted.');$('form').hidden=true;}
})();
