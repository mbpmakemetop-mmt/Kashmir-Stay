/* ══════════════════════════════════════════════════════════════════
   Kashmir Stay — Tour Packages
   • Owners: green 🧳 round button → "My Packages" → add / edit / hide / delete
   • 3 packages free per business, each extra package slot = ₹49 (Razorpay,
     verified on the server before the slot is added)
   • Public: package cards on the business page → WhatsApp / Call
   • Each live package also gets its own Google-indexable page, built by the
     Apps Script page generator (packages/<business>/<package>.html)
   ══════════════════════════════════════════════════════════════════ */
import { getApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

const FREE_SLOTS = 3;
const SLOT_PRICE_LABEL = '₹49';
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const TYPES = [
  { id: 'honeymoon', label: 'Honeymoon', icon: '💑' },
  { id: 'couple', label: 'Couple', icon: '👫' },
  { id: 'family', label: 'Family', icon: '👨‍👩‍👧' },
  { id: 'group', label: 'Group', icon: '👥' },
  { id: 'snow', label: 'Snow & Winter', icon: '❄️' },
  { id: 'adventure', label: 'Adventure', icon: '🏔️' },
  { id: 'budget', label: 'Budget', icon: '💰' },
  { id: 'luxury', label: 'Luxury', icon: '👑' },
  { id: 'pilgrimage', label: 'Pilgrimage', icon: '🙏' },
  { id: 'custom', label: 'Custom', icon: '✏️' },
];
const PLACES = ['Srinagar', 'Dal Lake', 'Gulmarg', 'Pahalgam', 'Sonamarg', 'Doodhpathri', 'Yusmarg',
  'Aru Valley', 'Betaab Valley', 'Gurez', 'Sinthan Top', 'Kokernag', 'Mughal Gardens'];
const INCLUDES = ['Hotel stay', 'Houseboat stay', 'Breakfast', 'Dinner', 'All meals', 'Cab / transport',
  'Airport pickup & drop', 'Sightseeing', 'Shikara ride', 'Gondola tickets', 'Tour guide', 'Bonfire'];
const UNITS = ['per person', 'per couple', 'per group'];

// ── Rooms (hotels, houseboats, resorts, guest houses, homestays…) ──
const ROOM_TYPES = [
  { id: 'standard', label: 'Standard', icon: '🛏️' },
  { id: 'deluxe', label: 'Deluxe', icon: '✨' },
  { id: 'superdeluxe', label: 'Super Deluxe', icon: '🌟' },
  { id: 'suite', label: 'Suite', icon: '👑' },
  { id: 'family', label: 'Family Room', icon: '👨‍👩‍👧' },
  { id: 'hbroom', label: 'Houseboat Room', icon: '🛶' },
  { id: 'cottage', label: 'Cottage / Hut', icon: '🏡' },
  { id: 'dorm', label: 'Dormitory', icon: '🛌' },
];
const BEDS = ['Double bed', 'King bed', 'Twin beds', 'Single bed', 'Bunk beds'];
const MEALS = ['Room only', 'Breakfast included', 'Breakfast & dinner', 'All meals'];
const AMENITIES = ['Wi-Fi', 'Room heating', 'Hot water', 'Attached bathroom', 'Lake view', 'Mountain view',
  'Balcony', 'TV', 'Room service', 'Electric blanket', 'Extra bed available', 'Free parking', 'Kettle', 'Air conditioning'];
const ROOM_UNITS = ['per night', 'per person per night'];
const roomTypeOf = (id) => ROOM_TYPES.find((t) => t.id === id) || ROOM_TYPES[0];

/** Which kind of listing this business adds: stays → rooms, tour/travel businesses → packages. */
const STAY_RE = /hotel|houseboat|resort|guest\s?house|home\s?stay|lodge|camp|cottage|hostel|villa/i;
const TOUR_RE = /travel|tour|taxi|cab|car\s?rental|adventure|trek|ski|shikara|raft|paraglid|photo/i;
function modeFor(biz) {
  const t = String((biz && biz.type) || '');
  if (STAY_RE.test(t)) return 'room';
  if (TOUR_RE.test(t)) return 'package';
  return null;   // restaurants, handicrafts… — nothing to add
}
const isRoom = (p) => p && p.kind === 'room';
const L = (mode) => mode === 'room'
  ? { one: 'room', One: 'Room', many: 'rooms', icon: '🛏️', title: 'My Rooms', section: '🛏️ Rooms & Rates', add: '+ Add Room', slotDesc: 'Extra room slot' }
  : { one: 'package', One: 'Package', many: 'packages', icon: '🧳', title: 'My Packages', section: '🧳 Tour Packages', add: '+ Add Package', slotDesc: 'Extra tour package slot' };
const ICON_BED = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18V7"/><path d="M3 14h18v4"/><path d="M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="2"/></svg>';
const roomMeta = (p) => [p.guests ? `Up to ${p.guests} guest${p.guests > 1 ? 's' : ''}` : '', p.beds || ''].filter(Boolean).join(' · ');

const typeOf = (id) => TYPES.find((t) => t.id === id) || TYPES[TYPES.length - 1];
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toast = (m) => (window.showToast ? window.showToast(m) : alert(m));
const fs = () => window._collections;
const db = () => window._db;
const me = () => window._currentUser || (window._auth && window._auth.currentUser) || null;
const isAdmin = () => {
  const e = (me() && me().email || '').toLowerCase();
  return !!e && (window.ADMIN_EMAILS || []).includes(e);
};
const inApp = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const rupees = (n) => '₹' + Number(n).toLocaleString('en-IN');
const durationText = (p) => (p.nights || p.days) ? `${p.nights || 0}N / ${p.days || 0}D` : '';

function waNumber(biz) {
  let n = String(biz.whatsapp || biz.phone || '').replace(/\D/g, '');
  if (n.length === 10) n = '91' + n;
  return n;
}

let state = { biz: null, isOwner: false, mode: null, mine: [], editing: null, imageBlob: null };
let fabIconPkg = '';

// ════════════════ STYLES ════════════════
const css = `
.ks-fab-green{background:linear-gradient(135deg,#16A34A,#15803D)}
#detail-packages-section .pk-row{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding:2px 2px 8px;-webkit-overflow-scrolling:touch}
#detail-packages-section .pk-row::-webkit-scrollbar{display:none}
.pk-card{flex:0 0 78%;max-width:300px;scroll-snap-align:start;background:#fff;border:1px solid var(--gray200,#E5E7EB);border-radius:16px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 1px 3px rgba(0,0,0,.05)}
.pk-card.single{flex-basis:100%;max-width:none}
.pk-img{position:relative;aspect-ratio:16/10;background:var(--gray100,#F3F4F6);cursor:pointer}
.pk-img img{width:100%;height:100%;object-fit:cover;display:block}
.pk-badge{position:absolute;left:8px;top:8px;background:rgba(17,17,17,.78);color:#fff;font-size:.68rem;font-weight:700;padding:4px 9px;border-radius:999px;backdrop-filter:blur(6px)}
.pk-body{padding:10px 12px 12px;display:flex;flex-direction:column;gap:5px;flex:1;cursor:pointer}
.pk-title{font-weight:700;font-size:.92rem;color:var(--primary,#1F1F1F);line-height:1.3}
.pk-meta{font-size:.76rem;color:var(--gray500,#6B7280)}
.pk-price{font-weight:800;color:#15803D}
.pk-desc{font-size:.8rem;color:var(--gray700,#374151);line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pk-inc{display:flex;flex-wrap:wrap;gap:4px;margin-top:2px}
.pk-inc span{font-size:.66rem;background:#F0FDF4;color:#166534;border:1px solid #BBF7D0;padding:2px 7px;border-radius:999px}
.pk-actions{display:flex;gap:8px;padding:0 12px 12px}
.pk-btn{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:5px;height:34px;border-radius:10px;font-size:.78rem;font-weight:700;text-decoration:none;border:none;cursor:pointer}
.pk-btn.wa{background:#25D366;color:#073b1c}.pk-btn.call{background:var(--primary,#1F1F1F);color:#fff}
.pk-admin{font-size:.7rem;color:#DC2626;background:none;border:none;padding:0 12px 10px;text-align:left;cursor:pointer}
.pk-mgr-item{display:flex;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--gray100,#F3F4F6)}
.pk-mgr-item img{width:58px;height:44px;border-radius:8px;object-fit:cover;background:var(--gray100,#F3F4F6);flex-shrink:0}
.pk-mgr-item .t{flex:1;min-width:0}.pk-mgr-item .t b{display:block;font-size:.86rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pk-mgr-item .t small{color:var(--gray500,#6B7280);font-size:.72rem}
.pk-pill{font-size:.66rem;font-weight:700;padding:2px 8px;border-radius:999px}
.pk-pill.live{background:#DCFCE7;color:#166534}.pk-pill.hidden{background:#F3F4F6;color:#6B7280}
.pk-icon-btn{background:var(--gray50,#F9FAFB);border:1px solid var(--gray200,#E5E7EB);border-radius:8px;height:30px;min-width:30px;padding:0 8px;font-size:.74rem;cursor:pointer}
.pk-chips{display:flex;flex-wrap:wrap;gap:6px}
.pk-chip{border:1px solid var(--gray200,#E5E7EB);background:#fff;border-radius:999px;padding:6px 11px;font-size:.78rem;cursor:pointer;user-select:none}
.pk-chip.on{background:var(--primary,#1F1F1F);color:#fff;border-color:var(--primary,#1F1F1F)}
.pk-types{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
.pk-type{border:1px solid var(--gray200,#E5E7EB);border-radius:12px;padding:8px 2px;text-align:center;font-size:.64rem;cursor:pointer;background:#fff;line-height:1.2}
.pk-type .i{font-size:1.2rem;display:block;margin-bottom:2px}
.pk-type.on{border-color:#16A34A;background:#F0FDF4;color:#166534;font-weight:700}
.pk-imgbox{border:2px dashed var(--gray200,#E5E7EB);border-radius:14px;aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:4px;cursor:pointer;overflow:hidden;position:relative;color:var(--gray500,#6B7280);font-size:.8rem}
.pk-imgbox img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.pk-row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.pk-day{display:flex;gap:6px;align-items:flex-start;margin-bottom:6px}
.pk-day b{font-size:.74rem;min-width:44px;padding-top:9px;color:var(--gray500,#6B7280)}
.pk-day textarea{flex:1;min-height:44px}
.pk-count{font-size:.7rem;color:var(--gray400,#9CA3AF);text-align:right;margin-top:2px}
.pk-detail-img{width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:14px;display:block;margin-bottom:12px;background:var(--gray100,#F3F4F6)}
.pk-detail ol{padding-left:20px;margin:6px 0 0}.pk-detail li{margin:5px 0;font-size:.84rem;line-height:1.5}
`;
const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

// ════════════════ MODALS (built once) ════════════════
function sheet(id, label) {
  let el = document.getElementById(id);
  if (el) return el;
  el = document.createElement('div');
  el.className = 'modal-overlay'; el.id = id;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', label);
  el.addEventListener('click', (e) => { if (e.target === el) close(id); });
  el.innerHTML = `<div class="modal-sheet" style="max-height:92dvh"><div class="modal-handle"></div><div class="pk-inner"></div></div>`;
  document.body.appendChild(el);
  return el;
}
const open = (id) => (window.openModal ? window.openModal(id) : document.getElementById(id).classList.add('open'));
const close = (id) => (window.closeModal ? window.closeModal(id) : document.getElementById(id).classList.remove('open'));

// ════════════════ PUBLIC: business page hook ════════════════
async function onBizOpened(biz, isOwner) {
  state.biz = biz; state.isOwner = !!isOwner; state.mode = modeFor(biz);
  const l = L(state.mode);
  const fab = document.getElementById('detail-packages-btn');
  if (fab) {
    if (!fabIconPkg) fabIconPkg = fab.innerHTML;
    fab.innerHTML = state.mode === 'room' ? ICON_BED : fabIconPkg;
    fab.setAttribute('aria-label', l.title); fab.title = state.mode === 'room' ? 'Rooms' : 'Packages';
    fab.style.display = (isOwner && biz.status === 'approved' && state.mode) ? 'flex' : 'none';
  }
  const h = document.querySelector('#detail-packages-section .section-title');
  if (h) h.textContent = l.section;
  renderPublic(biz);
}

async function fetchLive(bizId) {
  const { getDocs, query, collection, where } = fs();
  const snap = await getDocs(query(collection(db(), 'packages'), where('biz_id', '==', bizId), where('status', '==', 'live')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.slot || 0) - (b.slot || 0));
}

async function renderPublic(biz) {
  const sec = document.getElementById('detail-packages-section');
  if (!sec) return;
  sec.style.display = 'none';
  let list = [];
  try { list = await fetchLive(biz.id); } catch (e) { console.warn('[packages] load failed', e); return; }
  if (state.biz !== biz) return;                       // user already opened another business
  state.publicList = list;
  if (!list.length) return;
  const row = sec.querySelector('.pk-row');
  const tel = String(biz.phone || '').trim();
  const wa = waNumber(biz);
  row.innerHTML = list.map((p, i) => {
    if (isRoom(p)) return roomCard(p, i, biz, wa, tel, list.length);
    const t = typeOf(p.type);
    const msg = encodeURIComponent(`Hi ${biz.name}, I'm interested in your "${p.title}"${durationText(p) ? ' (' + durationText(p) + ')' : ''} package. I found it on Kashmir Stay.`);
    return `<article class="pk-card${list.length === 1 ? ' single' : ''}">
      <div class="pk-img" onclick="ksPackages.view(${i})"><img src="${esc(p.image_url)}" alt="${esc(p.title)} by ${esc(biz.name)}" loading="lazy"/><span class="pk-badge">${t.icon} ${esc(t.label)}</span></div>
      <div class="pk-body" onclick="ksPackages.view(${i})">
        <div class="pk-title">${esc(p.title)}</div>
        <div class="pk-meta">${esc(durationText(p))}${p.price ? `${durationText(p) ? ' · ' : ''}<span class="pk-price">${rupees(p.price)}</span> ${esc(p.price_unit || '')}` : ''}</div>
        <div class="pk-desc">${esc(p.description)}</div>
        ${(p.includes || []).length ? `<div class="pk-inc">${p.includes.slice(0, 4).map((x) => `<span>✓ ${esc(x)}</span>`).join('')}${p.includes.length > 4 ? `<span>+${p.includes.length - 4}</span>` : ''}</div>` : ''}
      </div>
      <div class="pk-actions">
        ${wa ? `<a class="pk-btn wa" href="https://wa.me/${wa}?text=${msg}" target="_blank" rel="noopener" onclick="ksPackages.track('whatsapp')">💬 WhatsApp</a>` : ''}
        ${tel ? `<a class="pk-btn call" href="tel:${esc(tel)}" onclick="ksPackages.track('phone')">📞 Call</a>` : ''}
      </div>
      ${isAdmin() ? `<button class="pk-admin" onclick="ksPackages.adminHide('${esc(p.id)}')">Admin: hide this package</button>` : ''}
    </article>`;
  }).join('');
  sec.style.display = 'block';
}

function roomCard(p, i, biz, wa, tel, n) {
  const t = roomTypeOf(p.type);
  const msg = encodeURIComponent(`Hi ${biz.name}, I'd like to check availability for your "${p.title}". I found it on Kashmir Stay.`);
  const chips = [p.meals].concat(p.amenities || []).filter(Boolean);
  return `<article class="pk-card${n === 1 ? ' single' : ''}">
      <div class="pk-img" onclick="ksPackages.view(${i})"><img src="${esc(p.image_url)}" alt="${esc(p.title)} at ${esc(biz.name)}" loading="lazy"/><span class="pk-badge">${t.icon} ${esc(t.label)}</span></div>
      <div class="pk-body" onclick="ksPackages.view(${i})">
        <div class="pk-title">${esc(p.title)}</div>
        <div class="pk-meta">${esc(roomMeta(p))}${p.price ? `${roomMeta(p) ? ' · ' : ''}<span class="pk-price">${rupees(p.price)}</span> ${esc(p.price_unit || 'per night')}` : ''}</div>
        <div class="pk-desc">${esc(p.description)}</div>
        ${chips.length ? `<div class="pk-inc">${chips.slice(0, 4).map((x) => `<span>✓ ${esc(x)}</span>`).join('')}${chips.length > 4 ? `<span>+${chips.length - 4}</span>` : ''}</div>` : ''}
      </div>
      <div class="pk-actions">
        ${wa ? `<a class="pk-btn wa" href="https://wa.me/${wa}?text=${msg}" target="_blank" rel="noopener" onclick="ksPackages.track('whatsapp')">💬 Check availability</a>` : ''}
        ${tel ? `<a class="pk-btn call" href="tel:${esc(tel)}" onclick="ksPackages.track('phone')">📞 Call</a>` : ''}
      </div>
      ${isAdmin() ? `<button class="pk-admin" onclick="ksPackages.adminHide('${esc(p.id)}')">Admin: hide this room</button>` : ''}
    </article>`;
}

function track(type) {
  try { if (state.biz && window.trackEvent) window.trackEvent(state.biz.id, type); } catch (e) {}
}

function view(i) {
  const p = (state.publicList || [])[i]; const biz = state.biz;
  if (!p || !biz) return;
  if (isRoom(p)) { viewRoom(p); return; }
  const t = typeOf(p.type);
  const el = sheet('modal-pk-view', 'Package details');
  const wa = waNumber(biz); const tel = String(biz.phone || '').trim();
  const msg = encodeURIComponent(`Hi ${biz.name}, I'm interested in your "${p.title}"${durationText(p) ? ' (' + durationText(p) + ')' : ''} package. I found it on Kashmir Stay.`);
  el.querySelector('.pk-inner').innerHTML = `<div class="pk-detail">
    <img class="pk-detail-img" src="${esc(p.image_url)}" alt="${esc(p.title)}"/>
    <div class="pk-meta" style="margin-bottom:4px">${t.icon} ${esc(t.label)} package · by ${esc(biz.name)}</div>
    <div class="modal-title" style="margin-bottom:6px">${esc(p.title)}</div>
    <div class="pk-meta" style="font-size:.85rem;margin-bottom:10px">${esc(durationText(p))}${p.price ? `${durationText(p) ? ' · ' : ''}<span class="pk-price">${rupees(p.price)}</span> ${esc(p.price_unit || '')}` : ''}</div>
    <p style="font-size:.86rem;line-height:1.6;color:var(--gray700);margin:0 0 12px">${esc(p.description)}</p>
    ${(p.places || []).length ? `<div style="font-size:.8rem;margin-bottom:10px"><b>📍 Places:</b> ${p.places.map(esc).join(', ')}</div>` : ''}
    ${(p.includes || []).length ? `<div class="pk-inc" style="margin-bottom:12px">${p.includes.map((x) => `<span>✓ ${esc(x)}</span>`).join('')}</div>` : ''}
    ${(p.itinerary || []).length ? `<div style="font-weight:700;font-size:.88rem">Day-wise plan</div><ol>${p.itinerary.map((d) => `<li>${esc(d)}</li>`).join('')}</ol>` : ''}
    <div class="pk-actions" style="padding:16px 0 0">
      ${wa ? `<a class="pk-btn wa" href="https://wa.me/${wa}?text=${msg}" target="_blank" rel="noopener" onclick="ksPackages.track('whatsapp')">💬 WhatsApp</a>` : ''}
      ${tel ? `<a class="pk-btn call" href="tel:${esc(tel)}" onclick="ksPackages.track('phone')">📞 Call</a>` : ''}
    </div>
    ${p.page_url ? `<button class="pk-icon-btn" style="width:100%;margin-top:10px;height:36px" onclick="ksPackages.share(${i})">🔗 Share this package</button>` : ''}
  </div>`;
  open('modal-pk-view');
}

function viewRoom(p) {
  const biz = state.biz; const t = roomTypeOf(p.type);
  const el = sheet('modal-pk-view', 'Room details');
  const wa = waNumber(biz); const tel = String(biz.phone || '').trim();
  const msg = encodeURIComponent(`Hi ${biz.name}, I'd like to check availability for your "${p.title}". I found it on Kashmir Stay.`);
  el.querySelector('.pk-inner').innerHTML = `<div class="pk-detail">
    <img class="pk-detail-img" src="${esc(p.image_url)}" alt="${esc(p.title)}"/>
    <div class="pk-meta" style="margin-bottom:4px">${t.icon} ${esc(t.label)} · at ${esc(biz.name)}</div>
    <div class="modal-title" style="margin-bottom:6px">${esc(p.title)}</div>
    <div class="pk-meta" style="font-size:.85rem;margin-bottom:10px">${esc(roomMeta(p))}${p.price ? `${roomMeta(p) ? ' · ' : ''}<span class="pk-price">${rupees(p.price)}</span> ${esc(p.price_unit || 'per night')}` : ''}</div>
    <p style="font-size:.86rem;line-height:1.6;color:var(--gray700);margin:0 0 12px">${esc(p.description)}</p>
    ${p.meals ? `<div style="font-size:.8rem;margin-bottom:10px"><b>🍽️ Meals:</b> ${esc(p.meals)}</div>` : ''}
    ${(p.amenities || []).length ? `<div class="pk-inc" style="margin-bottom:12px">${p.amenities.map((x) => `<span>✓ ${esc(x)}</span>`).join('')}</div>` : ''}
    <p class="text-sm text-muted" style="margin:0">Prices can change with season and dates — confirm with ${esc(biz.name)} before booking.</p>
    <div class="pk-actions" style="padding:16px 0 0">
      ${wa ? `<a class="pk-btn wa" href="https://wa.me/${wa}?text=${msg}" target="_blank" rel="noopener" onclick="ksPackages.track('whatsapp')">💬 Check availability</a>` : ''}
      ${tel ? `<a class="pk-btn call" href="tel:${esc(tel)}" onclick="ksPackages.track('phone')">📞 Call</a>` : ''}
    </div>
  </div>`;
  open('modal-pk-view');
}

async function share(i) {
  const p = (state.publicList || [])[i]; if (!p || !p.page_url) return;
  const url = p.page_url, title = p.title;
  try {
    if (navigator.share) { await navigator.share({ title, url }); return; }
    if (window.Capacitor?.Plugins?.Share) { await window.Capacitor.Plugins.Share.share({ title, url }); return; }
    await navigator.clipboard.writeText(url); toast('🔗 Link copied');
  } catch (e) {}
}

async function adminHide(id) {
  if (!isAdmin() || !confirm('Hide this from the public?')) return;
  try {
    const { doc, updateDoc, serverTimestamp } = fs();
    await updateDoc(doc(db(), 'packages', id), { status: 'hidden', updated_at: serverTimestamp() });
    toast('Hidden'); renderPublic(state.biz);
  } catch (e) { toast('❌ ' + e.message); }
}

// ════════════════ OWNER: manager ════════════════
async function loadMine() {
  const { getDocs, query, collection, where } = fs();
  const u = me(); if (!u || !state.biz) return [];
  const snap = await getDocs(query(collection(db(), 'packages'), where('biz_id', '==', state.biz.id), where('user_id', '==', u.uid)));
  state.mine = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.slot || 0) - (b.slot || 0));
  return state.mine;
}
const slotLimit = () => Number(state.biz && state.biz.package_slots) || FREE_SLOTS;
function freeSlot() {
  const used = new Set(state.mine.map((p) => p.slot));
  for (let s = 1; s <= slotLimit(); s++) if (!used.has(s)) return s;
  return 0;
}

