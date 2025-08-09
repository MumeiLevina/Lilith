const mongoose = require('mongoose');

const characterProfileSchema = new mongoose.Schema({
    name: { type: String, required: true },
    personality: { type: String, required: true },
    appearance: { type: String, required: true }
});

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    defaultCharacterName: { type: String, default: 'Lilith' },
    characterProfiles: [characterProfileSchema],
    preferredLanguage: { type: String, enum: ['Vietnamese', 'English'], default: 'Vietnamese' },
    customBotPersonality: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);