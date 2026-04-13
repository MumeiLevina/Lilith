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

        try {
            stop(interaction.client, interaction.guildId);
            await interaction.reply('⏹️ Đã dừng nhạc và xóa toàn bộ hàng đợi.');
        } catch (error) {
            await interaction.reply({ content: error.message, ephemeral: true });
        }
    }
};
