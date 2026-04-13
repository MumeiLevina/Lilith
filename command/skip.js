const { SlashCommandBuilder } = require('discord.js');
const { ensureDjPermission, ensureMusicReady, ensureSameVoiceChannel } = require('../utils/music');
const { skip } = require('../utils/musicControl');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Bỏ qua bài đang phát')
        .setDMPermission(false),

    async execute(interaction) {
        if (!await ensureMusicReady(interaction)) return;
        if (!await ensureSameVoiceChannel(interaction, 'skip')) return;
        if (!await ensureDjPermission(interaction)) return;

        try {
            skip(interaction.client, interaction.guildId);
            await interaction.reply('⏭️ Đã chuyển sang bài tiếp theo.');
        } catch (error) {
            await interaction.reply({ content: error.message, ephemeral: true });
        }
    }
};
