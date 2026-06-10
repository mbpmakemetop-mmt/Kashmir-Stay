// ═══════════════════════════════════════════════════════════════════════════
//  KASHMIR STAY CHAT WIDGET  — chat-widget.js
//  Drop this file anywhere and add:  <script src="chat-widget.js"></script>
// ═══════════════════════════════════════════════════════════════════════════

const CHAT_CONFIG = {
  // ↓ Paste your Apps Script Web App URL here (no trailing slash)
  DEPLOYMENT_URL: 'https://script.google.com/macros/s/AKfycbwa8XFecHqXe7_pPkmbeXqX5wUMUQHeNUb2ZntAbUdiHGPPM9n0G13TdmX4rzPz9A1bDw/exec',
  INITIAL_MESSAGE: "Hello! 👋 I'm Kashmir Stay's AI Assistant. Ask me anything about Kashmir travel, hotels, or resorts!",
  PLACEHOLDER: 'Ask about hotels, tours, travel tips…',
  THEME_COLOR: '#1F1F1F'
};

// ─── Boot ────────────────────────────────────────────────────────────────────
(function () {
  if (!CHAT_CONFIG.DEPLOYMENT_URL || CHAT_CONFIG.DEPLOYMENT_URL.includes('https://script.google.com/macros/s/AKfycbwa8XFecHqXe7_pPkmbeXqX5wUMUQHeNUb2ZntAbUdiHGPPM9n0G13TdmX4rzPz9A1bDw/exec')) {
    console.warn('[KS Chat] Set DEPLOYMENT_URL in chat-widget.js');
    return;
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildWidget);
  } else {
    buildWidget();
  }
})();

// ─── Build DOM ───────────────────────────────────────────────────────────────
function buildWidget() {
  injectStyles();

  document.body.insertAdjacentHTML('beforeend', `
    <div id="ks-root">

      <!-- Floating button -->
      <button id="ks-toggle" onclick="ksChatToggle()" title="Chat with us">
        <svg id="ks-icon-chat" viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
        </svg>
        <svg id="ks-icon-close" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
             stroke-width="2.5" stroke-linecap="round" style="display:none">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
        <span id="ks-badge">1</span>
      </button>

      <!-- Chat window -->
      <div id="ks-window" class="ks-hidden">

        <!-- Header -->
        <div id="ks-header">
          <div>
            <div id="ks-header-title">Kashmir Stay AI</div>
            <div id="ks-header-sub">Professional Travel Assistance</div>
          </div>
          <button id="ks-header-close" onclick="ksChatToggle()">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
                 stroke-width="2.5" stroke-linecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Messages -->
        <div id="ks-messages">
          <div class="ks-msg ks-ai">
            <div class="ks-bubble">${CHAT_CONFIG.INITIAL_MESSAGE}</div>
            <div class="ks-time">${ksTime()}</div>
          </div>
        </div>

        <!-- Input row -->
        <div id="ks-input-row">
          <input id="ks-input" type="text"
                 placeholder="${CHAT_CONFIG.PLACEHOLDER}"
                 autocomplete="off"
                 onkeydown="if(event.key==='Enter')ksSend()" />
          <button id="ks-send" onclick="ksSend()" title="Send">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M2 21l21-9L2 3v7l15 2-15 2z"/>
            </svg>
          </button>
        </div>

        <!-- Talk to owner -->
        <div id="ks-footer">
          <button id="ks-owner-btn" onclick="ksShowContact()">📞 Talk to Owner</button>
        </div>

      </div>

      <!-- Contact modal -->
      <div id="ks-modal" class="ks-hidden">
        <div id="ks-modal-box">
          <div id="ks-modal-header">
            <span>Contact Kashmir Stay</span>
            <button onclick="ksCloseContact()">×</button>
          </div>
          <div id="ks-modal-body">
            <div class="ks-field">
              <label>Name *</label>
              <input id="ks-f-name" type="text" placeholder="Your full name" />
            </div>
            <div class="ks-field">
              <label>Email *</label>
              <input id="ks-f-email" type="email" placeholder="your@email.com" />
            </div>
            <div class="ks-field">
              <label>Phone (optional)</label>
              <input id="ks-f-phone" type="tel" placeholder="+91 XXXXXXXXXX" />
            </div>
            <div class="ks-field">
              <label>Subject</label>
              <input id="ks-f-subject" type="text" placeholder="Hotel booking, tour inquiry…" />
            </div>
            <div class="ks-field">
              <label>Message *</label>
              <textarea id="ks-f-message" rows="4" placeholder="Tell us what you need…"></textarea>
            </div>
            <button id="ks-f-submit" onclick="ksSubmitContact()">Send Message</button>
            <button id="ks-f-cancel" onclick="ksCloseContact()">Cancel</button>
          </div>
        </div>
      </div>

    </div>
  `);
}

