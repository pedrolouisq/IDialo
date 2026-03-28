import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dns from 'dns';

import User from './models/User.js';
import Group from './models/Group.js';
import Message from './models/Message.js';

// Fix for SRV DNS resolution issues on some networks
dns.setServers(['8.8.8.8', '1.1.1.1']);

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }
});

app.use(cors());
app.use(express.json({ limit: '20mb' }));

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_chat_key_123';
const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("FATAL ERROR: MONGO_URI is not defined in .env");
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Cloud Conectado Exitosamente'))
  .catch(err => console.error('Error conectando a MongoDB', err));

function generateRandomId() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Rutas API
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Faltan datos' });

    let newId;
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      newId = `${username.toLowerCase()}#${generateRandomId()}`;
      const existing = await User.findOne({ id: newId });
      if (!existing) isUnique = true;
      attempts++;
    }

    if (!isUnique) return res.status(500).json({ error: 'No se pudo generar ID único' });

    const passwordHash = await bcrypt.hash(password, 10);
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(newId)}&background=random`;
    
    const newUser = new User({ id: newId, username, passwordHash, avatar: avatarUrl, theme: 'default' });
    await newUser.save();

    res.json({ message: 'Usuario registrado', user: { id: newUser.id, username: newUser.username, avatar: newUser.avatar, theme: newUser.theme } });
  } catch(err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username: { $regex: new RegExp('^' + username + '$', 'i') } });
    
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return res.status(401).json({ error: 'Credenciales inválidas' });

    if (!user.avatar) {
      user.avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.id)}&background=random`;
      await user.save();
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username, avatar: user.avatar, theme: user.theme || 'default' } });
  } catch(err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'ID requerido' });
    
    if (id.includes('@')) {
      const group = await Group.findOne({ id: { $regex: new RegExp('^' + id + '$', 'i') } });
      if (!group) return res.status(404).json({ error: 'Grupo no encontrado' });
      return res.json({ user: { id: group.id, username: group.name, isGroup: true } });
    }

    const user = await User.findOne({ id: { $regex: new RegExp('^' + id + '$', 'i') } });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    res.json({ user: { id: user.id, username: user.username, avatar: user.avatar, theme: user.theme || 'default' } });
  } catch(err) {
    res.status(500).json({ error: 'Error buscando ID' });
  }
});

app.post('/api/groups', async (req, res) => {
  try {
    const { name, creatorId } = req.body;
    const groupId = `${name.replace(/\s+/g, '').toLowerCase()}@${generateRandomId()}`;
    const group = new Group({ id: groupId, name, members: [creatorId], isGroup: true });
    await group.save();
    
    res.json({ group: { id: group.id, name: group.name, members: group.members, isGroup: true } });
  } catch(err) {
    res.status(500).json({ error: 'Error creando grupo' });
  }
});

app.post('/api/groups/join', async (req, res) => {
  try {
    const { groupId, userId } = req.body;
    const group = await Group.findOne({ id: groupId });
    if (!group) return res.status(404).json({ error: 'Grupo no encontrado' });
    
    if (!group.members.includes(userId)) {
      group.members.push(userId);
      await group.save();
    }
    res.json({ group });
  } catch(err) {
    res.status(500).json({ error: 'Error uniéndose al grupo' });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const { username, avatar, theme } = req.body;
    const user = await User.findOne({ id: req.params.id });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    if (username) user.username = username;
    if (avatar) user.avatar = avatar;
    if (theme) user.theme = theme;
    await user.save();
    
    io.emit('user_updated', { id: user.id, username: user.username, avatar: user.avatar, theme: user.theme });
    res.json({ message: 'Perfil actualizado', user: { id: user.id, username: user.username, avatar: user.avatar, theme: user.theme } });
  } catch(err) {
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

app.put('/api/groups/:id', async (req, res) => {
  try {
    const { name } = req.body;
    const group = await Group.findOne({ id: req.params.id });
    if (!group) return res.status(404).json({ error: 'Grupo no encontrado' });
    
    if (name) group.name = name;
    await group.save();
    
    io.emit('group_updated', { id: group.id, name: group.name });
    res.json({ message: 'Grupo actualizado', group });
  } catch(err) {
    res.status(500).json({ error: 'Error actualizando grupo' });
  }
});

app.get('/api/groups/:id/members', async (req, res) => {
  try {
    const group = await Group.findOne({ id: req.params.id });
    if (!group) return res.status(404).json({ error: 'Grupo no encontrado' });
    
    const memberProfiles = await Promise.all(group.members.map(async (memberId) => {
      const u = await User.findOne({ id: memberId });
      return u ? { id: u.id, username: u.username, avatar: u.avatar } : { id: memberId, username: memberId, avatar: '' };
    }));
    res.json({ members: memberProfiles });
  } catch(err) {
    res.status(500).json({ error: 'Error al listar miembros' });
  }
});

app.get('/api/messages/:targetId', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token' });
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const myId = decoded.id;
    const targetId = req.params.targetId;
    
    let chatHistory;
    if (targetId.includes('@')) {
      chatHistory = await Message.find({ to: targetId });
    } else {
      chatHistory = await Message.find({
        $or: [
          { from: myId, to: targetId },
          { from: targetId, to: myId }
        ]
      }).sort({ timestamp: 1 });
    }
    
    res.json(chatHistory.map(m => m.toObject()));
  } catch (err) {
    res.status(401).json({ error: 'Token inválido' });
  }
});

app.delete('/api/messages/:targetId', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token' });
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const myId = decoded.id;
    const targetId = req.params.targetId;
    
    if (targetId.includes('@')) {
      // In groups, only the creator or all? Let's say anyone for simplicity now
      await Message.deleteMany({ to: targetId });
    } else {
      await Message.deleteMany({
        $or: [
          { from: myId, to: targetId },
          { from: targetId, to: myId }
        ]
      });
    }
    
    res.json({ message: 'Chat eliminado' });
  } catch (err) {
    res.status(401).json({ error: 'Token inválido' });
  }
});


