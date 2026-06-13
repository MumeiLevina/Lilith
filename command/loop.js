const { SlashCommandBuilder } = require('discord.js');
const { QueueRepeatMode } = require('discord-player');
const { ensureDjPermission, ensureMusicReady, ensureSameVoiceChannel } = require('../utils/music');

const LOOP_MODE_LABELS = {
    [QueueRepeatMode.OFF]: 'Tắt',
    [QueueRepeatMode.TRACK]: 'Lặp bài hiện tại',
    [QueueRepeatMode.QUEUE]: 'Lặp toàn bộ hàng đợi',
    [QueueRepeatMode.AUTOPLAY]: 'Autoplay'
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('loop')
        .setDescription('Thiết lập chế độ lặp')
        .setDMPermission(false)
        .addStringOption(option =>
            option
                .setName('mode')
                .setDescription('Chọn chế độ lặp')
                .setRequired(true)
                .addChoices(
                    { name: 'Off', value: 'off' },
                    { name: 'Track', value: 'track' },
                    { name: 'Queue', value: 'queue' }
                )),

    async execute(interaction) {
        if (!await ensureMusicReady(interaction)) return;
        if (!await ensureSameVoiceChannel(interaction, 'chỉnh loop')) return;
        if (!await ensureDjPermission(interaction)) return;

        const queue = interaction.client.player.nodes.get(interaction.guildId);
        if (!queue || !queue.currentTrack) {
            await interaction.reply({ content: 'Không có bài nào đang phát.', ephemeral: true });
            return;
        }

        const modeInput = interaction.options.getString('mode', true);
        const modeMap = {
            off: QueueRepeatMode.OFF,
            track: QueueRepeatMode.TRACK,
            queue: QueueRepeatMode.QUEUE
        };

        const repeatMode = modeMap[modeInput] ?? QueueRepeatMode.OFF;
        queue.setRepeatMode(repeatMode);

        await interaction.reply(`🔁 Loop mode: **${LOOP_MODE_LABELS[repeatMode]}**`);
    }
};
