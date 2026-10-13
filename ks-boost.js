/* ══════════════════════════════════════════════════════════════════
   Kashmir Stay — Owner rewards (watch an ad → get a reward)
   Shown only to the OWNER of an APPROVED business, on its detail page:

   📊 Today's stats   — watch 1 ad → today's profile views, WhatsApp and
                        call clicks, unlocked for 24 hours
   ⬆  Bump to top     — watch 1 ad → business shows at the top of its
                        category list for 1 hour (once a day — enforced by
                        Firestore rules, not just the app)

   • App only: on the website both tiles stay locked and a tap shows an
     "available only in the app" popup with a Get App button
   • Bumps live in their own collection (bumps/{bizId}) so a bump never
     changes the business document → the SEO page isn't rebuilt each time
   ══════════════════════════════════════════════════════════════════ */
import { getCountFromServer, Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const REWARDED_AD_UNIT = 'ca-app-pub-3499114279910810/6301670106';
const BUMP_MS = 60 * 60 * 1000;          // 1 hour on top
const BUMP_GAP_MS = 20 * 60 * 60 * 1000;   // once a day (must match firestore.rules)
const STATS_MS = 24 * 60 * 60 * 1000;      // stats unlocked for 24 hours
const PLAY = 'https://play.google.com/store/apps/details?id=in.kashmirstay.ks&referrer=utm_source%3Dwebsite%26utm_medium%3Downer_rewards';

const fs = () => window._collections;
const db = () => window._db;
const me = () => window._currentUser || (window._auth && window._auth.currentUser) || null;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toast = (m) => (window.showToast ? window.showToast(m) : alert(m));
const inApp = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const timeText = (ms) => new Date(ms).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
const dayTimeText = (ms) => {
  const d = new Date(ms), t = new Date();
  const tomorrow = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1);
  const label = d.toDateString() === t.toDateString() ? 'today' : d.toDateString() === tomorrow.toDateString() ? 'tomorrow' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return `${timeText(ms)} ${label}`;
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


// ════════════════ ACTIVE BUMPS (used by the home list) ════════════════
let bumps = new Map();   // bizId → until (ms)

function isBumped(id) { return (bumps.get(id) || 0) > Date.now(); }

/** Bumped businesses first (newest bump on top), everything else keeps its order. */
function sortBumped(list) {
  if (!bumps.size || !Array.isArray(list)) return list;
  const now = Date.now();
  return list
    .map((b, i) => ({ b, i, u: (bumps.get(b.id) || 0) > now ? bumps.get(b.id) : 0 }))
    .sort((x, y) => (y.u - x.u) || (x.i - y.i))
    .map((x) => x.b);
}

async function loadBumps() {
  if (!db() || !fs()) return;
  const { getDocs, collection, query, where, getDoc, doc } = fs();
  try {
    const since = Timestamp.fromMillis(Date.now() - BUMP_MS);
    const snap = await getDocs(query(collection(db(), 'bumps'), where('last_at', '>', since)));
    const next = new Map();
    snap.forEach((d) => { const at = toMs(d.data().last_at); if (at) next.set(d.id, at + BUMP_MS); });
    const changed = next.size !== bumps.size || [...next].some(([k, v]) => bumps.get(k) !== v);
    bumps = next;

    // A bumped business older than the first 50 loaded must still appear in the list
    const list = window.allBizData || [];
    const have = new Set(list.map((b) => b.id));
    const missing = [...bumps.keys()].filter((id) => !have.has(id)).slice(0, 10);
    for (const id of missing) {
      try {
        const s = await getDoc(doc(db(), 'businesses', id));
        if (s.exists() && s.data().status === 'approved') list.push({ id: s.id, ...s.data() });
      } catch (e) {}
    }
    if ((changed || missing.length) && typeof window.ksRerenderHome === 'function') window.ksRerenderHome();
  } catch (e) {
    console.warn('[ksBoost] bumps:', e.message);
  }
}

// ════════════════ REWARDED AD ════════════════
function confirmAd(title, reward) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'kb-modal';
    wrap.innerHTML = `<div class="kb-sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="kb-sheet-ic">🎬</div>
      <h3>${esc(title)}</h3>
      <p>Watch a short ad (about 15–30 seconds) to ${esc(reward)}.</p>
      <div class="kb-sheet-btns">
        <button class="kb-btn ghost" data-a="no">Not now</button>
        <button class="kb-btn dark" data-a="yes">▶ Watch ad</button>
      </div></div>`;
    const done = (v) => { wrap.remove(); resolve(v); };
    wrap.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]');
      if (a) done(a.dataset.a === 'yes');
      else if (e.target === wrap) done(false);
    });
    document.body.appendChild(wrap);
  });
}

