const { PermissionsBitField, MessageFlags } = require('discord.js');

const DJ_ROLE_NAME = process.env.DJ_ROLE_NAME || 'DJ';
const DJ_ROLE_ID = process.env.DJ_ROLE_ID;

function hasDjPermission(member) {
    if (!member) return false;

    if (
        member.permissions?.has(PermissionsBitField.Flags.Administrator) ||
        member.permissions?.has(PermissionsBitField.Flags.ManageGuild)
    ) {
        return true;
    }

    if (!member.roles?.cache) return false;

    if (DJ_ROLE_ID && member.roles.cache.has(DJ_ROLE_ID)) {
        return true;
    }

    return member.roles.cache.some(role => role.name?.toLowerCase() === DJ_ROLE_NAME.toLowerCase());
}

async function ensureDjPermission(interaction) {
    if (hasDjPermission(interaction.member)) {
        return true;
    }

    await interaction.reply({
        content: `Bạn cần role **${DJ_ROLE_NAME}** (hoặc quyền quản trị) để dùng lệnh này.`,
        ephemeral: true
    });
    return false;
}

async function ensureMusicReady(interaction) {
    if (interaction.client.musicReady) return true;

    if (interaction.deferred || interaction.replied) {
        await interaction.deleteReply().catch((deleteError) => {
            // Ignore "Unknown Message" if the deferred placeholder was already removed.
            if (deleteError?.code !== 10008) {
                console.error('Failed to remove deferred music readiness reply:', deleteError);
            }
        });
        await interaction.followUp({
            content: 'Tính năng nhạc chưa sẵn sàng. Vui lòng thử lại sau vài giây.',
            flags: MessageFlags.Ephemeral
        });
    } else {
        await interaction.reply({
            content: 'Tính năng nhạc chưa sẵn sàng. Vui lòng thử lại sau vài giây.',
            flags: MessageFlags.Ephemeral
        });
    }
    return false;
}

async function ensureSameVoiceChannel(interaction, actionText = 'dùng lệnh này') {
    const memberChannelId = interaction.member?.voice?.channelId;
    const botChannelId = interaction.guild?.members.me?.voice?.channelId;

    if (!memberChannelId) {
        await interaction.reply({
            content: 'Bạn cần vào voice channel trước.',
            ephemeral: true
        });
        return false;
    }

    if (botChannelId && memberChannelId !== botChannelId) {
        await interaction.reply({
            content: `Bạn cần ở cùng voice channel với bot để ${actionText}.`,
            ephemeral: true
        });
        return false;
    }

    return true;
}

module.exports = {
    ensureDjPermission,
    ensureMusicReady,
    ensureSameVoiceChannel,
    hasDjPermission
};
