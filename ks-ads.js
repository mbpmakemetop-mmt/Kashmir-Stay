/* ════════════════════════════════════════════════════════════════
   Kashmir Stay — ads (only 3 places, clean "Sponsored" cards)
     top    → home, below the search bar
     feed   → between listings (after 4th + 12th card, max 2)
     detail → business page, below the reviews
   Website: Google AdSense.
   Android app (Kotlin): the SAME 3 slots are filled with real AdMob
   "Native advanced" ads drawn by the app (see ks_bridge.js / NativeAdsManager).
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ─── CONFIG: paste your AdSense ad-unit IDs (AdSense → Ads → By ad unit → Display ads) ───
  var CLIENT = 'ca-pub-3499114279910810';
  var SLOTS = {
    top:    "",                      // (not used — ads only at the end of content)
    feed:   'PASTE_FEED_SLOT_ID',
    detail: 'PASTE_DETAIL_SLOT_ID'
  };
  // ──────────────────────────────────────────────────────────────

  // Inside the Android app the same slots show real AdMob NATIVE ads (drawn by the app),
  // so AdSense only runs on the website.
  var cap = window.Capacitor;
  if (cap && cap.isNativePlatform && cap.isNativePlatform()) return;

  var ready = function (id) { return id && id.indexOf('PASTE_') !== 0; };
  // AdSense not set up yet (no slot IDs) → do nothing at all: no script, no empty boxes
  if (!Object.keys(SLOTS).some(function (k) { return ready(SLOTS[k]); })) return;

  // ── Styles: looks like one of your cards, clearly marked ──
  var css = '' +
    '.ks-ad-slot{display:none}' +
    '.ks-ad-slot.ks-ad-on{display:block;background:#fff;border:1px solid var(--gray100,#F3F4F6);border-radius:16px;' +
      'padding:10px 10px 12px;overflow:hidden;min-height:120px}' +
    '.ks-ad-top.ks-ad-on{margin:10px 16px 4px}' +
    '.ks-ad-feed.ks-ad-on{margin:0 0 12px}' +
    '.ks-ad-detail.ks-ad-on{margin:14px 16px 6px}' +
    '.ks-ad-label{display:flex;align-items:center;gap:6px;font:600 .62rem/1 var(--font-body,"DM Sans",sans-serif);' +
      'letter-spacing:.08em;text-transform:uppercase;color:var(--gray400,#9CA3AF);margin:0 2px 8px}' +
    '.ks-ad-label:before{content:"";width:6px;height:6px;border-radius:50%;background:var(--gray300,#D1D5DB)}' +
    '.ks-ad-slot ins.adsbygoogle{display:block;width:100%}' +
    /* no ad available → hide the whole card, no empty box */
    '.ks-ad-slot:has(ins[data-ad-status="unfilled"]){display:none!important}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  // ── Load AdSense once ──
  if (!document.querySelector('script[src*="adsbygoogle.js"]')) {
    var s = document.createElement('script');
    s.async = true; s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + CLIENT;
    document.head.appendChild(s);
  }

  // ── Fill a slot only when it's about to be seen (fast pages, real viewability) ──
  function fill(el) {
    if (el.dataset.ksFilled) return;
    var key = el.getAttribute('data-ks-ad');
    var slot = SLOTS[key];
    if (!ready(slot)) return;
    if (el.offsetWidth < 200) return;        // page hidden / too narrow → try again later
    el.dataset.ksFilled = '1';
    el.classList.add('ks-ad-on');
    el.innerHTML = '<div class="ks-ad-label">Sponsored</div>' +
      '<ins class="adsbygoogle" data-ad-client="' + CLIENT + '" data-ad-slot="' + slot + '"' +
      ' data-ad-format="auto" data-full-width-responsive="true"></ins>';
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { el.style.display = 'none'; }
  }

  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { if (en.isIntersecting) fill(en.target); });
  }, { rootMargin: '300px 0px' }) : null;

  function watch(root) {
    var list = (root && root.querySelectorAll) ? root.querySelectorAll('.ks-ad-slot:not([data-ks-watched])') : [];
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      el.setAttribute('data-ks-watched', '1');
      if (io) io.observe(el); else fill(el);
    }
  }

  function start() {
    watch(document);
    // New listings render later (home, search, business page) → pick up their slots automatically
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var added = muts[i].addedNodes;
        for (var k = 0; k < added.length; k++) {
          var n = added[k];
          if (n.nodeType !== 1) continue;
          if (n.classList && n.classList.contains('ks-ad-slot')) watch(n.parentNode); else watch(n);
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
    // Pages are shown/hidden with display:none — retry slots that were hidden when first seen
    setInterval(function () {
      var pending = document.querySelectorAll('.ks-ad-slot[data-ks-watched]:not([data-ks-filled])');
      for (var i = 0; i < pending.length; i++) {
        var r = pending[i].getBoundingClientRect();
        if (r.width > 0 && r.top < window.innerHeight + 300 && r.bottom > -300) fill(pending[i]);
      }
    }, 1500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
