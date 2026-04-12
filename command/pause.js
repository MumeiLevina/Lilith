const { SlashCommandBuilder } = require('discord.js');
const { ensureDjPermission, ensureMusicReady, ensureSameVoiceChannel } = require('../utils/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Tạm dừng bài hát hiện tại')
        .setDMPermission(false),

    async execute(interaction) {
        if (!await ensureMusicReady(interaction)) return;
        if (!await ensureSameVoiceChannel(interaction, 'tạm dừng nhạc')) return;
        if (!await ensureDjPermission(interaction)) return;

        const queue = interaction.client.player.nodes.get(interaction.guildId);
        if (!queue || !queue.currentTrack) {
            await interaction.reply({ content: 'Không có bài nào đang phát.', ephemeral: true });
            return;
        }

        if (queue.node.isPaused()) {
            await interaction.reply({ content: 'Nhạc đã đang tạm dừng rồi.', ephemeral: true });
            return;
        }

        queue.node.setPaused(true);
        await interaction.reply('⏸️ Đã tạm dừng phát nhạc.');
    }
};
