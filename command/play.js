const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Phát nhạc từ YouTube/Spotify/SoundCloud hoặc từ khóa tìm kiếm')
        .setDMPermission(false)
        .addStringOption(option =>
            option
                .setName('query')
                .setDescription('Link bài hát/playlist hoặc từ khóa tìm kiếm')
                .setRequired(true)),

    async execute(interaction) {
        const query = interaction.options.getString('query', true);
        const channel = interaction.member?.voice?.channel;

        if (!channel) {
            await interaction.reply({
                content: 'Bạn cần vào một voice channel trước khi dùng lệnh này.',
                ephemeral: true
            });
            return;
        }

        const botPermissions = channel.permissionsFor(interaction.guild.members.me);
        if (
            !botPermissions?.has(PermissionsBitField.Flags.Connect) ||
            !botPermissions?.has(PermissionsBitField.Flags.Speak)
        ) {
            await interaction.reply({
                content: 'Bot cần quyền **Connect** và **Speak** trong voice channel này.',
                ephemeral: true
            });
            return;
        }

        await interaction.deferReply();

        try {
            const result = await interaction.client.player.play(channel, query, {
                requestedBy: interaction.user,
                nodeOptions: {
                    metadata: {
                        channel: interaction.channel
                    },
                    leaveOnEmpty: true,
                    leaveOnEmptyCooldown: 60_000,
                    leaveOnEnd: true,
                    leaveOnEndCooldown: 30_000
                }
            });

            const track = result.track;
            const queuedEmbed = new EmbedBuilder()
                .setColor('#93C47D')
                .setTitle('✅ Đã thêm vào hàng đợi')
                .setDescription(`**${track.cleanTitle}**`)
                .addFields(
                    { name: 'Thời lượng', value: track.duration || 'Không rõ', inline: true },
                    { name: 'Kênh voice', value: channel.name, inline: true }
                );

            if (track.thumbnail) {
                queuedEmbed.setThumbnail(track.thumbnail);
            }

            await interaction.editReply({ embeds: [queuedEmbed] });
        } catch (error) {
            console.error('Play command error:', error);
            await interaction.editReply('Không thể phát nội dung này. Hãy thử link hoặc từ khóa khác.');
        }
    }
};
