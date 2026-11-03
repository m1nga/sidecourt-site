/* RedBot account-first web client. User text is never passed through translation. */
(() => {
  'use strict';
  const C = ShelfCore, R = RedBotCheck;
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stored = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const t = (zh, en) => lang === 'zh' ? zh : en;
  let lang = stored('redbot.language', 'zh');
  let credentials = stored('redbot.connection', null), config = {}, status = null;
  let offlineKey = stored('redbot.offline-key', null);
  let data = {version:1, items:[], annotations:{}, collections:[], guides:[], goalState:{}};
  let tab = 'home', goal = '', choice = '', query = '', filter = 'all', topic = '', collection = '', sort = 'position', limit = 60;
  let answer = null, working = false, ai = false, aiReady = false, auto = stored('redbot.auto', true);
  let detailId = null, requestActive = false, lastJob = '', lastFetch = '', initial = true;
  let toastTimer, dialogFocus, db;
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
    } catch { notify(t('浏览器未能保存，请先导出备份。','Could not save in this browser. Export a backup.')); }
  }
  function normalize(raw) {
    return {...data, ...raw, items:(raw.items || []).map(x=>({...x,...C.normalize(x)})), annotations:raw.annotations || {}, collections:raw.collections || [], guides:(raw.guides || []).map(C.normalizeGuide).filter(Boolean), goalState:C.normalizeGoalState(raw.goalState)};
  }
  async function loadLibrary() {
    const fresh = await api('/api/library');
    data.items = C.mergeItems(data.items, fresh.items || []).items;
    data.scan = fresh.scan;
    await save();
    render();
  }
  function rememberConnection(value) {
    credentials = value;
    if (value) localStorage.setItem('redbot.connection', JSON.stringify(value));
    else localStorage.removeItem('redbot.connection');
  }
  function apiURL() { return credentials?.api || config.api || ''; }
  async function api(path, body) {
    const root = apiURL();
    if (!root) throw Error('service_unavailable');
    const response = await fetch(root + path, {method:body ? 'POST' : 'GET', credentials:'omit', referrerPolicy:'no-referrer', headers:{...(credentials ? {Authorization:'Bearer ' + credentials.token} : {}), ...(body ? {'Content-Type':'application/json'} : {})}, ...(body ? {body:JSON.stringify(body)} : {}), signal:AbortSignal.timeout(15000), cache:'no-store'});
    const result = await response.json();
    if (!response.ok) throw Error(result.error || 'service_unavailable');
    return result;
  }
  function failure(error) {
    const messages = {
      invite_required:t('邀请码不正确，请使用收到的试用链接。','Use the invitation link you received.'),
      beta_full:t('目前试用名额已满，请稍后再试。','All test slots are in use. Try again later.'),
      session_expired:t('这次连接已过期。重新连接后可继续；本机备份仍保留。','This session expired. Reconnect to continue; your device copy is kept.'),
      sign_in_required:t('请在小红书中完成登录确认，再回来继续。','Confirm sign-in in Xiaohongshu, then return here.'),
      wrong_account:t('本次登录的账号与这份收藏库不同。请断开后重新连接，避免混入别人的收藏。','A different account signed in. Disconnect before switching accounts.'),
      scan_cooldown:t('刚刚已扫描，请稍等一分钟再刷新。','Just scanned. Wait a minute before refreshing.'),
      busy:t('上一项读取还在进行，请稍等。','A read is already running. Please wait.'),
      qr_unavailable:t('暂时没拿到登录码，请重试。','Could not get a sign-in code. Try again.'),
      source_unavailable:t('小红书暂时没有返回内容。已有收藏保留，可稍后重试或重新连接。','Xiaohongshu did not return content. Your saves are kept; retry or reconnect later.'),
      scan_incomplete:t('本次没有读到完整列表，已有收藏未改动。','The list could not be read. Existing saves are unchanged.'),
      sync_first:t('先刷新收藏，更新这篇笔记的访问链接。','Refresh your saves to update access to this post.'),
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
  function dismiss() { $('#dialog').close(); detailId = null; if (dialogFocus?.isConnected) dialogFocus.focus(); }

  function activity() {
    if (status?.job?.state === 'running') {
      return {connect:t('正在准备登录码…','Preparing sign-in…'), verify:t('正在确认你的账号…','Verifying your account…'), scan:status.progress?.seen?t('正在扫描 · 已看到 ','Scanning · seen ')+status.progress.seen:t('正在扫描收藏…','Scanning your saves…'), read:t('正在读取这篇笔记…','Reading this post…')}[status.job.kind];
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
    $('#foot-copy').textContent = t('收藏是为了用上的。','Saved for a reason.');
    $('#sidecourt-link').textContent = t('SideCourt 上的小工具 ↗','A small tool on SideCourt ↗');
    if (tab === 'home') renderHome(); else renderLibrary();
  }
  function scanLine() {
    const scan = data.scan;
    if (!scan) return '';
    return `<div class="sync-line"><span class="status-dot"></span><span>${t('上次扫描','Last scanned')} ${esc(date(scan.at))} · ${t('本次看到','Saw')} ${scan.count} ${t('条','saves')}${scan.added ? ' · +' + scan.added + t(' 新收藏',' new') : ''}</span><button data-action="connection">${t('查看范围','Coverage')}</button></div>`;
  }
  function renderHome() {
    const has = data.items.some(x=>!annotation(x.id).trashed);
    $('#main').innerHTML = `<section class="intro ${has?'compact':''}"><p class="eyebrow">${t('少找一会儿，多用一点。','LESS SEARCHING. MORE DOING.')}</p><h1>${has?t('今天，想做点什么？','What do you want to do?'):t('好东西收藏了，<br>然后呢？','You saved something good.<br>What next?')}</h1><p class="lead">${has?t('说说你现在的问题。从自己的收藏里，找一个有用的起点。','Describe your goal. Find a useful starting point in your own saves.'):t('连接小红书，把收藏找回来。需要时，知道看哪篇、信什么、怎么用。','Connect Xiaohongshu. Find the save you need, check the claims, and put the idea to use.')}</p></section>
    ${has?`<form id="goal-form" class="goal-form"><label class="sr-only" for="goal">${t('你现在想做什么','Your current goal')}</label><textarea id="goal" rows="2" maxlength="1000" placeholder="${t('比如：我想让产品首页更简洁，不知道从哪改','For example: make my product homepage less cluttered')}">${esc(goal)}</textarea><button class="primary" ${working?'disabled':''}>${working?t('正在找…','Looking…'):t('帮我找个起点 →','Find a starting point →')}</button></form><div class="under-goal"><button data-action="ai">${ai?'✦ ':''}${t(ai?'语义搜索已开':'开启语义搜索',ai?'Meaning search on':'Enable meaning search')}</button><button data-action="library">${t('或者，直接翻收藏','Or browse your saves')} ↗</button></div>${data.goalState?.plan?.goal&&!goal?`<button class="saved-plan" data-action="resume"><small>${t('上次留下的事','PICK UP WHERE YOU LEFT OFF')}</small><strong>${esc(data.goalState.plan.goal)}</strong><span>↗</span></button>`:''}<div id="answer">${answerHTML()}</div>${scanLine()}`:
    `<div class="paper-stack" aria-hidden="true"><div class="paper back"><i></i><i></i><i></i></div><div class="paper front"><span>↗</span><p>${t('留给下一次<br>刚好需要的自己。','For the moment<br>you need it.')}</p><i></i></div></div><div class="welcome"><button class="primary" data-action="connection">${t('连接我的小红书 →','Connect my Xiaohongshu →')}</button><p>${t('登录后扫描收藏，无需上传文件。','Sign in to scan your saves. No file upload.')}</p><button class="quiet" data-action="demo">${t('先用示例试一试','Explore an example first')}</button></div>`}`;
    $('#goal-form')?.addEventListener('submit', findStart);
    $('#goal')?.addEventListener('input', e=>{goal=e.target.value;choice='';answer=null;});
  }
  function answerHTML() {
    if (!answer) return '';
    if (answer.status === 'clarify') return `<section class="answer"><p class="eyebrow">${t('先缩小一点范围','ONE QUICK DETAIL')}</p><h2>${t('你想先解决哪一件事？','Which part comes first?')}</h2>${!answer.options.length?`<p>${t('再具体一点：想改善哪个动作、做出什么结果？','What specific change or outcome do you want?')}</p>`:''}<div class="actions">${answer.options.map(o=>`<button data-action="choice" data-choice="${esc(o.choice)}">${esc(lang==='zh'?choices[o.choice]||o.label:o.label)}</button>`).join('')}</div></section>`;
    if (!['ready','needs_reading'].includes(answer.status)) return `<section class="answer"><h2>${t('这次还没有足够合适的收藏。','No strong starting point yet.')}</h2><p>${t('换个更具体的问题，或先读取相关笔记的正文。只有标题时，RedBot 无法判断里面的方法是否真的有用。','Try a more specific goal, or read a related post. A title alone cannot show whether the method is useful.')}</p><button data-action="library">${t('看看已有收藏','Browse my saves')} →</button></section>`;
    const x = answer.source, g = answer.guide, take = x ? R.shortTake(x) : null;
    return `<article class="answer"><p class="eyebrow">${answer.status==='needs_reading'?t('先确认内容','READ BEFORE RELYING ON IT'):t('先看这一篇','START HERE')}</p><h2>${esc(x?.title||g?.title)}</h2><p class="source-line">${esc(x?.author||'')} ${answer.semantic?t('· 按语义匹配','· Matched by meaning'):t('· 根据收藏中的文字匹配','· Matched from saved text')}</p>${take?.lead?`<blockquote>${esc(take.lead)}</blockquote>`:`<p>${t('目前只有标题。读到正文后，才能判断如何用在你的问题上。','Only the title is available. Read the source to see how it applies.')}</p>`}${g?`<p>${esc(g.method)}</p>`:''}<div class="actions"><button class="primary" data-action="detail" data-id="${esc(x?.id||'')}">${t('看重点与条件 →','Read the useful part →')}</button><button data-action="keep">${t('留作下一步','Keep this plan')}</button><button class="quiet" data-action="skip">${t('不太适合','Not a fit')}</button></div></article>`;
  }
  async function findStart(event) {
    event?.preventDefault(); goal = $('#goal')?.value.trim() || goal.trim();
    if (!goal || working) return;
    working = true; render();
    try {
      answer = C.chooseStart(data.items,data.guides,data,goal,choice);
      if (ai && aiReady && !choice) {
        const result = await RedBotAI.search(goal,data.items,data.guides,data);
        answer = C.semanticStart(data.items,data.guides,data,goal,result.ranked);
      }
    } catch { notify(t('语义搜索暂时没完成，已使用基础匹配。','Meaning search failed. Basic matching is available.')); }
    finally { working = false; render(); }
  }
  function filtered() {
    const view = ['trash','archived','favorite','unread'].includes(filter)?filter:'all';
    return C.filterItems(data.items,data,view,filter==='content'?'content':'all',query,sort).filter(x=>(!topic||(annotation(x.id).category||x.category)===topic)&&(!collection||(annotation(x.id).collections||[]).includes(collection)));
  }
  function cards() {
    const rows = filtered();
    $('#result-count').textContent = rows.length + t(' 条收藏',' saves');
    $('#cards').innerHTML = rows.slice(0,limit).map(x=>`<article class="save-card"><button class="card-open" data-action="detail" data-id="${esc(x.id)}">${C.imageURL(x.image)?`<img src="${esc(C.imageURL(x.image))}" alt="" loading="lazy" referrerpolicy="no-referrer">`:`<div class="cover-letter" aria-hidden="true">${esc(label(annotation(x.id).category||x.category).slice(0,2))}</div>`}<span class="card-body"><small>${esc(label(annotation(x.id).category||x.category))} · ${x.hasContent?t('有正文／笔记','Text available'):t('尚未读正文','Title only')}</small><strong>${esc(x.title)}</strong><span>${esc(x.author)}</span></span></button><button class="star ${annotation(x.id).favorite?'selected':''}" data-action="favorite" data-id="${esc(x.id)}" aria-label="${t('标为常用','Favorite')}" aria-pressed="${!!annotation(x.id).favorite}">${annotation(x.id).favorite?'★':'☆'}</button></article>`).join('') || `<div class="empty"><h2>${t('这里还没有匹配的收藏。','No matching saves here.')}</h2><p>${t('换个词试试，或清除筛选。','Try another word, or clear the filters.')}</p><button data-action="clear">${t('清除筛选','Clear filters')}</button></div>`;
    $('#more').hidden = rows.length <= limit;
    $('#more').textContent = t('再看一些','Show more');
    $('#cards').querySelectorAll('img').forEach(img=>img.onerror=()=>img.hidden=true);
  }
  function renderLibrary() {
    $('#main').innerHTML = `<section class="library-heading"><div><p class="eyebrow">${t('你的积累，随时可用。','GOOD FINDS, WITHIN REACH.')}</p><h1>${t('我的收藏','My saves')}</h1></div><button data-action="sync">${t('刷新收藏 ↻','Refresh ↻')}</button></section>${scanLine()}<div class="library-search"><label class="sr-only" for="search">${t('搜索收藏','Search saves')}</label><input id="search" type="search" placeholder="${t('搜关键词、笔记或作者…','Search words, notes, or authors…')}" value="${esc(query)}"><button data-action="organize">${t('整理','Organize')}</button></div><div class="filters"><select id="filter" aria-label="${t('阅读状态','Reading status')}">${[['all',t('全部','Everything')],['unread',t('还没看','Unread')],['favorite',t('常用','Favorites')],['content',t('有文字内容','With text')],['archived',t('已归档','Archived')],['trash',t('回收站','Trash')]].map(([v,l])=>`<option value="${v}" ${filter===v?'selected':''}>${l}</option>`).join('')}</select><select id="topic" aria-label="${t('主题','Topic')}"><option value="">${t('所有主题','All topics')}</option>${C.TOPICS.map(v=>`<option value="${esc(v)}" ${topic===v?'selected':''}>${esc(label(v))}</option>`).join('')}</select><select id="collection" aria-label="${t('合集','Collection')}"><option value="">${t('所有合集','All collections')}</option>${data.collections.map(c=>`<option value="${esc(c.id)}" ${collection===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select><select id="sort" aria-label="${t('排序','Sort')}"><option value="position">${t('收藏顺序','Saved order')}</option><option value="title" ${sort==='title'?'selected':''}>${t('标题顺序','Title')}</option><option value="recent" ${sort==='recent'?'selected':''}>${t('最近加入','Recently added')}</option></select></div><div id="result-count" class="result-count"></div><section id="cards" class="cards"></section><button id="more" data-action="more"></button>`;
    cards();
    $('#search').oninput = e=>{query=e.target.value;limit=60;cards();};
    for (const name of ['filter','topic','collection','sort']) $('#'+name).onchange=e=>{if(name==='filter')filter=e.target.value;if(name==='topic')topic=e.target.value;if(name==='collection')collection=e.target.value;if(name==='sort')sort=e.target.value;limit=60;cards();};
  }
  function connectionDialog() {
    const running = status?.job?.state === 'running', connected = status?.state === 'connected';
    const scan = data.scan || status?.scan;
    let content = '';
    if (!credentials) {
      content = `<p>${t('用小红书确认登录，让 RedBot 只读扫描你自己的收藏。无需上传文件或复制 Cookie。','Confirm sign-in with Xiaohongshu so RedBot can read your own saves. No uploads or copying cookies.')}</p><div class="privacy-note"><strong>${t('这次试用如何保管数据','How this test stores your data')}</strong><p>${t('登录会话和收藏文本由 Ming 的测试服务分开保存，最长 7 天。远程试用会通过 Cloudflare 转发；本机访问不经过它。测试电脑离线时无法同步。断开连接会删除服务端数据。本机笔记和备份仍由你保管。','Ming’s test service stores an isolated sign-in session and saved text for up to 7 days, with remote access via Cloudflare (local access stays local). Sync stops when the test computer is offline. Disconnecting deletes server data; you keep your device notes and backup.')}</p><p>${t('这是浏览器登录连接，并非小红书官方开放的收藏授权。RedBot 不会发帖、点赞、评论或修改你的收藏。','This uses a browser sign-in, not an official favorites OAuth permission. RedBot does not post, like, comment, or change your saves.')}</p></div><form id="connect-form">${invitation?'':`<label for="invite">${t('试用邀请码','Test invitation code')}</label><input id="invite" autocomplete="off" required>`}<label class="check-row"><input id="consent" type="checkbox" required><span>${t('我了解以上保管方式，同意连接自己的账号。','I understand this storage arrangement and want to connect my own account.')}</span></label><button class="primary">${t('获取登录码 →','Get sign-in code →')}</button></form>`;
    } else if (status?.state === 'waiting' && status.qr) {
      content = `<p>${t('打开小红书，使用“扫一扫”，在小红书里确认登录。','Open Xiaohongshu, scan this code, and confirm sign-in there.')}</p><img class="login-qr" src="${esc(status.qr)}" alt="${t('小红书登录二维码','Xiaohongshu sign-in QR code')}"><p class="muted">${t('约 4 分钟内有效，请不要把登录码发给别人。','Valid for about 4 minutes. Do not share this sign-in code.')}</p><details><summary>${t('正在同一部手机上使用？','Using only this phone?')}</summary><p>${t('可先保存二维码，再到小红书“扫一扫”选择相册。是否支持识别登录码取决于小红书版本，目前尚未完成真机验证；如果不支持，需要在电脑或另一台设备显示此页。','You can save the code and try choosing it from the photo library in Xiaohongshu’s scanner. Login-code recognition depends on the app version and has not been verified on a real phone. If unsupported, display this page on a second device.')}</p><a download="RedBot-login.png" href="${esc(status.qr)}">${t('保存登录码','Save sign-in code')}</a></details>`;
    } else if (connected) {
      content = `<p class="connected-name">✓ ${esc(status.nickname||t('你的小红书','Your Xiaohongshu'))}</p><div class="scan-facts"><div><strong>${data.items.length}</strong><span>${t('已保存的收藏','Saves kept')}</span></div><div><strong>${data.items.filter(x=>x.description).length}</strong><span>${t('已读到正文','Post texts read')}</span></div><div><strong>0</strong><span>${t('同步所用 AI token','AI tokens for sync')}</span></div></div><p>${scan?t('上次扫描：','Last scan: ')+esc(date(scan.at)):t('登录成功，正在准备首次扫描。','Signed in. Preparing your first scan.')}</p>${scan?`<p class="coverage-note">${t('本次看到','This scan saw')} ${scan.count} ${t('条；新增','saves; new')} ${scan.added||0}，${t('变化','changed')} ${scan.changed||0}。${t('这是有上限的扫描，可能没有覆盖全部收藏。没有出现的旧收藏不会被删除；正文和视频也不会因扫描列表而自动读完。','This scan is bounded and may not cover every save. Missing old saves are kept. Scanning a list does not read all post or video content.')}</p>`:''}<label class="check-row"><input id="auto" type="checkbox" ${auto?'checked':''}><span>${t('打开时自动检查，并在页面可见时每 15 分钟扫描一次','Check on open and scan every 15 minutes while this page is visible')}</span></label><p class="muted">${t('关闭页面后不再发起新扫描；已开始的读取可在后台完成。扫描、去重和本地文字检查不调用大模型。','Closing the page stops new scans. A read already started can finish. Scanning, deduplication and local wording checks do not call a language model.')}</p><button class="primary" data-action="sync" ${running?'disabled':''}>${t('现在刷新','Refresh now')}</button>`;
    } else {
      content = `<p>${running?activity():status?.state==='expired'?t('登录码已过期，重新获取即可。','The sign-in code expired. Get a new one.'):status?.state==='wrong_account'?failure(Error('wrong_account')):t('连接保留在此设备。完成登录后，会先扫描收藏列表。','This device holds your connection. Confirm sign-in to scan your saves.')}</p>${!running?`<button class="primary" data-action="login">${t('获取新的登录码','Get a new sign-in code')}</button>`:''}`;
    }
    if (running && connected) content += `<p role="status">${esc(activity())}</p>`;
    if (status?.job?.state==='failed') content += `<p class="error" role="alert">${esc(failure(Error(status.job.error)))}</p>`;
    if (credentials) content += `<div class="dialog-foot"><button data-action="disconnect" class="quiet danger">${t('断开并删除服务端数据','Disconnect and delete server data')}</button></div>`;
    modal(`<p class="eyebrow">${t('把收藏接回来','YOUR OWN ACCOUNT')}</p><h2>${t('连接小红书','Connect Xiaohongshu')}</h2><div id="connection-content">${content}</div>`, 'connection');
    $('#connect-form')?.addEventListener('submit', async e=>{
      e.preventDefault(); const consent = $('#consent').checked, code = invitation || $('#invite').value.trim();
      e.submitter.disabled = true;
      try {
        const session = await api('/api/session', {invite:code,consent});
        const apiRoot = apiURL();
        rememberConnection({...session,api:apiRoot});
        data = normalize({items:[],annotations:{},collections:[],guides:[],goalState:{}});
        goal=''; answer=null; status={state:'needs_sign_in'};
        await startLogin(); render();
      } catch(error) { notify(failure(error)); if(e.submitter?.isConnected)e.submitter.disabled=false; }
    });
    $('#auto')?.addEventListener('change',e=>{auto=e.target.checked;localStorage.setItem('redbot.auto',JSON.stringify(auto));});
  }
  async function startLogin() {
    try { await api('/api/connect',{}); status={...status,job:{kind:'connect',state:'running'}}; connectionDialog(); await refreshStatus(); }
    catch(error) { notify(failure(error)); }
  }
  async function refreshStatus() {
    if (!credentials || requestActive) return;
    requestActive = true;
    try {
      status = await api('/api/connection');
      const stamp = status.scan?.at + ':' + status.scan?.readCount + ':' + (status.job?.state==='done'?status.job.id:'');
      if (stamp !== lastFetch && (status.scan || status.job?.kind==='read'&&status.job.state==='done')) {
        await loadLibrary(); lastFetch = stamp;
        if (status.job?.kind==='read' && status.job.state==='done' && detailId && $('#dialog').open && $('#dialog').dataset.kind==='detail') {
          // Update the returned source without discarding a note being typed.
          const fields=['personal-note','save-topic','save-collection'].map(id=>({id,value:$('#'+id)?.value}));
          const scroll=$('#dialog').scrollTop, focus=document.activeElement?.id;
          detail(detailId);
          fields.forEach(f=>{if(f.value!==undefined&&$('#'+f.id))$('#'+f.id).value=f.value;});
          if(focus&&$('#'+focus))$('#'+focus).focus({preventScroll:true});
          $('#dialog').scrollTop=scroll;
          notify(t('正文已更新。未读取的评论和视频仍单独标明。','Source text updated. Unread comments and video remain marked.'));
        }
      }
      if(status.job?.state==='failed' && status.job.id!==lastJob) {notify(failure(Error(status.job.error)));lastJob=status.job.id;}
      $('#account').textContent=activity();
      if ($('#dialog').open && $('#dialog').dataset.kind==='connection') {
        // The consent form never rerenders while it is being completed.
        const scroll = $('#dialog').scrollTop;
        connectionDialog(); $('#dialog').scrollTop=scroll;
      }
      if (status.state==='connected' && auto && !['running','failed'].includes(status.job?.state) && (!status.scan?.at || Date.now()-Date.parse(status.scan.at)>15*60*1000) && !document.hidden) {
        await api('/api/sync',{});
      }
    } catch(error) { if(initial)notify(failure(error)); }
    finally { requestActive=false;initial=false; }
  }
  async function sync() {
    if (!credentials) return connectionDialog();
    try { await api('/api/sync',{}); status={...status,job:{kind:'scan',state:'running'}}; $('#account').textContent=activity(); notify(t('开始扫描，原有笔记和计划都会保留。','Scanning. Your notes and plans are kept.')); }
    catch(error) { notify(failure(error)); }
  }
  async function disconnect() {
    modal(`<h2>${t('断开这个账号？','Disconnect this account?')}</h2><p>${t('登录会话和服务端收藏会删除；此设备的收藏与个人笔记会保留为离线副本，可导出。下次连接会使用新的独立库。','The sign-in session and server copy will be deleted. This device keeps an offline copy for export. Your next connection gets a separate library.')}</p><div class="actions"><button data-action="confirm-disconnect" class="danger">${t('确认断开并删除','Disconnect and delete')}</button><button data-action="connection">${t('返回','Go back')}</button></div>`, 'disconnect');
  }
  function sourceText(x) { return x.description || x.transcript || x.summary || x.readingNotes || ''; }
  function detail(id) {
    const x=item(id);if(!x)return;detailId=id;
    const a=annotation(id), report=R.scan(x), take=R.shortTake(x);
    const cueNames={free:t('“免费”的范围','What “free” includes'),cost:t('价格或使用条件','Cost or access conditions'),promotion:t('推广或引流线索','Promotion or contact gate'),promise:t('需要验证的承诺','A promise to verify'),license:t('复用与授权条件','Reuse terms')};
    modal(`<div class="detail-head"><p class="eyebrow">${esc(label(a.category||x.category))}</p><h2>${esc(x.title)}</h2><p class="muted">${esc(x.author)}</p></div><section><h3>${t('先看重点','The short version')}</h3>${take.lead?`<blockquote>${esc(take.lead)}</blockquote>${take.points.map(p=>`<p><strong>${esc(p.label)}</strong> ${esc(p.text)}</p>`).join('')}`:`<p>${t('还没有读到正文。先读取这篇，或打开原文。','No source text yet. Read this post, or open the original.')}</p>`}<p class="coverage-note">${t('这里是已保存文字的摘录，不是新的 AI 总结。未读取评论；没有转录的视频不代表已看过。','This extracts saved text, not a new AI summary. Comments are unread; a video without a transcript has not been watched.')}</p><div class="actions">${credentials&&/^[a-f0-9]{24}$/.test(x.id)?`<button data-action="read" data-id="${esc(id)}">${t(x.description?'刷新正文':'读取这篇正文',x.description?'Refresh source text':'Read this post')}</button>`:''}<a class="button" href="${esc(R.safeLink(x.url))}" target="_blank" rel="noopener noreferrer">${t('打开原文 ↗','Open original ↗')}</a></div></section><section><h3>${t('免费、广告、收费？先看条件。','Free, paid, or promoted? Check the terms.')}</h3><p class="muted">${t('这些是原文中的线索，不是“真假鉴定”。价格和效果还需到官方来源核实。','These are cues in the source, not a fraud verdict. Verify prices and behavior with primary sources.')}</p>${report.signals.length?report.signals.map(s=>`<details class="cue"><summary>${cueNames[s.id]||esc(s.label)}</summary><blockquote>${esc(s.excerpt)}</blockquote></details>`).join(''):`<p>${t(report.readable?'已保存的文字中没有明显线索，但不代表免费或可靠。':'只有标题，暂时无法检查。',report.readable?'No obvious wording cues; this does not establish that it is free or trustworthy.':'Only a title is available; the claims cannot be checked yet.')}</p>`}${report.projects.length?`<button data-action="repo-check" data-id="${esc(id)}">${t('核对 GitHub 项目信息','Check GitHub project facts')}</button><div id="repo-results">${repoHTML(a.projectChecks||[])}</div>`:''}</section><section><h3>${t('用到自己的项目里','Use it in your project')}</h3><p>${t('把方法和待核实的条件，整理为 Codex / Claude Code 可用的指令。','Turn the method and unresolved conditions into a brief for Codex / Claude Code.')}</p><button class="primary" data-action="brief" data-id="${esc(id)}">${t('整理执行指令 →','Make a build brief →')}</button></section><details class="full-source"><summary>${t('展开已保存的完整文字','Read all saved text')}</summary><p class="prewrap">${esc(sourceText(x))||t('尚无正文。','No source text.')}</p></details><section><label for="personal-note">${t('留给自己的笔记','A note to yourself')}</label><textarea id="personal-note" rows="3">${esc(a.note||'')}</textarea><label for="save-topic">${t('主题','Topic')}</label><select id="save-topic">${C.TOPICS.map(c=>`<option ${c===(a.category||x.category)?'selected':''} value="${esc(c)}">${esc(label(c))}</option>`).join('')}</select>${data.collections.length?`<label for="save-collection">${t('加入合集','Collection')}</label><select id="save-collection"><option value="">${t('不放入合集','No collection')}</option>${data.collections.map(c=>`<option value="${esc(c.id)}" ${(a.collections||[]).includes(c.id)?'selected':''}>${esc(c.name)}</option>`).join('')}</select>`:''}<div class="actions"><button data-action="note" data-id="${esc(id)}">${t('保存笔记','Save note')}</button><button data-action="read-mark" data-id="${esc(id)}">${a.read?t('标为未读','Mark unread'):t('标为已读','Mark read')}</button><button data-action="archive" data-id="${esc(id)}">${a.archived?t('取消归档','Unarchive'):t('归档','Archive')}</button><button data-action="trash" data-id="${esc(id)}" class="quiet">${a.trashed?t('移回收藏','Restore'):t('移入回收站','Move to trash')}</button></div></section>`, 'detail');
  }
  function repoHTML(checks) {
    return checks.map(c=>`<p><a href="${esc(R.safeLink(c.url))}" target="_blank" rel="noopener noreferrer">${esc(c.repo)} ↗</a><br>${c.status==='checked'?`${t('许可证','License')}: ${esc(c.license)} · ${c.archived?t('已归档','Archived'):t('未归档','Not archived')}<br>${t('最近推送','Last push')} ${esc(c.pushedAt?.slice(0,10)||'—')}`:t('尚未核实，不据此判断风险。','Not verified; no risk verdict.')}<br><small>${t('查询时间','Checked')} ${esc(date(c.checkedAt))} · ${t('不涵盖 API 费用或依赖授权。','Does not verify API costs or dependency terms.')}</small></p>`).join('');
  }
  function brief(id) {
    const x=item(id),a=annotation(id),d=a.buildBrief||{};if(!x)return;
    modal(`<p class="eyebrow">${t('从收藏，到行动','FROM SAVE TO ACTION')}</p><h2>${t('拿去用的指令','A brief you can use')}</h2><p>${esc(x.title)}</p><form id="brief-form"><label for="brief-idea">${t('保留的方法或概念（可修改）','Useful method or concept (editable)')}</label><textarea id="brief-idea" rows="5">${esc(d.brief||R.idea(x))}</textarea><label for="brief-goal">${t('你想用它做什么','Your goal')}</label><textarea id="brief-goal" rows="2" required>${esc(d.goal||goal)}</textarea><label for="brief-target">${t('交给哪个工具','Use in')}</label><select id="brief-target"><option>Codex</option><option ${d.target==='Claude Code'?'selected':''}>Claude Code</option></select>${a.note?`<label class="check-row"><input id="include-note" type="checkbox"><span>${t('同时加入我这篇的个人笔记','Include my personal note for this save')}</span></label>`:''}<p class="muted">${t('只包含这一篇。默认不授权花钱；先核实条件，再适配当前项目。生成指令不代表工具已经执行。','Includes only this save. No spending by default; verify conditions before adapting your project. Creating a brief does not execute it.')}</p><button class="primary">${t('生成指令','Create brief')}</button></form><section id="brief-result" hidden><label for="brief-output">${t('检查后复制到工具','Review before using')}</label><textarea id="brief-output" rows="12" readonly></textarea><div class="actions"><button data-action="copy-brief">${t('复制指令','Copy brief')}</button><button data-action="download-brief">${t('下载文本','Download text')}</button></div></section>`, 'brief');
    $('#brief-form').onsubmit=e=>{e.preventDefault();const fields={goal:$('#brief-goal').value,brief:$('#brief-idea').value,target:$('#brief-target').value};data.annotations[id]={...a,buildBrief:fields};save();$('#brief-output').value=R.createPrompt(x,{...fields,language:lang,checks:a.projectChecks||[],personalNote:$('#include-note')?.checked?a.note:''});$('#brief-result').hidden=false;};
  }
  function settings() {
    modal(`<h2>${t('设置与我的数据','Settings and my data')}</h2><p>${t('个人笔记和计划保存在这个浏览器。换设备前，先导出备份。','Your notes and plans stay in this browser. Export a backup before switching devices.')}</p><div class="setting"><span>${t('导出当前收藏、笔记与计划','Export this library, notes and plan')}</span><button data-action="export">${t('导出','Export')}</button></div><div class="setting"><span>${t('从 RedBot 备份恢复','Restore a RedBot backup')}</span><button data-action="import">${t('恢复备份','Restore')}</button></div><div class="setting"><span>${t('原有设备收藏与当前账号分别保管','Device saves stay separate from account saves')}</span><button data-action="device-copy">${t('查看设备副本','Device copy')}</button></div><div class="setting"><span>${t('添加一个链接（备用入口）','Add a link (optional)')}</span><button data-action="add">${t('添加','Add')}</button></div><p class="muted">${t('这里的归档、回收站和合集只整理 RedBot 副本，不会改动小红书。','Archiving, trash and collections only organize your RedBot copy. Xiaohongshu is unchanged.')}</p>`, 'settings');
  }
  function organize() {
    modal(`<h2>${t('给这些收藏一个去处','A place for related saves')}</h2><form id="collection-form"><label for="collection-name">${t('新合集名称','New collection name')}</label><input id="collection-name" required maxlength="60" placeholder="${t('比如：下个产品、周末做饭','Next product, weekend recipes…')}"><button class="primary">${t('创建合集','Create collection')}</button></form><p class="muted">${t('打开任意收藏，在笔记区域选择合集。不会改变小红书中的分组。','Open a save and choose its collection below your note. This does not change Xiaohongshu folders.')}</p>`, 'organize');
    $('#collection-form').onsubmit=e=>{e.preventDefault();const name=$('#collection-name').value.trim();if(!name)return;if(data.collections.some(c=>c.name===name))return notify(t('这个合集已存在。','This collection already exists.'));data.collections.push({id:'c-'+crypto.randomUUID(),name});save();dismiss();tab='library';render();};
  }
  function download(value, name, mime='text/plain') {const u=URL.createObjectURL(new Blob([value],{type:mime}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
  async function useDeviceCopy() {
    if(credentials) {notify(t('请先断开当前账号，再查看设备副本；可先导出当前收藏。','Disconnect this account before opening the device copy. You can export first.'));return;}
    offlineKey=null;localStorage.removeItem('redbot.offline-key');data=normalize(await cacheRead('current')||stored('shelf.library.v1',{}));dismiss();tab='library';render();
  }
  function addLink() {
    modal(`<h2>${t('补充一条收藏','Add a reference')}</h2><form id="add-form"><label for="add-url">${t('链接','Link')}</label><input id="add-url" type="url" required><label for="add-title">${t('标题','Title')}</label><input id="add-title" required><label for="add-text">${t('原文片段或笔记（可选）','Source text or notes (optional)')}</label><textarea id="add-text" rows="4"></textarea><p class="muted">${t('只保存链接不会自动读完网页或视频。','Saving a link does not read the page or watch the video.')}</p><button class="primary">${t('保存','Save')}</button></form>`, 'add');
    $('#add-form').onsubmit=e=>{e.preventDefault();data.items=C.mergeItems(data.items,[{url:$('#add-url').value,title:$('#add-title').value,description:$('#add-text').value}]).items;save();dismiss();tab='library';render();};
  }
  function aiDialog() {
    modal(`<h2>${t('不记得原词，也能找','Search without the exact words')}</h2><p>${t('下载一个多语言模型，在此设备上匹配你的问题和收藏文字。没有云端模型 token 账单，但会使用网络流量、内存和电量。','Download a multilingual model to match your goal to saved text on this device. No cloud-model token bill; it uses bandwidth, memory and battery.')}</p><p class="coverage-note">${t('当前每次最多检索前 300 个条目。只匹配已保存的文字，不能理解未读正文、未转录的视频或图片。','Currently searches up to the first 300 entries. It matches saved text, not unread posts, untranscribed videos or images.')}</p><p id="ai-progress" role="status"></p><div class="actions"><button class="primary" data-action="enable-ai">${t('下载并开启','Download and enable')}</button><button data-action="disable-ai">${t('使用基础匹配','Use basic matching')}</button></div>`, 'ai');
  }
  async function act(action, target) {
    const id=target.dataset.id, x=id&&item(id), a=id&&annotation(id);
    if(action==='connection') {connectionDialog();return refreshStatus();}
    if(action==='login')return startLogin();
    if(action==='sync')return sync();
    if(action==='disconnect')return disconnect();
    if(action==='confirm-disconnect') {
      target.disabled=true;
      try {await api('/api/disconnect',{});await save();const offline='offline:'+credentials.sessionId;const base=await database();await new Promise((resolve,reject)=>{const tx=base.transaction('library','readwrite');tx.objectStore('library').put(data,offline);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});offlineKey=offline;localStorage.setItem('redbot.offline-key',JSON.stringify(offline));rememberConnection(null);status=null;dismiss();render();notify(t('已断开，服务端数据已删除。当前副本可先导出；不会混入下一次账号连接。','Disconnected. Server data deleted. Export this offline copy before connecting again.'));}
      catch(error) {notify(failure(error));target.disabled=false;}return;
    }
    if(action==='home'||action==='library'){tab=action==='home'?'home':'library';dismiss();render();return;}
    if(action==='demo'){if(credentials)return notify(t('连接账号时不混入示例收藏。','Examples stay separate from your connected account.'));const s=window.REDBOT_SEED;data.items=C.mergeItems(data.items,s.items).items;const guides=new Map(data.guides.map(g=>[g.id,g]));s.guides.forEach(g=>guides.set(g.id,g));data.guides=[...guides.values()];save();render();return;}
    if(action==='choice'){choice=target.dataset.choice;return findStart();}
    if(action==='keep'){data.goalState.plan={goal,choice:choice||answer.guide?.id||(answer.source?'save:'+answer.source.id:''),status:'ready',sourceId:answer.source?.id||'',updatedAt:new Date().toISOString()};save();notify(t('已记住，下次从这里继续。','Saved. Continue here next time.'));return;}
    if(action==='resume'){goal=data.goalState.plan.goal;choice=data.goalState.plan.choice;return findStart();}
    if(action==='skip'){const key=C.hash(goal.toLowerCase());data.goalState.skips[key]=[...new Set([...(data.goalState.skips[key]||[]),answer.guide?.id||answer.source?.id||''])];choice='';save();return findStart();}
    if(action==='favorite'||action==='read-mark'||action==='archive'||action==='trash'){const key={favorite:'favorite','read-mark':'read',archive:'archived',trash:'trashed'}[action];data.annotations[id]={...a,[key]:!a[key]};save();render();if($('#dialog').open)detail(id);return;}
    if(action==='detail')return detail(id);
    if(action==='read'){target.disabled=true;try{await api('/api/read',{id});status={...status,job:{kind:'read',state:'running'}};$('#account').textContent=activity();notify(t('正在读取，正文会显示在这里。','Reading. The source text will appear here.'));}catch(error){notify(failure(error));}target.disabled=false;return;}
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
    if(action==='disable-ai'){ai=false;dismiss();render();return;}
    if(action==='enable-ai'){target.disabled=true;$('#ai-progress').textContent=t('正在下载模型，首次需要一些时间…','Downloading the model. The first load takes a little time…');try{await RedBotAI.load();ai=aiReady=true;dismiss();render();notify(t('语义搜索已开启，仅在此设备运行。','Meaning search enabled on this device.'));}catch{$('#ai-progress').textContent=t('模型暂时无法运行。仍可使用基础匹配。','The model could not run. Basic matching is available.');target.disabled=false;}return;}
    if(action==='language'){lang=lang==='zh'?'en':'zh';localStorage.setItem('redbot.language',JSON.stringify(lang));dismiss();render();return;}
  }
  async function init() {
    document.addEventListener('click',e=>{const button=e.target.closest('[data-action]');if(button&&!button.disabled)act(button.dataset.action,button).catch(error=>notify(failure(error)));});
    $('#dialog-close').onclick=dismiss;
    $('#dialog').addEventListener('click',e=>{if(e.target===$('#dialog')){const r=$('#dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dismiss();}});
    $('#backup-file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>45*1024*1024)throw Error();const raw=JSON.parse(await f.text());if(!Array.isArray(raw.items))throw Error();data.items=C.mergeItems(data.items,raw.items).items;data.annotations={...raw.annotations,...data.annotations};const cs=new Map(data.collections.map(c=>[c.id,c]));for(const c of raw.collections||[])if(!cs.has(c.id))cs.set(c.id,c);data.collections=[...cs.values()];if(!data.goalState?.plan&&raw.goalState)data.goalState=C.normalizeGoalState(raw.goalState);const gs=new Map(data.guides.map(g=>[g.id,g]));for(const g of raw.guides||[]){const n=C.normalizeGuide(g);if(n&&!gs.has(n.id))gs.set(n.id,n);}data.guides=[...gs.values()];await save();dismiss();tab='library';render();notify(t('备份已合并，已有笔记保留。','Backup merged. Existing notes are kept.'));}catch{notify(t('无法读取这份备份，请选择有效的 RedBot JSON 备份。','Could not read this backup. Choose a valid RedBot JSON backup.'));}e.target.value='';};
    try {data=normalize(await cacheRead()||(!credentials?stored('shelf.library.v1',{}):{}));}catch{}
    try {const res=await fetch('connection.json',{cache:'no-store'});if(res.ok)config=await res.json();}catch{}
    // Local operator preview uses this server's API; the hosted page uses only
    // its shipped endpoint configuration, never a URL supplied in a share link.
    if (['127.0.0.1','localhost'].includes(location.hostname)) {
      try {const res=await fetch('/api/capabilities');const c=await res.json();if(c.redbotConnector===1)config.api=location.origin;}catch{}
    }
    if(config.api&&!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/.test(config.api)&&!/^http:\/\/127\.0\.0\.1:\d+$/.test(config.api))config.api='';
    if(credentials&&config.api&&credentials.api!==config.api){rememberConnection({...credentials,api:config.api});}
    render();
    if(invitation&&!credentials)connectionDialog();
    if(credentials)await refreshStatus();
    // This is the product's foreground refresh, not an always-on task/daemon.
    setInterval(()=>{if(!document.hidden&&credentials)refreshStatus();},7000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&credentials)refreshStatus();});
    window.addEventListener('hashchange',()=>{
      const code=new URLSearchParams(location.hash.slice(1)).get('invite');
      if(code){invitation=code;history.replaceState(null,'',location.pathname+location.search);if(!credentials)connectionDialog();}
    });
  }
  init();
})();
