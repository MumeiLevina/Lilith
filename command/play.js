const { SlashCommandBuilder, EmbedBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ensureMusicReady } = require('../utils/music');
const { play } = require('../utils/musicControl');
const { buildDashboardUrl } = require('../utils/dashboard');

const MAX_REPLY_LENGTH = 1900;
const MAX_ERROR_DETAILS_LENGTH = 320;
const SOURCE_LABELS = {
    youtube: 'YouTube',
    spotify: 'Spotify',
    soundcloud: 'SoundCloud',
    apple_music: 'Apple Music',
    arbitrary: 'Khác'
};

function getSourceLabel(source) {
    if (!source || typeof source !== 'string') return 'Không rõ';
    return SOURCE_LABELS[source] || source;
}

function clampReplyText(content) {
    if (!content || typeof content !== 'string') {
        return 'Không thể phát nội dung này. Vui lòng thử lại.';
    }

    if (content.length <= MAX_REPLY_LENGTH) return content;
    return `${content.slice(0, MAX_REPLY_LENGTH - 3)}...`;
}

async function sendDashboardShortcut(interaction) {
    const dashboardUrl = buildDashboardUrl(interaction.guildId);
    if (!dashboardUrl) return;

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel('Mở Dashboard Điều Khiển')
            .setURL(dashboardUrl)
            .setStyle(ButtonStyle.Link)
    );

    await interaction.followUp({
        content: '🎛️ Điều khiển nhạc trên web dashboard:',
        components: [row],
        flags: MessageFlags.Ephemeral
    });
}

function getUserFacingPlayError(error) {
    const code = error?.code;
    const rawMessage = typeof error?.message === 'string' ? error.message : '';

    if (code === 'ERR_NO_RESULT') {
        return 'Không tìm thấy kết quả cho link/từ khóa này. Bạn hãy thử link khác hoặc từ khóa khác.';
    }

    if (rawMessage.includes('Could not load ffmpeg')) {
        return 'Bot chưa tải được FFmpeg nên chưa thể phát nhạc. Hãy cài FFmpeg hoặc ffmpeg-static rồi khởi động lại bot.';
    }

    if (/You must be signed in to perform this operation/i.test(rawMessage)) {
        return 'Video YouTube này yêu cầu đăng nhập để phát. Hãy thử video khác hoặc cấu hình `YOUTUBE_COOKIE` trong file `.env`.';
    }

    const compactMessage = rawMessage.replace(/\s+/g, ' ').trim();
    if (compactMessage) {
        const shortDetails = compactMessage.slice(0, MAX_ERROR_DETAILS_LENGTH);
        const suffix = compactMessage.length > MAX_ERROR_DETAILS_LENGTH ? '...' : '';
        return `Không thể phát nội dung này. Chi tiết: ${shortDetails}${suffix}`;
    }

    return 'Không thể phát nội dung này. Hãy kiểm tra link/từ khóa và thử lại.';
}

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
            await interaction.deleteReply().catch((deleteError) => {
                // Ignore "Unknown Message" if the deferred placeholder was already removed.
                if (deleteError?.code !== 10008) {
                    console.error('Failed to remove deferred play reply:', deleteError);
                }
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

        try {
            const { result } = await play({
                client: interaction.client,
                guildId: interaction.guildId,
                query,
                requestedBy: interaction.user,
                channel,
                metadataChannel: interaction.channel
            });
            const searchResult = result.searchResult;
            const playlist = searchResult?.playlist;
            const queueWaitingCount = Number(result.queue?.tracks?.size) || 0;

            if (playlist) {
                const playlistTracksCount = searchResult?.tracks?.length || playlist.tracks?.length || 0;

                const playlistEmbed = new EmbedBuilder()
                    .setColor('#3C78D8')
                    .setTitle('✅ Đã thêm playlist vào hàng đợi')
                    .setDescription(`**${playlist.title || 'Playlist'}**`)
                    .addFields(
                        { name: 'Nguồn', value: getSourceLabel(playlist.source), inline: true },
                        { name: 'Số bài đã thêm', value: `${playlistTracksCount} bài`, inline: true },
                        { name: 'Kênh voice', value: channel.name, inline: true },
                        { name: 'Bài đang xử lý', value: result.track?.cleanTitle || 'Không rõ', inline: false },
                        { name: 'Hàng đợi chờ', value: `${queueWaitingCount} bài`, inline: true }
                    );

                if (playlist.thumbnail || result.track?.thumbnail) {
                    playlistEmbed.setThumbnail(playlist.thumbnail || result.track?.thumbnail);
                }

                await interaction.editReply({ embeds: [playlistEmbed] });
                await sendDashboardShortcut(interaction);
                return;
            }

            const track = result.track;
            if (!track) {
                await interaction.editReply({
                    content: 'Không thể thêm nội dung này vào hàng đợi. Hãy thử lại với link/từ khóa khác.',
                    embeds: []
                });
                return;
            }

            const queuedEmbed = new EmbedBuilder()
                .setColor('#93C47D')
                .setTitle('✅ Đã thêm vào hàng đợi')
                .setDescription(`**${track.cleanTitle}**`)
                .addFields(
                    { name: 'Thời lượng', value: track.duration || 'Không rõ', inline: true },
                    { name: 'Nguồn', value: getSourceLabel(track.source), inline: true },
                    { name: 'Kênh voice', value: channel.name, inline: true },
                    { name: 'Hàng đợi chờ', value: `${queueWaitingCount} bài`, inline: true }
                );

            if (track.thumbnail) {
                queuedEmbed.setThumbnail(track.thumbnail);
            }

            await interaction.editReply({ embeds: [queuedEmbed] });
            await sendDashboardShortcut(interaction);
        } catch (error) {
            console.error('Play command error:', error);
            const safeMessage = clampReplyText(getUserFacingPlayError(error));
            await interaction.editReply({ content: safeMessage, embeds: [] });
        }
    }
};
