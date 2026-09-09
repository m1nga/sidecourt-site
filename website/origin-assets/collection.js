(() => {
'use strict';
const $=(selector,root=document)=>root.querySelector(selector);
const results=$('#drop-results'),search=$('#drop-search'),template=$('#drop-card-template');
let filter='all';
function render(){
 const term=search.value.trim().toLowerCase();
 const found=filter!=='needs'&&(!term||'cleanpause macos mac windows pc private preview x64 clean keyboard trackpad screen pause m1nga'.includes(term));
 if(found)results.replaceChildren(template.content.cloneNode(true));
 else results.innerHTML='<div class="empty"><h2>'+(filter==='needs'?'No open requests right now.':'No work found.')+'</h2><p>'+(filter==='needs'?'You can still try the work and save it for later.':'Try another word, or return to all works.')+'</p><button class="text-link" data-action="clear-filter">See all DROPS ↗</button></div>';
 document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===filter)));
}
function flip(button,active){button.classList.toggle('is-flipped',active);button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-label',(active?'Open the full introduction to ':'Read the introduction to ')+button.dataset.workName);$('.flip-reset',button.closest('.drop-card')).hidden=!active;}
search.addEventListener('input',render);
document.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.dataset.filter){filter=button.dataset.filter;render();return;}
 switch(button.dataset.action){
  case 'layout-grid':case 'layout-rows':{const rows=button.dataset.action==='layout-rows';results.classList.toggle('rows',rows);$('[data-action=layout-grid]').setAttribute('aria-pressed',String(!rows));$('[data-action=layout-rows]').setAttribute('aria-pressed',String(rows));break;}
  case 'clear-filter':filter='all';search.value='';render();search.focus();break;
  case 'find-collection':$('#collection').scrollIntoView({block:'start'});search.focus({preventScroll:true});break;
  case 'flip-drop':if(button.getAttribute('aria-pressed')==='true')location.assign(button.dataset.introduction);else flip(button,true);break;
  case 'flip-reset':{const cover=$('.flip-display',button.closest('.drop-card'));flip(cover,false);cover.focus();break;}
 }
});
results.addEventListener('pointerover',event=>{if(event.pointerType!=='mouse')return;const button=event.target.closest('.flip-display');if(button&&!button.contains(event.relatedTarget))flip(button,true);});
results.addEventListener('pointerout',event=>{if(event.pointerType!=='mouse')return;const button=event.target.closest('.flip-display');if(button&&!button.contains(event.relatedTarget))flip(button,false);});
results.addEventListener('keydown',event=>{if(event.key==='Escape'){const cover=event.target.closest('.drop-card')?.querySelector('.flip-display');if(cover){flip(cover,false);cover.focus();}}});
})();
