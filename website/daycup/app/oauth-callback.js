// Only relay an authorization code to the same-origin window that opened this page.
// Tokens are exchanged by that window using its private one-use PKCE verifier.
const incoming=new URL(location.href),params=incoming.searchParams,fragment=new URLSearchParams(incoming.hash.slice(1)),attempt=params.get('attempt'),code=params.get('code'),error=params.has('error')||fragment.has('error');
history.replaceState(null,'',location.pathname);
const zh=navigator.language.startsWith('zh'),say=(en,cn)=>zh?cn:en,status=document.querySelector('#status'),detail=document.querySelector('#detail'),close=document.querySelector('#close');
document.documentElement.lang=zh?'zh-CN':'en';close.textContent=say('Close this window','关闭窗口');close.onclick=()=>window.close();
if((!incoming.hash||fragment.has('error')&&!code)&&params.getAll('attempt').length===1&&params.getAll('code').length<=1&&params.getAll('error').length<=1&&!(error&&code)&&(window.opener||globalThis.BroadcastChannel)&&/^[a-zA-Z0-9_-]{32,128}$/.test(attempt||'')&&(error||code&&code.length<=4096)){
 const result={type:'daycup-oauth',attempt,...(error?{error:true}:{code})};
 if(window.opener)window.opener.postMessage(result,location.origin);
 if(globalThis.BroadcastChannel){const channel=new BroadcastChannel('daycup-auth-'+attempt);channel.postMessage(result);setTimeout(()=>channel.close(),1000);}
 status.textContent=say(error?'Sign-in was cancelled':'Return to DayCup',error?'已取消登录':'返回 DayCup');detail.textContent=say('Your original window will finish the sign-in. You can close this window','原窗口会完成验证，你可以关闭此窗口');
}else{status.textContent=say('Open DayCup to sign in','请从 DayCup 开始登录');detail.textContent=say('This link needs the DayCup window where you started. Return there and try again','需要保留发起登录的 DayCup 窗口，请返回后重试');}
