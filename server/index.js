import express from 'express';
import cors from 'cors';
import { connectDB } from './db.js';
import dotenv from 'dotenv';
import { User } from './models/User.js';
import { GroupMessage } from './models/GroupMessage.js';
import PrivateKey from './models/PrivateKeys.js';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

connectDB();

app.post('/api/save-public-key', async (req, res) => {
    const { userId, publicKey } = req.body;
    const existingUser = await User.findOne({ userId });
    if (!existingUser) {
        await User.create(
            { userId, publicKey },
        );
    }
    res.json({ message: 'Public key saved' });
});

app.get('/api/public-keys', async (req, res) => {
    const users = await User.find({});
    const keys = {};
    users.forEach(u => (keys[u.userId] = u.publicKey));
    res.json(keys);
});

app.post('/api/send-group-message', async (req, res) => {
    const { senderId, groupId, encryptedMessages } = req.body;
    console.log('Received group message:', { senderId, groupId, encryptedMessages });

    const newMessage = new GroupMessage({
        groupId,
        senderId,
        encryptedMessages
    });

    await newMessage.save();

    res.json({ message: 'Group message stored in MongoDB' });
});

app.get('/api/get-group-messages', async (req, res) => {
    const { groupId } = req.query;
    const messages = await GroupMessage.find({ groupId });
    res.json(messages);
});

app.post('/api/save-private-key', async (req, res) => {
    const { userId, privateKey } = req.body;

    const existingKey = await PrivateKey.findOne({ userId });
    if (!existingKey) {
        await PrivateKey.create(
            { userId, privateKey },
        );
    }
    res.json({ message: 'Private key saved' });
});


app.get('/api/get-private-key', async (req, res) => {
    const { userId } = req.query;
    const record = await PrivateKey.findOne({ userId });
    if (record) {
        res.status(200).json({ privateKey: record.privateKey });
    } else {
        res.status(404).json({ message: 'Private key not found' })
    }
});

app.get('/api/get-public-key', async (req, res) => {
    const { userId } = req.query;
    const user = await User.findOne({ userId });
    if (user) {
        res.status(200).json({ publicKey: user.publicKey });
    } else {
        res.status(404).json({ message: 'Public key not found' });
    }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