// ─── Toggle chat window ───────────────────────────────────────────────────────
function ksChatToggle() {
  const win   = document.getElementById('ks-window');
  const chat  = document.getElementById('ks-icon-chat');
  const close = document.getElementById('ks-icon-close');
  const badge = document.getElementById('ks-badge');
  const open  = win.classList.contains('ks-hidden');

  win.classList.toggle('ks-hidden', !open);
  chat.style.display  = open ? 'none'  : '';
  close.style.display = open ? ''      : 'none';
  if (badge) badge.style.display = 'none';   // hide badge once opened

  if (open) {
    ksCloseContact();
    setTimeout(() => document.getElementById('ks-input').focus(), 100);
  }
}

// ─── Send chat message ────────────────────────────────────────────────────────
function ksSend() {
  const input = document.getElementById('ks-input');
  const text  = input.value.trim();
  if (!text) return;

  ksAddMsg(text, 'user');
  input.value = '';
  input.disabled = true;
  document.getElementById('ks-send').disabled = true;

  ksShowTyping();

  ksPost({ type: 'chat', message: text })
    .then(res => {
      ksHideTyping();
      input.disabled = false;
      document.getElementById('ks-send').disabled = false;
      input.focus();

      if (res.success) {
        ksAddMsg(res.message, 'ai');
      } else {
        ksAddMsg('❌ ' + (res.message || 'Something went wrong. Please try again.'), 'ai');
      }
    })
    .catch(err => {
      ksHideTyping();
      input.disabled = false;
      document.getElementById('ks-send').disabled = false;
      ksAddMsg('⚠️ Could not connect. Check your internet and try again.', 'ai');
      console.error('[KS Chat] fetch error:', err);
    });
}

// ─── Contact form ─────────────────────────────────────────────────────────────
function ksShowContact() {
  document.getElementById('ks-modal').classList.remove('ks-hidden');
}
function ksCloseContact() {
  document.getElementById('ks-modal').classList.add('ks-hidden');
}

function ksSubmitContact() {
  const name    = document.getElementById('ks-f-name').value.trim();
  const email   = document.getElementById('ks-f-email').value.trim();
  const phone   = document.getElementById('ks-f-phone').value.trim();
  const subject = document.getElementById('ks-f-subject').value.trim() || 'General Inquiry';
  const message = document.getElementById('ks-f-message').value.trim();

  if (!name || !email || !message) {
    alert('Please fill in Name, Email, and Message.');
    return;
  }
  if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    alert('Please enter a valid email address.');
    return;
  }

  const btn = document.getElementById('ks-f-submit');
  btn.textContent = 'Sending…';
  btn.disabled    = true;

  ksPost({ type: 'contact', name, email, phone, subject, message })
    .then(res => {
      btn.textContent = 'Send Message';
      btn.disabled    = false;

      if (res.success) {
        ksCloseContact();
        ksAddMsg('✅ ' + res.message, 'ai');
        // Clear form
        ['ks-f-name','ks-f-email','ks-f-phone','ks-f-subject','ks-f-message']
          .forEach(id => { document.getElementById(id).value = ''; });
      } else {
        alert('Error: ' + (res.message || 'Could not send. Please try again.'));
      }
    })
    .catch(err => {
      btn.textContent = 'Send Message';
      btn.disabled    = false;
      alert('Connection error. Please try again.');
      console.error('[KS Chat] contact error:', err);
    });
}

