const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ensureMusicReady } = require('../utils/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Xem bài hát đang phát')
        .setDMPermission(false),

    async execute(interaction) {
        if (!await ensureMusicReady(interaction)) return;

        const queue = interaction.client.player.nodes.get(interaction.guildId);
        if (!queue || !queue.currentTrack) {
            await interaction.reply({ content: 'Hiện không có bài nào đang phát.', ephemeral: true });
            return;
        }

        const progress = queue.node.createProgressBar();
        const timestamp = queue.node.getTimestamp();
        const embed = new EmbedBuilder()
            .setColor('#6FA8DC')
            .setTitle('🎧 Now Playing')
            .setDescription(`**${queue.currentTrack.cleanTitle}**`)
            .addFields(
                { name: 'Thời lượng', value: queue.currentTrack.duration || 'Không rõ', inline: true },
                { name: 'Tiến trình', value: timestamp?.progress ? `${timestamp.progress}%` : 'N/A', inline: true },
                { name: 'Queue', value: `${queue.tracks.size} bài chờ`, inline: true },
                { name: 'Thanh tiến trình', value: progress || 'Không thể hiển thị progress bar.' }
            );

        if (queue.currentTrack.thumbnail) {
            embed.setThumbnail(queue.currentTrack.thumbnail);
        }

        await interaction.reply({ embeds: [embed] });
    }
};
