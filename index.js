const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const fs = require('fs');

// ==========================================
// CONFIGURATION & GLOBAL STATE
// ==========================================
const PORT = process.env.PORT || 3000;

let botStatus = 'INITIALIZING'; // 'INITIALIZING' | 'QR_READY' | 'AUTHENTICATED' | 'READY' | 'DISCONNECTED'
let qrCodeDataUrl = null;
let clientInfo = null;

let autoReplyEnabled = true;
let replyToGroups = false;

let autoReplyMessage = 
`Hello! I am a WhatsApp agent and currently under development. Due to this, replies are currently limited to this automated response.

Please leave your message, and Sir will reply to you as soon as he is free. Thank you!`;

const stats = {
  totalMessages: 0,
  autoRepliesSent: 0
};

const messages = []; // Max 50 messages
const logs = [];     // Max 100 logs

// ==========================================
// EXPRESS & SOCKET.IO SETUP
// ==========================================
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Helper for unified logging (Terminal + Dashboard stream)
function log(type, text) {
  const timestamp = Date.now();
  const logEntry = { type, text, timestamp };

  // Terminal output
  const timeStr = new Date(timestamp).toLocaleTimeString();
  console.log(`[${timeStr}] ${text}`);

  // Save in memory
  logs.push(logEntry);
  if (logs.length > 100) logs.shift();

  // Broadcast to all connected web clients
  io.emit('log', logEntry);
}

// Socket.io Client Connections
io.on('connection', (socket) => {
  // Send current state to newly opened browser tab
  socket.emit('init_state', {
    botStatus,
    qrCodeDataUrl,
    clientInfo,
    autoReplyEnabled,
    replyToGroups,
    autoReplyMessage,
    stats,
    messages,
    logs
  });

  // Client toggled auto-reply
  socket.on('toggle_auto_reply', (isEnabled) => {
    autoReplyEnabled = Boolean(isEnabled);
    log('info', `[⚙ Settings] Auto-reply was ${autoReplyEnabled ? 'ENABLED' : 'DISABLED'} by user from dashboard.`);
    io.emit('settings_updated', { autoReplyEnabled, replyToGroups, autoReplyMessage });
  });

  // Client updated reply message text
  socket.on('update_reply_message', (newMessage) => {
    if (typeof newMessage === 'string' && newMessage.trim().length > 0) {
      autoReplyMessage = newMessage.trim();
      log('info', `[⚙ Settings] Auto-reply message text updated from dashboard.`);
      io.emit('settings_updated', { autoReplyEnabled, replyToGroups, autoReplyMessage });
    }
  });

  // Client toggled group reply
  socket.on('toggle_reply_to_groups', (isEnabled) => {
    replyToGroups = Boolean(isEnabled);
    log('info', `[⚙ Settings] Group auto-reply was ${replyToGroups ? 'ENABLED' : 'DISABLED'} from dashboard.`);
    io.emit('settings_updated', { autoReplyEnabled, replyToGroups, autoReplyMessage });
  });

  // Clear logs request
  socket.on('clear_logs', () => {
    logs.length = 0;
  });
});

// ==========================================
// BROWSER AUTO-DETECTION (WINDOWS)
// ==========================================
function getChromeExecutablePath() {
  const candidatePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    (process.env.LOCALAPPDATA || '') + '\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];

  for (const p of candidatePaths) {
    if (p && fs.existsSync(p)) {
      return p;
    }
  }
  return undefined;
}

const chromePath = getChromeExecutablePath();
if (chromePath) {
  log('info', `[+] Browser detected at: ${chromePath}`);
} else {
  log('info', `[!] Using default Puppeteer browser.`);
}

// ==========================================
// WHATSAPP CLIENT INITIALIZATION
// ==========================================
log('info', 'Initializing WhatsApp Client...');

const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: './.wwebjs_auth'
  }),
  puppeteer: {
    headless: true,
    ...(chromePath ? { executablePath: chromePath } : {}),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  }
});

// ==========================================
// WHATSAPP EVENT LISTENERS
// ==========================================