// ─── API call — NO mode:'no-cors' so we can actually read the response ────────
function ksPost(data) {
  return fetch(CHAT_CONFIG.DEPLOYMENT_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'text/plain' },   // text/plain bypasses CORS preflight for GAS
    body:    JSON.stringify(data)
  })
  .then(r => {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.text();
  })
  .then(text => {
    try {
      return JSON.parse(text);
    } catch (_) {
      console.error('[KS Chat] non-JSON response:', text.substring(0, 300));
      return { success: false, message: 'Unexpected server response' };
    }
  });
}

// ─── DOM helpers ─────────────────────────────────────────────────────────────
function ksAddMsg(text, who) {
  const box = document.getElementById('ks-messages');
  const div = document.createElement('div');
  div.className = 'ks-msg ' + (who === 'user' ? 'ks-user' : 'ks-ai');
  div.innerHTML =
    '<div class="ks-bubble">' + ksEscape(text) + '</div>' +
    '<div class="ks-time">'   + ksTime()        + '</div>';
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function ksShowTyping() {
  const box = document.getElementById('ks-messages');
  const div = document.createElement('div');
  div.className = 'ks-msg ks-ai';
  div.id = 'ks-typing';
  div.innerHTML = '<div class="ks-bubble ks-dots"><span></span><span></span><span></span></div>';
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}
function ksHideTyping() {
  const el = document.getElementById('ks-typing');
  if (el) el.remove();
}

function ksTime() {
  const d = new Date();
  return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
}

function ksEscape(str) {
  return str
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/\n/g,'<br>');
}

