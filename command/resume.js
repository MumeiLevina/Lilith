const { SlashCommandBuilder } = require('discord.js');
const { ensureDjPermission, ensureMusicReady, ensureSameVoiceChannel } = require('../utils/music');
const { resume } = require('../utils/musicControl');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Tiếp tục phát nhạc')
        .setDMPermission(false),

    async execute(interaction) {
        if (!await ensureMusicReady(interaction)) return;
        if (!await ensureSameVoiceChannel(interaction, 'tiếp tục nhạc')) return;
        if (!await ensureDjPermission(interaction)) return;

        try {
            resume(interaction.client, interaction.guildId);
            await interaction.reply('▶️ Đã tiếp tục phát nhạc.');
        } catch (error) {
            await interaction.reply({ content: error.message, ephemeral: true });
        }
    }
};
