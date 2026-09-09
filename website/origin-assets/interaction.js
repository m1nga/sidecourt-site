(() => {
'use strict';
const $=(s,r=document)=>r.querySelector(s),demo=$('.origin-product-demo'),hold=$('[data-action=hold]'),start=$('[data-action=demo-start]'),save=$('[data-action=save]');
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
let safety,holdTimer,holdTick,toastTimer,typed='',typedAt=0;
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('toast-visible');toastTimer=setTimeout(()=>$('#toast').classList.remove('toast-visible'),4600);}
function cancelHold(){clearTimeout(holdTimer);clearInterval(holdTick);hold.classList.remove('holding');hold.style.removeProperty('--hold');}
function reset(){cancelHold();clearTimeout(safety);typed='';demo.dataset.mode='ready';$('.demo-cleaning',demo).hidden=true;start.hidden=false;$('.demo-message',demo).hidden=false;$('[data-action=demo-reset]',demo).hidden=true;$('.demo-status',demo).textContent='Browser preview · only this panel changes';}
function begin(){reset();demo.dataset.mode='cleaning';$('.demo-cleaning',demo).hidden=false;$('.demo-message',demo).hidden=true;start.hidden=true;$('[data-action=demo-reset]',demo).hidden=false;$('.demo-status',demo).textContent='Panel only. Type done, hold 3 seconds, or exit. Preview resets after 30 seconds.';hold.focus();safety=setTimeout(()=>{reset();toast('Preview reset. The real Mac app has a 30-minute safety limit.');},30000);}
function beginHold(){if(demo.dataset.mode!=='cleaning'||hold.classList.contains('holding'))return;hold.classList.add('holding');const began=Date.now();holdTick=setInterval(()=>hold.style.setProperty('--hold',Math.min((Date.now()-began)/3000,1)),40);holdTimer=setTimeout(()=>{reset();start.focus();},3000);}
start.addEventListener('click',begin);$('[data-action=demo-reset]').addEventListener('click',()=>{reset();start.focus();});
hold.addEventListener('pointerdown',e=>{if(e.button===0)beginHold();});hold.addEventListener('pointerleave',cancelHold);document.addEventListener('pointerup',cancelHold);document.addEventListener('pointercancel',cancelHold);
demo.addEventListener('keydown',e=>{if(e.key==='Escape'){reset();start.focus();return;}if(e.target===hold&&[' ','Enter'].includes(e.key)){e.preventDefault();if(!e.repeat)beginHold();}if(demo.dataset.mode==='cleaning'&&e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){const now=Date.now();typed=((now-typedAt>3000?'':typed)+e.key.toLowerCase()).slice(-4);typedAt=now;if(typed==='done'){reset();start.focus();}}});
hold.addEventListener('keyup',e=>{if([' ','Enter'].includes(e.key))cancelHold();});hold.addEventListener('blur',cancelHold);
const optionalDemo=demo.closest('details.optional-demo');
optionalDemo?.addEventListener('toggle',()=>{if(!optionalDemo.open)reset();});
window.addEventListener('blur',reset);document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
$('[data-action=cp-mistype]').addEventListener('click',e=>{if(reduced())return;$('.cp-mistype',e.currentTarget).animate([{transform:'translateX(0)'},{transform:'translateX(-5px)'},{transform:'translateX(5px)'},{transform:'translateX(-3px)'},{transform:'translateX(0)'}],{duration:480});});
$('[data-action=try-current-question]')?.addEventListener('click',()=>{demo.scrollIntoView({block:'center',behavior:reduced()?'instant':'smooth'});setTimeout(()=>start.focus({preventScroll:true}),reduced()?0:450);});
function saved(value){save.setAttribute('aria-pressed',String(value));save.textContent=value?'Saved in this browser ✓':'Save in this browser';}
try{saved(localStorage.getItem('sidecourt-cleanpause-saved')==='true');}catch{}
save.addEventListener('click',()=>{const value=save.getAttribute('aria-pressed')!=='true';try{localStorage.setItem('sidecourt-cleanpause-saved',String(value));saved(value);toast(value?'Saved in this browser.':'Removed from this browser.');}catch{toast('This browser could not save it. Bookmark this page to return.');}});
$('[data-action=share-work]').addEventListener('click',async()=>{const link='https://sidecourt.space/drops/cleanpause/';try{await navigator.clipboard.writeText(link);toast('Link copied.');}catch{toast('Copy this link: '+link);}});
if(!reduced()&&'IntersectionObserver' in window){document.body.classList.add('motion-ready');const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-in');observer.unobserve(e.target);}}),{threshold:.17});document.querySelectorAll('.reveal').forEach(e=>observer.observe(e));}
})();