/** Website: these rewards need the app (ads only run there). */
function appOnly(feature) {
  feature = { stats: "Today's stats", bump: 'Bump to top' }[feature] || feature;
  const wrap = document.createElement('div');
  wrap.className = 'kb-modal';
  wrap.innerHTML = `<div class="kb-sheet" role="dialog" aria-modal="true" aria-label="Available in the app">
    <div class="kb-sheet-ic">📱</div>
    <h3>Available only in the app</h3>
    <p><b>${esc(feature)}</b> works in the Kashmir Stay Android app. Open your listing in the app and watch a short ad to unlock it.</p>
    <div class="kb-sheet-btns">
      <button class="kb-btn ghost" data-a="no">Not now</button>
      <a class="kb-btn dark" data-a="go" href="${PLAY}" target="_blank" rel="noopener">▶ Get the app</a>
    </div></div>`;
  wrap.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]');
    if ((a && a.dataset.a === 'no') || e.target === wrap) wrap.remove();
    else if (a && a.dataset.a === 'go') setTimeout(() => wrap.remove(), 300);
  });
  document.body.appendChild(wrap);
}

/** Resolves true only if the user watched the ad to the end. */
async function watchAd() {
  const Ads = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AdmobAds;
  if (!inApp() || !Ads) return false;
  toast('Loading ad…');
  try {
    await Ads.loadRewardedInterstitialAd({ adId: REWARDED_AD_UNIT, isTesting: false });
    const r = await Ads.showRewardedInterstitialAd();
    if (r && r.rewarded) return true;
    toast('Watch the full ad to get the reward.');
  } catch (e) {
    console.warn('[ksBoost] ad:', e && e.message);
    toast('No ad available right now — please try again in a few minutes.');
  }
  return false;
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

// ════════════════ BUMP ════════════════
let myBump = { id: null, lastAt: 0 };

async function loadMyBump(bizId) {
  const { getDoc, doc } = fs();
  try {
    const s = await getDoc(doc(db(), 'bumps', bizId));
    myBump = { id: bizId, lastAt: s.exists() ? toMs(s.data().last_at) : 0 };
  } catch (e) { myBump = { id: bizId, lastAt: 0 }; }
}

async function writeBump(bizId) {
  const { setDoc, doc, serverTimestamp } = fs();
  const u = me();
  await setDoc(doc(db(), 'bumps', bizId), { biz_id: bizId, user_id: u.uid, last_at: serverTimestamp() });
}

// ════════════════ UI ════════════════
let current = { biz: null, isOwner: false };

const css = `
#detail-owner-tools{padding:4px 16px 14px}
#detail-owner-tools .kb-head{font-size:.72rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--gray500,#6B7280);margin:0 0 8px}
.kb-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.kb-tile{background:var(--gray50,#F9FAFB);border:1px solid var(--gray200,#E5E7EB);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:6px;min-width:0}
.kb-tile .kb-t{font-weight:700;font-size:.86rem;color:var(--primary,#1F1F1F);display:flex;align-items:center;gap:6px}
.kb-tile .kb-s{font-size:.72rem;color:var(--gray500,#6B7280);line-height:1.4}
.kb-tile.on{background:#F0FDF4;border-color:#BBF7D0}
.kb-nums{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;text-align:center}
.kb-nums b{display:block;font-size:1.1rem;color:var(--primary,#1F1F1F);line-height:1.2}
.kb-nums span{font-size:.62rem;color:var(--gray500,#6B7280)}
.kb-btn{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:34px;padding:0 12px;border-radius:10px;font-size:.76rem;font-weight:700;border:none;cursor:pointer;text-decoration:none;width:100%}
.kb-btn.dark{background:var(--primary,#1F1F1F);color:#fff}
.kb-btn.gold{background:var(--accent,#F5A623);color:#1F1F1F}
.kb-btn.ghost{background:#fff;color:var(--primary,#1F1F1F);border:1px solid var(--gray200,#E5E7EB)}
.kb-btn[disabled]{opacity:.55;cursor:default}
.kb-pill{font-size:.6rem;font-weight:700;background:var(--accent,#F5A623);color:#1F1F1F;padding:2px 6px;border-radius:999px}
.kb-boosted{font-size:.62rem;background:#FEF3C7;color:#92400E;padding:2px 7px;border-radius:10px;font-weight:700;margin-left:4px}
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

  // ── stats tile
  const sUntil = app ? statsUntil(b.id) : 0;   // website: always locked
  const statsOpen = sUntil > now;
  const statsTile = statsOpen
    ? `<div class="kb-tile on" id="kb-stats">
        <div class="kb-t">📊 Today</div>
        <div class="kb-nums" id="kb-nums"><div><b>…</b><span>Views</span></div><div><b>…</b><span>WhatsApp</span></div><div><b>…</b><span>Calls</span></div></div>
        <div class="kb-s">Unlocked till ${dayTimeText(sUntil)} · updates every ~30 min</div>
      </div>`
    : `<div class="kb-tile" id="kb-stats">
        <div class="kb-t">📊 Today's stats</div>
        <div class="kb-s">See today's profile views, WhatsApp and call clicks.</div>
        ${app ? `<button class="kb-btn dark" onclick="ksBoost.unlockStats()">🎬 Watch ad · unlock</button>`
              : `<button class="kb-btn dark" onclick="ksBoost.appOnly('stats')">🔒 Unlock</button>`}
      </div>`;

  // ── bump tile
  const lastAt = myBump.id === b.id ? myBump.lastAt : 0;
  const onTopUntil = lastAt + BUMP_MS;
  const nextAt = lastAt + BUMP_GAP_MS;
  let bumpBody;
  if (onTopUntil > now) {
    bumpBody = `<div class="kb-s">Your business is at the top of the <b>${esc(b.type || 'category')}</b> list till ${timeText(onTopUntil)}.</div>
      <button class="kb-btn ghost" disabled>✅ On top now</button>`;
  } else if (lastAt && nextAt > now) {
    bumpBody = `<div class="kb-s">Used for today. Next bump available at ${dayTimeText(nextAt)}.</div>
      <button class="kb-btn ghost" disabled>⏳ Come back later</button>`;
  } else if (app) {
    bumpBody = `<div class="kb-s">Top of the <b>${esc(b.type || 'category')}</b> list for 1 hour. Once a day.</div>
      <button class="kb-btn gold" onclick="ksBoost.bump()">🎬 Watch ad · bump</button>`;
  } else {
    bumpBody = `<div class="kb-s">Top of the <b>${esc(b.type || 'category')}</b> list for 1 hour. Once a day.</div>
      <button class="kb-btn gold" onclick="ksBoost.appOnly('bump')">🔒 Bump</button>`;
  }
  const bumpTile = `<div class="kb-tile${onTopUntil > now ? ' on' : ''}" id="kb-bump"><div class="kb-t">⬆ Bump to top</div>${bumpBody}</div>`;

  box.innerHTML = `<p class="kb-head">Owner tools · only you see this</p><div class="kb-grid">${statsTile}${bumpTile}</div>`;
  box.style.display = 'block';

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
  if (!inApp()) { appOnly("Today's stats"); return; }
  if (!(await confirmAd("Unlock today's stats", "see today's views, WhatsApp and call clicks for the next 24 hours"))) return;
  busy = true;
  try {
    if (await watchAd()) {
      store.set(statsKey(b.id), String(Date.now() + STATS_MS));
      toast('📊 Stats unlocked for 24 hours');
      render();
    }
  } finally { busy = false; }
}

async function bump() {
  const b = current.biz;
  if (busy || !b || !current.isOwner || b.status !== 'approved') return;
  if (!inApp()) { appOnly('Bump to top'); return; }
  // Never make someone watch an ad for a bump the rules will refuse
  if (myBump.id === b.id && myBump.lastAt && myBump.lastAt + BUMP_GAP_MS > Date.now()) {
    toast(`You can bump again at ${dayTimeText(myBump.lastAt + BUMP_GAP_MS)}.`);
    return;
  }
  if (!(await confirmAd('Bump to top', `show ${b.name} at the top of the ${b.type || 'category'} list for 1 hour`))) return;
  busy = true;
  try {
    if (!(await watchAd())) return;
    try {
      await writeBump(b.id);
    } catch (e) {
      // Rules reject a second bump within 20 hours (or a non-owner)
      console.warn('[ksBoost] bump:', e.message);
      await loadMyBump(b.id);
      render();
      toast(String(e.code || '').includes('permission') ? 'You can bump once a day — try again later.' : 'Could not bump right now — please try again.');
      return;
    }
    await loadMyBump(b.id);
    if (!myBump.lastAt) myBump = { id: b.id, lastAt: Date.now() };
    bumps.set(b.id, myBump.lastAt + BUMP_MS);
    if (typeof window.ksRerenderHome === 'function') window.ksRerenderHome();
    toast('⬆ You are at the top for 1 hour!');
    render();
  } finally { busy = false; }
}

async function onBizOpened(b, isOwner) {
  current = { biz: b, isOwner: !!isOwner };
  if (!current.isOwner || !b || b.status !== 'approved') { render(); return; }
  await loadMyBump(b.id);
  if (current.biz && current.biz.id === b.id) render();
}

// ════════════════ INIT ════════════════
function init() {
  const st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);
  window.ksBoost = { onBizOpened, unlockStats, bump, appOnly, isBumped, sortBumped, reload: loadBumps };
  if (window._ksPendingBiz) onBizOpened(window._ksPendingBiz.b, window._ksPendingBiz.isOwner);
  const start = () => (db() && fs()) ? loadBumps() : setTimeout(start, 300);
  start();
  setInterval(loadBumps, 5 * 60 * 1000);                 // bumps expire after 1 hour
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadBumps(); });
}
init();
