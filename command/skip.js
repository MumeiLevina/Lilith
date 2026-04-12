const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Bỏ qua bài đang phát')
        .setDMPermission(false),

    async execute(interaction) {
        const queue = interaction.client.player.nodes.get(interaction.guildId);
        const memberChannelId = interaction.member?.voice?.channelId;
        const botChannelId = interaction.guild?.members.me?.voice?.channelId;

        if (!queue || !queue.currentTrack) {
            await interaction.reply({ content: 'Hiện không có bài nào để skip.', ephemeral: true });
            return;
        }

        if (!memberChannelId || memberChannelId !== botChannelId) {
            await interaction.reply({
                content: 'Bạn cần ở cùng voice channel với bot để skip.',
                ephemeral: true
            });
            return;
        }

        const skipped = queue.node.skip();
        await interaction.reply(
            skipped ? '⏭️ Đã chuyển sang bài tiếp theo.' : 'Không thể skip bài hiện tại.'
        );
    }
};