// Socket.IO
const connectedUsers = new Map(); // socket.id -> userId
const userSockets = new Map(); // userId -> socket.id

function broadcastOnlineUsers() {
  const onlineIds = Array.from(userSockets.keys());
  io.emit('online_users', onlineIds);
}

io.on('connection', (socket) => {
  socket.on('authenticate', async (token) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      connectedUsers.set(socket.id, decoded.id);
      userSockets.set(decoded.id, socket.id);
      
      broadcastOnlineUsers();
      
      const groups = await Group.find({ members: decoded.id });
      groups.forEach(g => {
        socket.join(g.id);
      });
    } catch (err) {
      socket.emit('auth_error', 'Token inválido');
    }
  });

  socket.on('join_group_room', (groupId) => {
    socket.join(groupId);
  });

  socket.on('typing', ({ to }) => {
    const from = connectedUsers.get(socket.id);
    if (!from) return;
    if (to.includes('@')) {
      socket.to(to).emit('typing', { from, to });
    } else {
      const toSocketId = userSockets.get(to);
      if (toSocketId) io.to(toSocketId).emit('typing', { from, to });
    }
  });

  socket.on('stop_typing', ({ to }) => {
    const from = connectedUsers.get(socket.id);
    if (!from) return;
    if (to.includes('@')) {
      socket.to(to).emit('stop_typing', { from, to });
    } else {
      const toSocketId = userSockets.get(to);
      if (toSocketId) io.to(toSocketId).emit('stop_typing', { from, to });
    }
  });

  socket.on('call_offer', ({ to, offer }) => {
    const from = connectedUsers.get(socket.id);
    const toSocketId = userSockets.get(to);
    if (toSocketId) io.to(toSocketId).emit('call_offer', { from, offer });
  });

  socket.on('call_answer', ({ to, answer }) => {
    const from = connectedUsers.get(socket.id);
    const toSocketId = userSockets.get(to);
    if (toSocketId) io.to(toSocketId).emit('call_answer', { from, answer });
  });

  socket.on('ice_candidate', ({ to, candidate }) => {
    const from = connectedUsers.get(socket.id);
    const toSocketId = userSockets.get(to);
    if (toSocketId) io.to(toSocketId).emit('ice_candidate', { from, candidate });
  });

  socket.on('call_end', ({ to }) => {
    const from = connectedUsers.get(socket.id);
    const toSocketId = userSockets.get(to);
    if (toSocketId) io.to(toSocketId).emit('call_end', { from });
  });

  socket.on('send_message', async (data) => {
    const myId = connectedUsers.get(socket.id);
    if (!myId) return socket.emit('error', 'No autenticado');
    
    const { to, text, image, audio, replyTo } = data;
    try {
      const message = new Message({
        id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
        from: myId,
        to,
        text: text || '',
        image: image || null,
        audio: audio || null,
        replyTo: replyTo || null,
        reactions: {},
        timestamp: Date.now()
      });
      
      await message.save();
      const msgObj = message.toObject();

      if (to.includes('@')) {
         io.to(to).emit('receive_message', msgObj);
      } else {
         socket.emit('receive_message', msgObj);
         const toSocketId = userSockets.get(to);
         if (toSocketId && toSocketId !== socket.id) {
           io.to(toSocketId).emit('receive_message', msgObj);
         }
      }
    } catch(err) {
      console.error("Error al guardar mensaje:", err);
    }
  });

  socket.on('react_message', async ({ msgId, emoji }) => {
    const myId = connectedUsers.get(socket.id);
    if (!myId) return;

    try {
      const msg = await Message.findOne({ id: msgId });
      if (!msg) return;

      const currentReactions = msg.reactions || new Map();
      if (currentReactions.get(myId) === emoji) {
        currentReactions.delete(myId);
      } else {
        currentReactions.set(myId, emoji);
      }
      msg.reactions = currentReactions;
      await msg.save();

      io.emit('message_updated', msg.toObject());
    } catch(err) {
      console.error("Error en reaccion:", err);
    }
  });

  socket.on('disconnect', () => {
    const userId = connectedUsers.get(socket.id);
    if (userId) {
      userSockets.delete(userId);
      connectedUsers.delete(socket.id);
      broadcastOnlineUsers();
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Servidor de Producción Backend corriendo en el puerto ${PORT}`);
});