async function openManager() {
  if (!state.biz || !state.isOwner) return;
  const l = L(state.mode);
  const el = sheet('modal-pk-mgr', l.title);
  el.querySelector('.pk-inner').innerHTML = `<div class="modal-title">${l.icon} ${l.title}</div><p class="text-muted text-sm">Loading…</p>`;
  open('modal-pk-mgr');
  try { await loadMine(); } catch (e) {
    console.error('[packages] load', e);
    const why = e && e.code === 'permission-denied'
      ? 'access blocked — the new Firestore rules are not published yet'
      : (e && (e.code || e.message)) || 'unknown error';
    el.querySelector('.pk-inner').innerHTML = `<div class="modal-title">${l.icon} ${l.title}</div><p class="text-sm" style="color:#DC2626">Could not load ${l.many}: ${esc(why)}.</p>`;
    toast('❌ Could not load ' + l.many + ' (' + ((e && e.code) || 'error') + ')');
    return;
  }
  renderManager();
}

function renderManager() {
  const el = document.getElementById('modal-pk-mgr'); if (!el) return;
  const l = L(state.mode);
  const used = state.mine.length, limit = slotLimit(), slot = freeSlot();
  const sub = (p) => isRoom(p)
    ? `${roomTypeOf(p.type).icon} ${esc(roomTypeOf(p.type).label)}${p.price ? ' · ' + rupees(p.price) : ''}`
    : `${typeOf(p.type).icon} ${esc(typeOf(p.type).label)} · ${esc(durationText(p) || '—')}`;
  const intro = state.mode === 'room'
    ? `${used} of ${limit} slots used · ${FREE_SLOTS} free, then ${SLOT_PRICE_LABEL} per extra room. Your rooms show on your business page and on Google.`
    : `${used} of ${limit} slots used · ${FREE_SLOTS} free, then ${SLOT_PRICE_LABEL} per extra package. Live packages also get their own page on Google.`;
  const empty = state.mode === 'room'
    ? `<div class="empty-state" style="padding:18px 0"><div class="empty-icon">🛏️</div><h3>No rooms yet</h3><p>Add your room types with photos and price per night — tourists can WhatsApp or call you to book.</p></div>`
    : `<div class="empty-state" style="padding:18px 0"><div class="empty-icon">🧳</div><h3>No packages yet</h3><p>Add honeymoon, family or group packages — tourists can WhatsApp or call you directly.</p></div>`;
  el.querySelector('.pk-inner').innerHTML = `
    <div class="modal-title" style="margin-bottom:4px">${l.icon} ${l.title}</div>
    <p class="text-sm text-muted" style="margin:0 0 12px">${intro}</p>
    ${state.mine.length ? state.mine.map((p) => `<div class="pk-mgr-item">
        <img src="${esc(p.image_url)}" alt=""/>
        <div class="t"><b>${esc(p.title)}</b><small>${sub(p)}</small><br/>
          <span class="pk-pill ${p.status === 'live' ? 'live' : 'hidden'}">${p.status === 'live' ? '● Live' : 'Hidden'}</span></div>
        <button class="pk-icon-btn" onclick="ksPackages.toggle('${esc(p.id)}')" aria-label="Show or hide">${p.status === 'live' ? 'Hide' : 'Show'}</button>
        <button class="pk-icon-btn" onclick="ksPackages.edit('${esc(p.id)}')" aria-label="Edit">✏️</button>
        <button class="pk-icon-btn" onclick="ksPackages.remove('${esc(p.id)}')" aria-label="Delete">🗑</button>
      </div>`).join('') : empty}
    <div style="margin-top:16px">
      ${slot ? `<button class="btn btn-primary" onclick="ksPackages.edit()">${l.add}</button>`
             : `<button class="btn btn-primary" id="pk-buy-btn" style="background:linear-gradient(135deg,#16A34A,#15803D)" onclick="ksPackages.buySlot()">+ Add another ${l.one} · ${SLOT_PRICE_LABEL}</button>
                <p class="text-center text-sm text-muted" style="margin-top:8px">One-time payment per extra ${l.one} slot. Secure payment via Razorpay.</p>`}
    </div>`;
}

