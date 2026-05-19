require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const setupSocket = require('./socket/socketHandler');

// Generate a FRESH secret every time the server starts
// This means all old tokens (from before restart) become invalid
// and users must log in again — exactly what we want
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your_super_secret_jwt_key_change_this_in_production') {
  process.env.JWT_SECRET = crypto.randomBytes(64).toString('hex');
  console.log('Generated fresh JWT secret for this session');
} else {
  // Even if JWT_SECRET is set in .env, append a random suffix so it changes each restart
  process.env.JWT_SECRET = process.env.JWT_SECRET + '_' + crypto.randomBytes(16).toString('hex');
  console.log('JWT secret refreshed for this server session');
}

const app = express();
const server = http.createServer(app);

connectDB();

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});
setupSocket(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});