// ─── Styles ───────────────────────────────────────────────────────────────────
function injectStyles() {
  const s = document.createElement('style');
  s.textContent = `
  /* ── root vars ── */
  #ks-root { --c:#1F1F1F; --cr:#333; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }

  /* ── floating button ── */
  #ks-toggle {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: linear-gradient(135deg, #1F1F1F, #333);
    color: white;
    border: none;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(31, 31, 31, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    z-index: 9999;
  }
  #ks-toggle:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 16px rgba(31, 31, 31, 0.4);
  }
  #ks-toggle.active { bottom: 420px; }
  #ks-badge {
    position: absolute;
    top: -5px;
    right: -5px;
    background: #ff4444;
    color: white;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: bold;
  }

  /* ── chat window ── */
  #ks-window {
    position:fixed; bottom:96px; right:24px; z-index:9998;
    width:360px; height:480px; max-height:calc(100vh - 120px);
    background:#fff; border-radius:14px;
    box-shadow:0 8px 40px rgba(0,0,0,.18);
    display:flex; flex-direction:column;
    transition:opacity .2s,transform .2s;
  }
  #ks-window.ks-hidden { display:none; }

  /* ── header ── */
  #ks-header {
    background:linear-gradient(135deg,var(--c),var(--cr));
    color:#fff; padding:14px 16px;
    border-radius:14px 14px 0 0;
    display:flex; justify-content:space-between; align-items:center;
    flex-shrink:0;
  }
  #ks-header-title  { font-size:15px; font-weight:600; }
  #ks-header-sub    { font-size:11px; opacity:.85; margin-top:2px; }
  #ks-header-close  {
    background:rgba(255,255,255,.15); border:none; color:#fff;
    border-radius:6px; width:28px; height:28px; cursor:pointer;
    display:flex; align-items:center; justify-content:center;
  }
  #ks-header-close:hover { background:rgba(255,255,255,.3); }

  /* ── messages ── */
  #ks-messages {
    flex:1; overflow-y:auto; padding:14px;
    display:flex; flex-direction:column; gap:10px;
    background:#f7f7f7;
  }
  .ks-msg { display:flex; flex-direction:column; gap:3px; }
  .ks-msg.ks-user { align-items:flex-end; }
  .ks-msg.ks-ai   { align-items:flex-start; }
  .ks-bubble {
    max-width:82%; padding:9px 13px; border-radius:12px;
    font-size:14px; line-height:1.45; word-break:break-word;
  }
  .ks-user .ks-bubble { background:var(--c); color:#fff; border-radius:12px 2px 12px 12px; }
  .ks-ai   .ks-bubble { background:#e4e4e4; color:#222; border-radius:2px 12px 12px 12px; }
  .ks-time { font-size:10px; color:#aaa; padding:0 4px; }

  /* ── typing dots ── */
  .ks-dots { display:flex; gap:5px; align-items:center; min-width:44px; padding:12px 14px !important; }
  .ks-dots span {
    width:7px; height:7px; border-radius:50%; background:#888;
    animation:ks-bounce 1.2s infinite;
  }
  .ks-dots span:nth-child(2) { animation-delay:.2s; }
  .ks-dots span:nth-child(3) { animation-delay:.4s; }
  @keyframes ks-bounce {
    0%,60%,100% { transform:translateY(0); opacity:.5; }
    30%          { transform:translateY(-6px); opacity:1; }
  }

  /* ── input row ── */
  #ks-input-row {
    display:flex; gap:8px; padding:10px 12px 6px;
    border-top:1px solid #e8e8e8; flex-shrink:0; background:#fff;
  }
  #ks-input {
    flex:1; border:1px solid #ddd; border-radius:20px;
    padding:9px 14px; font-size:14px; outline:none;
    transition:border-color .2s;
  }
  #ks-input:focus  { border-color:var(--c); }
  #ks-input:disabled { background:#f5f5f5; }
  #ks-send {
    background:var(--c); color:#fff; border:none; border-radius:50%;
    width:36px; height:36px; cursor:pointer; flex-shrink:0;
    display:flex; align-items:center; justify-content:center;
    transition:background .2s;
  }
  #ks-send:hover    { background:#444; }
  #ks-send:disabled { background:#aaa; cursor:default; }

  /* ── footer ── */
  #ks-footer {
    padding:6px 12px 12px; background:#fff;
    border-radius:0 0 14px 14px; flex-shrink:0;
  }
  #ks-owner-btn {
    width:100%; background:#f2f2f2; border:1px solid #ddd;
    border-radius:7px; padding:8px; font-size:13px; font-weight:500;
    cursor:pointer; transition:background .2s;
  }
  #ks-owner-btn:hover { background:#e5e5e5; }

  /* ── contact modal ── */
  #ks-modal {
    position:fixed; inset:0; background:rgba(0,0,0,.5);
    z-index:10000; display:flex; align-items:center; justify-content:center;
  }
  #ks-modal.ks-hidden { display:none; }
  #ks-modal-box {
    background:#fff; border-radius:12px; width:90%; max-width:420px;
    max-height:90vh; overflow-y:auto;
    box-shadow:0 12px 48px rgba(0,0,0,.22);
  }
  #ks-modal-header {
    padding:16px 20px; font-size:16px; font-weight:600;
    border-bottom:1px solid #eee;
    display:flex; justify-content:space-between; align-items:center;
  }
  #ks-modal-header button {
    background:none; border:none; font-size:22px;
    cursor:pointer; color:#999; line-height:1;
  }
  #ks-modal-body { padding:20px; display:flex; flex-direction:column; gap:12px; }
  .ks-field label { display:block; font-size:13px; font-weight:500; margin-bottom:4px; }
  .ks-field input, .ks-field textarea {
    width:100%; padding:9px 11px; border:1px solid #ddd; border-radius:7px;
    font-size:14px; font-family:inherit; box-sizing:border-box; outline:none;
    transition:border-color .2s;
  }
  .ks-field input:focus, .ks-field textarea:focus { border-color:var(--c); }
  #ks-f-submit {
    background:var(--c); color:#fff; border:none; border-radius:7px;
    padding:11px; font-size:14px; font-weight:500; cursor:pointer;
    transition:background .2s; width:100%;
  }
  #ks-f-submit:hover    { background:#333; }
  #ks-f-submit:disabled { background:#aaa; cursor:default; }
  #ks-f-cancel {
    background:#f0f0f0; color:#333; border:1px solid #ddd;
    border-radius:7px; padding:11px; font-size:14px; font-weight:500;
    cursor:pointer; width:100%; transition:background .2s;
  }
  #ks-f-cancel:hover { background:#e0e0e0; }

  /* ── responsive ── */
  @media(max-width:480px){
    #ks-window { width:calc(100vw - 32px); right:16px; bottom:86px; }
    #ks-toggle { right:16px; bottom:16px; }
  }
  `;
  document.head.appendChild(s);
}

console.log('[Kashmir Stay] Chat widget loaded');
