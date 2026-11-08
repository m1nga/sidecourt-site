/* RedBot saved-content client. User text is never passed through translation. */
(() => {
  'use strict';
  const C = ShelfCore, R = RedBotCheck, Q = RedBotQuick, APP_VERSION = '1.14.0';
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stored = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const t = (zh, en) => lang === 'zh' ? zh : en;
  let lang = stored('redbot.language', 'zh');
  let credentials = stored('redbot.connection', null), config = {}, status = null;
  let offlineKey = stored('redbot.offline-key', null);
  let data = {version:1, items:[], annotations:{}, collections:[], guides:[], goalState:{}};
  let tab = 'home', goal = '', choice = '', query = '', filter = 'all', topic = '', collection = '', sort = 'position', limit = 60;
  let answer = null, working = false, ai = stored('redbot.semantic', false), aiReady = false, auto = stored('redbot.auto', true);
  let detailId = null, requestActive = false, lastJob = '', lastFetch = '', initial = true;
  let libraryPage = null, recentPending = true, pollSoon = () => {};
  let toastTimer, dialogFocus, db;
  const reads = new Map();
  let readEpoch = 0, statusSnapshot = {epoch:0,startedAt:0};
  let latestVersion = '', versionCheckedAt = 0, aiLoadGeneration = 0;
  let userInteracted = false, automaticUpdateAttempted = false;
  let onboarding = false, offline = false, startedAt = 0, connectionError = '';
  let bootstrapPending, configValidated = false, configCheckedAt=0;
  let sidecourtSession=null, accountPending=false, ideaLimit=3;
  const intelligence=new Map(), consumedJobs=new Set();
  let searchGeneration=0, searchProgress='', searchCoverage=null, videoStartedAt=0;
  let invitation = new URLSearchParams(location.hash.slice(1)).get('invite') || '';
  if (invitation) history.replaceState(null, '', location.pathname + location.search);

  const topics = {'Design':'设计','AI & tools':'AI 与工具','Creative':'创作','Marketing':'推广','Food & coffee':'美食与咖啡','Fitness':'健身','Life':'生活','Film & culture':'影视与文化','Finance':'财经','Parenting':'育儿','Work & learning':'工作与学习','Style':'穿搭','Unsorted':'未分类'};
  const choices = {'web-polish':'让现有页面更简洁、有质感','web-direction':'先定视觉方向','web-system':'统一字体、配色和组件','product-states':'让新用户顺利完成第一次操作','product-model':'理清产品结构','product-continuity':'让用户下次回来也有用','product-sidecourt':'改进一次 SideCourt 访问','web-scroll':'做一个滚动交互','web-components':'改用一个交互组件','web-effects':'实现一个具体动效','web-reference':'给页面某一处找参考','shared-diagram':'把流程画清楚','shared-verification':'验证产品是否真的可用','shared-search':'让搜索引擎找到我的网页','promotion-geo':'让 AI 回答能引用我的产品','promotion-positioning':'确定受众和表达方式','video-shotcraft':'制作产品介绍视频','video-source':'修改已有视频','video-editable':'制作可编辑的视频变体'};
  const label = value => lang === 'zh' ? topics[value] || value : value;
  const annotation = id => data.annotations[id] || {};
  const item = id => data.items.find(x => x.id === id);
  const libraryKey = () => credentials ? 'account:' + credentials.sessionId : offlineKey || 'current';
  const date = value => value ? new Date(value).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : t('尚未扫描','Not scanned yet');

  async function database() {
    if (!db) db = new Promise((resolve, reject) => {
      const request = indexedDB.open('shelf-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('library');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return db;
  }
  async function cacheRead(key = libraryKey()) {
    const base = await database();
    return new Promise((resolve,reject) => { const req = base.transaction('library').objectStore('library').get(key); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
  }
  async function save() {
    const snapshot = JSON.parse(JSON.stringify(data)), key = libraryKey();
    try {
      const base = await database();
      await new Promise((resolve,reject) => { const tx = base.transaction('library','readwrite'); tx.objectStore('library').put(snapshot,key); tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error); });
      return true;
    } catch { notify(t('浏览器未能保存，请先导出备份。','Could not save in this browser. Export a backup.')); return false; }
  }
  function normalize(raw) {
    return {...data, ...raw, items:(raw.items || []).map(x=>C.normalize(x)), annotations:raw.annotations || {}, collections:raw.collections || [], guides:(raw.guides || []).map(C.normalizeGuide).filter(Boolean), goalState:C.normalizeGoalState(raw.goalState)};
  }
  async function loadLibrary() {
    const scope = libraryKey(), cursor = data.remoteCursor;
    const page = libraryPage?.scope === scope ? libraryPage.next : null;
    const fresh = await api('/api/library?paged=1' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '') + (page ? '&page=' + encodeURIComponent(page) : ''));
    if (scope !== libraryKey()) return;
    const complete = !fresh.next;
    libraryPage = complete ? null : {scope,next:fresh.next};
    const nextCursor = complete ? (typeof fresh.cursor === 'string' ? fresh.cursor : null) : data.remoteCursor;
    const changed = (fresh.items || []).length > 0;
    const persist = changed || data.remoteCursor !== nextCursor || JSON.stringify(data.scan) !== JSON.stringify(fresh.scan) || JSON.stringify(data.recent) !== JSON.stringify(fresh.recent);
    if (changed) {
      data.items = C.mergeItems(data.items, fresh.items).items;
      const positions=new Map(fresh.items.filter(x=>Number.isFinite(x.position)).map(x=>[x.id,x.position]));
      for(const x of data.items)if(positions.has(x.id))x.position=positions.get(x.id);
      const previousAnswer=answer;cancelSearch(); answer=null; searchCoverage=null;
      if(previousAnswer&&tab==='home'&&typeof goal==='string'&&goal.trim())answer=ideaAnswer(previousAnswer,true);
      if ($('#answer')) $('#answer').innerHTML='';
      if ($('#search-status')) $('#search-status').outerHTML=searchStatus();
      const submit=$('#goal-form button');if(submit){submit.disabled=false;submit.textContent=t('找内容和方法 →','Find ideas and methods →');}
    }
    data.scan = fresh.scan; data.recent = fresh.recent;
    data.remoteCursor = nextCursor;
    if (persist) await save();
    if (tab === 'library' && $('#cards')) { if (changed) cards(); updateProgress(); }
    else if (tab === 'home' && $('#goal-form')) updateProgress();
    else render();
    refreshDetail();
    if(tab==='home'&&answer)refreshQuickAnswer();
    return complete;
  }
  function cancelSearch(){searchGeneration++;window.RedBotAI?.cancel();working=false;searchProgress='';}
  function resetSearchScope(){recentPending=true;libraryPage=null;reads.clear();intelligence.clear();consumedJobs.clear();cancelSearch();window.RedBotAI?.setScope(libraryKey());answer=null;searchCoverage=null;}
  function coverageText(c){if(!c)return '';return c.complete?t('已检索全部 '+c.rows+' 条收藏与方法，共 '+c.indexedChunks+' 个文字片段；复用 '+c.cacheHits+' 个缓存片段。','Searched all '+c.rows+' saves and methods, '+c.indexedChunks+' text chunks; '+c.cacheHits+' cached chunks reused.')+(c.persistentCache?'':t(' 本次缓存未能保存，刷新后可能需要重新计算。',' Cache could not be saved; a reload may recompute it.')):t('正在检索 '+c.rows+' / '+c.totalRows+' 条；已处理 '+c.indexedChunks+' 个文字片段。','Searching '+c.rows+' / '+c.totalRows+' entries; '+c.indexedChunks+' text chunks processed.');}
  function searchStatus(){return `<div id="search-status" role="status" aria-live="polite"><p>${esc(searchProgress||coverageText(searchCoverage))}</p>${working?`<button type="button" data-action="cancel-search">${t('取消查找','Cancel search')}</button>`:''}</div>`;}
  function requirementsHTML(result){
    const names={'cooking':'在家做饭','weight-loss':'减肥／减脂适用声明','free':'免费使用','cheap':'低成本','no-equipment':'无需器械'};
    const name=r=>lang==='zh'?names[r.id]||r.label:r.label;
    if(!result?.requirements?.length)return '';
    return `<section class="match-evidence"><h3>${t('这次需要满足','Requirements for this goal')}</h3><p>${result.requirements.map(r=>esc(name(r))).join(' · ')}</p>${result.evidence?.length?`<p class="muted">${t('以下只是原文声明，不是 RedBot 对营养、效果或费用的独立验证。','These are source claims, not independent verification of nutrition, results or costs.')}</p>${result.evidence.map(e=>`<blockquote>${esc(e.text)}</blockquote>`).join('')}`:''}${result.missing?.length?`<p>${t('还缺少证据：','Evidence still missing: ')}${result.requirements.filter(r=>result.missing.includes(r.label)).map(r=>esc(name(r))).join(' · ')}</p>`:''}</section>`;
  }
  function rememberConnection(value) {
    const oldScope=libraryKey();credentials = value;
    if(oldScope!==libraryKey())resetSearchScope();
    if (value) localStorage.setItem('redbot.connection', JSON.stringify(value));
    else localStorage.removeItem('redbot.connection');
  }
  function apiURL() { return credentials?.api || config.api || ''; }
  function usesSideCourtAccount() { return config.sidecourtAuth === true || !!credentials?.accountUser; }
  function accountDialog(){
    if(!usesSideCourtAccount())return connectionDialog();
    const who=sidecourtSession?.user;
    modal(`<h2>${t('一个 SideCourt 账号，就够了','One SideCourt account')}</h2>${who?`<p>${esc(who.email||t('你已登录 SideCourt','Signed in to SideCourt'))}</p>${credentials&&!credentials.accountUser?`<p>${t('将当前的小红书连接关联到这个账号，换设备时就能找回这份收藏。','Link this Xiaohongshu connection to find your saves on another device.')}</p><button class="primary" data-action="account-bind">${t('关联当前收藏','Link this library')}</button>`:`<p>${t('继续使用同一账号的 RedBot 收藏。','Continue with your RedBot library.')}</p><button class="primary" data-action="account-check">${t('继续 →','Continue →')}</button>`}`:`<p>${t('使用 SideCourt 的账号登录或注册。完成后回到这里，不需要再注册 RedBot。','Sign in or join SideCourt. Return here afterwards; no separate RedBot registration is needed.')}</p><a class="button primary" href="https://sidecourt.space/sign-in" target="_blank" rel="noopener noreferrer">${t('去 SideCourt 登录 / 注册 ↗','Sign in / join SideCourt ↗')}</a><button data-action="account-check">${t('我已登录，继续','I have signed in — continue')}</button>`}<p id="account-error" class="error" role="alert"></p>`, 'sidecourt');
  }
  async function accountChanged(session){
    sidecourtSession=session;
    if(credentials?.accountUser&&credentials.accountUser!==session?.user?.id){
      await save();readEpoch++;rememberConnection(null);offlineKey=null;localStorage.removeItem('redbot.offline-key');
      data=normalize({items:[],annotations:{},collections:[],guides:[],goalState:{}});status=null;lastFetch='';dismiss();render();
    }
    if($('#sc-account'))$('#sc-account').textContent=session?t('SideCourt 账号','SideCourt account'):t('登录','Sign in');
  }
  async function initAccount(){
    $('#sc-account').hidden=!usesSideCourtAccount();
    if(!usesSideCourtAccount()){sidecourtSession=null;return;}
    // Load the optional legacy identity integration only for a configured host or
    // an already-linked library. Standalone visitors never read a SideCourt login.
    if(!window.RedBotAccount){
      try{await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='vendor/sidecourt-auth.js?v=2.116.0';script.onload=resolve;script.onerror=reject;document.head.appendChild(script);});}catch{return;}
    }
    if(!window.RedBotAccount)return;
    try{await accountChanged(await RedBotAccount.session());}catch{}
    RedBotAccount.onChange(async(event,session)=>{
      await accountChanged(session);
      if($('#dialog').open&&$('#dialog').dataset.kind==='sidecourt')accountDialog();
    });
    if(sidecourtSession&&!credentials&&configValidated)void checkAccount({resume:true,silent:true});
  }
  async function checkAccount({resume=false,silent=false}={}){
    if(accountPending)return;accountPending=true;
    try{
      await accountChanged(await window.RedBotAccount?.session());
      if(!sidecourtSession){if(!silent)accountDialog();return;}
      if(!configValidated)await refreshConnectionConfig();
      if(credentials){if(!silent)(credentials.accountUser?connectionDialog():accountDialog());return;}
      if(resume){
        const result=await api('/api/account-resume',{});
        if(result.connection){
          rememberConnection({...result.connection,api:config.api});offlineKey=null;resetSearchScope();
          data=normalize(await cacheRead()||{items:[],annotations:{},collections:[],guides:[],goalState:{}});
          lastFetch='';initial=true;dismiss();tab='library';render();await refreshStatus();return;
        }
      }
      if(!silent)connectionDialog();
    }catch(error){if($('#account-error'))$('#account-error').textContent=failure(error);else if(!silent)notify(failure(error));}
    finally{accountPending=false;}
  }
  async function bindAccount(){
    if(accountPending)return;accountPending=true;
    try{
      const result=await api('/api/account-bind',{});
      if(result.linked){rememberConnection({...credentials,accountUser:sidecourtSession.user.id});await refreshStatus();connectionDialog();notify(t('已关联，同一个 SideCourt 账号可找回收藏。','Linked. Use this SideCourt account to find your saves.'));}
    }catch(error){if($('#account-error'))$('#account-error').textContent=failure(error);else notify(failure(error));}
    finally{accountPending=false;}
  }
  // Only the shipped same-origin configuration may select a remote endpoint.
  // Never replay a session/connect mutation after a timeout: its result is unknown.
  async function refreshConnectionConfig() {
    if (bootstrapPending) return bootstrapPending;
    bootstrapPending = (async () => {
      let next;
      try {
        if (['127.0.0.1','localhost'].includes(location.hostname)) {
          const response = await fetch('/api/capabilities', {cache:'no-store', credentials:'omit', redirect:'error', signal:AbortSignal.timeout(5000)});
          if(response.ok){const capabilities=await response.json();if(capabilities.redbotConnector===1)next={api:location.origin,sidecourtAuth:capabilities.sidecourtAuth===true};}
        }
        if (!next) {
          const response = await fetch(new URL('connection.json', location.href), {cache:'no-store', credentials:'omit', redirect:'error', signal:AbortSignal.timeout(5000)});
          if (!response.ok) throw Error();
          next = await response.json();
          if (!next || typeof next.api !== 'string' || !/^https:\/\/[a-z0-9.-]+(?::\d+)?$/.test(next.api)) throw Error();
        }
        if(next.transport!=null&&next.transport!=='encrypted-v1')throw Error('invalid_transport');
        if(next.transport==='encrypted-v1'&&!/^[A-Za-z0-9_-]{87}$/.test(next.readerKey||''))throw Error('invalid_transport');
        // The legacy discovery flag keeps already-open older clients working.
        // Current clients always use the pinned encrypted transport when configured.
        if(next.discovery===true&&next.transport!=='encrypted-v1'){
          const gateway=next.api;
          const response=await fetch(gateway+'/api/route',{cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(8000)});
          const route=await response.json();
          if(!response.ok)throw Error(route.error||'reader_offline');
          if(!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(route.api||''))throw Error('invalid_route');
          next={...next,gateway,api:route.api};
        }
      } catch(error) {configCheckedAt=Date.now();configValidated=false;throw Error(error.message==='reader_offline'?'reader_offline':'connection_config_unavailable');}
      config = next;configCheckedAt=Date.now();
      configValidated = true;
      if (credentials && credentials.api !== config.api) rememberConnection({...credentials,api:config.api});
      connectionError = '';
    })();
    try { await bootstrapPending; } finally { bootstrapPending = null; }
  }
  function showConnectionError(error) {
    connectionError = failure(error);
    const target = $('#connection-error');
    if (target) { target.textContent = connectionError; target.hidden = false; }
    else notify(connectionError);
  }
  async function recoverExpiredConnection(sessionId) {
    if (!credentials || credentials.sessionId !== sessionId) return;
    // Keep this exact account cache, including private notes, as the device copy.
    await save();
    if (!credentials || credentials.sessionId !== sessionId) return;
    offlineKey = 'account:' + sessionId;
    localStorage.setItem('redbot.offline-key', JSON.stringify(offlineKey));
    rememberConnection(null);
    status = null; onboarding = false; offline = false;
    connectionError = failure(Error('session_expired'));
    render(); connectionDialog();
  }
  async function api(path, body) {
    const root = apiURL(), requestSession = credentials?.sessionId;
    if(usesSideCourtAccount()&&window.RedBotAccount){try{sidecourtSession=await RedBotAccount.session();}catch{}}
    if (!configValidated || !root) throw Error('connection_config_unavailable');
    let response;
    const endpoint = path.split('?')[0];
    const timeout = endpoint==='/api/library' ? 60000 : endpoint==='/api/connection' ? 8000 : 15000;
    try {
      const options={method:body ? 'POST' : 'GET', credentials:'omit', referrerPolicy:'no-referrer', headers:{...(credentials ? {Authorization:'Bearer ' + credentials.token} : {}), ...(usesSideCourtAccount()&&sidecourtSession?.access_token?{'X-SideCourt-Token':sidecourtSession.access_token}:{}), ...(body ? {'Content-Type':'application/json'} : {})}, ...(body ? {body:JSON.stringify(body)} : {}), signal:AbortSignal.timeout(timeout), cache:'no-store'};
      if(config.transport==='encrypted-v1') {
        if(!window.RedBotTransport)throw Error('transport_unavailable');
        response=await window.RedBotTransport.fetch(root,path,options,config.readerKey);
      } else response=await fetch(root+path,options);
    } catch { throw Error('service_offline'); }
    let result;
    try { result = await response.json(); } catch { throw Error('service_offline'); }
    if (!response.ok) {
      if (response.status === 401 && result.error === 'session_expired' && requestSession) await recoverExpiredConnection(requestSession);
      throw Error(result.error || 'service_unavailable');
    }
    if(body && requestSession===credentials?.sessionId && typeof pollSoon==='function')pollSoon();
    return result;
  }
  function failure(error) {
    const messages = {
      connection_config_unavailable:t('未能读取连接地址，尚未发起登录。请再次点击获取登录码以重新读取；已有收藏和连接信息保留。','Could not load the connection address. Sign-in has not started. Click Get sign-in code to retry; your saves and connection are kept.'),
      reader_offline:t('读取电脑暂时离线。已有收藏仍可查看，恢复后会继续连接。','The reader is offline. Saved content remains available; reconnection is automatic.'),
      reader_unavailable:t('连接正在恢复，已保存内容不受影响。','Reconnecting. Saved content is still available.'),
      sidecourt_sign_in_required:t('请先登录 SideCourt，再回到这里继续。','Sign in to SideCourt, then return here.'),
      sidecourt_mfa_required:t('请在 SideCourt 完成双重验证，再继续。','Complete verification on SideCourt to continue.'),
      account_mismatch:t('当前 SideCourt 账号与这份收藏不一致，请切回原账号。','This library belongs to a different SideCourt account.'),
      account_already_connected:t('这个 SideCourt 账号已有连接，请从账号入口恢复。','This SideCourt account already has a connection. Resume it from Account.'),
      account_service_unavailable:t('账号服务暂时无法连接，请稍后重试。','The account service is unavailable. Try again shortly.'),
      ai_result_unknown:t('未确认这次整理的结果，可以重试；原文已保留。','This result could not be confirmed. You can retry; the source is kept.'),
      ai_result_unsupported:t('整理结果已更新，请保存笔记后刷新页面。','The result format has changed. Save your notes and refresh.'),
      ai_busy:t('正在整理另一篇内容，完成后可继续。','Another save is being understood. Try after it finishes.'),
      source_not_read:t('还没有足够的原文，请先读取内容。','Read the source content first.'),
      ai_not_configured:t('内容理解暂不可用，已读取原文仍可查看。','Understanding is unavailable; saved source text is still available.'),
      ai_unavailable:t('这次整理没有完成，可以重试。原文已保留。','Understanding did not finish. Retry; the source is kept.'),
      ai_evidence_missing:t('这次结果未通过原文核对，请重试。','The result did not pass its source check. Please retry.'),
      source_changed:t('原文刚有更新，请再整理一次。','The source was updated. Try again.'),
      service_offline:t('暂时联系不上同步服务。已有收藏仍可查看；恢复连接后继续更新。','The sync service cannot be reached. Your saved content is still available; updates can continue when it reconnects.'),
      invite_required:t('邀请码不正确，请使用收到的试用链接。','Use the invitation link you received.'),
      beta_full:t('目前试用名额已满，请稍后再试。','All test slots are in use. Try again later.'),
      service_restarted:t('服务重启中断了这次读取。已有内容已保留，可手动重试。','A service restart interrupted this read. Existing content is kept. Retry manually.'),
      session_expired:t('这次连接已过期，请使用邀请码重新连接。本机收藏和笔记已保留，可先导出备份。','This session expired. Use your invitation to reconnect. Your saves and notes are kept on this device; you can export them first.'),
      sign_in_required:t('请在小红书中完成登录确认，再回来继续。','Confirm sign-in in Xiaohongshu, then return here.'),
      wrong_account:t('本次登录的账号与这份收藏库不同。请断开后重新连接，避免混入别人的收藏。','A different account signed in. Disconnect before switching accounts.'),
      scan_cooldown:t('刚刚已扫描，请稍等一分钟再刷新。','Just scanned. Wait a minute before refreshing.'),
      busy:t('上一项读取还在进行，请稍等。','A read is already running. Please wait.'),
      qr_unavailable:t('暂时没拿到登录码，请重试。','Could not get a sign-in code. Try again.'),
      source_content_invalid:t('来源返回的内容与这篇收藏不一致，未替换已有内容。请刷新收藏后重试。','The returned source did not match this save. Existing content is kept. Refresh your saves and retry.'),
      read_cancelled:t('正文读取已取消，可稍后重试。','Text reading cancelled. Retry when ready.'),
      source_unavailable:t('小红书这次未能完成读取。已有收藏和登录状态保留，可稍后重试。','This read from Xiaohongshu did not finish. Your saves and sign-in are kept; try again later.'),
      scan_incomplete:t('本次没有读到列表末尾，已收到的收藏会保留。','The end of the list was not reached. Saves already received are kept.'),
      sync_first:t('先刷新收藏，更新这篇笔记的访问链接。','Refresh your saves to update access to this post.'),
      video_busy:t('另一段视频正在处理，请稍后重试。','Another video is being processed. Try later.'),
      video_cancelled:t('视频读取已取消，原收藏和笔记保留。','Video reading cancelled. Saves and notes are kept.'),
      video_timeout:t('视频处理超时。已有文字保留，可稍后再试或打开原视频。','Video processing timed out. Existing text is kept; retry later or open the source.'),
      video_duration_limit:t('旧服务拒绝了这段视频，需要更新服务后重试。','The older service rejected this video. Update the service and retry.'),
      video_too_large:t('旧服务拒绝了这个文件，需要更新服务后重试。','The older service rejected this file. Update the service and retry.'),
      video_storage_full:t('测试服务空间不足，已有结果已保留。释放空间后可以继续读取。','The test host is low on storage. Existing results are kept; free space and continue.'),
      video_setup_required:t('视频转录组件尚未准备好，需要测试服务维护者完成安装；收藏仍可查看。','Video transcription is not set up. The test host maintainer needs to finish setup; saves remain available.'),
      video_model_mismatch:t('本机转录模型校验未通过，需要维护者修复后重试。','The local transcription model failed verification. The host maintainer needs to repair it.'),
      video_source_unavailable:t('没有取得可读取的视频来源。请先刷新收藏再重试，或打开原视频。','No readable video source was returned. Refresh saves, retry, or open the original.'),
      video_download_failed:t('视频下载未完成。请稍后重试，或打开原视频。','Video download failed. Retry later or open the original.'),
      video_url_not_allowed:t('视频来源不在允许范围，未下载。请打开原视频。','The video source is not allowed and was not downloaded. Open the original.'),
      video_protected:t('这段视频受保护，无法读取。请在原平台查看。','This video is protected. View it on the original platform.'),
      video_tool_failed:t('视频处理未完成。已获得的文字会保留；请稍后重试或打开原视频。','Video processing did not finish. Available text is kept; retry later or open the original.'),
      video_redirect_limit:t('视频链接跳转过多，已停止下载。请刷新收藏后重试。','Too many video redirects. Refresh saves and retry.'),
      no_video_running:t('当前没有正在读取的视频，可以重新打开这篇收藏查看。','No video is currently being read. Reopen the save to check it.'),
      already_connected:t('账号已连接，可直接刷新收藏。','Already connected. Refresh your saves.'),
    };
    return messages[error.message] || t('连接服务暂时不可用。本机收藏仍可查看，请稍后再试。','The connection service is unavailable. Your device copy is still available. Try again later.');
  }
  function notify(message) {
    clearTimeout(toastTimer); $('#notice').textContent = message; $('#notice').hidden = false;
    toastTimer = setTimeout(()=>$('#notice').hidden = true, 5500);
  }
  function modal(html, kind = '') {
    dialogFocus = document.activeElement;
    $('#dialog').dataset.kind = kind;
    $('#dialog-body').innerHTML = html;
    $('#dialog-close').ariaLabel = t('关闭','Close');
    if (!$('#dialog').open) $('#dialog').showModal();
  }
  function dismiss() { if($('#dialog').dataset.kind==='ai'){aiLoadGeneration++;window.RedBotAI?.cancel();} $('#dialog').close(); detailId = null; if (dialogFocus?.isConnected) dialogFocus.focus(); }

  function activity() {
    if (offline && credentials) return t('同步暂不可用','Sync unavailable');
    if (status?.job?.state === 'running') {
      return {connect:t('正在准备登录码…','Preparing sign-in…'), verify:t('正在确认你的账号…','Verifying your account…'), scan:status.progress?.seen?t('正在扫描 · 已看到 ','Scanning · seen ')+status.progress.seen:t('正在扫描收藏…','Scanning your saves…'), read:t('正在读取这篇笔记…','Reading this post…'),video:t('正在读取视频内容…','Reading video content…')}[status.job.kind];
    }
    if (status?.state === 'connected') return t('已连接','Connected') + (status.nickname ? ' · ' + status.nickname : '');
    if (credentials) return t('查看连接','Connection');
    return t('连接小红书','Connect Xiaohongshu');
  }
  function accountLabel() {
    return credentials ? t('小红书账号','Xiaohongshu account') : t('连接小红书','Connect Xiaohongshu');
  }
  function render() {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.title = t('RedBot — 找回收藏，马上用起来','RedBot — Put your saves to use');
    $('#nav-home').textContent = t('最近收藏','Recent saves');
    $('#nav-library').textContent = t('我的收藏','My saves');
    $('#nav-home').ariaCurrent = tab === 'home' ? 'page' : 'false';
    $('#nav-library').ariaCurrent = tab === 'library' ? 'page' : 'false';
    $('#account').textContent = accountLabel();
    $('#language').textContent = lang === 'zh' ? 'EN' : '中文';
    $('#language').ariaLabel = t('切换到英文','Switch to Chinese');
    $('#settings').ariaLabel = t('设置与备份','Settings and backups');
    $('#foot-copy').textContent = t('收藏是为了用上的。','Saved for a reason.') + ' · v' + APP_VERSION;
    renderVersion();
    $('#sidecourt-link').textContent = t('在 SideCourt 发现更多作品 ↗','Discover more work on SideCourt ↗');
    if (tab === 'home') renderHome(); else renderLibrary();
  }
  function isScanning() { return status?.job?.state === 'running' && status.job.kind === 'scan'; }
  function elapsed() {
    const start = status?.job?.startedAt || status?.job?.started;
    const seconds = Math.max(0, Math.floor((Date.now() - (start ? Date.parse(start) : startedAt || Date.now())) / 1000));
    return seconds < 60 ? seconds + t(' 秒','s') : Math.floor(seconds/60) + t(' 分 ','m ') + seconds%60 + t(' 秒','s');
  }
  function scanLine() {
    const scan = status?.scan || data.scan;
    if(status?.job?.state==='running'&&status.job.kind==='recent')return `<p class="sync-line" role="status">${t('正在找最新收藏，已有内容可以先用。','Checking recent saves. Everything already here is ready to use.')}</p>`;
    if (offline && credentials) return `<aside class="scan-panel warning" role="status"><strong>${t('暂时联系不上同步服务','Sync service is unavailable')}</strong><p>${t('已到达的收藏可以继续查看。恢复连接后再更新。','You can keep browsing saves already received. Updates will resume when the service returns.')}</p><button data-action="retry-status">${t('重新连接','Retry connection')}</button></aside>`;
    if (libraryPage && credentials && !isScanning()) return `<aside class="scan-panel" role="status"><strong>${t('正在接收收藏内容','Receiving your saved content')}</strong><p>${t('已保存的内容可以先看，其余内容会陆续到达。','You can use content already saved. The rest will appear as it arrives.')}</p></aside>`;
    if (credentials && status?.state !== 'connected' && status?.job?.state === 'failed') return `<aside class="scan-panel warning" role="status"><strong>${t('连接需要恢复，已有收藏仍在','Restore the connection; your saves are kept')}</strong><p>${esc(failure(Error(status.job.error)))}</p><button data-action="connection">${t('恢复连接','Restore connection')}</button></aside>`;
    if (isScanning()) return `<aside class="scan-panel" role="status" aria-live="polite"><div class="scan-title"><span class="scan-pulse" aria-hidden="true"></span><strong>${t('收藏正在陆续到达','Your saves are arriving')}</strong><span>${elapsed()}</span></div><p>${t('本次已找到','Found this scan:')} <b>${status.progress?.seen ?? scan?.seen ?? 0}</b> ${t('条 · 已到达的可以先看，不用等全部完成。','saves · You can browse them while the rest arrive.')}</p><div class="scan-track" aria-hidden="true"></div><button data-action="cancel-sync">${t('先停在这里','Stop for now')}</button></aside>`;
    if (!scan) return '';
    const complete = scan.complete === true;
    const title = scan.endReason === 'cancelled' ? t('已停止，收到的收藏都保留了','Stopped. Your saves are kept') : complete ? t('本次扫描已到列表末尾','Reached the end of the list') : t('已收到一部分，仍可继续检查','Some saves received; coverage is not complete');
    return `<aside class="scan-panel ${complete?'finished':'warning'}"><div class="scan-title"><strong>${title}</strong><button data-action="connection">${t('查看连接','Connection')}</button></div><p>${t('本次找到','Found this scan:')} ${scan.seen ?? scan.count ?? 0} ${t('条','saves')} · ${esc(date(scan.at))}${scan.added ? ' · +' + scan.added + t(' 新收藏',' new') : ''}${!complete?' · '+t('之前收到的不会删除。','Earlier saves are kept.'):''}</p>${scan.endReason==='source_response_incomplete'?`<p>${t('小红书这次没有返回后续收藏。已收到的可以继续看，稍后再检查。','Xiaohongshu did not return the next saves this time. You can browse what arrived and check again later.')}</p>`:''}${!complete?`<button data-action="full-sync">${t('继续扫描全部','Scan the full list again')}</button>`:''}</aside>`;
  }
  function updateProgress() {
    const region = $('#scan-progress');
    if (region) region.innerHTML = progressHTML();
    const recent=$('#recent-saves');if(recent)recent.outerHTML=recentHTML();
    const refresh = $('.library-heading [data-action="sync"]');
    if (refresh) refresh.disabled = status?.job?.state === 'running';
  }
  function progressHTML() {
    if(tab==='home'&&status?.state==='connected'&&!offline&&!isScanning())return '';
    return scanLine()+readingLine();
  }
  function recentHTML() {
    const ids=data.recent?.ids||[],byId=new Map(data.items.map(x=>[x.id,x]));
    const rows=(ids.length?ids.map(id=>byId.get(id)).filter(Boolean):[...data.items].sort((a,b)=>a.position-b.position)).filter(x=>!annotation(x.id).trashed).slice(0,3);
    if(!rows.length)return '<section id="recent-saves"></section>';
    const busy=status?.job?.state==='running'&&status.job.kind==='recent';
    return `<section id="recent-saves" class="recent-saves"><div class="recent-heading"><h2>${t('最近收藏','Recent saves')}</h2><button data-action="sync" ${busy?'disabled':''}>${busy?t('正在找新收藏…','Checking…'):t('刷新 ↻','Refresh ↻')}</button></div><div class="recent-list">${rows.map(x=>`<button class="recent-save" data-action="detail" data-id="${esc(x.id)}"><span class="recent-title">${esc(x.title)}</span><span class="recent-author">${esc(x.author)} · ${completeContent(x)?t('已读，可直接复制','Read · ready to copy'):x.type==='video'?t('视频 · 点开读取','Video · open to read'):t('点开读取','Open to read')}</span><span class="recent-open" aria-hidden="true">↗</span></button>`).join('')}</div><p class="recent-status" role="status">${busy?t('先看已有收藏，新帖子找到后就会出现。','Your saves stay usable while new posts arrive.'):data.recent?.at?t('已检查最新收藏 · ','Latest saves checked · ')+esc(date(data.recent.at)):t('点开一篇，先读重点。','Open a save to read its key points.')}</p></section>`;
  }
  function readingLine() {
    if(!credentials || !data.items.length)return '';
    const q=status?.readingQueue, finished=data.items.filter(x=>x.type==='video'?x.videoAnalysis?.complete:['ready','empty'].includes(x.contentReadStatus)&&x.contentReadAt).length;
    const running=q?.state==='running', paused=q?.state==='paused', unread=data.items.length-finished;
    const title=running?t('正在读取全部收藏','Reading all saves'):paused?t(q.currentId?'当前这篇读完后暂停':'读取已暂停',q.currentId?'Finishing this save, then pausing':'Reading paused'):t(unread?'让收藏里的内容也能被找到':'全部收藏内容已读取',unread?'Make the content inside your saves searchable':'All saved content has been read');
    const message=running||paused?t(`已读 ${finished} / ${data.items.length} 条，待完成 ${unread} 条。`,`Read ${finished} / ${data.items.length}; ${unread} still to complete.`):t(`已读 ${finished} / ${data.items.length} 条。${unread?'正文和视频会逐篇读取，读好一篇就能用。':'现在可以直接搜索和查看。'}`,`Read ${finished} / ${data.items.length}. ${unread?'Post text and videos become available one at a time.':'Ready to search and browse.'}`);
    return `<aside class="scan-panel content-reading" role="status"><strong>${title}</strong><p>${message}${q?.failed?t(` ${q.failed} 条需要重试。`,` ${q.failed} need another attempt.`):''}</p>${running?`<button data-action="pause-reading">${t('暂停读取','Pause reading')}</button>`:`${unread>(q?.failed||0)?`<button data-action="read-all" ${paused&&q.currentId?'disabled':''}>${t(paused?'继续读取':'读取全部内容',paused?'Continue reading':'Read all content')}</button>`:''}${q?.failed?` <button data-action="retry-all">${t('重试未读成功的','Retry unsuccessful reads')}</button>`:''}`}</aside>`;
  }
  function renderHome() {
    const has = data.items.some(x=>!annotation(x.id).trashed);
    $('#main').innerHTML = `<section class="intro ${has?'compact':''}"><p class="eyebrow">${t('少找一会儿，多用一点。','LESS SEARCHING. MORE DOING.')}</p><h1>${has?t('点开收藏，用起来。','Open a save. Put it to use.'):t('好东西收藏了，<br>然后呢？','You saved something good.<br>What next?')}</h1><p class="lead">${has?t('读懂文字、图片、视频和评论，留下有用内容，一键复制给 AI。','Read the text, images, video and comments. Get the useful content, ready to copy for AI.'):t('连接小红书，点开一篇收藏，读懂内容，复制给 AI。','Connect Xiaohongshu. Open a save, understand it, and copy it for AI.')}</p></section>
    ${has?`${recentHTML()}<div class="browse-saves"><button class="primary" data-action="library">${t('查看全部收藏','Browse all saves')} · ${data.items.filter(x=>!annotation(x.id).trashed).length} ↗</button></div><details class="optional-search" ${goal||answer?'open':''}><summary>${t('按想法找收藏','Find saves for an idea')}</summary><form id="goal-form" class="goal-form"><label class="sr-only" for="goal">${t('你现在想做什么','Your current goal')}</label><textarea id="goal" rows="2" maxlength="1000" placeholder="${t('比如：我想让产品首页更简洁，不知道从哪改','For example: make my product homepage less cluttered')}">${esc(goal)}</textarea><button class="primary" ${working?'disabled':''}>${working?t('正在找…','Looking…'):t('找内容和方法 →','Find ideas and methods →')}</button></form>${searchStatus()}${data.goalState?.plan?.goal&&!goal?`<button class="saved-plan" data-action="resume"><small>${t('上次留下的事','PICK UP WHERE YOU LEFT OFF')}</small><strong>${esc(data.goalState.plan.goal)}</strong><span>↗</span></button>`:''}</details><div id="answer">${answerHTML()}</div><div id="scan-progress">${progressHTML()}</div>`:
    `<div class="paper-stack" aria-hidden="true"><div class="paper back"><i></i><i></i><i></i></div><div class="paper front"><span>↗</span><p>${t('留给下一次<br>刚好需要的自己。','For the moment<br>you need it.')}</p><i></i></div></div><div class="welcome"><button class="primary" data-action="connection">${t('连接我的小红书 →','Connect my Xiaohongshu →')}</button><p>${t('登录后扫描收藏，无需上传文件。','Sign in to scan your saves. No file upload.')}</p><button class="quiet" data-action="demo">${t('先用示例试一试','Explore an example first')}</button></div>`}`;
    $('#goal-form')?.addEventListener('submit', findStart);
    $('#goal')?.addEventListener('input', e=>{cancelSearch();goal=e.target.value;choice='';answer=null;if($('#answer'))$('#answer').innerHTML='';if($('#search-status'))$('#search-status').outerHTML=searchStatus();const submit=$('#goal-form button');if(submit){submit.disabled=false;submit.textContent=t('找内容和方法 →','Find ideas and methods →');}});
  }
  function ideaAnswer(preferred=null,strict=false) {
    const matches=Q.search(data.items,data,goal);
    const selected=matches.find(r=>r.source.id===preferred?.source?.id)||(!strict&&['ready','needs_reading'].includes(preferred?.status)?preferred:null)||matches[0];
    if(!selected)return (!strict&&preferred)||C.chooseStart(data.items,data.guides,data,goal,choice);
    const unique=[selected,...matches.filter(r=>r.source.id!==selected.source?.id)];
    return {...selected,matches:unique,goal};
  }
  function answerHTML() {
    if (!answer) return '';
    if (answer.status === 'clarify') return `<section class="answer"><h2>${t('还想找哪方面的内容？','What would you like to find?')}</h2><div class="actions">${answer.options.map(o=>`<button data-action="choice" data-choice="${esc(o.choice)}">${esc(lang==='zh'?choices[o.choice]||o.label:o.label)}</button>`).join('')}</div></section>`;
    if (!['ready','needs_reading'].includes(answer.status)) return `<section class="answer"><h2>${t('还没找到能支持这个想法的内容。','No supporting save found yet.')}</h2><p>${t('可以换一个关键词，或看看已有收藏。没有内容依据时，不会勉强给出方法。','Try another keyword or browse your saves. A method needs supporting source content.')}</p>${requirementsHTML(answer)}<button data-action="library">${t('看看已有收藏','Browse my saves')} →</button></section>`;
    const x=answer.source,g=answer.guide,take=x?R.shortTake(x):null,insight=x?.insight;
    const matches=answer.matches||[],others=matches.filter(r=>r.source?.id!==x?.id),hasText=!!insight||take?.sourceKind&&take.sourceKind!=='none';
    return `<article class="answer quick-answer"><p class="eyebrow">${t('和这个想法有关','FOR YOUR IDEA')}</p><h2>${esc(x?.title||g?.title)}</h2><p class="source-line">${esc(x?.author||'')}${matches.length>1?' · '+t('找到 '+matches.length+' 条相关收藏',matches.length+' relevant saves'):''}</p>
      <div class="quick-content">${insight?`<p class="summary-lead">${esc(simple(insight.overview))}</p>${insight.methods?.length?`<h3>${t('可以借用的方法','Methods to draw on')}</h3><ol>${insight.methods.slice(0,3).map(m=>`<li>${esc(simple(m.text))}</li>`).join('')}</ol>`:''}${insight.gap&&!insight.methods?.length?`<p class="muted">${esc(simple(insight.gap))}</p>`:''}<p class="source-caption">${t('根据已读原文整理，作者经验仍需结合你的情况判断。','Organized from the source. Check how the author’s experience fits your situation.')}</p>`:take?.lead?`<p class="source-caption">${t('先看原文里的内容','FROM THE SAVED SOURCE')}</p><blockquote>${esc(take.lead)}</blockquote><p class="muted">${t('这是原文摘录，尚未生成内容总结。','This is a source excerpt; a summary is not ready yet.')}</p>`:`<p>${t('目前只有标题，读到内容后才能总结方法。','Only the title is available. Read the content before deriving a method.')}</p>`}</div>
      ${x?`<div id="quick-progress">${intelligenceProgress(x.id)}</div>`:''}${requirementsHTML(answer)}
      <div class="actions">${x?hasText?`<button class="primary" data-action="quick-copy" data-id="${esc(x.id)}">${t('复制给 AI','Copy for AI')} ↗</button><button data-action="detail" data-id="${esc(x.id)}">${t('原文与详情','Source and details')}</button>`:`<button class="primary" data-action="detail" data-id="${esc(x.id)}">${t('读取内容 →','Read content →')}</button>`:''}<button class="quiet" data-action="skip">${t('不太相关','Not relevant')}</button></div>${hasText?`<p class="handoff-hint">${t('带上你的想法和这篇内容，粘贴到 Codex 或常用 AI 即可。','Includes your idea and this source. Paste into Codex or your usual AI.')}</p>`:''}
      ${others.length?`<section class="quick-related"><h3>${t('也可以看看','Other relevant saves')}</h3>${others.slice(0,ideaLimit-1).map(r=>`<button data-action="quick-select" data-id="${esc(r.source.id)}"><strong>${esc(r.source.title)}</strong><span>${esc(r.source.author||'')} ↗</span></button>`).join('')}${others.length>ideaLimit-1?`<button class="quiet" data-action="quick-more">${t('再看 '+(others.length-ideaLimit+1)+' 条相关收藏','Show '+(others.length-ideaLimit+1)+' more saves')}</button>`:''}</section>`:''}</article>`;
  }
  function refreshQuickAnswer() {
    if(tab!=='home'||!answer||!$('#answer'))return;
    if(answer.source?.id){const current=item(answer.source.id);if(current)answer.source=current;}
    $('#answer').innerHTML=answerHTML();
  }
  function prepareQuickAnswer() {
    const x=answer?.source;if(tab!=='home'||!x||!credentials||x.insight||!readable(x))return;
    if(['running','failed'].includes(intelligence.get(x.id)?.state)||[...intelligence.values()].some(j=>j.state==='running'))return;
    void requestInsight(x.id);
  }
  async function copyText(value) {
    if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(value);return;}catch{}}
    const focused=document.activeElement, field=document.createElement('textarea');
    field.value=value;field.readOnly=true;field.tabIndex=-1;
    field.style.cssText='position:fixed;top:0;left:-9999px;opacity:0;font-size:16px';
    let copied=false;
    const host=focused?.closest?.('dialog[open]')||document.querySelector?.('dialog[open]')||document.body;
    try{host.appendChild(field);field.focus({preventScroll:true});field.select();field.setSelectionRange(0,value.length);copied=document.execCommand?.('copy')===true;}
    catch{}
    finally{field.remove();focused?.focus?.({preventScroll:true});}
    if(!copied)throw Error('Clipboard copy was blocked');
  }
  async function copyQuickAnswer(id) {
    const x=item(id);if(!x)return;
    const value=Q.handoff(x,goal,lang);
    try{await copyText(value);notify(t('已复制。粘贴到 Codex 或你常用的 AI，即可继续。','Copied. Paste into Codex or your usual AI to continue.'));}
    catch{modal(`<h2>${t('复制给 AI','Copy for AI')}</h2><p>${t('浏览器暂不允许自动复制。请复制下面已选中的文字，或下载文本。','This browser blocked automatic copying. Copy the selected text below, or download it.')}</p><textarea id="quick-output" rows="10" readonly>${esc(value)}</textarea><button data-action="quick-download" data-id="${esc(id)}">${t('下载文本','Download text')}</button>`,'quick-copy');$('#quick-output').focus();$('#quick-output').select();}
  }
  async function findStart(event) {
    event?.preventDefault(); goal = $('#goal')?.value.trim() || goal.trim();
    if (!goal || working) return;
    const generation=++searchGeneration,scope=libraryKey(),requestedGoal=goal;
    const current=()=>generation===searchGeneration&&scope===libraryKey()&&requestedGoal===goal;
    ideaLimit=3;working=true;searchCoverage=null;searchProgress=ai?t('正在准备此设备上的语义匹配…','Preparing on-device meaning search…'):'';render();
    let next=ideaAnswer(C.chooseStart(data.items,data.guides,data,goal,choice));
    if(current()){answer=next;refreshQuickAnswer();}
    try {
      if(ai&&!choice){
        RedBotAI.setScope(scope);
        RedBotAI.progress((message,coverage)=>{if(!current())return;searchProgress=coverage?coverageText(coverage):t('正在加载本机模型，首次需要下载…','Loading the local model; first use requires a download…');if($('#search-status'))$('#search-status').outerHTML=searchStatus();});
        if(!aiReady){await RedBotAI.load();if(!current())return;aiReady=true;}
        const result=await RedBotAI.search(requestedGoal,data.items,data.guides,data,{scope});
        if(!current())return;searchCoverage=result.coverage;searchProgress='';
        next=ideaAnswer(C.semanticStart(data.items,data.guides,data,requestedGoal,result.ranked));
      }
      if(current())answer=next;
    }catch(error){if(current()){answer=next;searchProgress=t('语义匹配未完成，下面使用基础匹配；不代表已覆盖全库。','Meaning search did not finish. Basic matching is shown below; full semantic coverage is not established.');}}
    finally{if(current()){working=false;render();prepareQuickAnswer();$('#answer')?.scrollIntoView({block:'start',behavior:'smooth'});}}
  }
  function filtered() {
    const view = ['trash','archived','favorite','unread'].includes(filter)?filter:'all';
    return C.filterItems(data.items,data,view,filter==='content'?'content':'all',query,sort).filter(x=>(!topic||(annotation(x.id).category||x.category)===topic)&&(!collection||(annotation(x.id).collections||[]).includes(collection)));
  }
  function cards() {
    const rows = filtered();
    $('#result-count').textContent = rows.length + t(' 条收藏',' saves');
    $('#cards').innerHTML = rows.slice(0,limit).map(x=>`<article class="save-card"><button class="card-open" data-action="detail" data-id="${esc(x.id)}">${C.imageURL(x.image)?`<img src="${esc(C.imageURL(x.image))}" alt="" loading="lazy" referrerpolicy="no-referrer">`:`<div class="cover-letter" aria-hidden="true">${esc(label(annotation(x.id).category||x.category).slice(0,2))}</div>`}<span class="card-body"><small>${esc(label(annotation(x.id).category||x.category))} · ${x.hasContent?t('有正文／笔记','Text available'):t('尚未读正文','Title only')}</small><strong>${esc(x.title)}</strong><span>${esc(x.author)}</span>${query?`<span class="search-excerpt">${esc(C.matchSnippet(x,annotation(x.id),query))}</span>`:''}</span></button><button class="star ${annotation(x.id).favorite?'selected':''}" data-action="favorite" data-id="${esc(x.id)}" aria-label="${t('标为常用','Favorite')}" aria-pressed="${!!annotation(x.id).favorite}">${annotation(x.id).favorite?'★':'☆'}</button></article>`).join('') || `<div class="empty"><h2>${isScanning()&&!data.items.length?t('正在取回第一批收藏…','Fetching your first saves…'):t('这里还没有匹配的收藏。','No matching saves here.')}</h2><p>${isScanning()&&!data.items.length?t('第一批到达后会出现在这里，你可以先留在本页。','Your first saves will appear here as soon as they arrive.'):t('换个词试试，或清除筛选。','Try another word, or clear the filters.')}</p>${data.items.length?`<button data-action="clear">${t('清除筛选','Clear filters')}</button>`:''}</div>`;
    $('#more').hidden = rows.length <= limit;
    $('#more').textContent = t('再看一些','Show more');
    $('#cards').querySelectorAll('img').forEach(img=>img.onerror=()=>img.hidden=true);
  }
  function renderLibrary() {
    $('#main').innerHTML = `<section class="library-heading"><div><p class="eyebrow">${t('你的积累，随时可用。','GOOD FINDS, WITHIN REACH.')}</p><h1>${t('我的收藏','My saves')}</h1></div><div class="actions"><button data-action="sync">${t('刷新最新 ↻','Refresh latest ↻')}</button><button class="quiet" data-action="full-sync">${t('扫描全部收藏','Scan all saves')}</button></div></section><div id="scan-progress">${progressHTML()}</div><div class="library-search"><label class="sr-only" for="search">${t('搜索收藏','Search saves')}</label><input id="search" type="search" placeholder="${t('搜关键词、笔记或作者…','Search words, notes, or authors…')}" value="${esc(query)}"><button data-action="organize">${t('整理','Organize')}</button></div><div class="filters"><select id="filter" aria-label="${t('阅读状态','Reading status')}">${[['all',t('全部','Everything')],['unread',t('还没看','Unread')],['favorite',t('常用','Favorites')],['content',t('有文字内容','With text')],['archived',t('已归档','Archived')],['trash',t('回收站','Trash')]].map(([v,l])=>`<option value="${v}" ${filter===v?'selected':''}>${l}</option>`).join('')}</select><select id="topic" aria-label="${t('主题','Topic')}"><option value="">${t('所有主题','All topics')}</option>${C.TOPICS.map(v=>`<option value="${esc(v)}" ${topic===v?'selected':''}>${esc(label(v))}</option>`).join('')}</select><select id="collection" aria-label="${t('合集','Collection')}"><option value="">${t('所有合集','All collections')}</option>${data.collections.map(c=>`<option value="${esc(c.id)}" ${collection===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select><select id="sort" aria-label="${t('排序','Sort')}"><option value="position">${t('收藏顺序','Saved order')}</option><option value="title" ${sort==='title'?'selected':''}>${t('标题顺序','Title')}</option><option value="recent" ${sort==='recent'?'selected':''}>${t('最近加入','Recently added')}</option></select></div><div id="result-count" class="result-count"></div><section id="cards" class="cards"></section><button id="more" data-action="more"></button>`;
    cards(); updateProgress();
    $('#search').oninput = e=>{cancelSearch();query=e.target.value;limit=60;cards();};
    for (const name of ['filter','topic','collection','sort']) $('#'+name).onchange=e=>{if(name==='filter')filter=e.target.value;if(name==='topic')topic=e.target.value;if(name==='collection')collection=e.target.value;if(name==='sort')sort=e.target.value;limit=60;cards();};
  }
  function connectionDialog() {
    if(!credentials&&!sidecourtSession&&config.sidecourtAuth===true)return accountDialog();
    const running = status?.job?.state === 'running', connected = status?.state === 'connected';
    const scan = status?.scan || data.scan;
    let content = '';
    if (!credentials) {
      content = `<p>${t('用小红书确认登录，让 RedBot 只读扫描你自己的收藏。无需上传文件或复制 Cookie。','Confirm sign-in with Xiaohongshu so RedBot can read your own saves. No uploads or copying cookies.')}</p><div class="privacy-note"><strong>${t('这次试用如何保管数据','How this test stores your data')}</strong><p>${t('扫码后保持登录的凭据，以及读出的正文、评论和视频文字，会在 Ming 的测试电脑上分开保存，最长 7 天。已收到的收藏和你的笔记也会保存在当前浏览器，手机上也是如此。远程读取通过 Cloudflare 转发；测试电脑离线时不能读取新内容，已保存的仍可查看。断开连接会删除测试电脑上这次连接的数据，本机副本仍保留。','Ming’s test computer keeps your sign-in credentials and extracted post, comment and video text separately for up to 7 days. Received saves and your notes also stay in this browser, including on your phone. Remote reads pass through Cloudflare. When the test computer is offline, saved content remains available but new reads stop. Disconnecting removes this connection’s data from the test computer and keeps your device copy.')}</p><p>${t('这是浏览器登录连接，并非小红书官方开放的收藏授权。RedBot 不会发帖、点赞、评论或修改你的收藏。','This uses a browser sign-in, not an official favorites OAuth permission. RedBot does not post, like, comment, or change your saves.')}</p></div><form id="connect-form"><label for="invite">${t('试用邀请码','Test invitation code')}</label><input id="invite" value="${esc(invitation)}" autocomplete="off" autocapitalize="none" spellcheck="false" required>${invitation?`<p class="muted">${t('邀请链接已为你填好，确认后连接即可。','Your invitation link filled this in for you.')}</p>`:''}<label class="check-row"><input id="consent" type="checkbox" required><span>${t('我了解以上保管方式，同意连接自己的账号。','I understand this storage arrangement and want to connect my own account.')}</span></label><button class="primary">${t('获取登录码 →','Get sign-in code →')}</button></form>`;
    } else if (status?.state === 'waiting' && status.qr) {
      content = `<p>${t('打开小红书，使用“扫一扫”，在小红书里确认登录。','Open Xiaohongshu, scan this code, and confirm sign-in there.')}</p><img class="login-qr" src="${esc(status.qr)}" alt="${t('小红书登录二维码','Xiaohongshu sign-in QR code')}"><p class="muted">${t('约 4 分钟内有效，请不要把登录码发给别人。','Valid for about 4 minutes. Do not share this sign-in code.')}</p><details><summary>${t('正在同一部手机上使用？','Using only this phone?')}</summary><p>${t('可先保存二维码，再到小红书“扫一扫”选择相册。是否支持识别登录码取决于小红书版本，目前尚未完成真机验证；如果不支持，需要在电脑或另一台设备显示此页。','You can save the code and try choosing it from the photo library in Xiaohongshu’s scanner. Login-code recognition depends on the app version and has not been verified on a real phone. If unsupported, display this page on a second device.')}</p><a download="RedBot-login.png" href="${esc(status.qr)}">${t('保存登录码','Save sign-in code')}</a></details>`;
    } else if (connected) {
      content = `<p class="connected-name">✓ ${esc(status.nickname||t('你的小红书','Your Xiaohongshu'))}</p><div class="scan-facts"><div><strong>${data.items.length}</strong><span>${t('已保存的收藏','Saves kept')}</span></div><div><strong>${data.items.filter(x=>x.description).length}</strong><span>${t('已读到正文','Post texts read')}</span></div><div><strong>0</strong><span>${t('同步所用 AI token','AI tokens for sync')}</span></div></div><p>${scan?t('上次扫描：','Last scan: ')+esc(date(scan.at)):t('登录成功，先显示最新收藏。完整列表可在“我的收藏”里扫描。','Signed in. Recent saves appear first; scan the full list in My saves.')}</p>${scan?`<p class="coverage-note">${t('本次看到','This scan saw')} ${scan.count} ${t('条；新增','saves; new')} ${scan.added||0}，${t('变化','changed')} ${scan.changed||0}。${t(scan.complete?'小红书已返回列表末尾。正文和视频仍需按需读取。':'尚未确认列表末尾，可以再检查。没有出现的旧收藏不会删除；正文和视频需按需读取。',scan.complete?'Xiaohongshu reported the end of the list. Post text and video still need separate reading.':'The end of the list has not been confirmed. You can check again. Missing old saves are kept; post text and video need separate reading.')}</p>`:''}<label class="check-row"><input id="auto" type="checkbox" ${auto?'checked':''}><span>${t('打开或回到页面时，检查最新收藏','Check recent saves when opening or returning to the page')}</span></label><p class="muted">${t('关闭页面后不再发起新扫描；已开始的读取可在后台完成。扫描、去重和本地文字检查不调用大模型。','Closing the page stops new scans. A read already started can finish. Scanning, deduplication and local wording checks do not call a language model.')}</p><button class="primary" data-action="sync" ${running?'disabled':''}>${t('现在刷新','Refresh now')}</button>`;
    } else {
      content = `<p>${running?activity():status?.state==='expired'?t('登录码已过期，重新获取即可。','The sign-in code expired. Get a new one.'):status?.state==='wrong_account'?failure(Error('wrong_account')):t('连接保留在此设备。完成登录后，会先扫描收藏列表。','This device holds your connection. Confirm sign-in to scan your saves.')}</p>${running?`<p class="muted">${elapsed()} · ${status?.job?.kind==='verify'?t('正在确认保留的登录信息。成功后会自动扫描收藏，无需重新输入邀请码。','Checking your saved sign-in. A successful check starts the scan without another invitation.'):t('正在打开小红书登录页，通常需要一些时间。二维码出现后会自动更新；可以先关闭这个窗口。','Opening Xiaohongshu’s sign-in page. This can take a little time. The code will appear here automatically; you can close this panel meanwhile.')}</p>`:''}${!running?`<button class="primary" data-action="login">${status?.canRetryVerification || status?.job?.error==='source_unavailable'?t('重试连接','Retry connection'):t('获取新的登录码','Get a new sign-in code')}</button>`:''}`;
    }
    if (running && connected) content += `<p role="status">${esc(activity())}</p>`;
    if (status?.job?.state==='failed') content += `<p class="error" role="alert">${esc(failure(Error(status.job.error)))}</p>`;
    if (credentials) content += `<p class="muted">${t('本设备已通过邀请验证，有效会话内无需再次输入。','This device has passed the invitation check. You do not need to re-enter it while this session is valid.')}</p><div class="dialog-foot"><button data-action="disconnect" class="quiet danger">${t('断开并删除服务端数据','Disconnect and delete server data')}</button></div>`;
    modal(`<p class="eyebrow">${t('把收藏接回来','YOUR OWN ACCOUNT')}</p><h2>${t('连接小红书','Connect Xiaohongshu')}</h2><p id="connection-error" class="error" role="alert" ${connectionError?'':'hidden'}>${esc(connectionError)}</p><div id="connection-content">${content}</div>`, 'connection');
    $('#connect-form')?.addEventListener('submit', async e=>{
      e.preventDefault(); const consent = $('#consent').checked, code = $('#invite').value.trim();
      e.submitter.disabled = true;
      try {
        invitation = code;
        await refreshConnectionConfig();
        const session = await api('/api/session', {invite:code,consent});
        const apiRoot = apiURL();
        rememberConnection({...session,api:apiRoot,...(config.sidecourtAuth===true&&sidecourtSession?.user?.id?{accountUser:sidecourtSession.user.id}:{})});
        data = normalize({items:[],annotations:{},collections:[],guides:[],goalState:{}});
        goal=''; answer=null; lastFetch=''; onboarding=true; status={state:'needs_sign_in'};
        await startLogin({configReady:true}); render();
      } catch(error) { if(credentials)connectionDialog(); showConnectionError(error); if(e.submitter?.isConnected)e.submitter.disabled=false; }
    });
    $('#auto')?.addEventListener('change',e=>{auto=e.target.checked;localStorage.setItem('redbot.auto',JSON.stringify(auto));});
  }
  async function startLogin({configReady = false} = {}) {
    try { if(!configReady)await refreshConnectionConfig(); startedAt=Date.now(); onboarding=true; const retry=status?.canRetryVerification; await api(retry?'/api/verify':'/api/connect',{}); status={...status,job:{kind:retry?'verify':'connect',state:'running'}}; connectionDialog(); await refreshStatus(); }
    catch(error) { connectionDialog(); showConnectionError(error); }
  }
  async function refreshStatus() {
    if (!credentials || !configValidated || requestActive) return;
    requestActive = true;
    const epoch=readEpoch, snapshotStartedAt=Date.now();
    let connectionReceived = false;
    try {
      const next=await api('/api/connection');
      connectionReceived = true;
      if(epoch!==readEpoch)return;
      status=next;for(const [id,j]of intelligence){if(j.state==='running'&&j.startedAt&&Date.now()-j.startedAt>20000&&next.aiJob?.requestId!==j.requestId)intelligence.set(id,{...j,state:'failed',error:'ai_result_unknown'});}
      await consumeIntelligence(next.aiJob);refreshIntelligence();statusSnapshot={epoch,startedAt:snapshotStartedAt};offline=false;
      if ((onboarding || initial && isScanning() && !data.items.length) && status.state === 'connected') {
        onboarding=false; tab='library';
        if ($('#dialog').open && $('#dialog').dataset.kind==='connection') dismiss();
        render();
      }
      const stamp = String(status.revision ?? '') + ':' + status.scan?.at + ':' + status.scan?.readCount + ':' + (status.job?.state==='done'?status.job.id:'');
      if (stamp !== lastFetch && (status.revision !== undefined || status.scan || ['read','video'].includes(status.job?.kind)&&['done','failed','cancelled'].includes(status.job.state))) {
        const complete=await loadLibrary();if(epoch!==readEpoch)return;if(complete)lastFetch = stamp;
      }
      await reconcileRead();
      if(status.job?.state==='failed' && status.job.id!==lastJob) {if(!['read','video'].includes(status.job.kind))notify(failure(Error(status.job.error)));lastJob=status.job.id;}
      $('#account').textContent=accountLabel(); updateProgress();if($('#source-progress')&&detailId)$('#source-progress').innerHTML=readProgress(item(detailId));
      if ($('#dialog').open && $('#dialog').dataset.kind==='connection') {
        // The consent form never rerenders while it is being completed.
        const scroll = $('#dialog').scrollTop;
        connectionDialog(); $('#dialog').scrollTop=scroll;
      }
      if (status.state==='connected' && auto && recentPending && status.job?.state!=='running' && !document.hidden && !detailId) {
        await refreshRecent();
      }
    } catch(error) {
      // A busy/cooldown response or a rendering exception is not an outage.
      offline=!connectionReceived && ['service_offline','service_unavailable','reader_offline','reader_unavailable','connection_config_unavailable'].includes(error.message);
      if(!offline&&!['busy','scan_cooldown','session_expired'].includes(error.message))console.warn('RedBot refresh did not finish:',error.name);
      $('#account').textContent=accountLabel(); updateProgress();if($('#source-progress')&&detailId)$('#source-progress').innerHTML=readProgress(item(detailId)); if(initial)notify(failure(error));
    }
    finally { requestActive=false;initial=false; }
  }
  async function refreshRecent() {
    if(!credentials)return connectionDialog();
    const scope=libraryKey();if(typeof pollSoon==='function')pollSoon();
    try{const result=await api('/api/recent',{});if(scope!==libraryKey())return;recentPending=false;if(!result.cached)status={...status,job:{id:result.jobId,kind:'recent',state:'running',startedAt:new Date().toISOString()}};updateProgress();}
    catch(error){if(error.message==='busy')recentPending=true;else{recentPending=false;notify(failure(error));}}
  }
  async function sync() {
    if (!credentials) return connectionDialog();
    try { await api('/api/sync',{}); startedAt=Date.now(); status={...status,job:{kind:'scan',state:'running'}}; $('#account').textContent=accountLabel(); if($('#dialog').open && $('#dialog').dataset.kind==='connection')dismiss(); tab='library';render(); notify(t('开始扫描，原有笔记和计划都会保留。','Scanning. Your notes and plans are kept.')); }
    catch(error) { notify(failure(error)); }
  }
  async function disconnect() {
    modal(`<h2>${t('断开这个账号？','Disconnect this account?')}</h2><p>${t('登录会话和服务端收藏会删除；此设备的收藏与个人笔记会保留为离线副本，可导出。下次连接会使用新的独立库。','The sign-in session and server copy will be deleted. This device keeps an offline copy for export. Your next connection gets a separate library.')}</p><div class="actions"><button data-action="confirm-disconnect" class="danger">${t('确认断开并删除','Disconnect and delete')}</button><button data-action="connection">${t('返回','Go back')}</button></div>`, 'disconnect');
  }
  function sourceText(x){return R.blocks(x).filter(b=>b.label!=='Post title').map(b=>b.label+'\n'+b.text).join('\n\n');}
  function readable(x) {
    if(!x)return false;
    if(x.comments?.items?.some(c=>c.text?.trim()))return true;
    if(x.type==='video'&&x.quickReadAt&&x.description?.trim())return true;
    if(x.type==='video')return !!x.videoAnalysis && R.blocks({...x,description:'',summary:'',readingNotes:'',research:null,transcript:''}).some(b=>b.label!=='Post title');
    return R.scan(x).readable;
  }
  function fullSourceReady(x){return x?.contentReadVersion===1&&x.contentReadStatus==='ready';}
  function completeContent(x){return fullSourceReady(x)&&x.insight?.contentVersion===1?x.insight.content||'':'';}
  function contentHTML(value){
    const inline=s=>esc(simple(s)).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
    const html=[],paragraph=[];
    const flush=()=>{if(paragraph.length){html.push(`<p class="prewrap">${inline(paragraph.join('\n'))}</p>`);paragraph.length=0;}};
    for(const line of value.split('\n')){
      if(/^#{1,6} /.test(line)){flush();html.push(`<h3>${inline(line.replace(/^#{1,6} /,''))}</h3>`);}
      else if(!line.trim())flush();
      else paragraph.push(line.replace(/^(\s*)\* +/,'$1• '));
    }
    flush();return html.join('');
  }
  function contentForAI(x){return [x.title,x.author,completeContent(x)].filter(Boolean).join('\n\n');}
  function selected(id) {return detailId===id && $('#dialog').open && $('#dialog').dataset.kind==='detail';}
  function refreshDetail() {
    if(!detailId || !selected(detailId))return;
    const fields=['personal-note','save-topic','save-collection'].map(id=>({id,value:$('#'+id)?.value}));
    const scroll=$('#dialog').scrollTop, focus=document.activeElement?.id;
    const expanded=[...document.querySelectorAll('#dialog-body details')].filter(d=>d.open).map(d=>d.querySelector('summary')?.textContent);
    detail(detailId,{refresh:true});
    fields.forEach(f=>{if(f.value!==undefined&&$('#'+f.id))$('#'+f.id).value=f.value;});
    document.querySelectorAll('#dialog-body details').forEach(d=>{if(expanded.includes(d.querySelector('summary')?.textContent))d.open=true;});
    if(focus&&$('#'+focus))$('#'+focus).focus({preventScroll:true});
    $('#dialog').scrollTop=scroll;
  }
  function contentReadMessage(){
    const j=status?.job||{},names={comments:t('正在读取正文和评论…','Reading text and comments…'),download:t('正在读取视频…','Loading the video…'),audio:t('正在读取完整视频语音…','Reading the full audio…'),frames:t('正在读取视频画面里的文字…','Reading on-screen text…'),visual:t('正在读取视频中的图片和演示…','Reading images and demonstrations…'),images:t('正在读取帖子图片…','Reading post images…')};
    return (names[j.phase]||t('正在读取内容…','Reading content…'))+(j.total>1?` ${Math.min(j.part||0,j.total)}/${j.total}`:'');
  }
  function readProgress(x) {
    if(!x)return '';
    const r=reads.get(x.id), pending=['queued','starting','running'].includes(r?.state);
    let message=r?.state==='queued'?t('正在等待上一项读取结束…','Waiting for the current read to finish…'):r?.state==='starting'?t('正在开始读取…','Starting the read…'):r?.state==='running'?contentReadMessage():r?.error||'';
    if(r?.error&&pending)message+=' '+r.error;
    if(offline&&pending)message=t('正在重新连接，读取结果会自动更新。你可以先看其它收藏。','Reconnecting. The read result will update automatically. You can browse other saves meanwhile.');
    if(!message&&readable(x))message=t('原文已读取。','Source text read.');
    return `<div role="status" aria-live="polite">${esc(message)}</div>${r?.state==='running'?`<button data-action="cancel-read">${t('取消读取','Cancel reading')}</button>`:''}${pending||!credentials||!/^[a-f0-9]{24}$/.test(x.id)?'':`<button data-action="read" data-id="${esc(x.id)}">${t(r?.error?'重试读取':readable(x)?'重新读取':'读取内容',r?.error?'Retry reading':readable(x)?'Read again':'Read content')}</button>`}`;
  }
  async function requestRead(id,{retry=false,briefAfter=false}={}) {
    const x=item(id);if(!x||!credentials||!selected(id))return;
    let r=reads.get(id);
    if(r&&!retry){if(briefAfter)r.briefAfter=true;return;}
    if(r&&['queued','starting','running'].includes(r.state))return;
    r={state:'queued',briefAfter,force:retry,jobId:'',error:'',baseline:readOutcome(x)};reads.set(id,r);refreshDetail();
    await startSelectedRead(id,r);
  }
  async function startSelectedRead(id,r) {
    if(!selected(id)||reads.get(id)!==r||r.state!=='queued')return;
    if(!r.force&&fullSourceReady(item(id))) {r.state='done';refreshDetail();if(r.briefAfter)brief(id);return;}
    if(status?.job?.state==='running') {
      if(status.job.targetId===id&&status.job.kind==='read'){r.state='running';r.jobId=status.job.id;r.epoch=readEpoch;r.acceptedAt=statusSnapshot.startedAt;r.requestStartedAt=Date.parse(status.job.startedAt)||Date.now();refreshDetail();}
      else if(status.readingQueue?.state==='running'&&!r.priorityRequested){r.priorityRequested=true;try{await api('/api/prioritize-read',{id});}catch(error){r.error=failure(error);refreshDetail();}}
      return;
    }
    r.state='starting';r.baseline=readOutcome(item(id));r.requestStartedAt=Date.now();refreshDetail();if(typeof pollSoon==='function')pollSoon();
    try {
      const result=await api('/api/quick-read',{id,full:true});
      const job=result.job||result;
      r.state='running';r.jobId=job.id||result.jobId||'';r.acceptedAt=Date.now();r.epoch=++readEpoch;
      status={...status,job:{...job,id:r.jobId,kind:'read',state:'running',targetId:id}};
      refreshDetail();
    } catch(error) {
      if(error.message==='busy'){r.state='queued';}
      else {r.state='failed';r.error=failure(error);}
      refreshDetail();
    }
  }
  function readOutcome(x) {
    return JSON.stringify([x.contentReadStatus,x.contentReadAttemptedAt,x.contentReadAt,x.contentReadError?.code,x.contentReadError?.at,x.videoAnalysis?.readAt,x.comments?.readAt,x.coverage]);
  }
  function interruptedRead(r) {
    r.state='interrupted';r.error=t('这次读取已中断，或结果无法确认。已有内容已保留；可以手动重试。','This read was interrupted or its result could not be confirmed. Existing content is kept. You can retry manually.');
  }
  function currentAttemptOutcome(x,r) {
    const state=x?.contentReadStatus;
    if(!['ready','empty','failed','cancelled'].includes(state)||readOutcome(x)===r.baseline)return null;
    const since=Math.floor(r.requestStartedAt/1000)*1000,attempt=Date.parse(x.contentReadAttemptedAt),readAt=Date.parse(x.contentReadAt);
    if(!Number.isFinite(since)||!Number.isFinite(attempt)||attempt<since)return null;
    if(['failed','cancelled'].includes(state))return Date.parse(x.contentReadError?.at)>r.acceptedAt?state:null;
    if(!Number.isFinite(readAt)||readAt<=r.acceptedAt)return null;
    if(state==='ready'&&x.type==='video'&&!(Date.parse(x.videoAnalysis?.readAt)>r.acceptedAt||Date.parse(x.comments?.readAt)>r.acceptedAt||Date.parse(x.quickReadAt)>r.acceptedAt))return null;
    return state;
  }
  async function reconcileRead(snapshot=statusSnapshot) {
    const id=detailId,r=reads.get(id);if(!r||!selected(id))return;
    if(r.epoch!==undefined&&(snapshot.epoch!==r.epoch||snapshot.startedAt<r.acceptedAt))return;
    const job=status?.job;
    if(r.state==='queued'){await startSelectedRead(id,r);return;}
    if(r.state!=='running')return;
    const matching=job?.targetId===id&&(!r.jobId||job.id===r.jobId);
    if(matching&&job.state==='running')return;
    if(matching&&['done','failed','cancelled'].includes(job.state)) {
      r.state=job.state;
      if(job.state!=='done')r.error=job.state==='cancelled'?t('读取已取消。可在准备好后重试。','Reading cancelled. Retry when you are ready.'):failure(Error(job.error));
      else if(!readable(item(id)))r.error=t('这次没有取得可用内容。可以重试，或打开原文查看。','No usable content was returned. Retry or open the original.');
    } else {
      // The single job slot may have been lost on restart or replaced after completion.
      // Read only: never replay an accepted mutation to discover its outcome.
      try {
        await loadLibrary();
        if(reads.get(id)!==r||!selected(id)||snapshot.epoch!==readEpoch)return;
        const x=item(id),outcome=currentAttemptOutcome(x,r);
        if(outcome==='ready'&&readable(x)){r.state='done';r.error='';}
        else if(outcome==='failed'||outcome==='cancelled'){r.state=outcome;r.error=outcome==='cancelled'?t('读取已取消。可在准备好后重试。','Reading cancelled. Retry when you are ready.'):x.contentReadError?.code==='service_restarted'?t('服务重启中断了这次读取。已有内容已保留，可手动重试。','A service restart interrupted this read. Existing content is kept. Retry manually.'):failure(Error(x.contentReadError?.code||'source_unavailable'));}
        else if(outcome==='empty'){r.state='empty';r.error=t('这次没有取得可用内容。可以重试，或打开原文查看。','No usable content was returned. Retry or open the original.');}
        else interruptedRead(r);
      } catch {if(reads.get(id)===r&&selected(id))interruptedRead(r);}
    }
    refreshDetail();
    if(r.state==='done'&&!r.error&&r.briefAfter&&selected(id))brief(id);
  }
  async function recoverCancelledRead() {
    const id=detailId,r=reads.get(id),epoch=readEpoch,startedAt=Date.now();if(!r)return;
    try {
      const next=await api('/api/connection');
      if(epoch!==readEpoch||reads.get(id)!==r||!selected(id))return;
      status=next;for(const [id,j]of intelligence){if(j.state==='running'&&j.startedAt&&Date.now()-j.startedAt>20000&&next.aiJob?.requestId!==j.requestId)intelligence.set(id,{...j,state:'failed',error:'ai_result_unknown'});}
      await consumeIntelligence(next.aiJob);refreshIntelligence();statusSnapshot={epoch,startedAt};
      if(next.job?.targetId===id&&next.job.id===r.jobId&&['done','failed','cancelled'].includes(next.job.state)){await loadLibrary();if(epoch!==readEpoch)return;}
      await reconcileRead(statusSnapshot);
    } catch {if(reads.get(id)===r&&selected(id)){interruptedRead(r);refreshDetail();}}
  }
  function renderVersion() {
    for(const selector of ['#app-update','#dialog-update']) {
      const node=$(selector);if(!node)continue;
      node.hidden=!latestVersion;
      node.textContent=t('有新版本，保存并刷新','Update available — save and reload');
    }
  }
  function canAutomaticallyUpdate() {
    return !userInteracted && !detailId && !working && !requestActive && !onboarding && !$('#dialog')?.open;
  }
  async function checkVersion(automatic = false) {
    if(Date.now()-versionCheckedAt<60000)return;
    versionCheckedAt=Date.now();
    try {
      const response=await fetch(new URL('version.json',location.href),{cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(5000)});
      if(!response.ok)return;
      const v=(await response.json()).version;
      const versionNumber=value=>value.split('.').reduce((n,x,i)=>n+Number(x)*1000**(2-i),0);
      if(typeof v!=='string'||!/^\d+\.\d+\.\d+$/.test(v)||versionNumber(v)<=versionNumber(APP_VERSION))return;
      latestVersion=v;renderVersion();
      // Only an untouched fresh page may update itself. Recheck after saving
      // and installing: typing while the new shell downloads must win.
      if(automatic&&!automaticUpdateAttempted&&canAutomaticallyUpdate()) {
        automaticUpdateAttempted=true;
        await reloadUpdatedApp(canAutomaticallyUpdate);
      }
    } catch {}
  }
  async function reloadUpdatedApp(canReload = () => true) {
    if(!canReload())return;
    if(detailId&&$('#personal-note')) {
      data.annotations[detailId]={...annotation(detailId),note:$('#personal-note').value,category:$('#save-topic').value,...($('#save-collection')?{collections:$('#save-collection').value?[$('#save-collection').value]:[]}: {})};
    }
    if($('#brief-form')&&detailId){const a=annotation(detailId);data.annotations[detailId]={...a,buildBrief:{...a.buildBrief,goal:$('#brief-goal').value,promptVersion:3}};}
    if(!await save())return;
    if(!canReload())return;
    try {
      if(typeof navigator!=='undefined' && navigator.serviceWorker) {
        const registration=await navigator.serviceWorker.getRegistration();
        if(registration) {
          await registration.update();
          const worker=registration.installing||registration.waiting;
          if(worker && worker.state!=='activated')await new Promise((resolve,reject)=>{
            const timer=setTimeout(()=>{worker.removeEventListener('statechange',changed);reject(Error('update_pending'));},20000);
            function changed(){if(worker.state==='activated'||worker.state==='redundant'){clearTimeout(timer);worker.removeEventListener('statechange',changed);worker.state==='activated'?resolve():reject(Error('update_failed'));}}
            worker.addEventListener('statechange',changed);changed();
          });
        }
      }
      if(canReload())location.reload();
    } catch {notify(t('更新还在准备，当前内容已保存。稍后再点一次更新即可。','The update is still being prepared. Your content is saved; try updating again shortly.'));}
  }
  function timecode(value){const n=Math.max(0,Math.floor(Number(value)||0));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');}
  function videoProgress(){
    if(status?.job?.kind!=='video'||status.job.state!=='running')return '';
    const from=Date.parse(status.job.startedAt)||videoStartedAt||Date.now();
    return `<p role="status">${t('正在读取视频内容，已用时 ','Reading video content, elapsed ')}${timecode((Date.now()-from)/1000)}${t('。处理可能需要几分钟。','; this may take a few minutes.')}</p><button data-action="cancel-video">${t('取消视频读取','Cancel video reading')}</button>`;
  }
  function commentsHTML(x) {
    const c=x.comments;if(!c)return '';
    const rows=c.items||[], author=rows.filter(r=>r.isAuthor===true),other=rows.filter(r=>r.isAuthor!==true);
    const row=r=>`<p><strong>${t(r.isAuthor===true?'原作者':r.isAuthor===false?'读者':'身份未确认',r.isAuthor===true?'Original author':r.isAuthor===false?'Reader':'Author unknown')}${r.reply?t(' · 回复',' · Reply'):''}</strong></p><blockquote class="prewrap">${esc(r.text)}</blockquote>`;
    return `<section class="comments-reading"><h3>${t('首屏评论','First-page comments')} · ${rows.length}</h3><p class="coverage-note">${esc(date(c.readAt))}</p><p class="coverage-note">${t('已读取首屏评论，非全部；评论是用户说法，不是官方事实。','Only the returned first page was read, not all comments. These are user statements, not official facts.')} ${t(c.hasMore===true?'来源显示还有更多评论。':c.hasMore===false?'未继续加载评论。':'未取得后续评论状态。',c.hasMore===true?'The source indicates more comments.':c.hasMore===false?'No further comments were loaded.':'Further comment availability is unknown.')} ${c.truncated?t('保存内容有长度或条数限制。','Saved comments were limited by count or length.'):''}</p>${author.map(row).join('')}${other.length?`<details><summary>${t('展开其它已返回评论','Read other returned comments')} (${other.length})</summary>${other.map(row).join('')}</details>`:''}${rows.length?'':`<p>${t('本次返回的首屏没有可用评论文字。','No usable comment text was returned on this page.')}</p>`}</section>`;
  }
  function videoHTML(x){
    if(x.type!=='video'&&!x.videoAnalysis)return '';
    const v=x.videoAnalysis,transcript=v?.transcript||[],frames=v?.frames||[];
    const audioNames={transcribed:t('已转录','Transcribed'),no_speech_detected:t('未检测到语音','No speech detected'),no_audio_track:t('视频没有音轨','Video has no audio track')};
    const frameNames={sampled_ocr:t('已均匀采样并读取画面文字','Uniform samples read with OCR'),ocr_setup_required:t('画面文字组件尚未准备好','On-screen text reader needs setup')};
    return `<section class="video-reading"><h3>${t('视频内容','Video content')}</h3><p>${t('按需读取语音与少量画面文字采样，不是完整视觉理解，也不鉴定真假。没有云端模型 token 账单，但会使用测试服务电脑的算力；长视频会分段处理。','Reads speech and sampled on-screen text on request. This is not full visual understanding or a truth check. No cloud-model token bill; processing uses the test host computer. Long videos are processed in chunks.')}</p>${v?`<p class="coverage-note">${t(v.complete?'本次处理完成；覆盖范围仍仅限下列语音与采样。':'本次只得到部分结果，不能视为读完视频。',v.complete?'Processing completed; coverage is limited to speech and samples below.':'Only partial results are available; the video has not been fully read.')} ${v.cached?t('复用相同版本的本机结果。','Reused a local result for the same version.'):''}</p><p>${t('语音：','Audio: ')}${esc(audioNames[v.coverage?.audio]||t('未完成','Not completed'))} · ${t('画面文字：','On-screen text: ')}${esc(frameNames[v.coverage?.frames]||t('未完成','Not completed'))}</p>${v.lastRefreshError?.retainedPrevious?`<p class="warning">${t('最近一次重新读取失败；下方保留上次成功结果，并非这次的新结果。','The latest refresh failed. Results below are from the previous successful read.')} ${esc(failure(Error(v.lastRefreshError.code)))}</p>`:''}${v.error?`<p class="warning">${esc(failure(Error(v.error)))}</p>`:''}${transcript.length?`<details><summary>${t('原始语音转录','Timestamped transcript')}</summary><p class="coverage-note">${t('自动转录可能听错，请对照画面文字或原视频核对。','Automatic transcripts may mishear speech. Check against on-screen text or the original video.')}</p>${transcript.map(t=>`<p><time>${timecode(t.start)}–${timecode(t.end)}</time> ${esc(t.text)}</p>`).join('')}</details>`:''}${frames.length?`<details><summary>${t('采样画面中的文字','Text from sampled frames')} (${frames.length})</summary>${frames.map(f=>`<p><time>${timecode(f.at)}</time> ${esc((f.text||[]).map(t=>t.text).join(' ')||t('此采样未读出文字','No text read in this sample'))}</p>`).join('')}</details>`:''}`:''}</section>`;
  }
  function detail(id,{refresh=false}={}) {
    const x=item(id);if(!x)return;detailId=id;
    if(!reads.has(id)&&['failed','cancelled','empty'].includes(x.contentReadStatus))reads.set(id,{state:x.contentReadStatus,error:failure(Error(x.contentReadError?.code||'source_unavailable'))});
    const a=annotation(id),content=completeContent(x),ready=fullSourceReady(x),pending=['queued','starting','running'].includes(reads.get(id)?.state);
    const comments=x.comments,partialComments=ready&&(!comments||comments.hasMore!==false||comments.truncated);
    modal(`<button id="dialog-update" data-action="update-app" hidden></button>
      <div class="detail-head"><p class="eyebrow">${esc(label(a.category||x.category))}</p><h2>${esc(x.title)}</h2><p class="muted">${esc(x.author)}</p></div>
      <section class="useful-summary content-description">
        ${content?`<button class="primary content-copy" data-action="copy-content" data-id="${esc(id)}">${t('复制给 AI','Copy for AI')}</button>`:''}
        ${content?`<div class="content-text">${contentHTML(content)}</div>`:`<p id="content-wait">${t('正在读取内容，完成后会直接显示在这里。','Reading this save. The useful content will appear here when ready.')}</p>`}
        ${!ready||pending?`<div id="source-progress">${readProgress(x)}</div>`:''}
        ${ready?`<div id="intelligence-progress">${intelligenceProgress(id)}</div>`:''}
        ${partialComments?`<p class="muted">${t('评论尚未全部取得；下文包含本次已读到的有用补充。','Some comments could not be loaded. This includes useful additions from the comments received.')}</p>`:''}
      </section>`, 'detail');
    renderVersion();
    if(credentials&&ready&&!content&&!pending&&(!intelligence.has(id)||intelligence.get(id).state==='done'))void requestInsight(id);
    if(!refresh&&credentials&&status?.state==='connected'&&/^[a-f0-9]{24}$/.test(id)&&!ready&&!reads.has(id))void requestRead(id);
  }
  function repoHTML(checks) {
    return checks.map(c=>`<p><a href="${esc(R.safeLink(c.url))}" target="_blank" rel="noopener noreferrer">${esc(c.repo)} ↗</a><br>${c.status==='checked'?`${t('许可证','License')}: ${esc(c.license)} · ${c.archived?t('已归档','Archived'):t('未归档','Not archived')}<br>${t('最近推送','Last push')} ${esc(c.pushedAt?.slice(0,10)||'—')}`:t('尚未核实，不据此判断风险。','Not verified; no risk verdict.')}<br><small>${t('查询时间','Checked')} ${esc(date(c.checkedAt))} · ${t('不涵盖 API 费用或依赖授权。','Does not verify API costs or dependency terms.')}</small></p>`).join('');
  }
  function simple(value){return window.RedBotText?.simplify(value)||value;}
  function intelligenceProgress(id){
    const job=intelligence.get(id)||((status?.aiJob?.targetId===id)?status.aiJob:null);if(!job)return '';
    if(job.state==='running')return `<p role="status">${t(job.phase==='adapting'?'正在结合你的目标整理…':'正在写出有用内容，完成后可复制…',job.phase==='adapting'?'Adapting to your goal…':'Writing the useful content. Copy when complete…')}</p>${job.partialContent?`<div class="content-text content-preview">${contentHTML(job.partialContent)}</div>`:''}`;
    if(job.state==='failed')return `<p role="alert">${esc(failure(Error(job.error||'ai_unavailable')))}</p><button data-action="${job.kind==='assistant'?'retry-assistant':'insight'}" data-id="${esc(id)}">${t('重试','Try again')}</button>`;
    return '';
  }
  async function requestInsight(id,goalValue=null,note=''){
    if(!credentials)return notify(t('连接账号后可使用内容理解。','Connect your account to use understanding.'));
    const scope=libraryKey(),kind=goalValue===null?'insight':'assistant',requestId=crypto.randomUUID(),startedAt=Date.now();
    intelligence.set(id,{state:'running',kind,targetId:id,phase:'queued',requestId,startedAt});refreshIntelligence();if(typeof pollSoon==='function')pollSoon();
    try{
      const job=await api(kind==='insight'?'/api/insight':'/api/assistant',{id,requestId,...(goalValue===null?(typeof selected==='function'&&selected(id)?{full:true}:{fast:true}):{goal:goalValue,note})});
      if(scope!==libraryKey())return;
      intelligence.set(id,{...job,startedAt}); await consumeIntelligence(job); refreshIntelligence();if(job.kind==='insight'&&job.state==='done')refreshDetail();
    }catch(error){
      if(scope!==libraryKey())return;
      intelligence.set(id,{state:['service_offline','reader_unavailable'].includes(error.message)?'running':'failed',kind,targetId:id,error:error.message,requestId,startedAt});refreshIntelligence();
    }
  }
  async function consumeIntelligence(job){
    if(!job?.targetId)return;const pending=intelligence.get(job.targetId);
    if(pending?.state==='running'&&pending.requestId&&pending.requestId!==job.requestId)return;
    const receipt=libraryKey()+':'+(job.id||job.targetId+':'+job.kind+':'+job.result?.sourceHash);
    if(job.state==='done'&&consumedJobs.has(receipt))return;
    intelligence.set(job.targetId,{...job,startedAt:pending?.startedAt||Date.parse(job.startedAt)||Date.now()});
    if(job.state==='done'&&job.result){
      consumedJobs.add(receipt);
      if(job.kind==='insight'){const x=item(job.targetId);if(x){const normalized=C.normalizeInsight(job.result);if(!normalized){intelligence.set(job.targetId,{...job,state:'failed',error:'ai_result_unsupported'});return;}x.insight=normalized;await save();if(detailId===job.targetId&&$('#dialog').dataset.kind==='detail')refreshDetail();}}
      else {const a=annotation(job.targetId);data.annotations[job.targetId]={...a,buildBrief:{...a.buildBrief,result:job.result}};await save();}
    }
  }
  function refreshIntelligence(){
    refreshQuickAnswer();
    prepareQuickAnswer();
    if($('#intelligence-progress')&&detailId)$('#intelligence-progress').innerHTML=intelligenceProgress(detailId);
    if($('#content-wait')&&detailId)$('#content-wait').hidden=!!intelligence.get(detailId)?.partialContent;
    if($('#dialog').dataset.kind==='brief'&&detailId){
      const pending=intelligence.get(detailId), result=annotation(detailId).buildBrief?.result;
      if($('#brief-progress'))$('#brief-progress').innerHTML=intelligenceProgress(detailId);
      if(result&&$('#brief-output')){$('#brief-answer').textContent=simple(result.answer);$('#brief-output').value=simple(result.prompt);$('#brief-result').hidden=false;}
      if($('#brief-submit'))$('#brief-submit').disabled=pending?.state==='running';
    }
  }
  function brief(id) {
    const x=item(id),a=annotation(id),d=a.buildBrief||{};if(!x)return;detailId=id;
    if(!readable(x)){detail(id);return requestRead(id,{briefAfter:true});}
    modal(`<h2>${t('用到我的事情里','Use it for my goal')}</h2><p class="muted">${esc(x.title)}</p><form id="brief-form"><label for="brief-goal">${t('你想做什么？','What do you want to do?')}</label><textarea id="brief-goal" maxlength="600" rows="3" placeholder="${t('例如：用这个方法，验证我的第一个付费产品','For example: use this method to validate my first paid product')}">${esc(d.promptVersion===3?d.goal||'':'')}</textarea>${a.note?`<label class="check-row"><input id="include-note" type="checkbox"><span>${t('加入我的笔记','Include my note')}</span></label>`:''}<button id="brief-submit" class="primary">${t('帮我用起来 →','Make it useful →')}</button></form><div id="brief-progress"></div><section id="brief-result" hidden><p id="brief-answer" class="summary-lead"></p><label for="brief-output">${t('复制给 Codex 或你常用的 AI','Copy into Codex or your AI')}</label><textarea id="brief-output" rows="9" readonly></textarea><div class="actions"><button class="primary" data-action="copy-brief">${t('复制指令','Copy prompt')}</button><button data-action="download-brief">${t('下载文本','Download text')}</button></div></section>`, 'brief');
    $('#brief-form').onsubmit=async e=>{e.preventDefault();const targetGoal=$('#brief-goal').value.trim();const note=$('#include-note')?.checked?(a.note||'').slice(0,800):'';data.annotations[id]={...annotation(id),buildBrief:{...d,goal:targetGoal,promptVersion:3,result:null}};await save();$('#brief-result').hidden=true;await requestInsight(id,targetGoal,note);};
    refreshIntelligence();
  }
  function settings() {
    modal(`<h2>${t('设置与我的数据','Settings and my data')}</h2><p>RedBot v${APP_VERSION}</p><button id="dialog-update" data-action="update-app" ${latestVersion?'':'hidden'}>${t('有新版本，保存并刷新','Update available — save and reload')}</button><p>${t('个人笔记和计划保存在这个浏览器。换设备前，先导出备份。','Your notes and plans stay in this browser. Export a backup before switching devices.')}</p><div class="setting"><span>${t('导出当前收藏、笔记与计划','Export this library, notes and plan')}</span><button data-action="export">${t('导出','Export')}</button></div><div class="setting"><span>${t('从 RedBot 备份恢复','Restore a RedBot backup')}</span><button data-action="import">${t('恢复备份','Restore')}</button></div><div class="setting"><span>${t('原有设备收藏与当前账号分别保管','Device saves stay separate from account saves')}</span><button data-action="device-copy">${t('查看设备副本','Device copy')}</button></div><div class="setting"><span>${t('添加一个链接（备用入口）','Add a link (optional)')}</span><button data-action="add">${t('添加','Add')}</button></div><div class="setting"><span>${t('不记得原词，也能找','Search beyond exact words')}</span><button data-action="ai">${t('搜索设置','Search settings')}</button></div><p class="muted">${t('这里的归档、回收站和合集只整理 RedBot 副本，不会改动小红书。','Archiving, trash and collections only organize your RedBot copy. Xiaohongshu is unchanged.')}</p>`, 'settings');
  }
  function organize() {
    modal(`<h2>${t('给这些收藏一个去处','A place for related saves')}</h2><form id="collection-form"><label for="collection-name">${t('新合集名称','New collection name')}</label><input id="collection-name" required maxlength="60" placeholder="${t('比如：下个产品、周末做饭','Next product, weekend recipes…')}"><button class="primary">${t('创建合集','Create collection')}</button></form><p class="muted">${t('打开任意收藏，在笔记区域选择合集。不会改变小红书中的分组。','Open a save and choose its collection below your note. This does not change Xiaohongshu folders.')}</p>`, 'organize');
    $('#collection-form').onsubmit=e=>{e.preventDefault();const name=$('#collection-name').value.trim();if(!name)return;if(data.collections.some(c=>c.name===name))return notify(t('这个合集已存在。','This collection already exists.'));data.collections.push({id:'c-'+crypto.randomUUID(),name});save();dismiss();tab='library';render();};
  }
  function download(value, name, mime='text/plain') {const u=URL.createObjectURL(new Blob([value],{type:mime}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
  async function useDeviceCopy() {
    if(credentials) {notify(t('请先断开当前账号，再查看设备副本；可先导出当前收藏。','Disconnect this account before opening the device copy. You can export first.'));return;}
    offlineKey=null;resetSearchScope();localStorage.removeItem('redbot.offline-key');data=normalize(await cacheRead('current')||stored('shelf.library.v1',{}));dismiss();tab='library';render();
  }
  function addLink() {
    modal(`<h2>${t('补充一条收藏','Add a reference')}</h2><form id="add-form"><label for="add-url">${t('链接','Link')}</label><input id="add-url" type="url" required><label for="add-title">${t('标题','Title')}</label><input id="add-title" required><label for="add-text">${t('原文片段或笔记（可选）','Source text or notes (optional)')}</label><textarea id="add-text" rows="4"></textarea><p class="muted">${t('只保存链接不会自动读完网页或视频。','Saving a link does not read the page or watch the video.')}</p><button class="primary">${t('保存','Save')}</button></form>`, 'add');
    $('#add-form').onsubmit=e=>{e.preventDefault();data.items=C.mergeItems(data.items,[{url:$('#add-url').value,title:$('#add-title').value,description:$('#add-text').value}]).items;save();dismiss();tab='library';render();};
  }
  function aiDialog() {
    modal(`<h2>${t('不记得原词，也能找','Search without the exact words')}</h2><p>${t('下载一个多语言模型，在此设备上匹配你的问题和收藏文字。没有云端模型 token 账单，但会使用网络流量、内存和电量。','Download a multilingual model to match your goal to saved text on this device. No cloud-model token bill; it uses bandwidth, memory and battery.')}</p><p class="coverage-note">${t('检索当前库的全部已保存文字，长文会分段处理；进度会显示实际覆盖数量。向量缓存按账号隔离，内容变化后重新计算。未读正文和未读取的视频不在证据中。','Searches all saved text in the active library, splitting long text into chunks. Progress shows actual coverage. Vector caches are account-isolated and refreshed when text changes. Unread posts and videos are not evidence.')}</p><p id="ai-progress" role="status"></p><div class="actions"><button class="primary" data-action="enable-ai">${t('下载并开启','Download and enable')}</button><button data-action="disable-ai">${t('使用基础匹配','Use basic matching')}</button></div>`, 'ai');
  }
  async function act(action, target) {
    const id=target.dataset.id, x=id&&item(id), a=id&&annotation(id);
    if(action==='connection') {connectionDialog();return refreshStatus();}
    if(action==='login')return startLogin();
    if(action==='sync')return refreshRecent();
    if(action==='full-sync')return sync();
    if(action==='disconnect')return disconnect();
    if(action==='confirm-disconnect') {
      target.disabled=true;
      try {const oldScope=libraryKey();cancelSearch();await api('/api/disconnect',{});let cacheCleared=false;try{const cleared=await Promise.race([RedBotAI.clearCache(oldScope),new Promise((_,reject)=>setTimeout(()=>reject(Error('cache_timeout')),15000))]);cacheCleared=cleared.cleared===true;}catch{}await save();const offline='offline:'+credentials.sessionId;const base=await database();await new Promise((resolve,reject)=>{const tx=base.transaction('library','readwrite');tx.objectStore('library').put(data,offline);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});offlineKey=offline;localStorage.setItem('redbot.offline-key',JSON.stringify(offline));rememberConnection(null);status=null;dismiss();render();notify(t('已断开，服务端数据已删除。当前副本可先导出；不会混入下一次账号连接。','Disconnected. Server data deleted. Export this offline copy before connecting again.'));if(!cacheCleared)notify(t('账号已断开，但此浏览器的旧向量缓存未确认删除。请在浏览器站点设置中清除此站点数据；先导出离线收藏。','Disconnected, but deletion of old vector cache was not confirmed. Export your offline saves, then clear this site’s data in browser settings.'));}
      catch(error) {notify(failure(error));target.disabled=false;}return;
    }
    if(action==='retry-status'){try {await refreshConnectionConfig();await refreshStatus();}catch(error){showConnectionError(error);}return;}
    if(['read-all','retry-all','pause-reading'].includes(action)){
      target.disabled=true;
      try {const q=await api(action==='pause-reading'?'/api/pause-reading':'/api/read-all',{retryFailed:action==='retry-all'});status={...status,readingQueue:q};updateProgress();await refreshStatus();}
      catch(error){notify(failure(error));target.disabled=false;}return;
    }
    if(action==='cancel-sync'){target.disabled=true;try{await api('/api/cancel-sync',{});await refreshStatus();}catch(error){notify(failure(error));target.disabled=false;}return;}
    if(action==='home'||action==='library'){tab=action==='home'?'home':'library';dismiss();render();return;}
    if(action==='demo'){if(credentials)return notify(t('连接账号时不混入示例收藏。','Examples stay separate from your connected account.'));const s=window.REDBOT_SEED;data.items=C.mergeItems(data.items,s.items).items;const guides=new Map(data.guides.map(g=>[g.id,g]));s.guides.forEach(g=>guides.set(g.id,g));data.guides=[...guides.values()];save();render();return;}
    if(action==='choice'){choice=target.dataset.choice;return findStart();}
    if(action==='keep'){if(answer?.status!=='ready')return;data.goalState.plan={goal,choice:choice||answer.guide?.id||(answer.source?'save:'+answer.source.id:''),status:'ready',sourceId:answer.source?.id||'',updatedAt:new Date().toISOString()};save();notify(t('已记住，下次从这里继续。','Saved. Continue here next time.'));return;}
    if(action==='resume'){goal=data.goalState.plan.goal;choice=data.goalState.plan.choice;return findStart();}
    if(action==='skip'){const key=C.hash(goal.toLowerCase());data.goalState.skips[key]=[...new Set([...(data.goalState.skips[key]||[]),answer.guide?.id||answer.source?.id||''])];choice='';save();return findStart();}
    if(action==='favorite'||action==='read-mark'||action==='archive'||action==='trash'){const key={favorite:'favorite','read-mark':'read',archive:'archived',trash:'trashed'}[action];data.annotations[id]={...a,[key]:!a[key]};save();render();if($('#dialog').open)detail(id);return;}
    if(action==='detail')return detail(id);
    if(action==='cancel-video'||action==='cancel-read'){target.disabled=true;try{await api(action==='cancel-video'?'/api/cancel-video':'/api/cancel-read',{});await refreshStatus();}catch(error){if(['no_read_running','no_video_running'].includes(error.message)){await recoverCancelledRead();return;}const r=reads.get(detailId);if(r)r.error=failure(error);refreshDetail();}return;}
    if(action==='video'){target.disabled=true;try{await api('/api/video',{id});videoStartedAt=Date.now();status={...status,job:{kind:'video',state:'running',startedAt:new Date().toISOString()}};if($('#video-progress'))$('#video-progress').innerHTML=videoProgress();$('#account').textContent=accountLabel();}catch(error){notify(failure(error));target.disabled=false;}return;}
    if(action==='read')return requestRead(id,{retry:true});
    if(action==='update-app')return reloadUpdatedApp();
    if(action==='note'){data.annotations[id]={...a,note:$('#personal-note').value,category:$('#save-topic').value,...($('#save-collection')?{collections:$('#save-collection').value?[$('#save-collection').value]:[]}: {})};await save();notify(t('笔记已保存。','Note saved.'));render();return;}
    if(action==='repo-check'){target.disabled=true;const checks=await R.fetchProjects(R.githubProjects(x));data.annotations[id]={...annotation(id),projectChecks:checks};save();if(detailId===id&&$('#repo-results'))$('#repo-results').innerHTML=repoHTML(checks);target.disabled=false;return;}
    if(action==='quick-copy')return copyQuickAnswer(id);
    if(action==='quick-download')return download($('#quick-output').value,'RedBot-to-AI.txt');
    if(action==='quick-select'){const selected=answer?.matches?.find(r=>r.source?.id===id);if(selected){cancelSearch();answer={...selected,matches:answer.matches,goal};refreshQuickAnswer();prepareQuickAnswer();}return;}
    if(action==='quick-more'){ideaLimit+=6;refreshQuickAnswer();return;}
    if(action==='brief')return brief(id);
    if(action==='insight'){intelligence.delete(id);return requestInsight(id);}
    if(action==='retry-assistant'){const draft=annotation(id).buildBrief||{};return requestInsight(id,draft.goal||'',$('#include-note')?.checked?annotation(id).note||'':'');}
    if(action==='sidecourt')return accountDialog();
    if(action==='account-check')return checkAccount({resume:true});
    if(action==='account-bind')return bindAccount();
    if(action==='copy-content'){const x=item(id);if(!completeContent(x))return;try{await copyText(contentForAI(x));notify(t('已复制，直接粘贴给 AI 即可。','Copied. Paste it into your AI.'));}catch{notify(t('复制失败，请选中文字复制。','Could not copy. Select the text to copy it.'));}return;}
    if(action==='copy-brief'){try{await copyText($('#brief-output').value);notify(t('已复制，可粘贴到项目里的工具。','Copied. Paste it into your assistant with the project open.'));}catch{notify(t('复制失败，可以下载文本。','Copy failed. Download the text instead.'));}return;}
    if(action==='download-brief')return download($('#brief-output').value,'RedBot-build-brief.txt');
    if(action==='settings')return settings();
    if(action==='organize')return organize();
    if(action==='clear'){query='';filter='all';topic='';collection='';renderLibrary();return;}
    if(action==='more'){limit+=60;cards();return;}
    if(action==='export')return download(JSON.stringify(data,null,2),'RedBot-backup-'+new Date().toISOString().slice(0,10)+'.json','application/json');
    if(action==='import')return $('#backup-file').click();
    if(action==='device-copy')return useDeviceCopy();
    if(action==='add')return addLink();
    if(action==='ai')return aiDialog();
    if(action==='cancel-search'){cancelSearch();render();notify(t('已取消查找。若本机缓存可用，已完成的文字片段可在下次复用。','Search cancelled. Completed text chunks can be reused next time if local caching is available.'));return;}
    if(action==='disable-ai'){cancelSearch();ai=false;localStorage.setItem('redbot.semantic','false');dismiss();render();return;}
    if(action==='enable-ai'){
      const generation=++aiLoadGeneration,scope=libraryKey(),current=()=>generation===aiLoadGeneration&&scope===libraryKey()&&$('#dialog').open&&$('#dialog').dataset.kind==='ai';
      target.disabled=true;$('#ai-progress').textContent=t('正在下载模型，首次需要一些时间…','Downloading the model. The first load takes a little time…');
      RedBotAI.progress((message,coverage,download)=>{if(!current())return;const node=$('#ai-progress');if(!node)return;const names={initiate:t('准备文件','Preparing file'),download:t('下载文件','Downloading file'),progress:t('下载中','Downloading'),done:t('文件已就绪','File ready'),ready:t('模型已就绪','Model ready')};node.textContent=download?(names[download.status]||t('正在加载','Loading'))+(download.file?' · '+download.file:'')+(download.progress===null?'':' · '+download.progress+'%'):message;});
      try{RedBotAI.setScope(scope);await RedBotAI.load();if(!current())return;ai=aiReady=true;localStorage.setItem('redbot.semantic','true');dismiss();render();notify(t('语义搜索已开启，仅在此设备运行。','Meaning search enabled on this device.'));}
      catch(error){if(!current())return;$('#ai-progress').textContent=t('模型加载暂未完成，可能是下载缓慢或浏览器资源不足。已下载的浏览器缓存会保留；可重试，或先用基础匹配。','Model loading did not finish. Downloads may be slow or browser resources limited. Downloaded browser caches are kept. Retry or use basic matching.');target.disabled=false;}return;
    }
    if(action==='language'){lang=lang==='zh'?'en':'zh';localStorage.setItem('redbot.language',JSON.stringify(lang));dismiss();render();return;}
  }
  async function init() {
    for(const event of ['input','pointerdown','keydown'])document.addEventListener(event,()=>{userInteracted=true;},{capture:true,passive:true,once:true});
    document.addEventListener('click',e=>{const button=e.target.closest('[data-action]');if(button&&!button.disabled)act(button.dataset.action,button).catch(error=>notify(failure(error)));});
    $('#dialog-close').onclick=dismiss;
    $('#dialog').addEventListener('cancel',e=>{e.preventDefault();dismiss();});
    $('#dialog').addEventListener('click',e=>{if(e.target===$('#dialog')){const r=$('#dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dismiss();}});
    $('#backup-file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>45*1024*1024)throw Error();const raw=JSON.parse(await f.text());if(!Array.isArray(raw.items))throw Error();data.items=C.mergeItems(data.items,raw.items).items;data.annotations={...raw.annotations,...data.annotations};const cs=new Map(data.collections.map(c=>[c.id,c]));for(const c of raw.collections||[])if(!cs.has(c.id))cs.set(c.id,c);data.collections=[...cs.values()];if(!data.goalState?.plan&&raw.goalState)data.goalState=C.normalizeGoalState(raw.goalState);const gs=new Map(data.guides.map(g=>[g.id,g]));for(const g of raw.guides||[]){const n=C.normalizeGuide(g);if(n&&!gs.has(n.id))gs.set(n.id,n);}data.guides=[...gs.values()];data.remoteCursor=null;libraryPage=null;lastFetch='';await save();dismiss();tab='library';render();notify(t('备份已合并，已有笔记保留。','Backup merged. Existing notes are kept.'));}catch{notify(t('无法读取这份备份，请选择有效的 RedBot JSON 备份。','Could not read this backup. Choose a valid RedBot JSON backup.'));}e.target.value='';};
    resetSearchScope();
    try {data=normalize(await cacheRead()||(!credentials?stored('shelf.library.v1',{}):{}));}catch{}
    // Browsing the saved device copy must not wait for any network request.
    render();
    if(typeof performance!=='undefined')$('#main')?.setAttribute('data-redbot-ready-ms',String(Math.round(performance.now())));
    // A failed reader must not delay discovering a fixed app version.
    void checkVersion(true);
    try {await refreshConnectionConfig();}
    catch(error) {
      connectionError=failure(error);
      if(credentials){offline=true;updateProgress();}
    }
    await initAccount();
    if(invitation&&!credentials)connectionDialog();
    if(credentials)await refreshStatus();
    // One foreground timer. A user action must wake an idle 30-second poll.
    let pollTimer=null,polling=false;
    const reconnectDelay=5000;
    const poll = async () => {
      if(polling)return;
      polling=true;
      try {
        if (!document.hidden && credentials){
          if((!configValidated||offline)&&Date.now()-configCheckedAt>=reconnectDelay){try{await refreshConnectionConfig();}catch{}}
          await refreshStatus();
        }
      } finally {
        polling=false;clearTimeout(pollTimer);
        const pending=Array.from(intelligence.values()).some(j=>j.state==='running')||Array.from(reads.values()).some(r=>['queued','starting','running'].includes(r.state));
        const reconnecting=!document.hidden&&credentials&&(!configValidated||offline);
        pollTimer=setTimeout(poll,reconnecting?reconnectDelay:libraryPage?100:pending||status?.job?.state==='running'||status?.aiJob?.state==='running'||status?.state==='waiting'?800:30000);
      }
    };
    pollSoon=()=>{clearTimeout(pollTimer);pollTimer=setTimeout(poll,100);};
    pollSoon();
    document.addEventListener('visibilitychange',()=>{if(!document.hidden){void checkVersion();if(credentials){recentPending=true;pollSoon();}}});
    window.addEventListener('hashchange',()=>{
      const code=new URLSearchParams(location.hash.slice(1)).get('invite');
      if(code){invitation=code;history.replaceState(null,'',location.pathname+location.search);if(!credentials)connectionDialog();}
    });
  }
  init();
})();
