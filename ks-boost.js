/* ══════════════════════════════════════════════════════════════════
   Kashmir Stay — Owner tools (shown only to the OWNER of an APPROVED
   business, on its detail page)

   📊 Today's stats — watch 1 rewarded ad (app only) → today's profile
                      views, WhatsApp and call clicks, unlocked for 24 hours
   ⭐ Spotlight     — opens the Spotlight popup with TWO options:
                        💳 Buy Spotlight (1 / 3 / 7 days — unchanged)
                        🎬 Watch 2 ads → 1 hour FREE (app only)
   Free-hour rules:
     • only fills a slot nobody has paid for — paid spotlights always come
       first and push free hours out (see ksGetSpotlights in index.html)
     • once per business every 20 hours — enforced by Firestore rules
     • stored in spot_boosts/{bizId}, never on the business document, so it
       can't touch paid spotlight data or trigger an SEO page rebuild
     • when the hour ends, the owner sees how many views it brought and a
       "full day for ₹49" offer

   • On the website the stats tile stays locked; a tap shows an
     "available only in the app" popup with a Get App button
   • Everyone watches the ad in the app — Premium included
   ══════════════════════════════════════════════════════════════════ */
import { getCountFromServer, Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const REWARDED_AD_UNIT = 'ca-app-pub-3499114279910810/6301670106';
const STATS_MS = 24 * 60 * 60 * 1000;      // stats unlocked for 24 hours
const FREE_MS = 60 * 60 * 1000;            // free spotlight: 1 hour
const FREE_GAP_MS = 20 * 60 * 60 * 1000;   // once a day (must match firestore.rules)
const FREE_ADS = 2;                        // ads needed for one free hour
const MAX_SLOTS = () => window.SPOTLIGHT_MAX_SLOTS || 3;
const PLAY = 'https://play.google.com/store/apps/details?id=in.kashmirstay.ks&referrer=utm_source%3Dwebsite%26utm_medium%3Downer_tools';

const fs = () => window._collections;
const db = () => window._db;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toast = (m) => (window.showToast ? window.showToast(m) : alert(m));
const inApp = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const dayTimeText = (ms) => {
  const d = new Date(ms), t = new Date();
  const tomorrow = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1);
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  const label = d.toDateString() === t.toDateString() ? 'today' : d.toDateString() === tomorrow.toDateString() ? 'tomorrow' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return `${time} ${label}`;
};
const toMs = (v) => {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  const n = new Date(v).getTime();
  return isNaN(n) ? 0 : n;
};
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
};

// ════════════════ POPUPS ════════════════
function sheet(html, onClick) {
  const wrap = document.createElement('div');
  wrap.className = 'kb-modal';
  wrap.innerHTML = `<div class="kb-sheet" role="dialog" aria-modal="true">${html}</div>`;
  wrap.addEventListener('click', (e) => onClick(e, wrap));
  document.body.appendChild(wrap);
}

function confirmAd() {
  return new Promise((resolve) => {
    sheet(`<div class="kb-sheet-ic">🎬</div>
      <h3>Unlock today's stats</h3>
      <p>Watch a short ad (about 15–30 seconds) to see today's views, WhatsApp and call clicks for the next 24 hours.</p>
      <div class="kb-sheet-btns">
        <button class="kb-btn ghost" data-a="no">Not now</button>
        <button class="kb-btn dark" data-a="yes">▶ Watch ad</button>
      </div>`, (e, wrap) => {
      const a = e.target.closest('[data-a]');
      if (a || e.target === wrap) { wrap.remove(); resolve(!!a && a.dataset.a === 'yes'); }
    });
  });
}

