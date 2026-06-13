const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ensureMusicReady } = require('../utils/music');
const { createState } = require('../utils/musicControl');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Xem bài hát đang phát')
        .setDMPermission(false),

    async execute(interaction) {
        if (!await ensureMusicReady(interaction)) return;

        const state = createState(interaction.client, interaction.guildId);
        if (!state.active || !state.nowPlaying) {
            await interaction.reply({ content: 'Hiện không có bài nào đang phát.', ephemeral: true });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#6FA8DC')
            .setTitle('🎧 Now Playing')
            .setDescription(`**${state.nowPlaying.title}**`)
            .addFields(
                { name: 'Thời lượng', value: state.nowPlaying.duration || 'Không rõ', inline: true },
                { name: 'Tiến trình', value: `${state.progressPercent || 0}%`, inline: true },
                { name: 'Queue', value: `${state.queueSize || 0} bài chờ`, inline: true },
                { name: 'Thanh tiến trình', value: state.progressBar || 'Không thể hiển thị progress bar.' }
            );

        if (state.nowPlaying.thumbnail) {
            embed.setThumbnail(state.nowPlaying.thumbnail);
        }

        await interaction.reply({ embeds: [embed] });
    }
};
