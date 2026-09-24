// Deploy this directory at /secret/public/media/. No secret is built into public assets.
// A link can carry the page key in its fragment; fragments are not sent to GitHub Pages.
(() => {
  const gate=document.querySelector('#gate'), frame=document.querySelector('#desk');
  function open(key) {
    if(!/^[A-Za-z0-9_-]{16,200}$/.test(key)) {document.querySelector('#message').textContent='Use the complete private link or access key.';return;}
    frame.src='https://sidecourt-desk.pages.dev/'+encodeURIComponent(key)+'/';
    gate.hidden=true;frame.hidden=false;
    // Do not persist credentials in browser storage, public code or telemetry.
  }
  document.querySelector('#access').addEventListener('submit',e=>{e.preventDefault();open(document.querySelector('#key').value.trim());});
  function consumeLink(){if(location.hash.length>1) {const key=location.hash.slice(1);history.replaceState(null,'',location.pathname);open(key);}}
  window.addEventListener('hashchange',consumeLink);consumeLink();
})();
