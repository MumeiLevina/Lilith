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
    customBotPersonality: { type: String, default: '' },
    
    // Cài đặt phong cách phản hồi
    responseStyle: {
        length: { type: String, enum: ['short', 'medium', 'long', 'poetic'], default: 'poetic' },
        poeticLevel: { type: Number, min: 1, max: 5, default: 5 }, // 1: thường, 5: rất thơ mộng
        detailLevel: { type: Number, min: 1, max: 5, default: 5 }, // 1: ngắn gọn, 5: chi tiết rất cao
        metaphorUsage: { type: Boolean, default: true }, // Có sử dụng ẩn dụ không
        paragraphCount: { type: Number, min: 1, max: 10, default: 5 } // Số đoạn văn mong muốn
    }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);