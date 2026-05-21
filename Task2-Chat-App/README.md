# LiveChat — Real-Time Chat App
**Stack:** Node.js · Express · Socket.IO · HTML/CSS/JS

---

## Project Structure

```
livechat/
├── backend/
│   ├── server.js       ← Node.js server (Socket.IO)
│   └── package.json    ← Dependencies
└── frontend/
    └── index.html      ← Complete chat UI
```

---

## How to Run

### Step 1 — Install Node.js
Download from https://nodejs.org (choose LTS)

### Step 2 — Install dependencies
```bash
cd backend
npm install
```

### Step 3 — Start the server
```bash
npm start
```
Terminal shows: `✅ Server running → http://localhost:3000`

### Step 4 — Open in browser
Go to → **http://localhost:3000**

Open **2 or 3 tabs**, enter different names, and chat in real-time!

---

## Socket Events (for presentation)

| Event | Who sends it | What it does |
|---|---|---|
| `user_join` | Client → Server | Registers your username |
| `send_message` | Client → Server | Sends a chat message |
| `typing` | Client → Server | Typing on/off indicator |
| `receive_message` | Server → All clients | Broadcasts message to everyone |
| `system_message` | Server → All clients | Join/leave notifications |
| `user_list` | Server → All clients | Updates online users list |
