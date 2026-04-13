const { SlashCommandBuilder } = require('discord.js');
const { ensureDjPermission, ensureMusicReady, ensureSameVoiceChannel } = require('../utils/music');
const { pause } = require('../utils/musicControl');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Tạm dừng bài hát hiện tại')
        .setDMPermission(false),

    async execute(interaction) {
        if (!await ensureMusicReady(interaction)) return;
        if (!await ensureSameVoiceChannel(interaction, 'tạm dừng nhạc')) return;
        if (!await ensureDjPermission(interaction)) return;

        try {
            pause(interaction.client, interaction.guildId);
            await interaction.reply('⏸️ Đã tạm dừng phát nhạc.');
        } catch (error) {
            await interaction.reply({ content: error.message, ephemeral: true });
        }
    }
};
