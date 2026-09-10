(() => {
'use strict';
const section=document.querySelector('.work-participation'),form=section.querySelector('#feedback-form'),input=form.querySelector('textarea'),status=form.querySelector('.draft-status');
const key='sidecourt-comment-draft-v1:'+encodeURIComponent(form.dataset.workId);
let edited=false,storageUnavailable=false;
function tell(message){if(status.textContent!==message)status.textContent=message;}
function restore(){
 try{const draft=localStorage.getItem(key);if(draft!==null){input.value=draft;tell(draft?'Draft restored in this browser.':'Draft in this browser.');}storageUnavailable=false;}
 catch{storageUnavailable=true;tell('Browser storage is unavailable. Keep this page open and copy your text before leaving.');}
}
function saveDraft(){
 try{localStorage.setItem(key,input.value);storageUnavailable=false;tell('Draft saved in this browser.');return true;}
 catch{storageUnavailable=true;tell('Could not save in this browser. Your text is still here; copy it before leaving.');return false;}
}
function panel(name){
 if(!['comments','involved','updates'].includes(name))return;
 section.querySelectorAll('[data-work-panel]').forEach(p=>p.hidden=p.dataset.workPanel!==name);
 section.querySelectorAll('[data-action=work-panel]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.panel===name)));
}
function join(){panel('comments');section.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});input.focus({preventScroll:true});}
form.addEventListener('submit',event=>{event.preventDefault();saveDraft();});
input.addEventListener('input',()=>{edited=true;saveDraft();});
section.querySelectorAll('[data-action=work-panel]').forEach(button=>button.addEventListener('click',()=>panel(button.dataset.panel)));
document.querySelector('[data-action=join-conversation]').addEventListener('click',join);
section.querySelector('[data-action=respond-invitation]')?.addEventListener('click',join);
form.querySelector('[data-action=copy-comment-draft]').addEventListener('click',async()=>{
 if(!input.value.trim()){tell('Write something before copying.');input.focus();return;}
 try{await navigator.clipboard.writeText(input.value);tell(storageUnavailable?'Draft copied. Browser storage is still unavailable; not posted or sent.':'Draft copied. Not posted or sent.');}
 catch{panel('comments');input.focus();input.select();tell(storageUnavailable?'Copy failed and browser storage is unavailable. Text selected for manual copying.':'Copy failed. Text selected for manual copying.');}
});
restore();
// Enable editing only after the local-only submit handler is installed.
input.disabled=false;form.querySelectorAll('button').forEach(button=>button.disabled=false);
window.addEventListener('pagehide',()=>{if(edited)saveDraft();});
window.addEventListener('pageshow',()=>{if(!edited&&!input.value)restore();});
})();
