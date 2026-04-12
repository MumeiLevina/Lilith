const { SlashCommandBuilder } = require('discord.js');
const { QueueRepeatMode } = require('discord-player');
const { ensureDjPermission, ensureMusicReady, ensureSameVoiceChannel } = require('../utils/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autoplay')
        .setDescription('Bật/tắt autoplay khi hết hàng đợi')
        .setDMPermission(false)
        .addStringOption(option =>
            option
                .setName('state')
                .setDescription('Bật hoặc tắt autoplay')
                .setRequired(true)
                .addChoices(
                    { name: 'On', value: 'on' },
                    { name: 'Off', value: 'off' }
                )),

    async execute(interaction) {
        if (!await ensureMusicReady(interaction)) return;
        if (!await ensureSameVoiceChannel(interaction, 'chỉnh autoplay')) return;
        if (!await ensureDjPermission(interaction)) return;

        const queue = interaction.client.player.nodes.get(interaction.guildId);
        if (!queue || !queue.currentTrack) {
            await interaction.reply({ content: 'Không có bài nào đang phát.', ephemeral: true });
            return;
        }

        const state = interaction.options.getString('state', true);
        const repeatMode = state === 'on' ? QueueRepeatMode.AUTOPLAY : QueueRepeatMode.OFF;
        queue.setRepeatMode(repeatMode);

        await interaction.reply(
            state === 'on'
                ? '♾️ Đã bật autoplay.'
                : '✅ Đã tắt autoplay.'
        );
    }
};