/** Website: the stats unlock needs the app (rewarded ads only run there). */
function appOnly(which) {
  const feature = which === 'spot' ? 'The free Spotlight hour' : "Today's stats";
  sheet(`<div class="kb-sheet-ic">📱</div>
    <h3>Available only in the app</h3>
    <p><b>${feature}</b> works in the Kashmir Stay Android app. Open your listing in the app and watch ${which === 'spot' ? '2 short ads' : 'a short ad'} to unlock it.</p>
    <div class="kb-sheet-btns">
      <button class="kb-btn ghost" data-a="no">Not now</button>
      <a class="kb-btn dark" data-a="go" href="${PLAY}" target="_blank" rel="noopener">▶ Get the app</a>
    </div>`, (e, wrap) => {
    const a = e.target.closest('[data-a]');
    if ((a && a.dataset.a === 'no') || e.target === wrap) wrap.remove();
    else if (a && a.dataset.a === 'go') setTimeout(() => wrap.remove(), 300);
  });
}

/** Resolves true only if the user watched the ad to the end. */
async function watchAd(skipMsg) {
  const Ads = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AdmobAds;
  if (!inApp() || !Ads) return false;
  toast('Loading ad…');
  try {
    await Ads.loadRewardedInterstitialAd({ adId: REWARDED_AD_UNIT, isTesting: false });
    const r = await Ads.showRewardedInterstitialAd();
    if (r && r.rewarded) return true;
    toast(skipMsg || 'Watch the full ad to get the reward.');
  } catch (e) {
    console.warn('[ksBoost] ad:', e && e.message);
    toast('No ad available right now — please try again in a few minutes.');
  }
  return false;
}

// ════════════════ FREE SPOTLIGHT (watch 2 ads → 1 hour) ════════════════
let freeMap = new Map();   // bizId → started at (ms), only boosts still running

/** Free spotlights to show, as copies (originals untouched), oldest first,
    never for a business that already has a paid spotlight. */
function freeSpots(all, paid) {
  const now = Date.now();
  const paidIds = new Set((paid || []).map((b) => b.id));
  const byId = new Map((all || []).map((b) => [b.id, b]));
  return [...freeMap.entries()]
    .filter(([id, at]) => at + FREE_MS > now && !paidIds.has(id) && byId.has(id))
    .sort((a, b) => a[1] - b[1])
    .map(([id, at]) => Object.assign({}, byId.get(id), { spotlight_until: new Date(at + FREE_MS).toISOString(), _freeSpot: true }));
}

async function loadFreeSpots() {
  if (!db() || !fs()) return;
  const { getDocs, collection, query, where, getDoc, doc } = fs();
  try {
    const snap = await getDocs(query(collection(db(), 'spot_boosts'), where('last_at', '>', Timestamp.fromMillis(Date.now() - FREE_MS))));
    const next = new Map();
    snap.forEach((d) => { const at = toMs(d.data().last_at); if (at) next.set(d.id, at); });
    const changed = next.size !== freeMap.size || [...next].some(([k, v]) => freeMap.get(k) !== v);
    freeMap = next;
    // a free-spotlight business older than the first 50 loaded must still be on the list
    const list = window.allBizData || [];
    const have = new Set(list.map((b) => b.id));
    const missing = [...freeMap.keys()].filter((id) => !have.has(id)).slice(0, 5);
    for (const id of missing) {
      try {
        const s = await getDoc(doc(db(), 'businesses', id));
        if (s.exists() && s.data().status === 'approved') list.push({ id: s.id, ...s.data() });
      } catch (e) {}
    }
    if ((changed || missing.length) && typeof window.ksRerenderHome === 'function') window.ksRerenderHome();
  } catch (e) { console.warn('[ksBoost] free spots:', e.message); }
}

async function myFreeLastAt(bizId) {
  const { getDoc, doc } = fs();
  try {
    const s = await getDoc(doc(db(), 'spot_boosts', bizId));
    return s.exists() ? toMs(s.data().last_at) : 0;
  } catch (e) { return 0; }
}

/** Free slots right now = 3 − paid − other free hours still running. */
function freeSlotsLeft(paidLive, bizId) {
  const now = Date.now();
  const running = [...freeMap.entries()].filter(([id, at]) => id !== bizId && at + FREE_MS > now).length;
  return Math.max(0, MAX_SLOTS() - (paidLive || 0) - running);
}

