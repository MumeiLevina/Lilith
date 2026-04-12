const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ensureMusicReady } = require('../utils/music');

function toTrackArray(queue) {
    if (typeof queue.tracks?.toArray === 'function') return queue.tracks.toArray();
    if (typeof queue.tracks?.map === 'function') return queue.tracks.map(track => track);
    if (queue.tracks && typeof queue.tracks[Symbol.iterator] === 'function') return Array.from(queue.tracks);
    return [];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Xem danh sách bài hát trong hàng đợi')
        .setDMPermission(false),

    async execute(interaction) {
        if (!await ensureMusicReady(interaction)) return;

        const queue = interaction.client.player.nodes.get(interaction.guildId);
        if (!queue || !queue.currentTrack) {
            await interaction.reply({ content: 'Hàng đợi đang trống.', ephemeral: true });
            return;
        }

        const tracks = toTrackArray(queue);
        const nextTracks = tracks.slice(0, 10);

        const embed = new EmbedBuilder()
            .setColor('#F6B26B')
            .setTitle('📜 Hàng đợi phát nhạc')
            .addFields({
                name: 'Đang phát',
                value: `**${queue.currentTrack.cleanTitle}** (${queue.currentTrack.duration || 'Không rõ'})`
            });

        if (nextTracks.length > 0) {
            embed.addFields({
                name: `Tiếp theo (${tracks.length} bài)`,
                value: nextTracks
                    .map((track, index) => `${index + 1}. ${track.cleanTitle} (${track.duration || 'Không rõ'})`)
                    .join('\n')
            });
        } else {
            embed.addFields({
                name: 'Tiếp theo',
                value: 'Chưa có bài nào trong hàng đợi.'
            });
        }

        await interaction.reply({ embeds: [embed] });
    }
};