async function toggle(id) {
  const p = state.mine.find((x) => x.id === id); if (!p) return;
  try {
    const { doc, updateDoc, serverTimestamp } = fs();
    const status = p.status === 'live' ? 'hidden' : 'live';
    await updateDoc(doc(db(), 'packages', id), { status, updated_at: serverTimestamp() });
    p.status = status; renderManager(); renderPublic(state.biz);
    toast(status === 'live' ? '✅ Live again' : 'Hidden');
  } catch (e) { toast('❌ ' + e.message); }
}

async function remove(id) {
  const p = state.mine.find((x) => x.id === id); if (!p) return;
  if (!confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
  try {
    const { doc, deleteDoc } = fs();
    await deleteDoc(doc(db(), 'packages', id));
    if (p.image_path) { try { await deleteObject(ref(getStorage(getApp()), p.image_path)); } catch (e) {} }
    state.mine = state.mine.filter((x) => x.id !== id);
    renderManager(); renderPublic(state.biz); toast('🗑 Deleted');
  } catch (e) { toast('❌ ' + e.message); }
}

// ════════════════ OWNER: add / edit form ════════════════
function edit(id) {
  const p = id ? state.mine.find((x) => x.id === id) : null;
  if (!p && !freeSlot()) { renderManager(); return; }
  if (p ? isRoom(p) : state.mode === 'room') { editRoom(p); return; }
  state.editing = p || null; state.imageBlob = null;
  const d = p || { type: 'honeymoon', title: '', description: '', nights: 3, days: 4, price: '', price_unit: 'per person', places: ['Srinagar'], includes: [], itinerary: [] };
  const el = sheet('modal-pk-form', 'Add package');
  el.querySelector('.pk-inner').innerHTML = `
    <div class="modal-title">${p ? 'Edit package' : 'Add a package'}</div>
    <div class="form-group"><label class="form-label">Package type *</label>
      <div class="pk-types" id="pk-types">${TYPES.map((t) => `<div class="pk-type${t.id === d.type ? ' on' : ''}" data-v="${t.id}"><span class="i">${t.icon}</span>${esc(t.label)}</div>`).join('')}</div></div>
    <div class="form-group"><label class="form-label">Cover image * <span class="text-muted">(max 5 MB)</span></label>
      <div class="pk-imgbox" id="pk-imgbox">${d.image_url ? `<img src="${esc(d.image_url)}" alt=""/>` : '<span style="font-size:1.6rem">🖼️</span><span>Tap to add a photo</span>'}</div>
      <input type="file" id="pk-file" accept="image/jpeg,image/png,image/webp" hidden/></div>
    <div class="form-group"><label class="form-label">Package title *</label>
      <input class="form-input" id="pk-title" maxlength="70" placeholder="e.g. Kashmir Honeymoon Package" value="${esc(d.title)}"/></div>
    <div class="pk-row2">
      <div class="form-group"><label class="form-label">Nights</label><input class="form-input" id="pk-nights" type="number" min="0" max="30" inputmode="numeric" value="${esc(d.nights)}"/></div>
      <div class="form-group"><label class="form-label">Days</label><input class="form-input" id="pk-days" type="number" min="1" max="31" inputmode="numeric" value="${esc(d.days)}"/></div>
    </div>
    <div class="pk-row2">
      <div class="form-group"><label class="form-label">Starting price (₹)</label><input class="form-input" id="pk-price" type="number" min="0" inputmode="numeric" placeholder="Optional" value="${esc(d.price || '')}"/></div>
      <div class="form-group"><label class="form-label">Price is</label><select class="form-input" id="pk-unit">${UNITS.map((u) => `<option${u === d.price_unit ? ' selected' : ''}>${u}</option>`).join('')}</select></div>
    </div>
    <div class="form-group"><label class="form-label">Short description *</label>
      <textarea class="form-textarea" id="pk-desc" maxlength="300" placeholder="What makes this package special? Hotels, highlights, who it is for…">${esc(d.description)}</textarea>
      <div class="pk-count" id="pk-desc-count">0/300</div></div>
    <div class="form-group"><label class="form-label">Places covered</label>
      <div class="pk-chips" id="pk-places">${PLACES.map((x) => `<span class="pk-chip${(d.places || []).includes(x) ? ' on' : ''}">${esc(x)}</span>`).join('')}</div></div>
    <div class="form-group"><label class="form-label">What's included</label>
      <div class="pk-chips" id="pk-includes">${INCLUDES.map((x) => `<span class="pk-chip${(d.includes || []).includes(x) ? ' on' : ''}">${esc(x)}</span>`).join('')}</div></div>
    <div class="form-group"><label class="form-label">Day-wise plan <span class="text-muted">(recommended — helps your package show on Google)</span></label>
      <div id="pk-days-list"></div>
      <button type="button" class="pk-icon-btn" onclick="ksPackages.addDay()">+ Add day</button></div>
    <button class="btn btn-primary" id="pk-save" onclick="ksPackages.save()">${p ? 'Save changes' : 'Publish package'}</button>
    <button class="btn btn-ghost" style="margin-top:8px" onclick="ksPackages.closeForm()">Cancel</button>`;
  // wire up
  el.querySelectorAll('#pk-types .pk-type').forEach((n) => n.onclick = () => { el.querySelectorAll('#pk-types .pk-type').forEach((m) => m.classList.remove('on')); n.classList.add('on'); });
  el.querySelectorAll('.pk-chips .pk-chip').forEach((n) => n.onclick = () => n.classList.toggle('on'));
  const file = el.querySelector('#pk-file');
  el.querySelector('#pk-imgbox').onclick = () => file.click();
  file.onchange = () => pickImage(file.files[0]);
  const desc = el.querySelector('#pk-desc'), cnt = el.querySelector('#pk-desc-count');
  const upd = () => { cnt.textContent = `${desc.value.length}/300`; }; desc.oninput = upd; upd();
  const list = el.querySelector('#pk-days-list'); list.innerHTML = '';
  (d.itinerary || []).forEach((t) => addDay(t));
  open('modal-pk-form');
}

function editRoom(p) {
  state.editing = p || null; state.imageBlob = null;
  const d = p || { type: 'deluxe', title: '', description: '', price: '', price_unit: 'per night', guests: 2, beds: 'Double bed', meals: 'Breakfast included', amenities: ['Hot water', 'Attached bathroom'] };
  const el = sheet('modal-pk-form', p ? 'Edit room' : 'Add room');
  el.querySelector('.pk-inner').innerHTML = `
    <div class="modal-title">${p ? 'Edit room' : 'Add a room'}</div>
    <div class="form-group"><label class="form-label">Room type *</label>
      <div class="pk-types" id="pk-types">${ROOM_TYPES.map((t) => `<div class="pk-type${t.id === d.type ? ' on' : ''}" data-v="${t.id}"><span class="i">${t.icon}</span>${esc(t.label)}</div>`).join('')}</div></div>
    <div class="form-group"><label class="form-label">Room photo * <span class="text-muted">(max 5 MB)</span></label>
      <div class="pk-imgbox" id="pk-imgbox">${d.image_url ? `<img src="${esc(d.image_url)}" alt=""/>` : '<span style="font-size:1.6rem">🖼️</span><span>Tap to add a photo of the room</span>'}</div>
      <input type="file" id="pk-file" accept="image/jpeg,image/png,image/webp" hidden/></div>
    <div class="form-group"><label class="form-label">Room name *</label>
      <input class="form-input" id="pk-title" maxlength="70" placeholder="e.g. Deluxe Lake-View Room" value="${esc(d.title)}"/></div>
    <div class="pk-row2">
      <div class="form-group"><label class="form-label">Price (₹)</label><input class="form-input" id="pk-price" type="number" min="0" inputmode="numeric" placeholder="Optional" value="${esc(d.price || '')}"/></div>
      <div class="form-group"><label class="form-label">Price is</label><select class="form-input" id="pk-unit">${ROOM_UNITS.map((u) => `<option${u === d.price_unit ? ' selected' : ''}>${u}</option>`).join('')}</select></div>
    </div>
    <div class="pk-row2">
      <div class="form-group"><label class="form-label">Max guests</label><input class="form-input" id="pk-guests" type="number" min="1" max="20" inputmode="numeric" value="${esc(d.guests || 2)}"/></div>
      <div class="form-group"><label class="form-label">Bed</label><select class="form-input" id="pk-beds">${BEDS.map((u) => `<option${u === d.beds ? ' selected' : ''}>${u}</option>`).join('')}</select></div>
    </div>
    <div class="form-group"><label class="form-label">Meals</label><select class="form-input" id="pk-meals">${MEALS.map((u) => `<option${u === d.meals ? ' selected' : ''}>${u}</option>`).join('')}</select></div>
    <div class="form-group"><label class="form-label">Short description *</label>
      <textarea class="form-textarea" id="pk-desc" maxlength="300" placeholder="Size, view, what makes this room special…">${esc(d.description)}</textarea>
      <div class="pk-count" id="pk-desc-count">0/300</div></div>
    <div class="form-group"><label class="form-label">Facilities</label>
      <div class="pk-chips" id="pk-amenities">${AMENITIES.map((x) => `<span class="pk-chip${(d.amenities || []).includes(x) ? ' on' : ''}">${esc(x)}</span>`).join('')}</div></div>
    <button class="btn btn-primary" id="pk-save" onclick="ksPackages.save()">${p ? 'Save changes' : 'Publish room'}</button>
    <button class="btn btn-ghost" style="margin-top:8px" onclick="ksPackages.closeForm()">Cancel</button>`;
  el.querySelectorAll('#pk-types .pk-type').forEach((n) => n.onclick = () => { el.querySelectorAll('#pk-types .pk-type').forEach((m) => m.classList.remove('on')); n.classList.add('on'); });
  el.querySelectorAll('.pk-chips .pk-chip').forEach((n) => n.onclick = () => n.classList.toggle('on'));
  const file = el.querySelector('#pk-file');
  el.querySelector('#pk-imgbox').onclick = () => file.click();
  file.onchange = () => pickImage(file.files[0]);
  const desc = el.querySelector('#pk-desc'), cnt = el.querySelector('#pk-desc-count');
  const upd = () => { cnt.textContent = `${desc.value.length}/300`; }; desc.oninput = upd; upd();
  open('modal-pk-form');
}

function addDay(text) {
  const list = document.getElementById('pk-days-list'); if (!list) return;
  if (list.children.length >= 15) { toast('Max 15 days'); return; }
  const n = list.children.length + 1;
  const row = document.createElement('div'); row.className = 'pk-day';
  row.innerHTML = `<b>Day ${n}</b><textarea class="form-textarea" maxlength="300" placeholder="e.g. Arrive in Srinagar, houseboat check-in, evening shikara ride">${esc(typeof text === 'string' ? text : '')}</textarea><button type="button" class="pk-icon-btn" aria-label="Remove day">✕</button>`;
  row.querySelector('button').onclick = () => { row.remove(); [...list.children].forEach((r, i) => r.querySelector('b').textContent = `Day ${i + 1}`); };
  list.appendChild(row);
}

async function pickImage(f) {
  if (!f) return;
  if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { toast('⚠️ Please choose a JPG, PNG or WebP photo'); return; }
  if (f.size > MAX_UPLOAD_BYTES) { toast('⚠️ Photo is larger than 5 MB — please choose a smaller one'); return; }
  try {
    state.imageBlob = await compress(f);
    const box = document.getElementById('pk-imgbox');
    box.innerHTML = `<img src="${URL.createObjectURL(state.imageBlob)}" alt=""/>`;
  } catch (e) { toast('⚠️ Could not read this photo'); }
}

/** Resize to max 1600px and convert to WebP (≈150–300 KB) — fast pages rank better. */
async function compress(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(bmp, 0, 0, w, h);
  const blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.8));
  if (blob && blob.type === 'image/webp') return blob;
  return new Promise((r) => c.toBlob(r, 'image/jpeg', 0.82));
}