// ads watched so far toward the next free hour (kept 30 min, so a failed 2nd ad isn't lost)
const adsKey = (id) => 'ks_free_ads_' + id;
function adsDone(id) {
  try { const o = JSON.parse(store.get(adsKey(id)) || 'null'); return o && Date.now() - o.t < 30 * 60 * 1000 ? o.n : 0; } catch (e) { return 0; }
}
const setAdsDone = (id, n) => store.set(adsKey(id), JSON.stringify({ n, t: Date.now() }));

/** Fills #ks-free-spot-opt inside the Spotlight popup (index.html). */
async function renderFreeOption(bizId, paidLive) {
  const box = document.getElementById('ks-free-spot-opt');
  if (!box || !bizId) return;
  const optCard = (sub, btn) => `
    <div style="font-size:.72rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--gray500,#6B7280);margin:0 0 8px">🎬 Or try it free</div>
    <div style="border:2px dashed #FCD34D;background:#FFFBEB;border-radius:12px;padding:14px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
        <div><div style="font-weight:700;font-size:.9rem">Watch ${FREE_ADS} ads → 1 hour FREE</div><div style="font-size:.74rem;color:var(--gray500,#6B7280)">${sub}</div></div>
        <div style="font-family:var(--font-display);font-weight:800;font-size:1.1rem;color:#15803D">FREE</div>
      </div>${btn}
    </div>`;
  const btnHtml = (label, action, disabled) => `<button class="kb-btn ${disabled ? 'ghost' : 'dark'}" style="margin-top:10px" ${disabled ? 'disabled' : `onclick="${action}"`}>${label}</button>`;
  box.innerHTML = optCard('Checking free slots…', '');

  if (!inApp()) {
    box.innerHTML = optCard('Top of the home page for 1 hour · once a day', btnHtml('🔒 Only in the app', 'ksBoost.appOnly(\'spot\')', false));
    return;
  }
  await loadFreeSpots();
  const lastAt = await myFreeLastAt(bizId);
  const now = Date.now();
  let sub, btn;
  if (lastAt + FREE_MS > now) {
    sub = `Your free hour is running till ${dayTimeText(lastAt + FREE_MS)}.`;
    btn = btnHtml('✅ Running now', '', true);
  } else if (lastAt && lastAt + FREE_GAP_MS > now) {
    sub = `Used for today · next free hour at ${dayTimeText(lastAt + FREE_GAP_MS)}`;
    btn = btnHtml('⏳ Come back later', '', true);
  } else if (freeSlotsLeft(paidLive, bizId) <= 0) {
    sub = 'All 3 slots are taken right now.';
    btn = btnHtml('Slots full · try later', '', true);
  } else {
    const done = adsDone(bizId);
    sub = `Top of the home page for 1 hour · once a day${done ? ` · ${done} of ${FREE_ADS} ads watched` : ''}`;
    btn = btnHtml(done >= FREE_ADS ? '⭐ Start my free hour' : done ? `🎬 Watch ad ${done + 1} of ${FREE_ADS}` : `🎬 Watch ${FREE_ADS} ads`, `ksBoost.freeSpot('${esc(bizId)}', ${Number(paidLive) || 0})`, false);
  }
  box.innerHTML = optCard(sub, btn);
}

