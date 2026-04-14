const mongoose = require('mongoose');

const dashboardAccessSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true, index: true },
    collaboratorIds: {
        type: [String],
        default: []
    },
    updatedBy: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('DashboardAccess', dashboardAccessSchema);