function readForm() {
  const el = document.getElementById('modal-pk-form');
  const val = (id) => el.querySelector(id).value.trim();
  const int = (v) => (v === '' ? null : Math.max(0, Math.floor(Number(v)) || 0));
  if (el.querySelector('#pk-guests')) {
    return {
      kind: 'room',
      type: (el.querySelector('#pk-types .pk-type.on') || {}).dataset?.v || 'standard',
      title: val('#pk-title').replace(/\s+/g, ' '),
      price: int(val('#pk-price')),
      price_unit: val('#pk-unit'),
      guests: Math.min(20, Math.max(1, int(val('#pk-guests')) || 1)),
      beds: val('#pk-beds'),
      meals: val('#pk-meals'),
      description: val('#pk-desc').replace(/\s+/g, ' '),
      amenities: [...el.querySelectorAll('#pk-amenities .pk-chip.on')].map((n) => n.textContent),
    };
  }
  return {
    type: (el.querySelector('#pk-types .pk-type.on') || {}).dataset?.v || 'custom',
    title: val('#pk-title').replace(/\s+/g, ' '),
    nights: Math.min(30, int(val('#pk-nights')) || 0),
    days: Math.min(31, int(val('#pk-days')) || 0),
    price: int(val('#pk-price')),
    price_unit: val('#pk-unit'),
    description: val('#pk-desc').replace(/\s+/g, ' '),
    places: [...el.querySelectorAll('#pk-places .pk-chip.on')].map((n) => n.textContent),
    includes: [...el.querySelectorAll('#pk-includes .pk-chip.on')].map((n) => n.textContent),
    itinerary: [...el.querySelectorAll('#pk-days-list textarea')].map((t) => t.value.trim().replace(/\s+/g, ' ')).filter(Boolean),
  };
}