// QR Code Event
client.on('qr', async (qr) => {
  botStatus = 'QR_READY';
  log('info', 'QR Code received! Scan it via WhatsApp on your phone.');

  // Print in terminal
  console.log('\n======================================================');
  console.log('Scan the QR Code below or open http://localhost:' + PORT);
  console.log('======================================================\n');
  qrcodeTerminal.generate(qr, { small: true });

  // Generate Data URL for Web UI
  try {
    qrCodeDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
    io.emit('qr', { qrCodeDataUrl });
    io.emit('status_change', { status: botStatus });
  } catch (err) {
    log('error', `[-] Error converting QR code: ${err.message}`);
  }
});

// Authenticated Event
client.on('authenticated', () => {
  botStatus = 'AUTHENTICATED';
  qrCodeDataUrl = null;
  log('success', '[+] Authentication successful! Saving session...');
  io.emit('status_change', { status: botStatus });
});

// Auth Failure Event
client.on('auth_failure', (msg) => {
  botStatus = 'DISCONNECTED';
  log('error', `[-] Authentication failure: ${msg}`);
  io.emit('status_change', { status: botStatus });
});

// Ready Event
client.on('ready', () => {
  botStatus = 'READY';
  qrCodeDataUrl = null;
  clientInfo = client.info || null;

  log('success', '======================================================');
  log('success', '[✓] WhatsApp Bot is READY and listening for messages!');
  log('success', '======================================================');

  io.emit('ready', { clientInfo });
  io.emit('status_change', { status: botStatus, clientInfo });
});

// Disconnected Event
client.on('disconnected', (reason) => {
  botStatus = 'DISCONNECTED';
  log('error', `[-] WhatsApp Client was disconnected: ${reason}`);
  io.emit('status_change', { status: botStatus });
});

// Incoming Message Listener
client.on('message', async (message) => {
  try {
    // Ignore status stories
    if (message.from === 'status@broadcast' || message.isStatus) {
      return;
    }

    const isGroup = message.from.endsWith('@g.us');
    if (isGroup && !replyToGroups) {
      return;
    }

    // Extract Sender Name and Number accurately
    let senderName = 'Unknown';
    let senderNumber = message.from.split('@')[0];

    try {
      const contact = await message.getContact();
      senderName = contact.pushname || contact.name || message._data.notifyName || 'Unknown';
      if (contact.number) {
        senderNumber = contact.number;
      } else if (contact.id && contact.id.user) {
        senderNumber = contact.id.user;
      }
      if (contact.formattedNumber) {
        senderNumber = contact.formattedNumber;
      }
    } catch (e) {
      senderName = message._data.notifyName || 'Unknown';
    }

    const messageText = message.body || '[Media / Non-text message]';

    // Update stats
    stats.totalMessages++;

    log('msg', `[📩 Incoming Message] From: ${senderName} (Number: ${senderNumber})`);
    log('msg', `[💬 Content]: ${messageText}`);

    let autoReplied = false;

    // Check if Auto-Reply is enabled from the Dashboard
    if (autoReplyEnabled) {
      await message.reply(autoReplyMessage);
      stats.autoRepliesSent++;
      autoReplied = true;
      log('bot', `[🤖 Auto-Reply Sent to ${senderName} (${senderNumber})]`);
    } else {
      log('info', `[⏸ Auto-reply is paused. Skipped replying to ${senderName}]`);
    }

    // Save in message history for dashboard
    const messageRecord = {
      id: (message.id && message.id._serialized) || Date.now().toString(),
      senderName,
      senderNumber,
      body: messageText,
      timestamp: Date.now(),
      isGroup,
      autoReplied
    };

    messages.unshift(messageRecord);
    if (messages.length > 50) messages.pop();

    // Broadcast to web frontend
    io.emit('new_message', messageRecord);
    io.emit('stats_updated', stats);

  } catch (error) {
    log('error', `[-] Error handling incoming message: ${error.message}`);
  }
});

// ==========================================
// START WEB SERVER & INITIALIZE CLIENT
// ==========================================
server.listen(PORT, () => {
  log('success', `[✓] Web Dashboard running at: http://localhost:${PORT}`);
  log('info', 'Starting WhatsApp Client...');
  client.initialize();
});
