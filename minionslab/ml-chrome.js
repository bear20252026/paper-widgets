/* ml-chrome.js — the shared frame of every Minion Lab page: a centred header, the key row (home, the tabs, mute), a centred footer.
   Include it as the FIRST thing inside <body>:
     <script src="ml-chrome.js" data-page="home"></script>          (hub)
     <script src="../ml-chrome.js" data-page="bosshistory"></script> (sub-pages)
   data-solid="1" gives the top and bottom bands a paper background (for pages that scroll under them).
   The footer heart toggles to a banana and dispatches  window 'ml-like'  with { detail:{ liked } }.          */
(function(){
  const me = document.currentScript;
  const base = (me.getAttribute('src') || (me.dataset.page === 'home' ? '' : '../')).replace(/ml-chrome\.js.*$/, '');   // '' on the hub, '../' on sub-pages (also when inlined)
  const page = me.dataset.page || 'home';
  function track(){}   // analytics removed for the shelf

  const embed = new URLSearchParams(location.search).get('embed') === '1';
  // The pixel scenes live in the Pixel Town deck now. Their own addresses still exist because the deck loads
  // them in its cards (?embed=1); opened directly, they go to their card instead. Vercel does the same at the
  // edge (vercel.json); this covers local serving and anything that slips past.
  const CARDS = { gumball:'gumball', windows:'trampoline', drivein:'cinema' };
  const seg = location.pathname.split('/').filter(Boolean).pop();
  if (!embed && CARDS[seg]){ location.replace(`${base}town/#${CARDS[seg]}`); return; }
  if (embed){
    document.head.insertAdjacentHTML('beforeend', `<style>html,body{margin:0;padding:0!important;overflow:hidden;background:transparent!important}body{min-height:100vh;display:grid;place-items:center}</style>`);
    try { Object.defineProperty(window, 'GUMBALL_PAD', { get: () => [0, 0], set(){}, configurable: true }); } catch (e) {}   // the scene fills the card
    // a sideways drag that starts on the scene belongs to the deck: pass it up; a plain click stays with the scene
    let sx = 0, sy = 0, down = false, swiping = false;
    const post = (t, e) => { try { parent.postMessage({ t, dx: e.clientX - sx, dy: e.clientY - sy }, location.origin); } catch (err) {} };
    addEventListener('pointerdown', e => { if (e.button !== 0) return; sx = e.clientX; sy = e.clientY; down = true; swiping = false; }, true);
    addEventListener('pointermove', e => { if (!down) return; const dx = e.clientX - sx, dy = e.clientY - sy;
      if (!swiping && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.2) swiping = true;
      if (swiping) post('mlc-swipe', e); }, true);
    const up = e => { if (!down) return; down = false; if (swiping) post('mlc-swipe-end', e); swiping = false; };
    addEventListener('pointerup', up, true); addEventListener('pointercancel', up, true);
    // a scene can hand a short readout (e.g. "Caught 3") to the card it sits in; the card shows it top-left
    window.mlcReadout = text => { try { parent.postMessage({ t:'mlc-readout', text:String(text ?? '') }, location.origin); } catch (err) {} };
    // Or declare it in markup: the text of [data-mlc-readout] is relayed whenever it changes, and [data-mlc-hide]
    // elements (a scene's own sound button, say) are hidden, because the site's mute key takes over inside a card.
    // Interim: the trampoline scene's #hud / #snd are treated the same until it adopts the attributes.
    addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style'); style.textContent = '[data-mlc-hide], #snd { display:none !important; }'; document.head.appendChild(style);
      const src = document.querySelector('[data-mlc-readout]') || document.getElementById('hud');
      if (!src) return;
      src.style.display = 'none';
      const relay = () => window.mlcReadout(src.textContent.trim());
      new MutationObserver(relay).observe(src, { childList:true, characterData:true, subtree:true });
      relay();
    });
    track();
    return;
  }
  const solid = me.dataset.solid === '1';
  const paper = me.dataset.paper || '#F2F0EE';
  const TABS = [
    { key:'bosshistory', label:'Boss History',  short:'Bosses',   href:'bosshistory/', bg:'#F7C942', fg:'#1d1b17' },
    { key:'teardown',    label:'Teardown',      short:'Parts',    href:'teardown/',    bg:'#578AC9', fg:'#ffffff' },
    { key:'ripening',    label:'Ripening Line', short:'Ripen',    href:'ripening/',    bg:'#9EA0A4', fg:'#1d1b17' },
    { key:'town',        label:'Pixel Town',    short:'Town',     href:'town/',        bg:'#E58AAB', fg:'#1d1b17', dn:'#D06C92' },
    { key:'squish',      label:'Squish',        short:'Squish',   href:'squish/',      bg:'#F0A35E', fg:'#1d1b17', dn:'#D4863F' },
  ];
  const current = TABS.find(t => t.key === page);
  const font = `ui-rounded,"SF Pro Rounded","Arial Rounded MT Bold","Yuanti SC","PingFang SC","Helvetica Neue",sans-serif`;
  const css = `
  html { background:${paper}; color-scheme:light; }
  @view-transition { navigation:auto; }
  /* page swap: the old page fades out, then the new one fades in — never both at once (a cross-fade read as a flash) */
  ::view-transition-old(root) { animation:mlcOut .13s ease-in both; }
  ::view-transition-new(root) { animation:mlcIn .22s ease-out .09s both; }
  @keyframes mlcOut { to { opacity:0; } }
  @keyframes mlcIn { from { opacity:0; } }
  /* header and keys are the same object on every page: no cross-fade (it ghosted two key states), the new page simply takes over */
  ::view-transition-old(mlc-top), ::view-transition-old(mlc-bottom) { display:none; }
  ::view-transition-new(mlc-top), ::view-transition-new(mlc-bottom) { animation:none; }
  .mlc-top { view-transition-name:mlc-top; }
  .mlc-bottom { view-transition-name:mlc-bottom; }
  .mlc-top, .mlc-bottom { position:fixed; left:0; right:0; z-index:60; pointer-events:none; font-family:${font}; -webkit-font-smoothing:antialiased; }
  .mlc-top { top:0; padding:22px 0 10px; text-align:center; }
  .mlc-bottom { bottom:0; padding:10px 0 22px; display:flex; flex-direction:column; align-items:center; gap:22px; }   /* the slots include the keys' 3px front edge, so 22 is real air: footer sits as far from the bottom edge as the header from the top; tabs keep at least that much air above the footer */
  .mlc-solid.mlc-top    { background:linear-gradient(${paper} 70%, ${paper}00); }
  .mlc-solid.mlc-bottom { background:linear-gradient(${paper}00, ${paper} 30%); }
  .mlc-title { font-size:10px; letter-spacing:5px; color:#8b8478; text-transform:uppercase; pointer-events:auto; }
  .mlc-title a { color:inherit; text-decoration:none; }
  .mlc-title a:hover { color:#4a453e; }
  .mlc-title .sep { margin:0 6px; opacity:.6; }
  .mlc-tabs { display:flex; justify-content:center; align-items:flex-start; gap:14px; flex-wrap:wrap; padding:0 16px; pointer-events:auto; }
  /* Each key sits in a slot cut into the panel. Everything that moves is a slide (transform) or a fade (opacity),
     which the GPU animates on its own, so a press stays smooth even on a page whose own animation keeps the main thread busy.
     - the slot: the key's colour a shade deeper (a floppy bay in a beige case), with the key's 3px front edge as its bottom band.
       Up, the key covers the slot and leaves that band showing below it; down, the key slides 3px over the band and a gap opens on top.
     - the drop shadow and the lit lip under a sunk key are fixed layers on the slot that fade.
     - hover-light and pressed-dark are colour layers on the key that fade. */
  .mlc-slot { --edge:color-mix(in srgb, var(--b) 66%, #000); position:relative; isolation:isolate; display:inline-flex; align-items:flex-start; padding-bottom:3px; border-radius:3px;
    background:linear-gradient(180deg, color-mix(in srgb, var(--b) 60%, #3b2d1c) 0, color-mix(in srgb, var(--b) 70%, #3b2d1c) calc(100% - 3px), var(--edge) calc(100% - 3px));
    box-shadow:inset 0 1px 2px rgba(45,32,12,.28); }
  .mlc-slot::after { content:""; position:absolute; inset:0; z-index:-1; border-radius:3px; box-shadow:0 2px 5px rgba(40,30,10,.24); transition:opacity .14s; pointer-events:none; }
  .mlc-slot::before { content:""; position:absolute; left:1px; right:1px; bottom:-1px; height:1px; background:rgba(255,255,255,.85); opacity:0; transition:opacity .14s; pointer-events:none; }
  .mlc-slot:has(> .on)::after, .mlc-slot:has(> .mlc-tab:active)::after { opacity:0; }
  .mlc-slot:has(> .on)::before, .mlc-slot:has(> .mlc-tab:active)::before { opacity:1; }
  .mlc-tab { position:relative; isolation:isolate; display:inline-flex; align-items:center; gap:9px; text-decoration:none; color:var(--t); height:28px; padding:0 13px 0 10px; border-radius:3px;   /* one height for every key, so every slot is filled exactly */
    font-size:11px; letter-spacing:1.6px; text-transform:uppercase; font-weight:600; line-height:1;
    --shine:linear-gradient(180deg, rgba(255,255,255,.16), rgba(255,255,255,0) 45%, rgba(0,0,0,.06));
    background:var(--shine), var(--b);
    box-shadow:inset 0 0 0 .5px rgba(0,0,0,.10), inset 0 1px 0 rgba(255,255,255,.24);
    transition:transform .14s cubic-bezier(.3,.7,.3,1); will-change:transform; }
  .mlc-tab::before, .mlc-tab::after { content:""; position:absolute; inset:0; z-index:-1; border-radius:inherit; opacity:0; pointer-events:none; transition:opacity .15s; }
  .mlc-tab::before { background:var(--shine), color-mix(in srgb, var(--b) 66%, #fff); }                                     /* hover: lit */
  .mlc-tab::after  { background:linear-gradient(180deg, rgba(45,32,12,.24), rgba(45,32,12,0) 4px), var(--d, color-mix(in srgb, var(--b) 78%, #2a1f12)); transition-duration:.14s; }   /* down: deeper, shaded under the slot's top edge (a key may give its own --d: brown turns pink grey) */
  .mlc-tab i { width:11px; height:11px; border-radius:50%; flex:0 0 auto; background:radial-gradient(circle at 38% 34%, rgba(255,255,255,.5), rgba(255,255,255,0) 58%), rgba(255,255,255,.05);
    box-shadow:inset 0 -1px 1.5px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.28), 0 1.5px 1px rgba(0,0,0,.16); }
  @media (hover:hover){ .mlc-tab:not(.on):hover::before { opacity:1; } }
  .mlc-tab:active, .mlc-tab.on { transform:translateY(3px); }
  .mlc-tab:active::after, .mlc-tab.on::after { opacity:1; }
  .mlc-tab:active::before { opacity:0; }
  .mlc-tab.on { cursor:default; }
  .mlc-home { padding:0; width:28px; justify-content:center; }
  .mlc-short { display:none; }
  /* phones: one row of keys like a real deck — home square, five equal keys with short names, mute square (two rows looked
     lopsided); the keys only fit without the little lamp, so it goes */
  @media (max-width:520px){
    .mlc-tabs { flex-wrap:nowrap; gap:5px; width:100%; box-sizing:border-box; padding:0 12px; }
    .mlc-slot { flex:1 1 0; min-width:0; }
    .mlc-slot:first-child, .mlc-slot:last-child { flex:0 0 auto; }
    .mlc-tab { flex:1; justify-content:center; padding:0 2px; gap:0; font-size:9.5px; letter-spacing:.4px; }
    .mlc-tab i { display:none; }
    .mlc-home, .mlc-mute { flex:0 0 28px; }
    .mlc-long { display:none; }
    .mlc-short { display:inline; }
  }
  @media (max-width:380px){   /* the narrowest phones: a little less air so 'Squish' keeps inside its key */
    .mlc-tabs { gap:4px; padding:0 10px; }
    .mlc-tab { font-size:9px; letter-spacing:.2px; }
    .mlc-home, .mlc-mute { flex:0 0 26px; width:26px; }
  }
  .mlc-home img { width:21px; height:21px; display:block; }
  /* the mute key: the home key's twin at the other end of the row; pressed = muted */
  .mlc-mute { padding:0; width:28px; justify-content:center; border:0; font:inherit; -webkit-appearance:none; appearance:none; }
  .mlc-mute svg { width:16px; height:16px; display:block; }
  .mlc-mute .off, .mlc-mute.on .onn { display:none; }
  .mlc-mute.on .off { display:block; }
  .mlc-mute.on { cursor:pointer; }
  .mlc-foot { font-size:11px; letter-spacing:1.3px; color:#8b8478; user-select:none; pointer-events:auto; }
  .mlc-foot a { color:inherit; text-decoration:none; }
  .mlc-foot a:hover { color:#575146; }
  #likeBtn { background:none; border:none; padding:0; margin:0 3px; cursor:pointer; display:inline-flex; align-items:center; vertical-align:-3px; font-size:13px; line-height:1; }
  #likeBtn .face { display:none; }
  #likeBtn.liked .heart { display:none; }
  #likeBtn.liked .face { display:inline-block; }
  #likeBtn .face { width:15px; height:15px; border-radius:50%;
    background:radial-gradient(circle at 36% 28%, rgba(255,255,255,.30), rgba(255,255,255,0) 52%), url(${base}bosshistory/favicon-64.png) center/cover no-repeat;
    box-shadow:inset 0 -1px 1.5px rgba(0,0,0,.20), inset 0 1px 0 rgba(255,255,255,.30), 0 1px 1.5px rgba(0,0,0,.18); }
  #likeBtn > span { display:inline-block; transform-origin:center; }
  #likeBtn.pop > span { animation:mlcPop .35s ease; }
  #likeBtn:hover > span { animation:mlcSway .7s ease-in-out infinite; }
  @keyframes mlcSway { 0%,100%{ transform:rotate(0) scale(1);} 25%{ transform:rotate(-11deg) scale(1.12);} 75%{ transform:rotate(11deg) scale(1.12);} }
  @keyframes mlcPop { 0%{ transform:scale(1);} 45%{ transform:scale(1.4);} 100%{ transform:scale(1);} }`;
  const heart = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M2 9.1371C2 14 6.01943 16.5914 8.96173 18.9109C10 19.7294 11 20.5 12 20.5C13 20.5 14 19.7294 15.0383 18.9109C17.9806 16.5914 22 14 22 9.1371C22 4.27416 16.4998 0.825464 12 5.50063C7.50016 0.825464 2 4.27416 2 9.1371Z" fill="none" stroke="#8b8478" stroke-width="1.7"/></svg>`;
  const title = page === 'home' ? `Minion Lab` : `<a href="${base}">Minion Lab</a>`;
  const slot = (bg, fg, key, dn) => `<span class="mlc-slot" style="--b:${bg};--t:${fg}${dn ? `;--d:${dn}` : ''}">${key}</span>`;
  const home = slot('#F7C942', '#1d1b17', `<a class="mlc-tab mlc-home${page==='home'?' on':''}" data-k="home" href="${page==='home' ? '#' : base}" title="Minion Lab" aria-label="Minion Lab home"><img src="${base}bosshistory/favicon-64.png" alt=""></a>`);
  const spk = (cls) => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M4 10v4h3.5L12 18V6L7.5 10H4z" fill="currentColor" stroke="none"/>${cls === 'onn'
        ? '<path d="M15.5 9.5a3.5 3.5 0 0 1 0 5"/><path d="M18 7a7 7 0 0 1 0 10"/>'
        : '<path d="M16 9.5l5 5"/><path d="M21 9.5l-5 5"/>'}</svg>`;
  let muted = false; try { muted = localStorage.getItem('mlc-muted') === '1'; } catch (e) {}
  const mute = slot('#F7C942', '#1d1b17', `<button type="button" class="mlc-tab mlc-mute${muted ? ' on' : ''}" aria-pressed="${muted}" title="${muted ? 'Sound off' : 'Sound on'}" aria-label="Mute the site's sounds">${spk('onn')}${spk('off')}</button>`);
  const tabs = home + TABS.map(t => slot(t.bg, t.fg, `<a class="mlc-tab${t.key===page?' on':''}" data-k="${t.key}" href="${t.key===page ? '#' : base + t.href}"><i></i><span class="mlc-long">${t.label}</span><span class="mlc-short">${t.short}</span></a>`, t.dn)).join('') + mute;
  document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`);
  document.body.insertAdjacentHTML('afterbegin',
    `<div class="mlc-top${solid?' mlc-solid':''}"><div class="mlc-title">${title}</div></div>` +
    `<div class="mlc-bottom${solid?' mlc-solid':''}"><nav class="mlc-tabs">${tabs}</nav>` +
    `<div class="mlc-foot">made with <button id="likeBtn" aria-label="like"><span class="heart">${heart}</span><span class="face"></span></button></div></div>`);
  const like = document.getElementById('likeBtn');
  like.addEventListener('click', ()=>{
    const liked = !like.classList.contains('liked');
    like.classList.toggle('liked', liked); like.classList.remove('pop'); void like.offsetWidth; like.classList.add('pop');
    window.dispatchEvent(new CustomEvent('ml-like', { detail:{ liked } }));
  });
  /* ---------- the keys: a clack on press; the old key pops up, the new one stays down, then the page changes ---------- */
  /* sounds by cuelume (MIT, vendored in vendor/cuelume): "type", one keystroke, when a key goes down; hover stays silent.
     Every page opens its own audio output on the first press, and that can take longer than the key's travel,
     so a key waits until the click has really sounded before the page changes (never longer than 600 ms). */
  let cue = null;
  // a full URL: on the hub `base` is '' and a bare 'vendor/…' is not a valid module specifier (the hub was silent)
  const cueRaw = import(new URL('vendor/cuelume/audio/engine.js', me.src).href);
  const cueReady = cueRaw.then(m => { cue = m; try { m.setBoost(3); } catch (e) {} }, () => {});
  const sound = (name, opts) => { if (muted) return; try { cue && cue.play(name, opts); } catch (e) {} };
  window.mlcMuted = () => muted;                                           // pages with sounds of their own ask this, and listen for 'ml-mute'
  const muteBtns = [...document.querySelectorAll('.mlc-mute')];
  function setMuted(v){
    muted = v; try { localStorage.setItem('mlc-muted', v ? '1' : '0'); } catch (e) {}
    muteBtns.forEach(b => { b.classList.toggle('on', v); b.setAttribute('aria-pressed', String(v)); b.title = v ? 'Sound off' : 'Sound on'; });
    window.dispatchEvent(new CustomEvent('ml-mute', { detail:{ muted:v } }));
  }
  muteBtns.forEach(b => {
    b.addEventListener('pointerdown', e => { if (e.button === 0 && !muted) clack(); });   // the key still clicks on the way down
    b.addEventListener('click', () => { setMuted(!muted); if (!muted) clack(); });        // and clicks again when the sound comes back
  });
  // The page may only change once the click has really played. The audio clock (currentTime) only moves while the
  // output is actually rendering, so wait until it has moved past the click (+ the device's own latency), at most 450 ms.
  // The click must be heard on every page, whatever the visitor did first. A browser only lets audio start after a
  // real gesture, and which event counts differs (mouse: the press; touch, and some browsers: the release or click).
  // So: try at the press; if the audio could not start then, try again at the click. Then hold the page change until
  // the audio clock proves the click has been rendered (an idle Bluetooth output can take most of a second to wake).
  let sCtx = null, sStart = -1, pressedAt = -1e9, pressSounded = false;
  // The library builds its output chain (limiter, room) on its first play and starts a cue right at the audio clock; on a
  // freshly loaded page that first click lost its attack and came out as a faint tail. So the chain is built ahead of
  // time (prime), and the engine starts every cue a few ms ahead of the clock (see vendor/cuelume/README.txt).
  const active = () => !(navigator.userActivation && navigator.userActivation.hasBeenActive === false);
  const prime = () => { try { cue && cue.prime && cue.prime(); } catch (e) {} };
  const tryClack = () => {                                                 // true when the cue is queued (or there is nothing to wait for)
    if (muted) return true;
    if (!cue || !active()) return false;
    let ctx = null; try { ctx = cue.warm ? cue.warm() : (cue.audioContext && cue.audioContext()); } catch (e) {}
    if (!ctx) { sStart = -2; return true; }
    prime();
    // a click scheduled on a brand-new audio clock (the context was just created by this very press) comes out as a
    // clipped tail: wait until the clock is running and has moved, then schedule; at most 300 ms
    sCtx = ctx; sStart = -1; const started = performance.now();
    const fire = () => { sound('type', { emphasis: 'strong' }); sStart = ctx.currentTime; };   // the full keystroke
    const ready = () => ctx.state === 'running' && ctx.currentTime > 0.02;
    if (ready()) fire(); else { const poll = () => { if (ready() || performance.now() - started > 300) fire(); else setTimeout(poll, 8); }; setTimeout(poll, 8); }
    return true;
  };
  const clack = () => { pressSounded = false; sStart = -1; const go = () => { pressSounded = tryClack(); }; cue ? go() : cueReady.then(go); };
  const played = () => {
    if (muted || sStart === -2) return true;
    if (!sCtx || sStart < 0 || sCtx.state !== 'running') return false;
    return sCtx.currentTime - sStart >= 0.06 + (sCtx.outputLatency || sCtx.baseLatency || 0.03);
  };
  const leaveFor = (href, t0) => {
    const cap = (sCtx && sCtx.state === 'running' && sCtx.currentTime > 0.05) ? 450 : 900;   // patient only while the output is still waking
    const tick = () => { const now = performance.now(); if (now - t0 > cap || (now >= t0 + 150 && played())) { location.href = href; return; } setTimeout(tick, 12); };
    tick();
  };
  // wake the audio on the first touch of the page (dragging bricks, the banana…), and again when the pointer reaches the
  // keys on a page that has been touched, so the output device is awake by the time a key is pressed
  const warmNow = () => { const w = () => { try { cue && cue.warm && cue.warm(); } catch (e) {} prime(); }; cue ? w() : cueReady.then(w); };
  const warm = () => { removeEventListener('pointerdown', warm, true); removeEventListener('keydown', warm, true); warmNow(); };
  addEventListener('pointerdown', warm, true); addEventListener('keydown', warm, true);
  document.querySelector('.mlc-tabs').addEventListener('pointerenter', warmNow);   // creating the context early is allowed
  const keys = [...document.querySelectorAll('a.mlc-tab')];
  const showPage = k => keys.forEach(a => a.classList.toggle('on', a.dataset.k === k));
  keys.forEach(a => {
    a.addEventListener('pointerdown', e => { if (e.button === 0 && !a.classList.contains('on')){ pressedAt = performance.now(); clack(); } });
    a.addEventListener('click', e => {
      if (a.classList.contains('on')){ e.preventDefault(); return; }
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;         // new tab / window: let the browser do it
      e.preventDefault();
      const fresh = performance.now() - pressedAt > 1500;                   // keyboard: no press came first
      if (fresh || !pressSounded) clack();                                  // the press could not sound (touch, or audio locked until the click): sound now
      else if (sCtx && sCtx.state !== 'running') { try { sCtx.resume().catch(() => {}); } catch (e) {} }
      showPage(a.dataset.k);                                               // old key pops up, this one stays down
      leaveFor(a.href, performance.now());                                  // after the key's travel and its click
    });
  });
  addEventListener('pageshow', e => { if (e.persisted) showPage(page); });   // coming Back from the cache: put the keys right
  // a page fade the browser skips (Back from the cache, a quick second click) rejects its promises: that's fine, keep the console quiet
  const quiet = vt => { if (vt){ vt.ready?.catch(()=>{}); vt.finished?.catch(()=>{}); vt.updateCallbackDone?.catch(()=>{}); } };
  addEventListener('pagereveal', e => quiet(e.viewTransition));
  addEventListener('pageswap', e => quiet(e.viewTransition));

  track();
})();
