const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    role: { type: String, required: true, enum: ['system', 'user', 'assistant'] },
    content: { type: String, required: true }
}, { _id: false });

const conversationSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    characterName: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    messages: [messageSchema]
}, { timestamps: true });

module.exports = mongoose.model('Conversation', conversationSchema);