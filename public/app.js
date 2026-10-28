// Establish real-time connection with backend
const socket = io();

// DOM Elements
const statusPill = document.getElementById('statusPill');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');

const statTotalMessages = document.getElementById('statTotalMessages');
const statRepliesSent = document.getElementById('statRepliesSent');

const qrSection = document.getElementById('qrSection');
const qrImage = document.getElementById('qrImage');
const qrLoading = document.getElementById('qrLoading');
const connectedSection = document.getElementById('connectedSection');
const connectedInfo = document.getElementById('connectedInfo');

const autoReplyToggle = document.getElementById('autoReplyToggle');
const toggleStatusLabel = document.getElementById('toggleStatusLabel');
const replyMessageInput = document.getElementById('replyMessageInput');
const charCount = document.getElementById('charCount');
const saveMessageBtn = document.getElementById('saveMessageBtn');
const groupReplyToggle = document.getElementById('groupReplyToggle');

const messagesList = document.getElementById('messagesList');
const emptyMessagesState = document.getElementById('emptyMessagesState');
const messageCountBadge = document.getElementById('messageCountBadge');

const terminalOutput = document.getElementById('terminalOutput');
const autoScrollCheck = document.getElementById('autoScrollCheck');
const clearLogsBtn = document.getElementById('clearLogsBtn');
const toast = document.getElementById('toast');

// Sound / Notification feedback helper
function showToast(message, duration = 3000) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

// Update char count helper
function updateCharCount() {
  charCount.textContent = `${replyMessageInput.value.length} chars`;
}
replyMessageInput.addEventListener('input', updateCharCount);

// ==========================================
// SOCKET.IO EVENT HANDLERS
// ==========================================

// Initial State Sync on Connect
socket.on('init_state', (state) => {
  console.log('[Socket] Initial state received:', state);
  
  // Set Auto Reply Toggle
  autoReplyToggle.checked = state.autoReplyEnabled;
  updateToggleLabel(state.autoReplyEnabled);

  // Set Auto Reply Message
  replyMessageInput.value = state.autoReplyMessage || '';
  updateCharCount();

  // Set Group Reply Toggle
  groupReplyToggle.checked = state.replyToGroups;

  // Set Stats
  statTotalMessages.textContent = state.stats.totalMessages || 0;
  statRepliesSent.textContent = state.stats.autoRepliesSent || 0;

  // Set Bot Status & QR
  handleStatusUpdate(state.botStatus, state.clientInfo);
  if (state.qrCodeDataUrl) {
    displayQrCode(state.qrCodeDataUrl);
  }

  // Populate Messages
  if (state.messages && state.messages.length > 0) {
    emptyMessagesState.style.display = 'none';
    messageCountBadge.textContent = state.messages.length;
    messagesList.innerHTML = '';
    state.messages.forEach(msg => renderMessageCard(msg, false));
  } else {
    emptyMessagesState.style.display = 'flex';
    messageCountBadge.textContent = '0';
  }

  // Populate Logs
  if (state.logs && state.logs.length > 0) {
    terminalOutput.innerHTML = '';
    state.logs.forEach(log => appendLogLine(log));
  }
});

// Bot Status Change
socket.on('status_change', (data) => {
  console.log('[Socket] Status changed:', data);
  handleStatusUpdate(data.status, data.clientInfo);
});

// Live QR Code Received
socket.on('qr', (data) => {
  console.log('[Socket] QR received');
  displayQrCode(data.qrCodeDataUrl);
  handleStatusUpdate('QR_READY');
});

// Ready / Connected Event
socket.on('ready', (data) => {
  console.log('[Socket] WhatsApp is ready!', data);
  handleStatusUpdate('READY', data.clientInfo);
  showToast('WhatsApp connected successfully!');
});

// New Incoming Message Received
socket.on('new_message', (msg) => {
  console.log('[Socket] New message:', msg);
  emptyMessagesState.style.display = 'none';
  renderMessageCard(msg, true);
  
  // Update badge
  const currentCount = parseInt(messageCountBadge.textContent || '0', 10);
  messageCountBadge.textContent = currentCount + 1;
});

// Live Terminal / Log streaming
socket.on('log', (logEntry) => {
  appendLogLine(logEntry);
});

// Stats Update
socket.on('stats_updated', (stats) => {
  statTotalMessages.textContent = stats.totalMessages || 0;
  statRepliesSent.textContent = stats.autoRepliesSent || 0;
});

// Settings Updated from Server
socket.on('settings_updated', (settings) => {
  autoReplyToggle.checked = settings.autoReplyEnabled;
  updateToggleLabel(settings.autoReplyEnabled);
  groupReplyToggle.checked = settings.replyToGroups;
  if (settings.autoReplyMessage) {
    replyMessageInput.value = settings.autoReplyMessage;
    updateCharCount();
  }
});

// ==========================================
// UI HELPER FUNCTIONS
// ==========================================

function updateToggleLabel(isEnabled) {
  if (isEnabled) {
    toggleStatusLabel.textContent = 'Currently Active (Auto-responding)';
    toggleStatusLabel.classList.remove('disabled');
  } else {
    toggleStatusLabel.textContent = 'Disabled (Bot is silent)';
    toggleStatusLabel.classList.add('disabled');
  }
}

