# WhatsApp Auto-Reply Bot with Web Dashboard 🚀

A real-time WhatsApp automation bot and control center built with **Node.js**, **Express**, **Socket.IO**, **whatsapp-web.js**, and modern **Vanilla HTML/CSS/JS**.

---

## 🌟 Key Features

1. **🌐 Web Dashboard UI (`http://localhost:3000`)**:
   - **Live QR Code Display**: Direct on-screen scannable QR code if login is required.
   - **Connection Status**: Real-time status indicator showing your linked WhatsApp account name and phone number.
   - **Session Persistence (`LocalAuth`)**: Auto-saves your session locally in `.wwebjs_auth` so you don't need to scan every time.

2. **⚡ Auto-Reply Control & Settings**:
   - **Enable / Disable Toggle Switch**: Turn automated replies ON or OFF in real-time with one click from the browser.
   - **Customizable Message Editor**: Edit and save the auto-reply message text directly from the dashboard.
   - **Group Chat Toggle**: Option to enable/disable auto-replies in WhatsApp groups (disabled by default to prevent spam).

3. **📩 Live Incoming Messages Feed**:
   - Shows **Sender Display Name** (e.g. `Muhammad Shahid`).
   - Shows **Sender Phone Number** (e.g. `+92 300 xxxxxxx`).
   - Shows incoming message text and timestamp.
   - Displays status badge (`✓ Auto-Replied` or `Auto-Reply Disabled`).

4. **💻 Live Terminal Console Feed**:
   - Real-time mirrored stream of terminal logs directly inside the web UI.
   - Color-coded prefixes for incoming messages, auto-replies, and system events.
   - Auto-scroll lock and clear console button.

---

## 📋 The Auto-Reply Message (English)

> *"Hello! I am a WhatsApp agent and currently under development. Due to this, replies are currently limited to this automated response.*
> 
> *Please leave your message, and Sir will reply to you as soon as he is free. Thank you!"*

---

## 🚀 How to Run

1. Open your terminal in this directory:
   ```bash
   npm start
   ```
   *(or `node index.js`)*

2. Open the Web Dashboard in your browser:
   👉 **[http://localhost:3000](http://localhost:3000)**

3. If not already authenticated:
   - Scan the QR code shown on the screen with your WhatsApp camera (**Linked Devices > Link a Device**).

4. Once connected:
   - You will see **"WhatsApp Connected & Active!"** with your linked account name and number.
   - Toggle the **Auto-Reply** switch whenever you want to enable or pause automated replies.
   - All incoming messages will appear in the **Incoming Messages** feed with their sender name & number!
