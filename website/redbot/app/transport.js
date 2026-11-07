/* Encrypted RedBot transport shared by the browser and the Mac relay. */
(() => {
  'use strict';
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const publicBytes = 65, nonceBytes = 12, tagBytes = 16;
  const maxRequestBytes = 64 * 1024, maxResponseBytes = 8 * 1024 * 1024;
  const algorithm = {name:'ECDH', namedCurve:'P-256'};

  function join(...parts) {
    const result = new Uint8Array(parts.reduce((total,part)=>total+part.byteLength,0));
    let offset = 0;
    for (const part of parts) {
      result.set(part,offset);
      offset += part.byteLength;
    }
    return result;
  }

  function publicKeyBytes(encoded) {
    if (typeof encoded!=='string' || !/^[A-Za-z0-9_-]{87}$/.test(encoded)) throw Error('invalid_reader_key');
    const bytes = Uint8Array.from(atob(encoded.replaceAll('-','+').replaceAll('_','/')+'='),c=>c.charCodeAt(0));
    if (bytes.byteLength!==publicBytes || bytes[0]!==4) throw Error('invalid_reader_key');
    return bytes;
  }

  async function channel(privateKey, rawPublicKey, nonce) {
    const publicKey = await crypto.subtle.importKey('raw',rawPublicKey,algorithm,false,[]);
    const shared = await crypto.subtle.deriveBits({name:'ECDH',public:publicKey},privateKey,256);
    const root = await crypto.subtle.importKey('raw',shared,'HKDF',false,['deriveKey']);
    const key = label => crypto.subtle.deriveKey(
      {name:'HKDF',hash:'SHA-256',salt:nonce,info:encoder.encode('redbot-bridge-v1/'+label)},
      root,{name:'AES-GCM',length:256},false,['encrypt','decrypt']
    );
    const [request,response] = await Promise.all([key('request'),key('response')]);
    return {request,response};
  }

  async function wrapRequest(readerKey, request) {
    const ephemeral = await crypto.subtle.generateKey(algorithm,true,['deriveBits']);
    const raw = new Uint8Array(await crypto.subtle.exportKey('raw',ephemeral.publicKey));
    const nonce = crypto.getRandomValues(new Uint8Array(nonceBytes));
    const keys = await channel(ephemeral.privateKey,publicKeyBytes(readerKey),nonce);
    const input = encoder.encode(JSON.stringify({...request,at:Date.now()}));
    if (input.byteLength+publicBytes+nonceBytes+tagBytes>maxRequestBytes) throw Error('request_too_large');
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},keys.request,input));
    return {bytes:join(raw,nonce,ciphertext),key:keys.response};
  }

  async function unwrapRequest(privateKey, bytes) {
    if (bytes.byteLength<=publicBytes+nonceBytes+tagBytes || bytes.byteLength>maxRequestBytes) throw Error('invalid_request');
    const nonce = bytes.subarray(publicBytes,publicBytes+nonceBytes);
    const keys = await channel(privateKey,bytes.subarray(0,publicBytes),nonce);
    const input = await crypto.subtle.decrypt({name:'AES-GCM',iv:nonce},keys.request,bytes.subarray(publicBytes+nonceBytes));
    const request = JSON.parse(decoder.decode(input));
    if (!Number.isSafeInteger(request.at) || Math.abs(Date.now()-request.at)>60_000) throw Error('expired_request');
    return {request,key:keys.response};
  }

  async function wrapResponse(key, status, body, gzip = false) {
    if (body.byteLength>maxResponseBytes) throw Error('response_too_large');
    const nonce = crypto.getRandomValues(new Uint8Array(nonceBytes));
    const input = join(encoder.encode(String(status)+(gzip?'1':'0')),body);
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},key,input));
    return join(nonce,ciphertext);
  }

  async function unwrapResponse(key, bytes) {
    if (bytes.byteLength<=nonceBytes+tagBytes+4 || bytes.byteLength>maxResponseBytes+nonceBytes+tagBytes+4) throw Error('invalid_reader_response');
    const nonce = bytes.subarray(0,nonceBytes);
    const decrypted = new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:nonce},key,bytes.subarray(nonceBytes)));
    const status = Number(decoder.decode(decrypted.subarray(0,3)));
    if (!Number.isInteger(status) || (status!==200 && (status<400 || status>599))) throw Error('invalid_reader_response');
    const flag = decrypted[3];
    if (flag!==48 && flag!==49) throw Error('invalid_reader_response');
    const bytesBody = decrypted.subarray(4);
    const body = flag===49 ? new Response(bytesBody).body.pipeThrough(new DecompressionStream('gzip')) : bytesBody;
    return new Response(body,{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  }

  async function encryptedFetch(root,path,options,readerKey) {
    const headers = new Headers(options.headers);
    const innerHeaders = Object.fromEntries(
      ['authorization','content-type','x-sidecourt-token'].filter(name=>headers.has(name)).map(name=>[name,headers.get(name)])
    );
    if (globalThis.location?.origin) innerHeaders.origin = globalThis.location.origin;
    const wrapped = await wrapRequest(readerKey,{method:options.method||'GET',path,headers:innerHeaders,body:options.body,acceptGzip:typeof DecompressionStream==='function'});
    const response = await fetch(root+'/bridge/v1',{
      method:'POST',body:wrapped.bytes,signal:options.signal,cache:'no-store',redirect:'error',
      credentials:'omit',referrerPolicy:'no-referrer'
    });
    if (!response.ok) {
      // An untrusted transport error must never impersonate an inner session-expired response.
      return Response.json({error:'reader_unavailable'},{status:503});
    }
    return unwrapResponse(wrapped.key,new Uint8Array(await response.arrayBuffer()));
  }

  if (typeof module==='object' && module.exports) {
    module.exports = {wrapRequest,unwrapRequest,wrapResponse,unwrapResponse,maxRequestBytes,maxResponseBytes,publicBytes,nonceBytes};
  } else {
    globalThis.RedBotTransport = {fetch:encryptedFetch};
  }
})();
