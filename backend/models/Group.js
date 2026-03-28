import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  members: [{ type: String }],
  isGroup: { type: Boolean, default: true }
});

export default mongoose.model('Group', groupSchema);
