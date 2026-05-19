const Document = require('../models/Document');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const activeRooms = new Map();

const authenticateSocket = async (token) => {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    return user || null;
  } catch (err) {
    console.error('Socket JWT error:', err.message);
    return null;
  }
};

const setupSocket = (io) => {
  io.on('connection', (socket) => {
    const handshakeToken = socket.handshake.auth?.token || null;

    socket.on('join-document', async ({ documentId, token }) => {
      const resolvedToken = token || handshakeToken;
      const user = await authenticateSocket(resolvedToken);

      if (!user) {
        socket.emit('auth-error', { message: 'Session expired. Please log in again.' });
        return;
      }

      try {
        const doc = await Document.findById(documentId);

        if (!doc) {
          socket.emit('error', { message: 'Document not found.' });
          return;
        }

        const isOwner = doc.owner.toString() === user._id.toString();
        const isCollaborator = doc.collaborators.some(
          (c) => c.user.toString() === user._id.toString()
        );

        if (!isOwner && !isCollaborator && !doc.isPublic) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        socket.join(documentId);
        socket.currentRoom = documentId;
        socket.currentUser = {
          userId: user._id.toString(),
          name: user.name,
          color: user.color,
          socketId: socket.id,
        };

        if (!activeRooms.has(documentId)) activeRooms.set(documentId, new Map());
        activeRooms.get(documentId).set(socket.id, socket.currentUser);

        socket.emit('load-document', { content: doc.content, title: doc.title });

        const users = Array.from(activeRooms.get(documentId).values());
        io.to(documentId).emit('active-users', users);

        socket.to(documentId).emit('user-joined', {
          user: socket.currentUser,
          message: `${user.name} joined the document`,
        });

      } catch (err) {
        console.error('join-document error:', err);
        socket.emit('error', { message: 'Server error loading document' });
      }
    });

    socket.on('send-changes', ({ documentId, content }) => {
      socket.to(documentId).emit('receive-changes', { content, from: socket.currentUser });
    });

    socket.on('save-document', async ({ documentId, content, title }) => {
      if (!socket.currentUser) return;
      try {
        await Document.findByIdAndUpdate(documentId, {
          content, title,
          lastEditedBy: socket.currentUser.userId,
          updatedAt: Date.now(),
        });
        socket.emit('document-saved', { savedAt: new Date().toISOString() });
      } catch (err) {
        console.error('save-document error:', err);
      }
    });

    socket.on('title-change', ({ documentId, title }) => {
      socket.to(documentId).emit('title-updated', { title, from: socket.currentUser });
    });

    socket.on('disconnect', () => {
      const room = socket.currentRoom;
      if (room && activeRooms.has(room)) {
        activeRooms.get(room).delete(socket.id);
        if (activeRooms.get(room).size === 0) {
          activeRooms.delete(room);
        } else {
          io.to(room).emit('active-users', Array.from(activeRooms.get(room).values()));
        }
        if (socket.currentUser) {
          socket.to(room).emit('user-left', {
            user: socket.currentUser,
            message: `${socket.currentUser.name} left the document`,
          });
        }
      }
    });
  });
};

module.exports = setupSocket;