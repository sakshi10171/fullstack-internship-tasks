// Import required modules
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Create express app and HTTP server
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO server with CORS configuration
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Store connected users
const users = {};

// Avatar background and text colors
const avatarColors = ['#EAF3DE','#EEEDFE','#FAECE7','#FAEEDA','#E1F5EE','#E6F1FB'];
const textColors   = ['#27500A','#3C3489','#712B13','#633806','#085041','#0C447C'];

let colorIndex = 0;

// Handle socket connection
io.on('connection', (socket) => {

  console.log(`Socket connected: ${socket.id}`);

  // Handle user joining the chat
  socket.on('user_join', (username) => {

    // Assign avatar color to user
    const ci = colorIndex++ % avatarColors.length;

    // Store user details
    users[socket.id] = {
      username,
      initials: username.slice(0, 2).toUpperCase(),
      bg: avatarColors[ci],
      color: textColors[ci]
    };

    // Notify all users that a new user joined
    io.emit('system_message', {
      text: `${username} joined the chat`,
      timestamp: getTime()
    });

    // Send updated user list
    io.emit('user_list', Object.values(users));

    console.log(`${username} joined`);
  });

  // Handle chat messages
  socket.on('send_message', ({ text, fileData }) => {

    const user = users[socket.id];

    if (!user) return;

    // Broadcast message to all connected users
    io.emit('receive_message', {
      username: user.username,
      initials: user.initials,
      bg: user.bg,
      color: user.color,
      text,
      fileData: fileData || null,
      timestamp: getTime(),
      socketId: socket.id
    });
  });

  // Handle typing indicator
  socket.on('typing', (isTyping) => {

    const user = users[socket.id];

    if (!user) return;

    // Notify other users about typing status
    socket.broadcast.emit('user_typing', {
      username: user.username,
      initials: user.initials,
      bg: user.bg,
      color: user.color,
      isTyping
    });
  });

  // Handle call start event
  socket.on('start_call', (type) => {

    const caller = users[socket.id];

    if (!caller) return;

    console.log(`${caller.username} started a ${type} call`);

    // Notify other users about incoming call
    socket.broadcast.emit('incoming_call', {
      type,
      callerName: caller.username,
      callerInitials: caller.initials,
      callerBg: caller.bg,
      callerColor: caller.color
    });
  });

  // Handle call end event
  socket.on('end_call', () => {

    // Notify all users that call has ended
    socket.broadcast.emit('call_ended');
  });

  // Handle declined call event
  socket.on('decline_call', () => {

    socket.broadcast.emit('call_declined');
  });

  // Handle user disconnect
  socket.on('disconnect', () => {

    const user = users[socket.id];

    if (user) {

      // Remove disconnected user
      delete users[socket.id];

      // End active calls for remaining users
      socket.broadcast.emit('call_ended');

      // Notify users that someone left the chat
      io.emit('system_message', {
        text: `${user.username} left the chat`,
        timestamp: getTime()
      });

      // Update user list
      io.emit('user_list', Object.values(users));

      console.log(`${user.username} disconnected`);
    }
  });
});

// Function to get current time
function getTime() {
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Set server port
const PORT = process.env.PORT || 3000;

// Start server
server.listen(PORT, () => {
  console.log(`\n✅ Server running → http://localhost:${PORT}\n`);
});
