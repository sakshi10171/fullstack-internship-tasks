const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(express.static(path.join(__dirname, '../frontend')));

const users = {};
const avatarColors = ['#EAF3DE','#EEEDFE','#FAECE7','#FAEEDA','#E1F5EE','#E6F1FB'];
const textColors   = ['#27500A','#3C3489','#712B13','#633806','#085041','#0C447C'];
let colorIndex = 0;

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // 1. User joins
  socket.on('user_join', (username) => {
    const ci = colorIndex++ % avatarColors.length;
    users[socket.id] = {
      username,
      initials: username.slice(0, 2).toUpperCase(),
      bg: avatarColors[ci],
      color: textColors[ci]
    };
    io.emit('system_message', { text: `${username} joined the chat`, timestamp: getTime() });
    io.emit('user_list', Object.values(users));
    console.log(`${username} joined`);
  });

  // 2. Chat message
  socket.on('send_message', ({ text, fileData }) => {
    const user = users[socket.id];
    if (!user) return;
    io.emit('receive_message', {
      username: user.username, initials: user.initials,
      bg: user.bg, color: user.color,
      text, fileData: fileData || null,
      timestamp: getTime(), socketId: socket.id
    });
  });

  // 3. Typing
  socket.on('typing', (isTyping) => {
    const user = users[socket.id];
    if (!user) return;
    socket.broadcast.emit('user_typing', {
      username: user.username, initials: user.initials,
      bg: user.bg, color: user.color, isTyping
    });
  });

  // 4. Call started — broadcast to everyone else
  socket.on('start_call', (type) => {
    const caller = users[socket.id];
    if (!caller) return;
    console.log(`${caller.username} started a ${type} call`);
    socket.broadcast.emit('incoming_call', {
      type,
      callerName: caller.username,
      callerInitials: caller.initials,
      callerBg: caller.bg,
      callerColor: caller.color
    });
  });

  // 5. Call ended — broadcast to everyone else
  socket.on('end_call', () => {
    socket.broadcast.emit('call_ended');
  });

  // 6. Call declined
  socket.on('decline_call', () => {
    socket.broadcast.emit('call_declined');
  });

  // 7. Disconnect
  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (user) {
      delete users[socket.id];
      // If they disconnect during a call, end it for others
      socket.broadcast.emit('call_ended');
      io.emit('system_message', { text: `${user.username} left the chat`, timestamp: getTime() });
      io.emit('user_list', Object.values(users));
      console.log(`${user.username} disconnected`);
    }
  });
});

function getTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n✅ Server running → http://localhost:${PORT}\n`);
});
