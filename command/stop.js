const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Dừng phát nhạc và xóa hàng đợi')
        .setDMPermission(false),

    async execute(interaction) {
        const queue = interaction.client.player.nodes.get(interaction.guildId);
        const memberChannelId = interaction.member?.voice?.channelId;
        const botChannelId = interaction.guild?.members.me?.voice?.channelId;

        if (!queue || !queue.currentTrack) {
            await interaction.reply({ content: 'Không có bài nào đang phát.', ephemeral: true });
            return;
        }

        if (!memberChannelId || memberChannelId !== botChannelId) {
            await interaction.reply({
                content: 'Bạn cần ở cùng voice channel với bot để dùng lệnh stop.',
                ephemeral: true
            });
            return;
        }

        queue.delete();
        await interaction.reply('⏹️ Đã dừng nhạc và xóa toàn bộ hàng đợi.');
    }
};
