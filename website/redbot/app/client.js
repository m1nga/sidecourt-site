/* RedBot account-first web client. User text is never passed through translation. */
(() => {
  'use strict';
  const C = ShelfCore, R = RedBotCheck, APP_VERSION = '1.9.3';
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
  let toastTimer, dialogFocus, db;
  const reads = new Map();
  let readEpoch = 0, statusSnapshot = {epoch:0,startedAt:0};
  let latestVersion = '', versionCheckedAt = 0, aiLoadGeneration = 0;
  let onboarding = false, offline = false, startedAt = 0, connectionError = '';
  let bootstrapPending, configValidated = false;
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
    const fresh = await api('/api/library');
    data.items = C.mergeItems(data.items, fresh.items || []).items;
    data.scan = fresh.scan;
    await save();
    if (tab === 'library' && $('#cards')) { cards(); updateProgress(); }
    else if (tab === 'home' && $('#goal-form')) updateProgress();
    else render();
  }
  function cancelSearch(){searchGeneration++;window.RedBotAI?.cancel();working=false;searchProgress='';}
  function resetSearchScope(){reads.clear();cancelSearch();window.RedBotAI?.setScope(libraryKey());answer=null;searchCoverage=null;}
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
  // Only the shipped same-origin configuration may select a remote endpoint.
  // Never replay a session/connect mutation after a timeout: its result is unknown.
  async function refreshConnectionConfig() {
    if (bootstrapPending) return bootstrapPending;
    bootstrapPending = (async () => {
      let next;
      try {
        if (['127.0.0.1','localhost'].includes(location.hostname)) {
          const response = await fetch('/api/capabilities', {cache:'no-store', credentials:'omit', redirect:'error', signal:AbortSignal.timeout(5000)});
          if (response.ok && (await response.json()).redbotConnector === 1) next = {api:location.origin};
        }
        if (!next) {
          const response = await fetch(new URL('connection.json', location.href), {cache:'no-store', credentials:'omit', redirect:'error', signal:AbortSignal.timeout(5000)});
          if (!response.ok) throw Error();
          next = await response.json();
          if (!next || typeof next.api !== 'string' || !/^https:\/\/[a-z0-9.-]+(?::\d+)?$/.test(next.api)) throw Error();
        }
      } catch { configValidated = false; throw Error('connection_config_unavailable'); }
      config = next;
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
    if (!configValidated || !root) throw Error('connection_config_unavailable');
    let response;
    try {
      response = await fetch(root + path, {method:body ? 'POST' : 'GET', credentials:'omit', referrerPolicy:'no-referrer', headers:{...(credentials ? {Authorization:'Bearer ' + credentials.token} : {}), ...(body ? {'Content-Type':'application/json'} : {})}, ...(body ? {body:JSON.stringify(body)} : {}), signal:AbortSignal.timeout(15000), cache:'no-store'});
    } catch { throw Error('service_offline'); }
    let result;
    try { result = await response.json(); } catch { throw Error('service_offline'); }
    if (!response.ok) {
      if (response.status === 401 && result.error === 'session_expired' && requestSession) await recoverExpiredConnection(requestSession);
      throw Error(result.error || 'service_unavailable');
    }
    return result;
  }
  function failure(error) {
    const messages = {
      connection_config_unavailable:t('未能读取连接地址，尚未发起登录。请再次点击获取登录码以重新读取；已有收藏和连接信息保留。','Could not load the connection address. Sign-in has not started. Click Get sign-in code to retry; your saves and connection are kept.'),
      service_offline:t('暂时联系不上 RedBot 登录服务，尚未取得二维码。可再次点击连接按钮重试；若仍失败，需要恢复测试服务。已有收藏保留。','RedBot’s sign-in service cannot be reached, so no QR code was issued. Click the connection button to retry; if it persists, the test host needs to be restored. Your saves are kept.'),
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
      source_unavailable:t('小红书暂时没有返回内容。已有收藏保留，可稍后重试或重新连接。','Xiaohongshu did not return content. Your saves are kept; retry or reconnect later.'),
      scan_incomplete:t('本次没有读到列表末尾，已收到的收藏会保留。','The end of the list was not reached. Saves already received are kept.'),
      sync_first:t('先刷新收藏，更新这篇笔记的访问链接。','Refresh your saves to update access to this post.'),
      video_busy:t('另一段视频正在处理，请稍后重试。','Another video is being processed. Try later.'),
      video_cancelled:t('视频读取已取消，原收藏和笔记保留。','Video reading cancelled. Saves and notes are kept.'),
      video_timeout:t('视频处理超时。已有文字保留，可稍后再试或打开原视频。','Video processing timed out. Existing text is kept; retry later or open the source.'),
      video_duration_limit:t('目前只支持 10 分钟以内的视频。请打开原视频查看。','Currently supports videos up to 10 minutes. Open the original for longer videos.'),
      video_too_large:t('视频超过 100 MB，暂时无法读取。请打开原视频。','This video exceeds 100 MB. Open the original.'),
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
  function render() {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.title = t('RedBot — 找回收藏，马上用起来','RedBot — Put your saves to use');
    $('#nav-home').textContent = t('现在想做','For now');
    $('#nav-library').textContent = t('我的收藏','My saves');
    $('#nav-home').ariaCurrent = tab === 'home' ? 'page' : 'false';
    $('#nav-library').ariaCurrent = tab === 'library' ? 'page' : 'false';
    $('#account').textContent = activity();
    $('#language').textContent = lang === 'zh' ? 'EN' : '中文';
    $('#language').ariaLabel = t('切换到英文','Switch to Chinese');
    $('#settings').ariaLabel = t('设置与备份','Settings and backups');
    $('#foot-copy').textContent = t('收藏是为了用上的。','Saved for a reason.') + ' · v' + APP_VERSION;
    renderVersion();
    $('#sidecourt-link').textContent = t('SideCourt 上的小工具 ↗','A small tool on SideCourt ↗');
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
    if (offline && credentials) return `<aside class="scan-panel warning" role="status"><strong>${t('暂时联系不上同步服务','Sync service is unavailable')}</strong><p>${t('已到达的收藏可以继续查看。恢复连接后再更新。','You can keep browsing saves already received. Updates will resume when the service returns.')}</p><button data-action="retry-status">${t('重新连接','Retry connection')}</button></aside>`;
    if (credentials && status?.state !== 'connected' && status?.job?.state === 'failed') return `<aside class="scan-panel warning" role="status"><strong>${t('连接需要恢复，已有收藏仍在','Restore the connection; your saves are kept')}</strong><p>${esc(failure(Error(status.job.error)))}</p><button data-action="connection">${t('恢复连接','Restore connection')}</button></aside>`;
    if (isScanning()) return `<aside class="scan-panel" role="status" aria-live="polite"><div class="scan-title"><span class="scan-pulse" aria-hidden="true"></span><strong>${t('收藏正在陆续到达','Your saves are arriving')}</strong><span>${elapsed()}</span></div><p>${t('本次已找到','Found this scan:')} <b>${status.progress?.seen ?? scan?.seen ?? 0}</b> ${t('条 · 已到达的可以先看，不用等全部完成。','saves · You can browse them while the rest arrive.')}</p><div class="scan-track" aria-hidden="true"></div><button data-action="cancel-sync">${t('先停在这里','Stop for now')}</button></aside>`;
    if (!scan) return '';
    const complete = scan.complete === true;
    const title = scan.endReason === 'cancelled' ? t('已停止，收到的收藏都保留了','Stopped. Your saves are kept') : complete ? t('本次扫描已到列表末尾','Reached the end of the list') : t('已收到一部分，仍可继续检查','Some saves received; coverage is not complete');
    return `<aside class="scan-panel ${complete?'finished':'warning'}"><div class="scan-title"><strong>${title}</strong><button data-action="connection">${t('查看连接','Connection')}</button></div><p>${t('本次找到','Found this scan:')} ${scan.seen ?? scan.count ?? 0} ${t('条','saves')} · ${esc(date(scan.at))}${scan.added ? ' · +' + scan.added + t(' 新收藏',' new') : ''}${!complete?' · '+t('之前收到的不会删除。','Earlier saves are kept.'):''}</p>${scan.endReason==='source_response_incomplete'?`<p>${t('小红书这次没有返回后续收藏。已收到的可以继续看，稍后再检查。','Xiaohongshu did not return the next saves this time. You can browse what arrived and check again later.')}</p>`:''}${!complete?`<button data-action="sync">${t('再检查一次','Check again')}</button>`:''}</aside>`;
  }
  function updateProgress() {
    const region = $('#scan-progress');
    if (region) region.innerHTML = scanLine();
    const refresh = $('.library-heading [data-action="sync"]');
    if (refresh) refresh.disabled = status?.job?.state === 'running';
  }
  function renderHome() {
    const has = data.items.some(x=>!annotation(x.id).trashed);
    $('#main').innerHTML = `<section class="intro ${has?'compact':''}"><p class="eyebrow">${t('少找一会儿，多用一点。','LESS SEARCHING. MORE DOING.')}</p><h1>${has?t('今天，想做点什么？','What do you want to do?'):t('好东西收藏了，<br>然后呢？','You saved something good.<br>What next?')}</h1><p class="lead">${has?t('说说你现在的问题。从自己的收藏里，找一个有用的起点。','Describe your goal. Find a useful starting point in your own saves.'):t('连接小红书，把收藏找回来。需要时，知道看哪篇、信什么、怎么用。','Connect Xiaohongshu. Find the save you need, check the claims, and put the idea to use.')}</p></section>
    ${has?`<form id="goal-form" class="goal-form"><label class="sr-only" for="goal">${t('你现在想做什么','Your current goal')}</label><textarea id="goal" rows="2" maxlength="1000" placeholder="${t('比如：我想让产品首页更简洁，不知道从哪改','For example: make my product homepage less cluttered')}">${esc(goal)}</textarea><button class="primary" ${working?'disabled':''}>${working?t('正在找…','Looking…'):t('帮我找个起点 →','Find a starting point →')}</button></form><div class="under-goal"><button data-action="ai">${ai?'✦ ':''}${t(ai?'语义搜索已开':'开启语义搜索',ai?'Meaning search on':'Enable meaning search')}</button><button data-action="library">${t('或者，直接翻收藏','Or browse your saves')} ↗</button></div>${searchStatus()}${data.goalState?.plan?.goal&&!goal?`<button class="saved-plan" data-action="resume"><small>${t('上次留下的事','PICK UP WHERE YOU LEFT OFF')}</small><strong>${esc(data.goalState.plan.goal)}</strong><span>↗</span></button>`:''}<div id="answer">${answerHTML()}</div><div id="scan-progress">${scanLine()}</div>`:
    `<div class="paper-stack" aria-hidden="true"><div class="paper back"><i></i><i></i><i></i></div><div class="paper front"><span>↗</span><p>${t('留给下一次<br>刚好需要的自己。','For the moment<br>you need it.')}</p><i></i></div></div><div class="welcome"><button class="primary" data-action="connection">${t('连接我的小红书 →','Connect my Xiaohongshu →')}</button><p>${t('登录后扫描收藏，无需上传文件。','Sign in to scan your saves. No file upload.')}</p><button class="quiet" data-action="demo">${t('先用示例试一试','Explore an example first')}</button></div>`}`;
    $('#goal-form')?.addEventListener('submit', findStart);
    $('#goal')?.addEventListener('input', e=>{cancelSearch();goal=e.target.value;choice='';answer=null;if($('#answer'))$('#answer').innerHTML='';if($('#search-status'))$('#search-status').outerHTML=searchStatus();const submit=$('#goal-form button');if(submit){submit.disabled=false;submit.textContent=t('帮我找个起点 →','Find a starting point →');}});
  }
  function answerHTML() {
    if (!answer) return '';
    if (answer.status === 'clarify') return `<section class="answer"><p class="eyebrow">${t('先缩小一点范围','ONE QUICK DETAIL')}</p><h2>${t('你想先解决哪一件事？','Which part comes first?')}</h2>${!answer.options.length?`<p>${t('再具体一点：想改善哪个动作、做出什么结果？','What specific change or outcome do you want?')}</p>`:''}<div class="actions">${answer.options.map(o=>`<button data-action="choice" data-choice="${esc(o.choice)}">${esc(lang==='zh'?choices[o.choice]||o.label:o.label)}</button>`).join('')}</div></section>`;
    if (!['ready','needs_reading'].includes(answer.status)) return `<section class="answer"><h2>${t('这次还没有足够合适的收藏。','No strong starting point yet.')}</h2><p>${t('已有文字还不足以支持这些要求。可以读取相关收藏的正文，或补充可靠来源；没有合适证据时，RedBot 不会勉强推荐。','The saved text does not establish these requirements. Read a related source or add reliable evidence; RedBot will not force a recommendation.')}</p>${requirementsHTML(answer)}<button data-action="library">${t('看看已有收藏','Browse my saves')} →</button></section>`;
    const x = answer.source, g = answer.guide, take = x ? R.shortTake(x) : null;
    return `<article class="answer"><p class="eyebrow">${answer.status==='needs_reading'?t('先确认内容','READ BEFORE RELYING ON IT'):t('先看这一篇','START HERE')}</p><h2>${esc(x?.title||g?.title)}</h2><p class="source-line">${esc(x?.author||'')} ${answer.semantic?t('· 按语义匹配','· Matched by meaning'):t('· 根据收藏中的文字匹配','· Matched from saved text')}</p>${take?.lead?`<blockquote>${esc(take.lead)}</blockquote>`:`<p>${t('目前只有标题。读到正文后，才能判断如何用在你的问题上。','Only the title is available. Read the source to see how it applies.')}</p>`}${g?`<p>${esc(g.method)}</p>`:''}${requirementsHTML(answer)}<div class="actions"><button class="primary" data-action="detail" data-id="${esc(x?.id||'')}">${t('看重点与条件 →','Read the useful part →')}</button>${answer.status==='ready'?`<button data-action="keep">${t('留作下一步','Keep this plan')}</button>`:''}<button class="quiet" data-action="skip">${t('不太适合','Not a fit')}</button></div></article>`;
  }
  async function findStart(event) {
    event?.preventDefault(); goal = $('#goal')?.value.trim() || goal.trim();
    if (!goal || working) return;
    const generation=++searchGeneration,scope=libraryKey(),requestedGoal=goal;
    const current=()=>generation===searchGeneration&&scope===libraryKey()&&requestedGoal===goal;
    working=true;searchCoverage=null;searchProgress=ai?t('正在准备此设备上的语义匹配…','Preparing on-device meaning search…'):'';render();
    let next=C.chooseStart(data.items,data.guides,data,goal,choice);
    try {
      if(ai&&!choice){
        RedBotAI.setScope(scope);
        RedBotAI.progress((message,coverage)=>{if(!current())return;searchProgress=coverage?coverageText(coverage):t('正在加载本机模型，首次需要下载…','Loading the local model; first use requires a download…');if($('#search-status'))$('#search-status').outerHTML=searchStatus();});
        if(!aiReady){await RedBotAI.load();if(!current())return;aiReady=true;}
        const result=await RedBotAI.search(requestedGoal,data.items,data.guides,data,{scope});
        if(!current())return;searchCoverage=result.coverage;searchProgress='';
        next=C.semanticStart(data.items,data.guides,data,requestedGoal,result.ranked);
      }
      if(current())answer=next;
    }catch(error){if(current()){answer=next;searchProgress=t('语义匹配未完成，下面使用基础匹配；不代表已覆盖全库。','Meaning search did not finish. Basic matching is shown below; full semantic coverage is not established.');}}
    finally{if(current()){working=false;render();}}
  }
  function filtered() {
    const view = ['trash','archived','favorite','unread'].includes(filter)?filter:'all';
    return C.filterItems(data.items,data,view,filter==='content'?'content':'all',query,sort).filter(x=>(!topic||(annotation(x.id).category||x.category)===topic)&&(!collection||(annotation(x.id).collections||[]).includes(collection)));
  }
  function cards() {
    const rows = filtered();
    $('#result-count').textContent = rows.length + t(' 条收藏',' saves');
    $('#cards').innerHTML = rows.slice(0,limit).map(x=>`<article class="save-card"><button class="card-open" data-action="detail" data-id="${esc(x.id)}">${C.imageURL(x.image)?`<img src="${esc(C.imageURL(x.image))}" alt="" loading="lazy" referrerpolicy="no-referrer">`:`<div class="cover-letter" aria-hidden="true">${esc(label(annotation(x.id).category||x.category).slice(0,2))}</div>`}<span class="card-body"><small>${esc(label(annotation(x.id).category||x.category))} · ${x.hasContent?t('有正文／笔记','Text available'):t('尚未读正文','Title only')}</small><strong>${esc(x.title)}</strong><span>${esc(x.author)}</span></span></button><button class="star ${annotation(x.id).favorite?'selected':''}" data-action="favorite" data-id="${esc(x.id)}" aria-label="${t('标为常用','Favorite')}" aria-pressed="${!!annotation(x.id).favorite}">${annotation(x.id).favorite?'★':'☆'}</button></article>`).join('') || `<div class="empty"><h2>${isScanning()&&!data.items.length?t('正在取回第一批收藏…','Fetching your first saves…'):t('这里还没有匹配的收藏。','No matching saves here.')}</h2><p>${isScanning()&&!data.items.length?t('第一批到达后会出现在这里，你可以先留在本页。','Your first saves will appear here as soon as they arrive.'):t('换个词试试，或清除筛选。','Try another word, or clear the filters.')}</p>${data.items.length?`<button data-action="clear">${t('清除筛选','Clear filters')}</button>`:''}</div>`;
    $('#more').hidden = rows.length <= limit;
    $('#more').textContent = t('再看一些','Show more');
    $('#cards').querySelectorAll('img').forEach(img=>img.onerror=()=>img.hidden=true);
  }
  function renderLibrary() {
    $('#main').innerHTML = `<section class="library-heading"><div><p class="eyebrow">${t('你的积累，随时可用。','GOOD FINDS, WITHIN REACH.')}</p><h1>${t('我的收藏','My saves')}</h1></div><button data-action="sync">${t('刷新收藏 ↻','Refresh ↻')}</button></section><div id="scan-progress">${scanLine()}</div><div class="library-search"><label class="sr-only" for="search">${t('搜索收藏','Search saves')}</label><input id="search" type="search" placeholder="${t('搜关键词、笔记或作者…','Search words, notes, or authors…')}" value="${esc(query)}"><button data-action="organize">${t('整理','Organize')}</button></div><div class="filters"><select id="filter" aria-label="${t('阅读状态','Reading status')}">${[['all',t('全部','Everything')],['unread',t('还没看','Unread')],['favorite',t('常用','Favorites')],['content',t('有文字内容','With text')],['archived',t('已归档','Archived')],['trash',t('回收站','Trash')]].map(([v,l])=>`<option value="${v}" ${filter===v?'selected':''}>${l}</option>`).join('')}</select><select id="topic" aria-label="${t('主题','Topic')}"><option value="">${t('所有主题','All topics')}</option>${C.TOPICS.map(v=>`<option value="${esc(v)}" ${topic===v?'selected':''}>${esc(label(v))}</option>`).join('')}</select><select id="collection" aria-label="${t('合集','Collection')}"><option value="">${t('所有合集','All collections')}</option>${data.collections.map(c=>`<option value="${esc(c.id)}" ${collection===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select><select id="sort" aria-label="${t('排序','Sort')}"><option value="position">${t('收藏顺序','Saved order')}</option><option value="title" ${sort==='title'?'selected':''}>${t('标题顺序','Title')}</option><option value="recent" ${sort==='recent'?'selected':''}>${t('最近加入','Recently added')}</option></select></div><div id="result-count" class="result-count"></div><section id="cards" class="cards"></section><button id="more" data-action="more"></button>`;
    cards(); updateProgress();
    $('#search').oninput = e=>{cancelSearch();query=e.target.value;limit=60;cards();};
    for (const name of ['filter','topic','collection','sort']) $('#'+name).onchange=e=>{if(name==='filter')filter=e.target.value;if(name==='topic')topic=e.target.value;if(name==='collection')collection=e.target.value;if(name==='sort')sort=e.target.value;limit=60;cards();};
  }
  function connectionDialog() {
    const running = status?.job?.state === 'running', connected = status?.state === 'connected';
    const scan = status?.scan || data.scan;
    let content = '';
    if (!credentials) {
      content = `<p>${t('用小红书确认登录，让 RedBot 只读扫描你自己的收藏。无需上传文件或复制 Cookie。','Confirm sign-in with Xiaohongshu so RedBot can read your own saves. No uploads or copying cookies.')}</p><div class="privacy-note"><strong>${t('这次试用如何保管数据','How this test stores your data')}</strong><p>${t('登录会话和收藏文本由 Ming 的测试服务分开保存，最长 7 天。远程试用会通过 Cloudflare 转发；本机访问不经过它。测试电脑离线时无法同步。断开连接会删除服务端数据。本机笔记和备份仍由你保管。','Ming’s test service stores an isolated sign-in session and saved text for up to 7 days, with remote access via Cloudflare (local access stays local). Sync stops when the test computer is offline. Disconnecting deletes server data; you keep your device notes and backup.')}</p><p>${t('这是浏览器登录连接，并非小红书官方开放的收藏授权。RedBot 不会发帖、点赞、评论或修改你的收藏。','This uses a browser sign-in, not an official favorites OAuth permission. RedBot does not post, like, comment, or change your saves.')}</p></div><form id="connect-form"><label for="invite">${t('试用邀请码','Test invitation code')}</label><input id="invite" value="${esc(invitation)}" autocomplete="off" autocapitalize="none" spellcheck="false" required>${invitation?`<p class="muted">${t('邀请链接已为你填好，确认后连接即可。','Your invitation link filled this in for you.')}</p>`:''}<label class="check-row"><input id="consent" type="checkbox" required><span>${t('我了解以上保管方式，同意连接自己的账号。','I understand this storage arrangement and want to connect my own account.')}</span></label><button class="primary">${t('获取登录码 →','Get sign-in code →')}</button></form>`;
    } else if (status?.state === 'waiting' && status.qr) {
      content = `<p>${t('打开小红书，使用“扫一扫”，在小红书里确认登录。','Open Xiaohongshu, scan this code, and confirm sign-in there.')}</p><img class="login-qr" src="${esc(status.qr)}" alt="${t('小红书登录二维码','Xiaohongshu sign-in QR code')}"><p class="muted">${t('约 4 分钟内有效，请不要把登录码发给别人。','Valid for about 4 minutes. Do not share this sign-in code.')}</p><details><summary>${t('正在同一部手机上使用？','Using only this phone?')}</summary><p>${t('可先保存二维码，再到小红书“扫一扫”选择相册。是否支持识别登录码取决于小红书版本，目前尚未完成真机验证；如果不支持，需要在电脑或另一台设备显示此页。','You can save the code and try choosing it from the photo library in Xiaohongshu’s scanner. Login-code recognition depends on the app version and has not been verified on a real phone. If unsupported, display this page on a second device.')}</p><a download="RedBot-login.png" href="${esc(status.qr)}">${t('保存登录码','Save sign-in code')}</a></details>`;
    } else if (connected) {
      content = `<p class="connected-name">✓ ${esc(status.nickname||t('你的小红书','Your Xiaohongshu'))}</p><div class="scan-facts"><div><strong>${data.items.length}</strong><span>${t('已保存的收藏','Saves kept')}</span></div><div><strong>${data.items.filter(x=>x.description).length}</strong><span>${t('已读到正文','Post texts read')}</span></div><div><strong>0</strong><span>${t('同步所用 AI token','AI tokens for sync')}</span></div></div><p>${scan?t('上次扫描：','Last scan: ')+esc(date(scan.at)):t('登录成功，正在准备首次扫描。','Signed in. Preparing your first scan.')}</p>${scan?`<p class="coverage-note">${t('本次看到','This scan saw')} ${scan.count} ${t('条；新增','saves; new')} ${scan.added||0}，${t('变化','changed')} ${scan.changed||0}。${t(scan.complete?'小红书已返回列表末尾。正文和视频仍需按需读取。':'尚未确认列表末尾，可以再检查。没有出现的旧收藏不会删除；正文和视频需按需读取。',scan.complete?'Xiaohongshu reported the end of the list. Post text and video still need separate reading.':'The end of the list has not been confirmed. You can check again. Missing old saves are kept; post text and video need separate reading.')}</p>`:''}<label class="check-row"><input id="auto" type="checkbox" ${auto?'checked':''}><span>${t('打开时自动检查，并在页面可见时每 15 分钟扫描一次','Check on open and scan every 15 minutes while this page is visible')}</span></label><p class="muted">${t('关闭页面后不再发起新扫描；已开始的读取可在后台完成。扫描、去重和本地文字检查不调用大模型。','Closing the page stops new scans. A read already started can finish. Scanning, deduplication and local wording checks do not call a language model.')}</p><button class="primary" data-action="sync" ${running?'disabled':''}>${t('现在刷新','Refresh now')}</button>`;
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
        rememberConnection({...session,api:apiRoot});
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
    try {
      const next=await api('/api/connection');
      if(epoch!==readEpoch)return;
      status=next;statusSnapshot={epoch,startedAt:snapshotStartedAt};offline=false;
      if ((onboarding || initial && isScanning() && !data.items.length) && status.state === 'connected') {
        onboarding=false; tab='library';
        if ($('#dialog').open && $('#dialog').dataset.kind==='connection') dismiss();
        render();
      }
      const stamp = String(status.revision ?? '') + ':' + status.scan?.at + ':' + status.scan?.readCount + ':' + (status.job?.state==='done'?status.job.id:'');
      if (stamp !== lastFetch && (status.revision !== undefined || status.scan || ['read','video'].includes(status.job?.kind)&&['done','failed','cancelled'].includes(status.job.state))) {
        await loadLibrary();if(epoch!==readEpoch)return;lastFetch = stamp;
      }
      await reconcileRead();
      if(status.job?.state==='failed' && status.job.id!==lastJob) {if(!['read','video'].includes(status.job.kind))notify(failure(Error(status.job.error)));lastJob=status.job.id;}
      $('#account').textContent=activity(); updateProgress();if($('#source-progress')&&detailId)$('#source-progress').innerHTML=readProgress(item(detailId));
      if ($('#dialog').open && $('#dialog').dataset.kind==='connection') {
        // The consent form never rerenders while it is being completed.
        const scroll = $('#dialog').scrollTop;
        connectionDialog(); $('#dialog').scrollTop=scroll;
      }
      if (status.state==='connected' && auto && !['running','failed','cancelled'].includes(status.job?.state) && (!status.scan?.at || Date.now()-Date.parse(status.scan.at)>15*60*1000) && !document.hidden) {
        await api('/api/sync',{}); startedAt=Date.now(); status={...status,job:{kind:'scan',state:'running'}}; updateProgress();
      }
    } catch(error) { offline=true; $('#account').textContent=activity(); updateProgress();if($('#source-progress')&&detailId)$('#source-progress').innerHTML=readProgress(item(detailId)); if(initial)notify(failure(error)); }
    finally { requestActive=false;initial=false; }
  }
  async function sync() {
    if (!credentials) return connectionDialog();
    try { await api('/api/sync',{}); startedAt=Date.now(); status={...status,job:{kind:'scan',state:'running'}}; $('#account').textContent=activity(); if($('#dialog').open && $('#dialog').dataset.kind==='connection')dismiss(); tab='library';render(); notify(t('开始扫描，原有笔记和计划都会保留。','Scanning. Your notes and plans are kept.')); }
    catch(error) { notify(failure(error)); }
  }
  async function disconnect() {
    modal(`<h2>${t('断开这个账号？','Disconnect this account?')}</h2><p>${t('登录会话和服务端收藏会删除；此设备的收藏与个人笔记会保留为离线副本，可导出。下次连接会使用新的独立库。','The sign-in session and server copy will be deleted. This device keeps an offline copy for export. Your next connection gets a separate library.')}</p><div class="actions"><button data-action="confirm-disconnect" class="danger">${t('确认断开并删除','Disconnect and delete')}</button><button data-action="connection">${t('返回','Go back')}</button></div>`, 'disconnect');
  }
  function sourceText(x){return R.blocks(x).filter(b=>b.label!=='Post title').map(b=>b.label+'\n'+b.text).join('\n\n');}
  function readable(x) {
    if(!x)return false;
    if(x.comments?.items?.some(c=>c.text?.trim()))return true;
    if(x.type==='video')return !!x.videoAnalysis && R.blocks({...x,description:'',summary:'',readingNotes:'',research:null,transcript:''}).some(b=>b.label!=='Post title');
    return R.scan(x).readable;
  }
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
  function readProgress(x) {
    if(!x)return '';
    const r=reads.get(x.id), pending=['queued','starting','running'].includes(r?.state);
    let message=r?.state==='queued'?t('正在等待上一项读取结束…','Waiting for the current read to finish…'):r?.state==='starting'?t('正在开始读取…','Starting the read…'):r?.state==='running'?t(x.type==='video'?'正在读取这篇视频的语音和画面文字，可能需要几分钟。':'正在读取正文…',x.type==='video'?'Reading this video’s speech and on-screen text. This may take a few minutes.':'Reading the source text…'):r?.error||'';
    if(r?.error&&pending)message+=' '+r.error;
    if(offline&&pending)message=t('同步暂不可用；恢复连接后会核对这次读取，不会重复发起。','Sync is unavailable. This read will be checked after reconnection without being started again.');
    if(!message&&readable(x))message=t('内容已就绪。','Content is ready.');
    return `<div role="status" aria-live="polite">${esc(message)}</div>${r?.state==='running'?`<button data-action="${x.type==='video'?'cancel-video':'cancel-read'}">${t('取消读取','Cancel reading')}</button>`:''}${pending||!credentials||!/^[a-f0-9]{24}$/.test(x.id)?'':`<button data-action="read" data-id="${esc(x.id)}">${t(r?.error?'重试读取':readable(x)?'重新读取':'读取内容',r?.error?'Retry reading':readable(x)?'Read again':'Read content')}</button>`}`;
  }
  async function requestRead(id,{retry=false,briefAfter=false}={}) {
    const x=item(id);if(!x||!credentials||!selected(id))return;
    let r=reads.get(id);
    if(r&&!retry){if(briefAfter)r.briefAfter=true;return;}
    if(r&&['queued','starting','running'].includes(r.state))return;
    r={state:'queued',briefAfter,jobId:'',error:'',baseline:readOutcome(x)};reads.set(id,r);refreshDetail();
    await startSelectedRead(id,r);
  }
  async function startSelectedRead(id,r) {
    if(!selected(id)||reads.get(id)!==r||r.state!=='queued')return;
    if(status?.job?.state==='running') {
      if(status.job.targetId===id&&status.job.kind===(item(id).type==='video'?'video':'read')){r.state='running';r.jobId=status.job.id;r.epoch=readEpoch;r.acceptedAt=statusSnapshot.startedAt;r.requestStartedAt=Date.parse(status.job.startedAt)||Date.now();refreshDetail();}
      return;
    }
    r.state='starting';r.baseline=readOutcome(item(id));r.requestStartedAt=Date.now();refreshDetail();
    try {
      const result=await api(item(id).type==='video'?'/api/video':'/api/read',{id});
      const job=result.job||result;
      r.state='running';r.jobId=job.id||result.jobId||'';r.acceptedAt=Date.now();r.epoch=++readEpoch;
      status={...status,job:{...job,id:r.jobId,kind:item(id).type==='video'?'video':'read',state:'running',targetId:id}};
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
    if(state==='ready'&&x.type==='video'&&!(Date.parse(x.videoAnalysis?.readAt)>r.acceptedAt||Date.parse(x.comments?.readAt)>r.acceptedAt))return null;
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
      status=next;statusSnapshot={epoch,startedAt};
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
  async function checkVersion() {
    if(Date.now()-versionCheckedAt<60000)return;
    versionCheckedAt=Date.now();
    try {const response=await fetch(new URL('version.json',location.href),{cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(5000)});if(!response.ok)return;const v=(await response.json()).version;if(typeof v==='string'&&/^\d+\.\d+\.\d+$/.test(v)&&v.split('.').reduce((n,x,i)=>n+Number(x)*1000**(2-i),0)>APP_VERSION.split('.').reduce((n,x,i)=>n+Number(x)*1000**(2-i),0)){latestVersion=v;renderVersion();}}catch{}
  }
  async function reloadUpdatedApp() {
    if(detailId&&$('#personal-note')) {
      data.annotations[detailId]={...annotation(detailId),note:$('#personal-note').value,category:$('#save-topic').value,...($('#save-collection')?{collections:$('#save-collection').value?[$('#save-collection').value]:[]}: {})};
    }
    if($('#brief-form')&&detailId){const a=annotation(detailId);data.annotations[detailId]={...a,buildBrief:{goal:$('#brief-goal').value,brief:$('#brief-idea').value,target:$('#brief-target').value}};}
    if(await save())location.reload();
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
    const audioNames={transcribed:t('已转录','Transcribed'),no_speech_detected:t('未检测到语音','No speech detected')};
    const frameNames={sampled_ocr:t('已均匀采样并读取画面文字','Uniform samples read with OCR'),ocr_setup_required:t('画面文字组件尚未准备好','On-screen text reader needs setup')};
    return `<section class="video-reading"><h3>${t('视频内容','Video content')}</h3><p>${t('按需读取语音与少量画面文字采样，不是完整视觉理解，也不鉴定真假。没有云端模型 token 账单，但会使用测试服务电脑的算力；目前限 10 分钟、100 MB 以内。','Reads speech and sampled on-screen text on request. This is not full visual understanding or a truth check. No cloud-model token bill; processing uses the test host computer. Limit: 10 minutes and 100 MB.')}</p>${v?`<p class="coverage-note">${t(v.complete?'本次处理完成；覆盖范围仍仅限下列语音与采样。':'本次只得到部分结果，不能视为读完视频。',v.complete?'Processing completed; coverage is limited to speech and samples below.':'Only partial results are available; the video has not been fully read.')} ${v.cached?t('复用相同版本的本机结果。','Reused a local result for the same version.'):''}</p><p>${t('语音：','Audio: ')}${esc(audioNames[v.coverage?.audio]||t('未完成','Not completed'))} · ${t('画面文字：','On-screen text: ')}${esc(frameNames[v.coverage?.frames]||t('未完成','Not completed'))}</p>${v.lastRefreshError?.retainedPrevious?`<p class="warning">${t('最近一次重新读取失败；下方保留上次成功结果，并非这次的新结果。','The latest refresh failed. Results below are from the previous successful read.')} ${esc(failure(Error(v.lastRefreshError.code)))}</p>`:''}${v.error?`<p class="warning">${esc(failure(Error(v.error)))}</p>`:''}${transcript.length?`<details><summary>${t('原始语音转录','Timestamped transcript')}</summary><p class="coverage-note">${t('自动转录可能听错，请对照画面文字或原视频核对。','Automatic transcripts may mishear speech. Check against on-screen text or the original video.')}</p>${transcript.map(t=>`<p><time>${timecode(t.start)}–${timecode(t.end)}</time> ${esc(t.text)}</p>`).join('')}</details>`:''}${frames.length?`<details><summary>${t('采样画面中的文字','Text from sampled frames')} (${frames.length})</summary>${frames.map(f=>`<p><time>${timecode(f.at)}</time> ${esc((f.text||[]).map(t=>t.text).join(' ')||t('此采样未读出文字','No text read in this sample'))}</p>`).join('')}</details>`:''}`:''}</section>`;
  }
  function detail(id,{refresh=false}={}) {
    const x=item(id);if(!x)return;detailId=id;
    if(!reads.has(id)&&['failed','cancelled','empty'].includes(x.contentReadStatus))reads.set(id,{state:x.contentReadStatus,error:x.contentReadStatus==='empty'?t('这次没有取得可用正文。可以重试或打开原文。','No usable text was returned. Retry or open the original.'):failure(Error(x.contentReadError?.code||'source_unavailable'))});
    if(!reads.has(id)&&x.type==='video'&&x.videoAnalysis&&!readable(x))reads.set(id,{state:'failed',error:failure(Error(x.videoAnalysis.error||'source_unavailable'))});
    const a=annotation(id), report=R.scan(x), take=R.shortTake(x);
    const cueNames={free:t('“免费”的范围','What “free” includes'),cost:t('价格或使用条件','Cost or access conditions'),promotion:t('推广或引流线索','Promotion or contact gate'),promise:t('需要验证的承诺','A promise to verify'),license:t('复用与授权条件','Reuse terms')};
    modal(`<button id="dialog-update" data-action="update-app" hidden></button>
      <div class="detail-head"><p class="eyebrow">${esc(label(a.category||x.category))}</p><h2>${esc(x.title)}</h2><p class="muted">${esc(x.author)}</p></div>
      <section class="useful-summary"><h3>${t('重点','The useful part')}</h3>
        ${take.lead?`<p class="summary-lead">${esc(take.lead)}</p>${take.points.length?`<ul>${take.points.map(p=>`<li>${esc(p.text)}</li>`).join('')}</ul>`:''}<p class="source-caption">${t(take.sourceKind==='author_method'?'根据原作者的文字整理':take.sourceKind==='transcript'?'根据自动转录提取，请核对原文':'根据已读取的文字整理',take.sourceKind==='author_method'?'From the author’s written method':take.sourceKind==='transcript'?'From automatic transcription; check the source':'From the saved source text')}</p>`:`<p>${t('正在准备这篇的内容。','Preparing this save.')}</p>`}
        <div id="source-progress">${readProgress(x)}</div>
        ${readable(x)?`<button class="primary" data-action="brief" data-id="${esc(id)}">${t('生成可用指令 →','Make a useful prompt →')}</button>`:''}
      </section>
      ${readable(x)&&report.signals.length?`<details class="detail-secondary"><summary>${t('使用前确认','Before you use it')} · ${report.signals.map(s=>cueNames[s.id]||s.label).join(' / ')}</summary><p class="muted">${t('来自原文的提醒，仍需核实。','Source cues to verify.')}</p>${report.signals.map(s=>`<p><strong>${cueNames[s.id]||esc(s.label)}</strong></p><blockquote>${esc(window.RedBotText?.simplify(s.excerpt)||s.excerpt)}</blockquote>`).join('')}${report.projects.length?`<button data-action="repo-check" data-id="${esc(id)}">${t('核对项目信息','Check project details')}</button><div id="repo-results">${repoHTML(a.projectChecks||[])}</div>`:''}</details>`:''}
      <details class="detail-secondary source-material"><summary>${t('查看原文与读取范围','Source and reading coverage')}</summary><a class="button" href="${esc(R.safeLink(x.url))}" target="_blank" rel="noopener noreferrer">${t('打开原文 ↗','Open original ↗')}</a>${commentsHTML(x)}${videoHTML(x)}<details class="full-source"><summary>${t('全部已保存文字','All saved text')}</summary><p class="prewrap">${esc(sourceText(x))||t('尚无正文。','No source text.')}</p></details></details>
      <details class="detail-secondary"><summary>${t('我的笔记与整理','My notes and organization')}</summary><label for="personal-note">${t('留给自己的笔记','A note to yourself')}</label><textarea id="personal-note" rows="3">${esc(a.note||'')}</textarea><label for="save-topic">${t('主题','Topic')}</label><select id="save-topic">${C.TOPICS.map(c=>`<option ${c===(a.category||x.category)?'selected':''} value="${esc(c)}">${esc(label(c))}</option>`).join('')}</select>${data.collections.length?`<label for="save-collection">${t('加入合集','Collection')}</label><select id="save-collection"><option value="">${t('不放入合集','No collection')}</option>${data.collections.map(c=>`<option value="${esc(c.id)}" ${(a.collections||[]).includes(c.id)?'selected':''}>${esc(c.name)}</option>`).join('')}</select>`:''}<div class="actions"><button data-action="note" data-id="${esc(id)}">${t('保存笔记','Save note')}</button><button data-action="read-mark" data-id="${esc(id)}">${a.read?t('标为未读','Mark unread'):t('标为已读','Mark read')}</button><button data-action="archive" data-id="${esc(id)}">${a.archived?t('取消归档','Unarchive'):t('归档','Archive')}</button><button data-action="trash" data-id="${esc(id)}" class="quiet">${a.trashed?t('移回收藏','Restore'):t('移入回收站','Move to trash')}</button></div></details>`, 'detail');
    renderVersion();
    if(!refresh&&credentials&&status?.state==='connected'&&/^[a-f0-9]{24}$/.test(id)&&!readable(x))void requestRead(id);
  }
  function repoHTML(checks) {
    return checks.map(c=>`<p><a href="${esc(R.safeLink(c.url))}" target="_blank" rel="noopener noreferrer">${esc(c.repo)} ↗</a><br>${c.status==='checked'?`${t('许可证','License')}: ${esc(c.license)} · ${c.archived?t('已归档','Archived'):t('未归档','Not archived')}<br>${t('最近推送','Last push')} ${esc(c.pushedAt?.slice(0,10)||'—')}`:t('尚未核实，不据此判断风险。','Not verified; no risk verdict.')}<br><small>${t('查询时间','Checked')} ${esc(date(c.checkedAt))} · ${t('不涵盖 API 费用或依赖授权。','Does not verify API costs or dependency terms.')}</small></p>`).join('');
  }
  function brief(id) {
    const x=item(id),a=annotation(id),d=a.buildBrief||{};if(!x)return;
    const legacyTranscript=(d.brief?.match(/\[\d+(?:\.\d+)?(?:[–-]\d+(?:\.\d+)?)?s\]/g)||[]).length>1;
    const methodDraft=legacyTranscript?R.idea(x):(d.brief||R.idea(x));
    const previousDraft=d.previousBrief||(legacyTranscript?d.brief:'');
    if(!readable(x)){detail(id);return requestRead(id,{briefAfter:true});}
    modal(`<h2>${t('拿去用','Put it to work')}</h2><p class="muted">${esc(x.title)}</p><form id="brief-form"><label for="brief-goal">${t('你想用它做什么？','What do you want to do?')}</label><textarea id="brief-goal" rows="2" required placeholder="${t('写下你想解决的问题','Describe the problem you want to solve')}">${esc(d.goal||goal)}</textarea><label for="brief-target">${t('交给','Use in')}</label><select id="brief-target"><option>Codex</option><option ${d.target==='Claude Code'?'selected':''}>Claude Code</option></select><details class="brief-method"><summary>${t('参考的方法 · 可修改','Reference method · editable')}</summary><label for="brief-idea" class="sr-only">${t('参考的方法','Reference method')}</label><textarea id="brief-idea" rows="5">${esc(window.RedBotText?.simplify(methodDraft)||methodDraft)}</textarea></details>${previousDraft?`<details class="brief-method"><summary>${t('查看之前的草稿','Previous draft')}</summary><p class="prewrap">${esc(previousDraft)}</p></details>`:''}${a.note?`<label class="check-row"><input id="include-note" type="checkbox"><span>${t('加入我的笔记','Include my note')}</span></label>`:''}<button class="primary">${t('生成指令','Create prompt')}</button></form><section id="brief-result" hidden><label for="brief-output">${t('复制后交给工具','Copy this to your tool')}</label><textarea id="brief-output" rows="12" readonly></textarea><div class="actions"><button class="primary" data-action="copy-brief">${t('复制指令','Copy prompt')}</button><button data-action="download-brief">${t('下载文本','Download text')}</button></div></section>`, 'brief');
    $('#brief-form').onsubmit=e=>{e.preventDefault();const fields={goal:$('#brief-goal').value,brief:$('#brief-idea').value,target:$('#brief-target').value};data.annotations[id]={...a,buildBrief:{...d,...fields,...(previousDraft?{previousBrief:previousDraft}:{})}};save();$('#brief-output').value=R.createPrompt(x,{...fields,language:lang,checks:a.projectChecks||[],personalNote:$('#include-note')?.checked?a.note:''});$('#brief-result').hidden=false;};
  }
  function settings() {
    modal(`<h2>${t('设置与我的数据','Settings and my data')}</h2><p>RedBot v${APP_VERSION}</p><button id="dialog-update" data-action="update-app" ${latestVersion?'':'hidden'}>${t('有新版本，保存并刷新','Update available — save and reload')}</button><p>${t('个人笔记和计划保存在这个浏览器。换设备前，先导出备份。','Your notes and plans stay in this browser. Export a backup before switching devices.')}</p><div class="setting"><span>${t('导出当前收藏、笔记与计划','Export this library, notes and plan')}</span><button data-action="export">${t('导出','Export')}</button></div><div class="setting"><span>${t('从 RedBot 备份恢复','Restore a RedBot backup')}</span><button data-action="import">${t('恢复备份','Restore')}</button></div><div class="setting"><span>${t('原有设备收藏与当前账号分别保管','Device saves stay separate from account saves')}</span><button data-action="device-copy">${t('查看设备副本','Device copy')}</button></div><div class="setting"><span>${t('添加一个链接（备用入口）','Add a link (optional)')}</span><button data-action="add">${t('添加','Add')}</button></div><p class="muted">${t('这里的归档、回收站和合集只整理 RedBot 副本，不会改动小红书。','Archiving, trash and collections only organize your RedBot copy. Xiaohongshu is unchanged.')}</p>`, 'settings');
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
    if(action==='sync')return sync();
    if(action==='disconnect')return disconnect();
    if(action==='confirm-disconnect') {
      target.disabled=true;
      try {const oldScope=libraryKey();cancelSearch();await api('/api/disconnect',{});let cacheCleared=false;try{const cleared=await Promise.race([RedBotAI.clearCache(oldScope),new Promise((_,reject)=>setTimeout(()=>reject(Error('cache_timeout')),15000))]);cacheCleared=cleared.cleared===true;}catch{}await save();const offline='offline:'+credentials.sessionId;const base=await database();await new Promise((resolve,reject)=>{const tx=base.transaction('library','readwrite');tx.objectStore('library').put(data,offline);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});offlineKey=offline;localStorage.setItem('redbot.offline-key',JSON.stringify(offline));rememberConnection(null);status=null;dismiss();render();notify(t('已断开，服务端数据已删除。当前副本可先导出；不会混入下一次账号连接。','Disconnected. Server data deleted. Export this offline copy before connecting again.'));if(!cacheCleared)notify(t('账号已断开，但此浏览器的旧向量缓存未确认删除。请在浏览器站点设置中清除此站点数据；先导出离线收藏。','Disconnected, but deletion of old vector cache was not confirmed. Export your offline saves, then clear this site’s data in browser settings.'));}
      catch(error) {notify(failure(error));target.disabled=false;}return;
    }
    if(action==='retry-status'){try {await refreshConnectionConfig();await refreshStatus();}catch(error){showConnectionError(error);}return;}
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
    if(action==='video'){target.disabled=true;try{await api('/api/video',{id});videoStartedAt=Date.now();status={...status,job:{kind:'video',state:'running',startedAt:new Date().toISOString()}};if($('#video-progress'))$('#video-progress').innerHTML=videoProgress();$('#account').textContent=activity();}catch(error){notify(failure(error));target.disabled=false;}return;}
    if(action==='read')return requestRead(id,{retry:true});
    if(action==='update-app')return reloadUpdatedApp();
    if(action==='note'){data.annotations[id]={...a,note:$('#personal-note').value,category:$('#save-topic').value,...($('#save-collection')?{collections:$('#save-collection').value?[$('#save-collection').value]:[]}: {})};await save();notify(t('笔记已保存。','Note saved.'));render();return;}
    if(action==='repo-check'){target.disabled=true;const checks=await R.fetchProjects(R.githubProjects(x));data.annotations[id]={...annotation(id),projectChecks:checks};save();if(detailId===id&&$('#repo-results'))$('#repo-results').innerHTML=repoHTML(checks);target.disabled=false;return;}
    if(action==='brief')return brief(id);
    if(action==='copy-brief'){try{await navigator.clipboard.writeText($('#brief-output').value);notify(t('已复制，可粘贴到项目里的工具。','Copied. Paste it into your assistant with the project open.'));}catch{notify(t('复制失败，可以下载文本。','Copy failed. Download the text instead.'));}return;}
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
    document.addEventListener('click',e=>{const button=e.target.closest('[data-action]');if(button&&!button.disabled)act(button.dataset.action,button).catch(error=>notify(failure(error)));});
    $('#dialog-close').onclick=dismiss;
    $('#dialog').addEventListener('cancel',e=>{e.preventDefault();dismiss();});
    $('#dialog').addEventListener('click',e=>{if(e.target===$('#dialog')){const r=$('#dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dismiss();}});
    $('#backup-file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>45*1024*1024)throw Error();const raw=JSON.parse(await f.text());if(!Array.isArray(raw.items))throw Error();data.items=C.mergeItems(data.items,raw.items).items;data.annotations={...raw.annotations,...data.annotations};const cs=new Map(data.collections.map(c=>[c.id,c]));for(const c of raw.collections||[])if(!cs.has(c.id))cs.set(c.id,c);data.collections=[...cs.values()];if(!data.goalState?.plan&&raw.goalState)data.goalState=C.normalizeGoalState(raw.goalState);const gs=new Map(data.guides.map(g=>[g.id,g]));for(const g of raw.guides||[]){const n=C.normalizeGuide(g);if(n&&!gs.has(n.id))gs.set(n.id,n);}data.guides=[...gs.values()];await save();dismiss();tab='library';render();notify(t('备份已合并，已有笔记保留。','Backup merged. Existing notes are kept.'));}catch{notify(t('无法读取这份备份，请选择有效的 RedBot JSON 备份。','Could not read this backup. Choose a valid RedBot JSON backup.'));}e.target.value='';};
    resetSearchScope();
    try {data=normalize(await cacheRead()||(!credentials?stored('shelf.library.v1',{}):{}));}catch{}
    try {await refreshConnectionConfig();} catch(error) {connectionError=failure(error);}
    render();
    void checkVersion();
    if(invitation&&!credentials)connectionDialog();
    if(credentials)await refreshStatus();
    // This is the product's foreground refresh, not an always-on task/daemon.
    const poll = async () => {
      if (!document.hidden && credentials) await refreshStatus();
      setTimeout(poll,status?.job?.state==='running'||status?.state==='waiting'?1500:7000);
    };
    setTimeout(poll,1500);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden){void checkVersion();if(credentials)refreshStatus();}});
    window.addEventListener('hashchange',()=>{
      const code=new URLSearchParams(location.hash.slice(1)).get('invite');
      if(code){invitation=code;history.replaceState(null,'',location.pathname+location.search);if(!credentials)connectionDialog();}
    });
  }
  init();
})();
