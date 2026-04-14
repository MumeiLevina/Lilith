const DashboardAccess = require('../models/dashboardAccess');
const { hasDjPermission } = require('./music');

function isDiscordSnowflake(value) {
    return typeof value === 'string' && /^\d{17,20}$/.test(value.trim());
}

function normalizeUserId(userId) {
    if (!isDiscordSnowflake(userId)) return null;
    return userId.trim();
}

function normalizeCollaboratorIds(collaboratorIds) {
    if (!Array.isArray(collaboratorIds)) return [];

    const unique = new Set();
    collaboratorIds.forEach(id => {
        const normalizedId = normalizeUserId(id);
        if (normalizedId) unique.add(normalizedId);
    });

    return [...unique];
}

async function getCollaboratorSetByGuildIds(guildIds) {
    const validGuildIds = Array.isArray(guildIds)
        ? guildIds.filter(id => isDiscordSnowflake(id))
        : [];

    if (!validGuildIds.length) return new Map();

    const docs = await DashboardAccess.find({ guildId: { $in: validGuildIds } })
        .lean()
        .exec();

    const map = new Map();
    for (const doc of docs) {
        map.set(doc.guildId, new Set(normalizeCollaboratorIds(doc.collaboratorIds)));
    }
    return map;
}

async function getCollaboratorIds(guildId) {
    if (!isDiscordSnowflake(guildId)) return [];

    const doc = await DashboardAccess.findOne({ guildId: guildId.trim() })
        .lean()
        .exec();

    return normalizeCollaboratorIds(doc?.collaboratorIds);
}

async function hasDashboardAccess(member, guildId) {
    if (!member || !isDiscordSnowflake(guildId)) return false;
    if (hasDjPermission(member)) return true;

    const normalizedUserId = normalizeUserId(member.id);
    if (!normalizedUserId) return false;

    const collaboratorIds = await getCollaboratorIds(guildId);
    return collaboratorIds.includes(normalizedUserId);
}

async function addDashboardCollaborator(guildId, userId, updatedBy = null) {
    const normalizedGuildId = isDiscordSnowflake(guildId) ? guildId.trim() : null;
    const normalizedUserId = normalizeUserId(userId);

    if (!normalizedGuildId || !normalizedUserId) {
        throw new Error('Guild ID hoặc User ID không hợp lệ.');
    }

    await DashboardAccess.findOneAndUpdate(
        { guildId: normalizedGuildId },
        {
            $addToSet: { collaboratorIds: normalizedUserId },
            $set: { updatedBy: normalizeUserId(updatedBy) }
        },
        {
            upsert: true,
            setDefaultsOnInsert: true,
            new: true
        }
    ).exec();

    return getCollaboratorIds(normalizedGuildId);
}

async function removeDashboardCollaborator(guildId, userId, updatedBy = null) {
    const normalizedGuildId = isDiscordSnowflake(guildId) ? guildId.trim() : null;
    const normalizedUserId = normalizeUserId(userId);

    if (!normalizedGuildId || !normalizedUserId) {
        throw new Error('Guild ID hoặc User ID không hợp lệ.');
    }

    const updated = await DashboardAccess.findOneAndUpdate(
        { guildId: normalizedGuildId },
        {
            $pull: { collaboratorIds: normalizedUserId },
            $set: { updatedBy: normalizeUserId(updatedBy) }
        },
        { new: true }
    ).exec();

    if (!updated?.collaboratorIds?.length) {
        await DashboardAccess.deleteOne({ guildId: normalizedGuildId }).exec();
        return [];
    }

    return normalizeCollaboratorIds(updated.collaboratorIds);
}

module.exports = {
    addDashboardCollaborator,
    getCollaboratorIds,
    getCollaboratorSetByGuildIds,
    hasDashboardAccess,
    removeDashboardCollaborator
};
