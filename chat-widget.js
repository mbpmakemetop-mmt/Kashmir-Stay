// ═══════════════════════════════════════════════════════════════════════════
//  KASHMIR STAY CHAT WIDGET
//  Floating AI Chat Interface + Owner Contact
// ═══════════════════════════════════════════════════════════════════════════

// ═══ CONFIGURATION ═══
const CHAT_CONFIG = {
  DEPLOYMENT_URL: 'Yhttps://script.google.com/macros/s/AKfycbwa8XFecHqXe7_pPkmbeXqX5wUMUQHeNUb2ZntAbUdiHGPPM9n0G13TdmX4rzPz9A1bDw/exec', // Replace with your deployment URL
  WIDGET_POSITION: 'bottom-right', // or 'bottom-left'
  INITIAL_MESSAGE: 'Hello! 👋 I\'m Kashmir Stay\'s AI Assistant. How can I help you with your Kashmir trip today?',
  PLACEHOLDER: 'Ask about hotels, tours, travel tips...',
  THEME_COLOR: '#1F1F1F' // Match your site color
};

// ═══════════════════════════════════════════════════════════════════════════
//  INITIALIZE CHAT WIDGET
// ═══════════════════════════════════════════════════════════════════════════

(function initChatWidget() {
  // Only initialize if deployment URL is set
  if (CHAT_CONFIG.DEPLOYMENT_URL === 'https://script.google.com/macros/s/AKfycbwa8XFecHqXe7_pPkmbeXqX5wUMUQHeNUb2ZntAbUdiHGPPM9n0G13TdmX4rzPz9A1bDw/exec') {
    console.warn('Chat Widget: Deployment URL not configured');
    return;
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createChatWidget);
  } else {
    createChatWidget();
  }
})();

// ═══════════════════════════════════════════════════════════════════════════
//  CREATE CHAT WIDGET DOM & STYLES
// ═══════════════════════════════════════════════════════════════════════════

function createChatWidget() {
  // Inject CSS
  injectChatStyles();

  // Create HTML structure
  const widgetHTML = `
    <!-- Chat Widget Container -->
    <div id="ks-chat-widget" class="ks-chat-widget">
      <!-- Chat Window -->
      <div id="ks-chat-window" class="ks-chat-window hidden">
        <!-- Header -->
        <div class="ks-chat-header">
          <div class="ks-chat-header-content">
            <h3>Kashmir Stay AI</h3>
            <p>Professional Travel Assistance</p>
          </div>
          <button id="ks-chat-close" class="ks-chat-close" onclick="toggleChatWidget()">
            <svg viewBox="0 0 24 24" width="20" height="20"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>

        <!-- Messages Container -->
        <div id="ks-chat-messages" class="ks-chat-messages">
          <div class="ks-chat-message ai-message">
            <div class="ks-message-content">${CHAT_CONFIG.INITIAL_MESSAGE}</div>
            <div class="ks-message-time">Just now</div>
          </div>
        </div>

        <!-- Input Area -->
        <div class="ks-chat-input-area">
          <form id="ks-chat-form" onsubmit="sendChatMessage(event)">
            <input 
              type="text" 
              id="ks-chat-input" 
              class="ks-chat-input" 
              placeholder="${CHAT_CONFIG.PLACEHOLDER}"
              autocomplete="off"
            />
            <button type="submit" class="ks-chat-send" title="Send message">
              <svg viewBox="0 0 24 24" width="18" height="18"><path d="M16.6915026,12.4744748 L3.50612381,13.2599618 C3.19218622,13.2599618 3.03521743,13.4170592 3.03521743,13.5741566 L1.15159189,20.0151496 C0.8376543,20.8006365 0.99,21.89 1.77946707,22.52 C2.41,22.99 3.50612381,23.1 4.13399899,22.8429026 L21.714504,14.0454487 C22.6563168,13.5741566 23.1272231,12.6315722 22.9702544,11.6889879 L4.13399899,1.16151496 C3.34915502,0.9 2.40734225,0.9 1.77946707,1.4429026 C0.994623095,2.0842451 0.837654301,3.0274462 1.15159189,3.81294309 L3.03521743,10.2539362 C3.03521743,10.4110336 3.19218622,10.5681311 3.50612381,10.5681311 L16.6915026,11.3536179 C16.6915026,11.3536179 17.1624089,11.3536179 17.1624089,10.9686265 L17.1624089,11.3536179 C17.1624089,11.5107153 17.1624089,12.4744748 16.6915026,12.4744748 Z" fill="currentColor"/></svg>
            </button>
          </form>

          <!-- "Talk to Owner" Button -->
          <button id="ks-talk-owner-btn" class="ks-talk-owner-btn" onclick="showContactForm()">
            📞 Talk to Owner
          </button>
        </div>
      </div>

      <!-- Chat Toggle Button (Floating) -->
      <button id="ks-chat-toggle" class="ks-chat-toggle" onclick="toggleChatWidget()" title="Open Chat">
        <svg viewBox="0 0 24 24" width="24" height="24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="currentColor"/></svg>
        <span class="ks-chat-badge">1</span>
      </button>

      <!-- Contact Form Modal (Hidden by default) -->
      <div id="ks-contact-modal" class="ks-contact-modal hidden">
        <div class="ks-contact-form-wrapper">
          <div class="ks-contact-header">
            <h3>Contact Kashmir Stay Team</h3>
            <button class="ks-contact-close" onclick="closeContactForm()">×</button>
          </div>

          <form id="ks-contact-form" onsubmit="submitContactForm(event)">
            <div class="ks-form-group">
              <label>Name *</label>
              <input type="text" name="name" required placeholder="Your full name" />
            </div>

            <div class="ks-form-group">
              <label>Email *</label>
              <input type="email" name="email" required placeholder="your@email.com" />
            </div>

            <div class="ks-form-group">
              <label>Phone (Optional)</label>
              <input type="tel" name="phone" placeholder="+91 XXXXXXXXXX" />
            </div>

            <div class="ks-form-group">
              <label>Message *</label>
              <textarea name="message" required placeholder="Tell us what you need..." rows="4"></textarea>
            </div>

            <button type="submit" class="ks-submit-btn">Send Message</button>
            <button type="button" class="ks-cancel-btn" onclick="closeContactForm()">Cancel</button>
          </form>
        </div>
      </div>
    </div>
  `;

  // Append to body
  const div = document.createElement('div');
  div.innerHTML = widgetHTML;
  document.body.appendChild(div);

  // Show welcome badge animation
  showBadgeAnimation();
}

