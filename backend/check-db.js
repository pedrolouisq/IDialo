import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';
dns.setServers(['8.8.8.8']);
dotenv.config();

import Message from './models/Message.js';
import User from './models/User.js';

await mongoose.connect(process.env.MONGO_URI);
console.log("Conectado.");

const users = await User.find({});
console.log("Usuarios:", users.map(u => u.id));

const messages = await Message.find({});
console.log("Total mensajes en DB:", messages.length);
if (messages.length > 0) {
    console.log("Último mensaje:", messages[messages.length-1]);
}

process.exit(0);
