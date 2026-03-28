import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  passwordHash: { type: String, required: true },
  avatar: { type: String, default: '' },
  theme: { type: String, default: 'default' }
});

export default mongoose.model('User', userSchema);