// ═══════════════════════════════════════════════════════════════════════════
//  TOGGLE CHAT WINDOW
// ═══════════════════════════════════════════════════════════════════════════

function toggleChatWidget() {
  const chatWindow = document.getElementById('ks-chat-window');
  const chatToggle = document.getElementById('ks-chat-toggle');
  
  if (chatWindow.classList.contains('hidden')) {
    // Open chat
    chatWindow.classList.remove('hidden');
    chatToggle.classList.add('active');
    document.getElementById('ks-chat-input').focus();
    // Hide contact modal if open
    closeContactForm();
  } else {
    // Close chat
    chatWindow.classList.add('hidden');
    chatToggle.classList.remove('active');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  SEND CHAT MESSAGE
// ═══════════════════════════════════════════════════════════════════════════

function sendChatMessage(event) {
  event.preventDefault();

  const input = document.getElementById('ks-chat-input');
  const message = input.value.trim();

  if (!message) return;

  // Add user message to chat
  addMessageToChat(message, 'user');

  // Clear input
  input.value = '';

  // Show loading indicator
  showLoadingIndicator();

  // Send to API
  sendToAPI({
    type: 'chat',
    message: message
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  SHOW CONTACT FORM
// ═══════════════════════════════════════════════════════════════════════════

function showContactForm() {
  const modal = document.getElementById('ks-contact-modal');
  modal.classList.remove('hidden');
  document.getElementById('ks-contact-form').reset();
}

function closeContactForm() {
  const modal = document.getElementById('ks-contact-modal');
  modal.classList.add('hidden');
}

// ═══════════════════════════════════════════════════════════════════════════
//  SUBMIT CONTACT FORM
// ═══════════════════════════════════════════════════════════════════════════

function submitContactForm(event) {
  event.preventDefault();

  const form = document.getElementById('ks-contact-form');
  const formData = new FormData(form);

  const contactData = {
    type: 'contact',
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    message: formData.get('message'),
    userAgent: navigator.userAgent
  };

  // Show loading state
  const submitBtn = form.querySelector('[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Sending...';
  submitBtn.disabled = true;

  // Send to API
  sendToAPI(contactData, function(response) {
    submitBtn.disabled = false;
    
    if (response.success) {
      // Success
      addMessageToChat('✅ ' + response.message, 'ai');
      closeContactForm();
      submitBtn.textContent = originalText;
      form.reset();
    } else {
      // Error
      submitBtn.textContent = originalText;
      alert('Error: ' + response.message);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  API COMMUNICATION
// ═══════════════════════════════════════════════════════════════════════════

function sendToAPI(data, callback) {
  callback = callback || function() {};

  fetch(CHAT_CONFIG.DEPLOYMENT_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
  .then(response => response.text())
  .then(text => {
    try {
      const result = JSON.parse(text);
      handleAPIResponse(result, data.type);
      callback(result);
    } catch (e) {
      console.error('Parse error:', e);
      addMessageToChat('⚠️ Connection error. Please try again.', 'ai');
      callback({ success: false, message: 'Parse error' });
    }
  })
  .catch(error => {
    console.error('API Error:', error);
    addMessageToChat('⚠️ Unable to connect to the server. Please try again later.', 'ai');
    callback({ success: false, message: error.toString() });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  HANDLE API RESPONSE
// ═══════════════════════════════════════════════════════════════════════════

function handleAPIResponse(response, type) {
  // Remove loading indicator
  removeLoadingIndicator();

  if (!response.success) {
    addMessageToChat('❌ ' + response.message, 'ai');
    return;
  }

  if (type === 'chat') {
    addMessageToChat(response.data.aiResponse ? response.message : response.data.message, 'ai');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  MESSAGE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

function addMessageToChat(message, sender) {
  const messagesContainer = document.getElementById('ks-chat-messages');
  
  const messageDiv = document.createElement('div');
  messageDiv.className = 'ks-chat-message ' + (sender === 'user' ? 'user-message' : 'ai-message');
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'ks-message-content';
  contentDiv.textContent = message;
  
  const timeDiv = document.createElement('div');
  timeDiv.className = 'ks-message-time';
  timeDiv.textContent = getCurrentTime();
  
  messageDiv.appendChild(contentDiv);
  messageDiv.appendChild(timeDiv);
  messagesContainer.appendChild(messageDiv);
  
  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showLoadingIndicator() {
  const messagesContainer = document.getElementById('ks-chat-messages');
  
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'ks-chat-message ai-message ks-loading';
  loadingDiv.id = 'ks-loading-indicator';
  loadingDiv.innerHTML = '<div class="ks-typing-dots"><span></span><span></span><span></span></div>';
  
  messagesContainer.appendChild(loadingDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function removeLoadingIndicator() {
  const loading = document.getElementById('ks-loading-indicator');
  if (loading) {
    loading.remove();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  UI HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function getCurrentTime() {
  const now = new Date();
  return now.getHours().toString().padStart(2, '0') + ':' + 
         now.getMinutes().toString().padStart(2, '0');
}

function showBadgeAnimation() {
  const badge = document.querySelector('.ks-chat-badge');
  if (badge) {
    badge.style.animation = 'ks-badge-bounce 2s ease-in-out infinite';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  INJECT CSS STYLES
// ═══════════════════════════════════════════════════════════════════════════

function injectChatStyles() {
  const style = document.createElement('style');
  style.textContent = `
    /* ═══ CHAT WIDGET STYLES ═══ */
    #ks-chat-widget {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      --primary-color: #1F1F1F;
      --text-color: #333;
      --bg-light: #f5f5f5;
      --ai-bg: #e8e8e8;
      --user-bg: #1F1F1F;
      --user-text: #fff;
    }

    /* ═══ TOGGLE BUTTON ═══ */
    .ks-chat-toggle {
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
      z-index: 999;
    }

    .ks-chat-toggle:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 16px rgba(31, 31, 31, 0.4);
    }

    .ks-chat-toggle.active {
      bottom: 420px;
    }

    .ks-chat-badge {
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

    /* ═══ CHAT WINDOW ═══ */
    .ks-chat-window {
      position: fixed;
      bottom: 90px;
      right: 20px;
      width: 380px;
      height: 500px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 5px 40px rgba(0, 0, 0, 0.16);
      display: flex;
      flex-direction: column;
      z-index: 998;
      transition: all 0.3s ease;
    }

    .ks-chat-window.hidden {
      display: none;
      opacity: 0;
      transform: scale(0.95);
    }

    /* ═══ CHAT HEADER ═══ */
    .ks-chat-header {
      background: linear-gradient(135deg, #1F1F1F, #333);
      color: white;
      padding: 16px;
      border-radius: 12px 12px 0 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .ks-chat-header-content h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }

    .ks-chat-header-content p {
      margin: 4px 0 0 0;
      font-size: 12px;
      opacity: 0.9;
    }

    .ks-chat-close {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }

    .ks-chat-close:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    /* ═══ MESSAGES CONTAINER ═══ */
    .ks-chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #fafafa;
    }

    /* ═══ MESSAGE STYLES ═══ */
    .ks-chat-message {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .ks-chat-message.user-message {
      align-items: flex-end;
    }

    .ks-chat-message.ai-message {
      align-items: flex-start;
    }

    .ks-message-content {
      max-width: 80%;
      padding: 10px 14px;
      border-radius: 12px;
      line-height: 1.4;
      word-wrap: break-word;
    }

    .user-message .ks-message-content {
      background: var(--user-bg);
      color: var(--user-text);
      border-radius: 12px 2px 12px 12px;
    }

    .ai-message .ks-message-content {
      background: var(--ai-bg);
      color: var(--text-color);
      border-radius: 2px 12px 12px 12px;
    }

    .ks-message-time {
      font-size: 11px;
      color: #999;
      padding: 0 4px;
    }

    /* ═══ LOADING STATE ═══ */
    .ks-loading .ks-message-content {
      padding: 10px 14px;
    }

    .ks-typing-dots {
      display: flex;
      gap: 4px;
    }

    .ks-typing-dots span {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--text-color);
      animation: ks-typing 1.4s infinite;
    }

    .ks-typing-dots span:nth-child(2) {
      animation-delay: 0.2s;
    }

    .ks-typing-dots span:nth-child(3) {
      animation-delay: 0.4s;
    }

    @keyframes ks-typing {
      0%, 60%, 100% { opacity: 0.5; transform: translateY(0); }
      30% { opacity: 1; transform: translateY(-8px); }
    }

    /* ═══ INPUT AREA ═══ */
    .ks-chat-input-area {
      padding: 12px;
      border-top: 1px solid #e0e0e0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    #ks-chat-form {
      display: flex;
      gap: 8px;
    }

    .ks-chat-input {
      flex: 1;
      border: 1px solid #ddd;
      border-radius: 20px;
      padding: 10px 16px;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
    }

    .ks-chat-input:focus {
      border-color: var(--primary-color);
    }

    .ks-chat-send {
      background: var(--primary-color);
      color: white;
      border: none;
      border-radius: 50%;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 0.2s;
    }

    .ks-chat-send:hover {
      background: #333;
    }

    /* ═══ TALK TO OWNER BUTTON ═══ */
    .ks-talk-owner-btn {
      background: #f0f0f0;
      border: 1px solid #ddd;
      padding: 8px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s;
    }

    .ks-talk-owner-btn:hover {
      background: #e0e0e0;
      border-color: var(--primary-color);
    }

    /* ═══ CONTACT MODAL ═══ */
    .ks-contact-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .ks-contact-modal.hidden {
      display: none;
    }

    .ks-contact-form-wrapper {
      background: white;
      border-radius: 12px;
      padding: 24px;
      width: 90%;
      max-width: 420px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    }

    .ks-contact-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .ks-contact-header h3 {
      margin: 0;
      font-size: 18px;
    }

    .ks-contact-close {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #999;
    }

    /* ═══ FORM ELEMENTS ═══ */
    .ks-form-group {
      margin-bottom: 16px;
    }

    .ks-form-group label {
      display: block;
      margin-bottom: 6px;
      font-weight: 500;
      font-size: 14px;
    }

    .ks-form-group input,
    .ks-form-group textarea {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
      font-family: inherit;
      box-sizing: border-box;
    }

    .ks-form-group input:focus,
    .ks-form-group textarea:focus {
      outline: none;
      border-color: var(--primary-color);
      box-shadow: 0 0 0 3px rgba(31, 31, 31, 0.1);
    }

    .ks-submit-btn {
      background: var(--primary-color);
      color: white;
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      width: 100%;
      margin-bottom: 8px;
      transition: background 0.2s;
    }

    .ks-submit-btn:hover {
      background: #333;
    }

    .ks-cancel-btn {
      background: #f0f0f0;
      color: #333;
      padding: 10px 20px;
      border: 1px solid #ddd;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      width: 100%;
      transition: all 0.2s;
    }

    .ks-cancel-btn:hover {
      background: #e0e0e0;
    }

    /* ═══ RESPONSIVE ═══ */
    @media (max-width: 480px) {
      .ks-chat-window {
        width: calc(100% - 40px);
        height: 70vh;
        bottom: 80px;
        right: 20px;
      }

      .ks-contact-form-wrapper {
        width: 95%;
      }

      .ks-message-content {
        max-width: 90% !important;
      }
    }

    /* ═══ ANIMATIONS ═══ */
    @keyframes ks-badge-bounce {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.2); }
    }
  `;

  document.head.appendChild(style);
}

// ═══════════════════════════════════════════════════════════════════════════
//  INITIALIZATION COMPLETE
// ═══════════════════════════════════════════════════════════════════════════

console.log('Kashmir Stay Chat Widget loaded successfully');