async function freeSpot(bizId, paidLive) {
  const b = (current.biz && current.biz.id === bizId) ? current.biz : (window.allBizData || []).find((x) => x.id === bizId);
  const u = window._currentUser || (window._auth && window._auth.currentUser);
  if (busy || !bizId || !u) return;
  if (!inApp()) { appOnly('spot'); return; }
  busy = true;
  try {
    // check everything BEFORE any ad, so nobody watches ads for nothing
    await loadFreeSpots();
    const lastAt = await myFreeLastAt(bizId);
    if (lastAt && lastAt + FREE_GAP_MS > Date.now()) { toast(`Free hour used — next one at ${dayTimeText(lastAt + FREE_GAP_MS)}.`); return; }
    if (freeSlotsLeft(paidLive, bizId) <= 0) { toast('All slots are taken right now — try again later.'); return; }

    let done = adsDone(bizId);
    while (done < FREE_ADS) {
      if (!(await watchAd('Watch the full ad — your progress is saved.'))) { renderFreeOption(bizId, paidLive); return; }
      done += 1;
      setAdsDone(bizId, done);
      if (done < FREE_ADS) toast(`✅ Ad ${done} of ${FREE_ADS} done — one more!`);
    }

    // a paid spotlight may have taken the last slot while the ads played
    await loadFreeSpots();
    if (freeSlotsLeft(paidLive, bizId) <= 0) { toast('Someone just took the last slot — your ads are saved, try again soon.'); renderFreeOption(bizId, paidLive); return; }

    const { setDoc, doc, serverTimestamp } = fs();
    try {
      await setDoc(doc(db(), 'spot_boosts', bizId), { biz_id: bizId, user_id: u.uid, last_at: serverTimestamp() });
    } catch (e) {
      console.warn('[ksBoost] free spot:', e.message);
      // lastAt was checked before the ads, so a refusal here is not the daily limit —
      // usually the new Firestore rules aren't deployed yet. Ads stay saved (30 min).
      toast(String(e.code || '').includes('permission')
        ? 'Server not ready for free Spotlight yet — your ads are saved, try again in a few minutes.'
        : 'Could not start your free hour — your ads are saved, please try again.');
      renderFreeOption(bizId, paidLive);
      return;
    }
    setAdsDone(bizId, 0);
    freeMap.set(bizId, Date.now());
    freeLast = { id: bizId, at: Date.now() };
    if (typeof window.closeSpotlightModal === 'function') window.closeSpotlightModal();
    toast('⭐ You are in Spotlight for 1 hour!');
    if (typeof window.ksRerenderHome === 'function') window.ksRerenderHome();
    if (current.biz && current.biz.id === bizId) render();
    setTimeout(loadFreeSpots, 3000);   // pick up the real server time
  } finally { busy = false; }
}

/** Views during the last free hour — shown after it ends, with the ₹49 offer. */
async function viewsDuring(bizId, from, to) {
  const { collection, query, where } = fs();
  const s = await getCountFromServer(query(collection(db(), 'analytics_events'),
    where('biz_id', '==', bizId), where('type', '==', 'view'),
    where('created_at', '>=', Timestamp.fromMillis(from)), where('created_at', '<', Timestamp.fromMillis(to))));
  return s.data().count;
}

// ════════════════ TODAY'S STATS ════════════════
const statsKey = (id) => 'ks_stats_unlock_' + id;
const statsUntil = (id) => Number(store.get(statsKey(id)) || 0);

async function loadTodayStats(bizId) {
  const { collection, query, where } = fs();
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const base = [where('biz_id', '==', bizId), where('created_at', '>=', Timestamp.fromDate(start))];
  const count = (type) => getCountFromServer(query(collection(db(), 'analytics_events'), ...base, where('type', '==', type)))
    .then((s) => s.data().count);
  const [views, whatsapp, calls] = await Promise.all([count('view'), count('whatsapp'), count('phone')]);
  return { views, whatsapp, calls };
}

// ════════════════ UI ════════════════
let current = { biz: null, isOwner: false };
let freeLast = { id: null, at: 0 };