async function save() {
  const u = me(); const biz = state.biz; if (!u || !biz) return;
  const f = readForm(); const p = state.editing;
  const word = f.kind === 'room' ? 'room' : 'package';
  if (f.title.length < 5) { toast(`⚠️ Add a ${word} name (min 5 letters)`); return; }
  if (f.description.length < 20) { toast('⚠️ Write a short description (min 20 letters)'); return; }
  if (!p && !state.imageBlob) { toast('⚠️ Add a photo'); return; }
  if (f.price !== null && f.price > 10000000) { toast('⚠️ Check the price'); return; }
  const btn = document.getElementById('pk-save'); const label = btn.textContent;
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const { doc, setDoc, updateDoc, serverTimestamp } = fs();
    const { getDoc } = fs();
    let slot = p ? p.slot : freeSlot();
    if (!p) {
      // Another tab/device may have just used this slot — never overwrite an existing package
      await loadMine(); slot = freeSlot();
      if (slot) {
        // A missing package can't be read under the rules (permission error) → that means the slot is free
        try { if ((await getDoc(doc(db(), 'packages', `${biz.id}_${slot}`))).exists()) slot = 0; } catch (e) {}
      }
    }
    if (!slot) throw new Error(`No free ${word} slot — refresh and try again`);
    const id = p ? p.id : `${biz.id}_${slot}`;
    const oldPath = p ? p.image_path : '';
    let image_url = p ? p.image_url : '', image_path = p ? p.image_path : '', uploaded = '';
    if (state.imageBlob) {
      btn.textContent = 'Uploading photo…';
      const ext = state.imageBlob.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `packages/${biz.id}/${slot}-${Date.now()}.${ext}`;
      const r = ref(getStorage(getApp()), path);
      await uploadBytes(r, state.imageBlob, { contentType: state.imageBlob.type, cacheControl: 'public,max-age=31536000' });
      image_url = await getDownloadURL(r); image_path = path; uploaded = path;
    }
    const data = { ...f, image_url, image_path, biz_name: biz.name || '', updated_at: serverTimestamp() };
    try {
      if (p) await updateDoc(doc(db(), 'packages', id), data);
      else await setDoc(doc(db(), 'packages', id), { ...data, biz_id: biz.id, user_id: u.uid, slot, status: 'live', created_at: serverTimestamp() });
    } catch (err) {
      if (uploaded) { try { await deleteObject(ref(getStorage(getApp()), uploaded)); } catch (e) {} }   // no orphan photos
      throw err;
    }
    // Old photo is removed only after the package was saved with the new one
    if (uploaded && oldPath && oldPath !== uploaded) { try { await deleteObject(ref(getStorage(getApp()), oldPath)); } catch (e) {} }
    toast(p ? '✅ Saved' : (f.kind === 'room' ? '🎉 Room is live! It shows on your business page now.' : '🎉 Package is live! Its Google page is created within a few minutes.'));
    close('modal-pk-form');
    await loadMine(); renderManager(); renderPublic(biz);
  } catch (e) {
    console.error('[packages] save', e);
    toast('❌ ' + (e.code === 'permission-denied' ? 'Not allowed — is your listing approved and is this your business?' : (e.message || 'Save failed')));
  } finally { btn.disabled = false; btn.textContent = label; }
}

