import mongoose from 'mongoose';

const groupMessageSchema = new mongoose.Schema({
    groupId: String,
    senderId: String,
    encryptedMessages: Object,  // { receiverId: encryptedBase64 }
    createdAt: { type: Date, default: Date.now }
});

export const GroupMessage = mongoose.model('GroupMessage', groupMessageSchema);
