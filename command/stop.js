const { SlashCommandBuilder } = require('discord.js');
const { ensureDjPermission, ensureMusicReady, ensureSameVoiceChannel } = require('../utils/music');
const { stop } = require('../utils/musicControl');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Dừng phát nhạc và xóa hàng đợi')
        .setDMPermission(false),

    async execute(interaction) {
        if (!await ensureMusicReady(interaction)) return;
        if (!await ensureSameVoiceChannel(interaction, 'dùng lệnh stop')) return;
        if (!await ensureDjPermission(interaction)) return;

        const queue = interaction.client.player.nodes.get(interaction.guildId);

        if (!queue || !queue.currentTrack) {
            await interaction.reply({ content: 'Không có bài nào đang phát.', ephemeral: true });
            return;
        }

        queue.delete();
        await interaction.reply('⏹️ Đã dừng nhạc và xóa toàn bộ hàng đợi.');
    }
};
