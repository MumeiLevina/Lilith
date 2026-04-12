const { SlashCommandBuilder } = require('discord.js');
const { ensureDjPermission, ensureMusicReady, ensureSameVoiceChannel } = require('../utils/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Tiếp tục phát nhạc')
        .setDMPermission(false),

    async execute(interaction) {
        if (!await ensureMusicReady(interaction)) return;
        if (!await ensureSameVoiceChannel(interaction, 'tiếp tục nhạc')) return;
        if (!await ensureDjPermission(interaction)) return;

        const queue = interaction.client.player.nodes.get(interaction.guildId);
        if (!queue || !queue.currentTrack) {
            await interaction.reply({ content: 'Không có bài nào để tiếp tục.', ephemeral: true });
            return;
        }

        if (!queue.node.isPaused()) {
            await interaction.reply({ content: 'Nhạc đang phát bình thường.', ephemeral: true });
            return;
        }

        queue.node.setPaused(false);
        await interaction.reply('▶️ Đã tiếp tục phát nhạc.');
    }
};