const css = `
#detail-owner-tools{padding:4px 16px 14px}
#detail-owner-tools .kb-head{font-size:.72rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--gray500,#6B7280);margin:0 0 8px}
.kb-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.kb-tile{background:var(--gray50,#F9FAFB);border:1px solid var(--gray200,#E5E7EB);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:6px;min-width:0}
.kb-tile .kb-t{font-weight:700;font-size:.86rem;color:var(--primary,#1F1F1F);display:flex;align-items:center;gap:6px}
.kb-tile .kb-s{font-size:.72rem;color:var(--gray500,#6B7280);line-height:1.4;flex:1}
.kb-tile.on{background:#F0FDF4;border-color:#BBF7D0}
.kb-tile.gold{background:linear-gradient(180deg,#FFFBEB,#fff);border-color:#FCD34D}
.kb-nums{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;text-align:center}
.kb-nums b{display:block;font-size:1.1rem;color:var(--primary,#1F1F1F);line-height:1.2}
.kb-nums span{font-size:.62rem;color:var(--gray500,#6B7280)}
.kb-btn{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:34px;padding:0 12px;border-radius:10px;font-size:.76rem;font-weight:700;border:none;cursor:pointer;text-decoration:none;width:100%}
.kb-btn.dark{background:var(--primary,#1F1F1F);color:#fff}
.kb-btn.gold{background:var(--accent,#F5A623);color:#1F1F1F}
.kb-btn.ghost{background:#fff;color:var(--primary,#1F1F1F);border:1px solid var(--gray200,#E5E7EB)}
.kb-modal{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center}
.kb-sheet{background:#fff;width:100%;max-width:480px;border-radius:20px 20px 0 0;padding:22px 20px calc(18px + env(safe-area-inset-bottom));text-align:center}
.kb-sheet-ic{font-size:2rem}.kb-sheet h3{font-size:1.05rem;margin:6px 0}.kb-sheet p{font-size:.86rem;color:var(--gray700,#374151);margin:0 0 16px}
.kb-sheet-btns{display:grid;grid-template-columns:1fr 1fr;gap:10px}.kb-sheet .kb-btn{min-height:44px;font-size:.88rem}
@media(max-width:360px){.kb-grid{grid-template-columns:1fr}}
`;

function ensureBox() {
  let box = document.getElementById('detail-owner-tools');
  if (box) return box;
  const header = document.querySelector('#page-biz-detail .biz-detail-header');
  if (!header) return null;
  box = document.createElement('div');
  box.id = 'detail-owner-tools';
  box.style.display = 'none';
  header.insertAdjacentElement('afterend', box);
  return box;
}

