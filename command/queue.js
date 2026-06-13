const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ensureMusicReady } = require('../utils/music');
const { createState } = require('../utils/musicControl');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Xem danh sách bài hát trong hàng đợi')
        .setDMPermission(false),

    async execute(interaction) {
        if (!await ensureMusicReady(interaction)) return;

        const state = createState(interaction.client, interaction.guildId);
        if (!state.active || !state.nowPlaying) {
            await interaction.reply({ content: 'Hàng đợi đang trống.', ephemeral: true });
            return;
        }

        const nextTracks = state.queue.slice(0, 10);

        const embed = new EmbedBuilder()
            .setColor('#F6B26B')
            .setTitle('📜 Hàng đợi phát nhạc')
            .addFields({
                name: 'Đang phát',
                value: `**${state.nowPlaying.title}** (${state.nowPlaying.duration || 'Không rõ'})`
            });

        if (nextTracks.length > 0) {
            embed.addFields({
                name: `Tiếp theo (${state.queue.length} bài)`,
                value: nextTracks
                    .map((track, index) => `${index + 1}. ${track.title} (${track.duration || 'Không rõ'})`)
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