function handleStatusUpdate(status, clientInfo) {
  statusDot.className = 'status-dot';

  switch (status) {
    case 'QR_READY':
      statusText.textContent = 'Scan QR Code';
      statusDot.classList.remove('active');
      statusDot.style.background = 'var(--color-amber)';
      qrSection.classList.remove('hidden');
      connectedSection.classList.add('hidden');
      break;

    case 'AUTHENTICATED':
      statusText.textContent = 'Authenticated! Loading chats...';
      statusDot.classList.add('active');
      break;

    case 'READY':
      statusText.textContent = 'Connected & Active';
      statusDot.classList.add('active');
      qrSection.classList.add('hidden');
      connectedSection.classList.remove('hidden');

      if (clientInfo && clientInfo.pushname) {
        connectedInfo.textContent = `Logged in as ${clientInfo.pushname} (${clientInfo.wid?.user || ''}).`;
      } else {
        connectedInfo.textContent = 'WhatsApp is connected, online, and listening for messages.';
      }
      break;

    case 'DISCONNECTED':
      statusText.textContent = 'Disconnected';
      statusDot.classList.add('disconnected');
      qrSection.classList.remove('hidden');
      connectedSection.classList.add('hidden');
      break;

    default: // INITIALIZING
      statusText.textContent = 'Initializing WhatsApp...';
      statusDot.classList.remove('active');
      break;
  }
}

function displayQrCode(dataUrl) {
  qrImage.src = dataUrl;
  qrImage.style.display = 'block';
  qrLoading.style.display = 'none';
}

function renderMessageCard(msg, prepend = true) {
  const item = document.createElement('div');
  item.className = `message-item ${msg.autoReplied ? '' : 'skipped'}`;

  // Avatar Initials
  const initials = (msg.senderName || 'U').substring(0, 2).toUpperCase();

  // Format time
  const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : new Date().toLocaleTimeString();

  // Status badge HTML
  const statusHtml = msg.autoReplied 
    ? `<span class="status-badge replied">✓ Auto-Replied</span>`
    : `<span class="status-badge disabled">Auto-Reply Disabled</span>`;

  item.innerHTML = `
    <div class="message-header-row">
      <div class="sender-identity">
        <div class="sender-avatar">${escapeHtml(initials)}</div>
        <div class="sender-info-text">
          <span class="sender-name">${escapeHtml(msg.senderName)}</span>
          <span class="sender-number">📱 ${escapeHtml(msg.senderNumber)}</span>
        </div>
      </div>
      <div class="meta-badges">
        <span class="time-stamp">${timeStr}</span>
        ${statusHtml}
      </div>
    </div>
    <div class="message-body-text">${escapeHtml(msg.body || '')}</div>
  `;

  if (prepend && messagesList.firstChild) {
    messagesList.insertBefore(item, messagesList.firstChild);
  } else {
    messagesList.appendChild(item);
  }
}

function appendLogLine(logEntry) {
  const line = document.createElement('div');
  line.className = 'log-line';

  const timeStr = logEntry.timestamp 
    ? new Date(logEntry.timestamp).toLocaleTimeString() 
    : new Date().toLocaleTimeString();

  let prefixClass = 'log-prefix-info';
  if (logEntry.type === 'success') prefixClass = 'log-prefix-success';
  if (logEntry.type === 'msg') prefixClass = 'log-prefix-msg';
  if (logEntry.type === 'bot') prefixClass = 'log-prefix-bot';
  if (logEntry.type === 'error') prefixClass = 'log-prefix-error';

  line.innerHTML = `<span class="log-time">[${timeStr}]</span><span class="${prefixClass}">${escapeHtml(logEntry.text)}</span>`;
  
  terminalOutput.appendChild(line);

  // Auto-scroll
  if (autoScrollCheck.checked) {
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==========================================
// USER CONTROLS EVENT LISTENERS
// ==========================================

// Toggle Auto-Reply (Enable / Disable)
autoReplyToggle.addEventListener('change', () => {
  const isEnabled = autoReplyToggle.checked;
  updateToggleLabel(isEnabled);
  socket.emit('toggle_auto_reply', isEnabled);
  showToast(isEnabled ? 'Auto-Reply enabled!' : 'Auto-Reply disabled!');
});

// Save Reply Message Text
saveMessageBtn.addEventListener('click', () => {
  const newMsg = replyMessageInput.value.trim();
  if (!newMsg) {
    showToast('Reply message cannot be empty!');
    return;
  }
  socket.emit('update_reply_message', newMsg);
  showToast('Auto-reply message updated successfully!');
});

// Toggle Reply to Groups
groupReplyToggle.addEventListener('change', () => {
  const isEnabled = groupReplyToggle.checked;
  socket.emit('toggle_reply_to_groups', isEnabled);
  showToast(isEnabled ? 'Group auto-reply enabled' : 'Group auto-reply disabled');
});

// Clear Logs
clearLogsBtn.addEventListener('click', () => {
  terminalOutput.innerHTML = '';
  socket.emit('clear_logs');
});
