import {t,currentLanguage,setLanguage,languages} from './i18n.js';
import './i18n-extra.js';
import './iphone-feedback-i18n.js';
// Only this authored privacy document is translated. No library or user text is scanned.
export function localizePrivacy(root){
 const walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
 while((node=walk.nextNode())){const key=node.textContent.trim();if(key)node.textContent=node.textContent.replace(key,t(key));}
 root.lang=currentLanguage()==='zh'?'zh-CN':'en';
}
if(typeof document!=='undefined'&&document.querySelector('#privacy-page')&&!document.querySelector('#main')){
 const root=document.querySelector('#privacy-page');localizePrivacy(root);document.documentElement.lang=root.lang;
 document.title=t('DayCup — Privacy & your data');
 const button=document.createElement('button'),other=currentLanguage()==='zh'?'en':'zh';button.textContent=languages[other];button.onclick=()=>{setLanguage(other);location.reload();};root.prepend(button);
}
