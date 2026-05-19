# CollabDocs — Real-Time Collaborative Document Editor
### CodTech Internship Task 3 — Full Stack Project

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React.js, React Router, Socket.io-client |
| Backend | Node.js, Express.js |
| Real-time | Socket.io (WebSocket) |
| Database | MongoDB (Mongoose ODM) |
| Auth | JWT (JSON Web Tokens), bcryptjs |

---

## Project Structure

```
collab-editor/
├── server/                    # Node.js + Express backend
│   ├── config/
│   │   └── db.js              # MongoDB connection
│   ├── middleware/
│   │   └── auth.js            # JWT authentication middleware
│   ├── models/
│   │   ├── User.js            # User schema (name, email, password, color)
│   │   └── Document.js        # Document schema (title, content, collaborators)
│   ├── routes/
│   │   ├── auth.js            # POST /register, POST /login, GET /me
│   │   └── documents.js       # CRUD + share + collaborators endpoints
│   ├── socket/
│   │   └── socketHandler.js   # Real-time Socket.io event handlers
│   ├── .env.example           # Environment variables template
│   ├── index.js               # Server entry point
│   └── package.json
│
├── client/                    # React frontend
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── Toolbar.js     # Rich text formatting toolbar
│   │   │   ├── Toolbar.css
│   │   │   ├── ShareModal.js  # Share / invite collaborators modal
│   │   │   └── ShareModal.css
│   │   ├── context/
│   │   │   └── AuthContext.js # Global auth state (login, register, logout)
│   │   ├── hooks/
│   │   │   └── useSocket.js   # Reusable socket hook
│   │   ├── pages/
│   │   │   ├── AuthPage.js    # Login / Register
│   │   │   ├── Auth.css
│   │   │   ├── Dashboard.js   # Document list / home
│   │   │   ├── Dashboard.css
│   │   │   ├── EditorPage.js  # Real-time document editor
│   │   │   └── Editor.css
│   │   ├── App.js             # Routes (public + private)
│   │   ├── index.js
│   │   └── index.css
│   └── package.json
│
├── package.json               # Root: run both servers together
└── README.md
```

---

## Setup Instructions

### Prerequisites
- Node.js v16+
- MongoDB (local install or MongoDB Atlas free tier)
- npm

---

### Step 1 — Clone / extract the project

```bash
cd collab-editor
```

### Step 2 — Install all dependencies

```bash
npm run install-all
```

Or manually:
```bash
npm install
cd server && npm install
cd ../client && npm install
```

### Step 3 — Configure environment variables

```bash
cd server
cp .env.example .env
```

Edit `server/.env`:
```
PORT=5000
MONGO_URI=mongodb://localhost:27017/collabeditor
JWT_SECRET=choose_a_long_random_secret_string
CLIENT_URL=http://localhost:3000
```

**MongoDB Atlas** (cloud, free):
1. Go to https://cloud.mongodb.com → create free cluster
2. Get connection string → replace MONGO_URI with it

### Step 4 — Run the project

```bash
# From root directory — starts both backend and frontend
npm run dev
```

- Backend runs on: http://localhost:5000
- Frontend runs on: http://localhost:3000

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login, returns JWT |
| GET | /api/auth/me | Get current user |

### Documents
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/documents | Get all user's docs |
| POST | /api/documents | Create new document |
| GET | /api/documents/:id | Get single document |
| PUT | /api/documents/:id | Update title / content |
| DELETE | /api/documents/:id | Delete document |
| POST | /api/documents/:id/share | Generate share link |
| POST | /api/documents/:id/collaborators | Add collaborator by email |

---

## Socket.io Events

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| join-document | { documentId, token } | Join a document room |
| send-changes | { documentId, content } | Broadcast content changes |
| save-document | { documentId, content, title } | Persist to MongoDB |
| title-change | { documentId, title } | Broadcast title update |
| cursor-move | { documentId, position } | Share cursor position |

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| load-document | { content, title, version } | Initial document load |
| receive-changes | { content, from } | Remote user's changes |
| title-updated | { title, from } | Title changed by another user |
| active-users | [ ...users ] | Current users in document |
| user-joined | { user, message } | User joined notification |
| user-left | { user, message } | User left notification |
| document-saved | { savedAt } | Confirm save to DB |

---

## Features

- **Authentication** — Register, login, JWT-protected routes
- **Real-time editing** — Multiple users edit simultaneously via WebSocket
- **Rich text toolbar** — Bold, italic, underline, font size, color, lists, links, undo/redo
- **Auto-save** — Debounced save to MongoDB every 1.5 seconds
- **Live collaborators** — See who's online with colored avatars
- **Activity feed** — Track edits, joins, and leaves in real time
- **Document management** — Create, rename, delete documents
- **Share & invite** — Generate share link or invite by email
- **Responsive** — Works on desktop and mobile

---

## Screenshots (Pages)

1. **Login / Register** — `/auth`
2. **Dashboard** — `/` — list of your documents
3. **Editor** — `/document/:id` — real-time collaborative editing

---

## Submission Checklist (CodTech Task 3)

- [x] React.js frontend with dynamic, responsive UI
- [x] Node.js backend with Express framework
- [x] MongoDB for data storage
- [x] Socket.io for real-time collaboration
- [x] JWT authentication
- [x] Multiple collaborators with live presence
- [x] Rich text document editor
