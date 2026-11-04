const CACHE='redbot-shell-1.9.4';
const FILES=['./','./index.html','./client.js','./client.css','./app.js','./check.js','./text.js','./vendor/opencc/t2cn.js','./check-ui.js','./core.js','./ai.js','./ai-worker.js','./semantic-engine.mjs','./style.css','./calm.css','./demo.js','./icon.svg','./manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES).then(()=>self.skipWaiting()))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('redbot-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.origin!==location.origin||e.request.method!=='GET')return;
 const shell=FILES.some(f=>new URL(f,registration.scope).pathname===u.pathname),vendor=u.pathname.startsWith(new URL('./vendor/',registration.scope).pathname);
 if(!shell&&!vendor)return;
 e.respondWith((async()=>{const cache=await caches.open(CACHE);try{const response=await fetch(e.request);if(response.ok)await cache.put(e.request,response.clone());return response;}catch{const saved=await cache.match(e.request,{ignoreSearch:true});if(saved)return saved;throw Error('Resource unavailable offline');}})());
});