function render() {
  const box = ensureBox();
  if (!box) return;
  const b = current.biz;
  if (!b || !current.isOwner || b.status !== 'approved') { box.style.display = 'none'; box.innerHTML = ''; return; }
  const app = inApp();
  const now = Date.now();

  // ── 📊 stats tile (app only, 1 ad = 24 hours)
  const sUntil = app ? statsUntil(b.id) : 0;
  const statsOpen = sUntil > now;
  const statsTile = statsOpen
    ? `<div class="kb-tile on">
        <div class="kb-t">📊 Today</div>
        <div class="kb-nums" id="kb-nums"><div><b>…</b><span>Views</span></div><div><b>…</b><span>WhatsApp</span></div><div><b>…</b><span>Calls</span></div></div>
        <div class="kb-s">Unlocked till ${dayTimeText(sUntil)} · updates every ~30 min</div>
      </div>`
    : `<div class="kb-tile">
        <div class="kb-t">📊 Today's stats</div>
        <div class="kb-s">See today's profile views, WhatsApp and call clicks.</div>
        ${app ? `<button class="kb-btn dark" onclick="ksBoost.unlockStats()">🎬 Watch ad · unlock</button>`
              : `<button class="kb-btn dark" onclick="ksBoost.appOnly('stats')">🔒 Unlock</button>`}
      </div>`;

  // ── ⭐ Spotlight tile (paid spotlight, or the free hour + ₹49 offer after it)
  const spUntil = toMs(b.spotlight_until);
  const freeAt = freeLast.id === b.id ? freeLast.at : 0;
  let spotTile;
  if (spUntil > now) {
    spotTile = `<div class="kb-tile gold">
        <div class="kb-t">⭐ Spotlight on</div>
        <div class="kb-s">You're at the top of the home page till ${dayTimeText(spUntil)}.</div>
        <button class="kb-btn ghost" onclick="openSpotlightModal('${esc(b.id)}')">Extend</button>
      </div>`;
  } else if (freeAt && freeAt + FREE_MS > now) {
    spotTile = `<div class="kb-tile gold">
        <div class="kb-t">⭐ Free hour on</div>
        <div class="kb-s">You're in Spotlight till ${dayTimeText(freeAt + FREE_MS)} (if a paid listing takes the slot, it ends early).</div>
        <button class="kb-btn gold" onclick="openSpotlightModal('${esc(b.id)}')">Make it a full day</button>
      </div>`;
  } else if (freeAt && now - (freeAt + FREE_MS) < 24 * 60 * 60 * 1000) {
    spotTile = `<div class="kb-tile gold">
        <div class="kb-t">⭐ Your free hour ended</div>
        <div class="kb-s" id="kb-free-result">You were at the top of the home page for 1 hour.</div>
        <button class="kb-btn gold" onclick="openSpotlightModal('${esc(b.id)}')">⭐ Full day for ₹49</button>
      </div>`;
  } else {
    spotTile = `<div class="kb-tile gold">
        <div class="kb-t">⭐ Get more views</div>
        <div class="kb-s">Spotlight puts you at the top of the home page. Buy it, or watch ${FREE_ADS} ads for 1 free hour.</div>
        <button class="kb-btn gold" onclick="openSpotlightModal('${esc(b.id)}')">⭐ Spotlight</button>
      </div>`;
  }

  box.innerHTML = `<p class="kb-head">Owner tools · only you see this</p><div class="kb-grid">${statsTile}${spotTile}</div>`;
  box.style.display = 'block';

  if (freeAt && freeAt + FREE_MS <= now && document.getElementById('kb-free-result')) {
    viewsDuring(b.id, freeAt, freeAt + FREE_MS).then((n) => {
      const el = document.getElementById('kb-free-result');
      if (el && n > 0) el.textContent = `Your free hour brought ${n} profile view${n !== 1 ? 's' : ''}. Imagine a full day!`;
    }).catch(() => {});
  }

  if (statsOpen) {
    loadTodayStats(b.id).then((s) => {
      const el = document.getElementById('kb-nums');
      if (el && current.biz && current.biz.id === b.id) {
        el.innerHTML = `<div><b>${s.views}</b><span>Views</span></div><div><b>${s.whatsapp}</b><span>WhatsApp</span></div><div><b>${s.calls}</b><span>Calls</span></div>`;
      }
    }).catch((e) => {
      console.warn('[ksBoost] stats:', e.message);
      const el = document.getElementById('kb-nums');
      if (el) el.innerHTML = '<div style="grid-column:1/-1" class="kb-s">Stats are being set up — try again in a few minutes.</div>';
    });
  }
}

// ════════════════ ACTIONS ════════════════
let busy = false;

async function unlockStats() {
  const b = current.biz;
  if (busy || !b || !current.isOwner) return;
  if (!inApp()) { appOnly(); return; }
  if (!(await confirmAd())) return;
  busy = true;
  try {
    if (await watchAd('Watch the full ad to unlock your stats.')) {
      store.set(statsKey(b.id), String(Date.now() + STATS_MS));
      toast('📊 Stats unlocked for 24 hours');
      render();
    }
  } finally { busy = false; }
}

async function onBizOpened(b, isOwner) {
  current = { biz: b, isOwner: !!isOwner };
  render();
  if (current.isOwner && b && b.status === 'approved') {
    const at = await myFreeLastAt(b.id);
    freeLast = { id: b.id, at };
    if (at && current.biz && current.biz.id === b.id) render();
  }
}

// ════════════════ INIT ════════════════
const st = document.createElement('style');
st.textContent = css;
document.head.appendChild(st);
window.ksBoost = { onBizOpened, unlockStats, appOnly, freeSpots, renderFreeOption, freeSpot };
const startFree = () => (db() && fs()) ? loadFreeSpots() : setTimeout(startFree, 300);
startFree();
setInterval(loadFreeSpots, 5 * 60 * 1000);   // free hours end after 60 min
document.addEventListener('visibilitychange', () => { if (!document.hidden) loadFreeSpots(); });
if (window._ksPendingBiz) onBizOpened(window._ksPendingBiz.b, window._ksPendingBiz.isOwner);
