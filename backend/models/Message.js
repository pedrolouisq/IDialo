import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  from: { type: String, required: true },
  to: { type: String, required: true },
  text: { type: String, default: '' },
  image: { type: String, default: null },
  audio: { type: String, default: null },
  replyTo: { type: String, default: null },
  reactions: { type: Map, of: String, default: {} },
  timestamp: { type: Number, default: Date.now }
});

export default mongoose.model('Message', messageSchema);