// ════════════════ OWNER: buy an extra slot (₹49) ════════════════
async function buySlot() {
  const u = me(); const biz = state.biz; if (!u || !biz) return;
  const btn = document.getElementById('pk-buy-btn'); if (btn) { btn.disabled = true; btn.textContent = 'Opening payment…'; }
  const l = L(state.mode);
  const reset = () => { if (btn) { btn.disabled = false; btn.textContent = `+ Add another ${l.one} · ${SLOT_PRICE_LABEL}`; } };
  try {
    const order = await window.callAppsScript({ action: 'createPackageSlotOrder', biz_id: biz.id });
    if (!order || order.error || !order.order_id) throw new Error((order && order.error) || 'Could not start payment');
    await window.ensureRazorpaySdk();
    const rzp = new window.Razorpay({
      key: order.key_id, order_id: order.order_id, amount: order.amount, currency: 'INR',
      name: 'Kashmir Stay', description: l.slotDesc,
      image: 'https://kashmirstay.in/icon-192-v2.png',
      webview_intent: inApp(),
      prefill: { name: u.displayName || '', email: u.email || '', contact: String(biz.phone || '').replace(/[^\d+]/g, '') },
      theme: { color: '#16A34A' },
      modal: { ondismiss: reset },
      handler: async (r) => {
        toast('Confirming payment…');
        try {
          const res = await window.callAppsScript({ action: 'activatePackageSlot', biz_id: biz.id, payment_id: r.razorpay_payment_id });
          if (!res || res.error) throw new Error((res && res.error) || 'Activation failed');
          biz.package_slots = res.package_slots;
          toast(`✅ Payment received — add your new ${l.one}`);
          renderManager(); edit();
        } catch (e) { toast('⚠️ ' + e.message + ' · Payment ID: ' + r.razorpay_payment_id); reset(); }
      },
    });
    rzp.on('payment.failed', (resp) => { toast('❌ ' + (resp.error?.description || 'Payment failed')); reset(); });
    rzp.open();
  } catch (e) { toast('❌ ' + e.message); reset(); }
}

window.ksPackages = {
  onBizOpened, openManager, view, track, share, adminHide, toggle, remove, edit, addDay, save, buySlot,
  closeForm: () => close('modal-pk-form'),
};
// The business page may already be open (deep link) before this file loaded
if (window._ksPendingBiz) { onBizOpened(window._ksPendingBiz.b, window._ksPendingBiz.isOwner); }
