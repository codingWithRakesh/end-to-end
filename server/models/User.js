import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    userId: { type: String, unique: true },
    publicKey: { type: String }
});

export const User = mongoose.model('User', userSchema);
