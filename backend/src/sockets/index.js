import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { corsOptions } from '../config/cors.js';

let io;
const connections = new Map();
const lastSeen = new Map();

export function presenceOf(userId) {
  const id = String(userId);
  const online = (connections.get(id) || 0) > 0;
  return { online, lastSeen: online ? null : (lastSeen.get(id) || null) };
}

export function onlineUserIds() {
  return [...connections.entries()].filter(([, count]) => count > 0).map(([id]) => id);
}

function changePresence(userId, connected) {
  const id = String(userId);
  const count = connections.get(id) || 0;
  if (connected) {
    connections.set(id, count + 1);
    if (count === 0) io?.emit('presence', { userId: id, online: true, lastSeen: null });
    return;
  }
  const next = count - 1;
  if (next > 0) {
    connections.set(id, next);
    return;
  }
  connections.delete(id);
  const seen = new Date().toISOString();
  lastSeen.set(id, seen);
  io?.emit('presence', { userId: id, online: false, lastSeen: seen });
}

export function initSocket(server) {
  io = new Server(server, {
    cors: corsOptions,
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = String(payload.id);
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);
    changePresence(socket.userId, true);
    socket.emit('presence:snapshot', { online: onlineUserIds() });
    socket.on('disconnect', () => changePresence(socket.userId, false));
    socket.on('chat:typing', (payload) => {
      const to = String(payload?.to || '');
      if (!/^[a-f0-9]{24}$/i.test(to) || to === socket.userId) return;
      emitToUser(to, 'chat:typing', { from: socket.userId });
    });
  });

  return io;
}

export function emitToUser(userId, event, payload) {
  io?.to(`user:${userId}`).emit(event, payload);
}
