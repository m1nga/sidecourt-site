// Discreet entrance anchored to the flower in the original Inside artwork.
(()=>{
 const scene=document.querySelector('[data-page="inside"]');if(!scene)return;
 const link=document.createElement('a');link.className='inside-agenda-ring';link.href='/secret/public/media/';link.rel='nofollow';link.setAttribute('aria-label','Ming’s marketing agenda');
 const img=document.createElement('img');img.src='/assets/ring-cream.svg';img.alt='';link.append(img);scene.append(link);
 const place=()=>{const w=scene.clientWidth,h=scene.clientHeight;if(!w||!h)return;const scale=Math.max(w/793,h/1983);link.style.left=((w-793*scale)/(w<=760?1:2)+654*scale)+'px';link.style.top=(1339*scale)+'px';};
 new ResizeObserver(place).observe(scene);place();
})();
