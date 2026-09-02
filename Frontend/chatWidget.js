// ====================================================
// StylePulse AI Chat Widget
// Inject into any page by including this script and
// adding <div id="sp-chat-widget"></div> in your HTML
// ====================================================

(function () {
  const API_BASE = (window.STYLEPULSE_API_BASE || (window.location.hostname === 'localhost' ? 'http://localhost:5001' : 'https://backend-production-8cd3.up.railway.app')).replace(/\/$/, '');

  // ── Generate a simple session ID (stored in sessionStorage) ──
  function getSessionId() {
    let id = sessionStorage.getItem('sp_ai_session');
    if (!id) {
      id = 'session_' + Math.random().toString(36).slice(2, 11) + '_' + Date.now();
      sessionStorage.setItem('sp_ai_session', id);
    }
    return id;
  }

  // ── Inject styles ────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #sp-chat-fab {
      position: fixed; bottom: 28px; right: 28px; z-index: 9999;
      width: 58px; height: 58px; border-radius: 50%;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border: none; cursor: pointer; box-shadow: 0 4px 20px rgba(99,102,241,.45);
      display: flex; align-items: center; justify-content: center;
      transition: transform .2s, box-shadow .2s;
    }
    #sp-chat-fab:hover { transform: scale(1.1); box-shadow: 0 6px 28px rgba(99,102,241,.6); }
    #sp-chat-fab svg { width: 28px; height: 28px; fill: #fff; }

    #sp-chat-panel {
      position: fixed; bottom: 100px; right: 28px; z-index: 9998;
      width: 360px; max-height: 540px;
      display: flex; flex-direction: column;
      background: rgba(15,23,42,.92);
      backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255,255,255,.1); border-radius: 20px;
      box-shadow: 0 24px 60px rgba(0,0,0,.5);
      overflow: hidden; font-family: 'Inter', sans-serif;
      transition: opacity .25s, transform .25s;
      opacity: 0; transform: translateY(16px) scale(.97); pointer-events: none;
    }
    #sp-chat-panel.open { opacity: 1; transform: translateY(0) scale(1); pointer-events: all; }

    #sp-chat-header {
      padding: 16px 18px; display: flex; align-items: center; gap: 10px;
      background: linear-gradient(90deg, rgba(99,102,241,.3), rgba(139,92,246,.3));
      border-bottom: 1px solid rgba(255,255,255,.08);
    }
    #sp-chat-header .sp-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      display: flex; align-items: center; justify-content: center; font-size: 18px;
    }
    #sp-chat-header h3 { margin: 0; font-size: 15px; font-weight: 700; color: #f1f5f9; }
    #sp-chat-header p  { margin: 0; font-size: 11px; color: #94a3b8; }
    #sp-chat-close {
      margin-left: auto; background: none; border: none; cursor: pointer;
      color: #94a3b8; font-size: 20px; line-height: 1; padding: 2px 6px; border-radius: 6px;
    }
    #sp-chat-close:hover { background: rgba(255,255,255,.1); color: #f1f5f9; }

    #sp-chat-messages {
      flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px;
      scrollbar-width: thin; scrollbar-color: rgba(99,102,241,.4) transparent;
    }
    .sp-msg {
      max-width: 82%; padding: 10px 14px; border-radius: 14px;
      font-size: 13.5px; line-height: 1.55; animation: spFadeIn .25s ease;
    }
    .sp-msg.user {
      align-self: flex-end;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: #fff; border-bottom-right-radius: 4px;
    }
    .sp-msg.model {
      align-self: flex-start;
      background: rgba(255,255,255,.08); color: #e2e8f0;
      border-bottom-left-radius: 4px; border: 1px solid rgba(255,255,255,.06);
    }
    .sp-typing { display: flex; gap: 5px; align-items: center; padding: 12px 16px; }
    .sp-typing span {
      width: 7px; height: 7px; background: #6366f1; border-radius: 50%;
      animation: spBounce .9s infinite ease-in-out;
    }
    .sp-typing span:nth-child(2) { animation-delay: .15s; }
    .sp-typing span:nth-child(3) { animation-delay: .3s; }

    #sp-chat-input-row {
      display: flex; gap: 8px; padding: 12px 14px;
      border-top: 1px solid rgba(255,255,255,.08);
      background: rgba(255,255,255,.03);
    }
    #sp-chat-input {
      flex: 1; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.1);
      border-radius: 10px; padding: 10px 14px; color: #f1f5f9; font-size: 13.5px;
      outline: none; resize: none;
    }
    #sp-chat-input::placeholder { color: #64748b; }
    #sp-chat-input:focus { border-color: rgba(99,102,241,.6); }
    #sp-send-btn {
      width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: opacity .2s;
    }
    #sp-send-btn:disabled { opacity: .4; cursor: not-allowed; }
    #sp-send-btn svg { width: 18px; height: 18px; fill: #fff; }

    @keyframes spFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
    @keyframes spBounce { 0%,80%,100% { transform: scale(0); } 40% { transform: scale(1); } }
  `;
  document.head.appendChild(style);

  // ── Build HTML ────────────────────────────────────────────────
  const fab = document.createElement('button');
  fab.id = 'sp-chat-fab';
  fab.title = 'Chat with StylePulse AI';
  fab.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.135 2 11.25c0 2.78 1.237 5.273 3.2 6.984L4 22l4.5-1.8A10.5 10.5 0 0012 20.5c5.523 0 10-4.135 10-9.25S17.523 2 12 2z"/></svg>`;

  const panel = document.createElement('div');
  panel.id = 'sp-chat-panel';
  panel.innerHTML = `
    <div id="sp-chat-header">
      <div class="sp-avatar">✨</div>
      <div><h3>StylePulse AI</h3><p>Ask me about services &amp; availability</p></div>
      <button id="sp-chat-close" title="Close">✕</button>
    </div>
    <div id="sp-chat-messages">
      <div class="sp-msg model">👋 Hi! I'm your StylePulse AI assistant. Ask me about our services, pricing, or check if a time slot is available (e.g., "Are there slots on 2026-08-15?").</div>
    </div>
    <div id="sp-chat-input-row">
      <textarea id="sp-chat-input" rows="1" placeholder="Ask about services, availability…"></textarea>
      <button id="sp-send-btn" title="Send">
        <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
      </button>
    </div>
  `;

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  // ── State ─────────────────────────────────────────────────────
  let isOpen = false;
  let isLoading = false;
  const sessionId = getSessionId();
  const messagesEl = panel.querySelector('#sp-chat-messages');
  const inputEl = panel.querySelector('#sp-chat-input');
  const sendBtn = panel.querySelector('#sp-send-btn');

  // ── Toggle ────────────────────────────────────────────────────
  fab.addEventListener('click', () => {
    isOpen = !isOpen;
    panel.classList.toggle('open', isOpen);
    if (isOpen) inputEl.focus();
  });
  panel.querySelector('#sp-chat-close').addEventListener('click', () => {
    isOpen = false;
    panel.classList.remove('open');
  });

  // ── Send message ──────────────────────────────────────────────
  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text || isLoading) return;

    appendMessage('user', text);
    inputEl.value = '';
    inputEl.style.height = 'auto';
    setLoading(true);

    const typingEl = showTyping();

    try {
      const res = await fetch(`${API_BASE}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId }),
      });
      const data = await res.json();
      typingEl.remove();
      appendMessage('model', data.reply || 'Sorry, I couldn\'t get a response right now.');
    } catch (err) {
      typingEl.remove();
      appendMessage('model', '⚠️ I\'m having trouble connecting. Please check your internet and try again.');
    } finally {
      setLoading(false);
    }
  }

  sendBtn.addEventListener('click', sendMessage);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  // Auto-resize textarea
  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 100) + 'px';
  });

  function appendMessage(role, content) {
    const el = document.createElement('div');
    el.className = `sp-msg ${role}`;
    el.textContent = content;
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showTyping() {
    const el = document.createElement('div');
    el.className = 'sp-msg model sp-typing';
    el.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return el;
  }

  function setLoading(val) {
    isLoading = val;
    sendBtn.disabled = val;
  }
})();
