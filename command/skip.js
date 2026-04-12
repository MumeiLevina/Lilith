const { SlashCommandBuilder } = require('discord.js');
const { ensureDjPermission, ensureMusicReady, ensureSameVoiceChannel } = require('../utils/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Bỏ qua bài đang phát')
        .setDMPermission(false),

    async execute(interaction) {
        if (!await ensureMusicReady(interaction)) return;
        if (!await ensureSameVoiceChannel(interaction, 'skip')) return;
        if (!await ensureDjPermission(interaction)) return;

        const queue = interaction.client.player.nodes.get(interaction.guildId);

        if (!queue || !queue.currentTrack) {
            await interaction.reply({ content: 'Hiện không có bài nào để skip.', ephemeral: true });
            return;
        }

        const skipped = queue.node.skip();
        await interaction.reply(
            skipped ? '⏭️ Đã chuyển sang bài tiếp theo.' : 'Không thể skip bài hiện tại.'
        );
    }
};
