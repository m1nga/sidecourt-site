// Explicit, local-only diagnostics: ?measure=1. No telemetry or account data is sent.
(() => {
 const route=(location.hash||'#home').slice(1).split('?')[0];
 const report={route,viewport:innerWidth,lcp:null,cls:0,ready:{},errors:[]};
 let output;
 function observe(type,consume){try{new PerformanceObserver(list=>list.getEntries().forEach(consume)).observe({type,buffered:true})}catch{}}
 observe('largest-contentful-paint',entry=>{report.lcp=Math.round(entry.startTime)});
 observe('layout-shift',entry=>{if(!entry.hadRecentInput)report.cls+=entry.value});
 function publish(){
  if(!output){output=document.createElement('output');output.id='performance-report';output.hidden=true;document.body.append(output)}
  const nav=performance.getEntriesByType('navigation')[0];
  report.navigation=nav?{ttfb:Math.round(nav.responseStart),domReady:Math.round(nav.domContentLoadedEventEnd),load:Math.round(nav.loadEventEnd),type:nav.type}:null;
  report.paint=Object.fromEntries(performance.getEntriesByType('paint').map(e=>[e.name,Math.round(e.startTime)]));
  report.resources=performance.getEntriesByType('resource').filter(e=>new URL(e.name).origin===location.origin).map(e=>({path:new URL(e.name).pathname,ms:Math.round(e.duration),end:Math.round(e.responseEnd),transfer:e.transferSize,body:e.encodedBodySize}));
  const stamp=(key,ready)=>{if(ready&&report.ready[key]===undefined)report.ready[key]=Math.round(performance.now())};
  stamp('fonts',document.fonts.status==='loaded');
  stamp('app',!!window.CourtApp);
  const scene=document.querySelector('.scene:not([hidden])');
  stamp('title',!!scene?.querySelector('h1')&&!!window.SC);
  const status=document.querySelector('#home-post-status')?.textContent||'';
  stamp('publicPosts',status&&!/Loading/.test(status));
  const court=document.querySelector('#court-content')?.textContent||'';
  stamp('account',route==='court'&&court&&!/Loading|Checking your saved session|Opening Your Court/.test(court));
  const art=scene?getComputedStyle(scene,'::before').backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1]:null;
  const resource=art?performance.getEntriesByName(art).at(-1):null;
  if(resource)report.background={path:new URL(art).pathname,downloadComplete:Math.round(resource.responseEnd)};
  output.textContent=JSON.stringify(report);
 }
 const start=()=>{publish();const timer=setInterval(publish,100);setTimeout(()=>{clearInterval(timer);publish()},20000)};
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start,{once:true}):start();
})();
