const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, MessageFlags } = require('discord.js');
const { ensureMusicReady } = require('../utils/music');

const LEAVE_ON_EMPTY_DELAY_MS = 60_000;

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
        await interaction.deferReply();

        const sendValidationError = async (message) => {
            await interaction.deleteReply().catch(() => {
                // Ignore if the deferred placeholder was already removed.
            });
            await interaction.followUp({
                content: message,
                flags: MessageFlags.Ephemeral
            });
        };

        if (!await ensureMusicReady(interaction)) return;

        const query = interaction.options.getString('query', true);
        const channel = interaction.member?.voice?.channel;

        if (!channel) {
            await sendValidationError('Bạn cần vào một voice channel trước khi dùng lệnh này.');
            return;
        }

        const botPermissions = channel.permissionsFor(interaction.guild.members.me);
        if (
            !botPermissions?.has(PermissionsBitField.Flags.Connect) ||
            !botPermissions?.has(PermissionsBitField.Flags.Speak)
        ) {
            await sendValidationError('Bot cần quyền **Connect** và **Speak** trong voice channel này.');
            return;
        }

        try {
            const result = await interaction.client.player.play(channel, query, {
                requestedBy: interaction.user,
                nodeOptions: {
                    metadata: {
                        channel: interaction.channel
                    },
                    leaveOnEmpty: true,
                    leaveOnEmptyCooldown: LEAVE_ON_EMPTY_DELAY_MS
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
            const reason = error?.message ? `\nChi tiết: ${error.message}` : '';
            await interaction.editReply(`Không thể phát nội dung này. Hãy kiểm tra link/từ khóa và thử lại.${reason}`);
        }
    }
};
