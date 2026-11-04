/* Presentation-only conversion. Original saved evidence is never modified. */
(function(root){
  'use strict';
  const OpenCC=root.OpenCC||(typeof require==='function'?require('./vendor/opencc/t2cn.js'):null);
  const convert=OpenCC?.Converter({from:'tw',to:'cn'});
  function simplify(value){
    const raw=typeof value==='string'?value:'';
    if(!convert)return raw;
    // Code and links stay byte-for-byte; only human-readable prose is converted.
    return raw.split(/(```[\s\S]*?```|`[^`\n]*`|https?:\/\/[^\s<>]+)/g)
      .map((part,i)=>i%2?part:convert(part)).join('');
  }
  root.RedBotText={simplify};
  if(typeof module!=='undefined')module.exports=root.RedBotText;
})(typeof window==='undefined'?globalThis:window);
