const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, MessageFlags } = require('discord.js');
const { ensureMusicReady } = require('../utils/music');

const LEAVE_ON_EMPTY_DELAY_MS = 60_000;
const MAX_REPLY_LENGTH = 1900;
const MAX_ERROR_DETAILS_LENGTH = 320;
const YOUTUBE_HOSTS = new Set([
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'music.youtube.com',
    'youtu.be',
    'www.youtu.be'
]);
const YOUTUBE_TRACKING_PARAMS = new Set([
    'si',
    'feature',
    'pp',
    'fbclid',
    'gclid',
    'igshid'
]);
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

function normalizeQuery(rawQuery) {
    const query = (rawQuery || '').trim();
    if (!query) return query;

    // Keep keyword searches unchanged.
    if (!/^https?:\/\//i.test(query)) return query;

    try {
        const url = new URL(query);
        const host = url.hostname.toLowerCase();

        if (host === 'youtu.be') {
            const videoId = url.pathname.split('/').filter(Boolean)[0];
            const playlistId = url.searchParams.get('list');

            if (videoId) {
                if (playlistId) {
                    return `https://www.youtube.com/watch?v=${videoId}&list=${playlistId}`;
                }

                return `https://www.youtube.com/watch?v=${videoId}`;
            }

            if (playlistId) {
                return `https://www.youtube.com/playlist?list=${playlistId}`;
            }
        }

        if (host.endsWith('youtube.com')) {
            if (url.pathname === '/playlist') {
                const playlistId = url.searchParams.get('list');
                if (playlistId) {
                    return `https://www.youtube.com/playlist?list=${playlistId}`;
                }
            }

            if (url.pathname === '/watch') {
                const videoId = url.searchParams.get('v');
                const playlistId = url.searchParams.get('list');

                if (videoId && playlistId) {
                    return `https://www.youtube.com/watch?v=${videoId}&list=${playlistId}`;
                }

                if (videoId) {
                    return `https://www.youtube.com/watch?v=${videoId}`;
                }

                if (playlistId) {
                    return `https://www.youtube.com/playlist?list=${playlistId}`;
                }
            }
        }

        return query;
    } catch {
        return query;
    }
}

function sanitizeYoutubeUrl(query) {
    try {
        const url = new URL(query.trim());
        const hostname = url.hostname.toLowerCase();
        if (!YOUTUBE_HOSTS.has(hostname)) return query;

        const filteredParams = new URLSearchParams();
        for (const [key, value] of url.searchParams.entries()) {
            const lowerKey = key.toLowerCase();
            const isTrackingParam = YOUTUBE_TRACKING_PARAMS.has(lowerKey) || lowerKey.startsWith('utm_');

            if (!isTrackingParam) {
                filteredParams.append(key, value);
            }
        }

        url.search = filteredParams.toString();
        return url.toString();
    } catch {
        return query;
    }
}

function clampReplyText(content) {
    if (!content || typeof content !== 'string') {
        return 'Không thể phát nội dung này. Vui lòng thử lại.';
    }

    if (content.length <= MAX_REPLY_LENGTH) return content;
    return `${content.slice(0, MAX_REPLY_LENGTH - 3)}...`;
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
        const normalizedQuery = normalizeQuery(query);
        const playQuery = sanitizeYoutubeUrl(normalizedQuery);
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
            const playOptions = {
                requestedBy: interaction.user,
                nodeOptions: {
                    metadata: {
                        channel: interaction.channel
                    },
                    leaveOnEmpty: true,
                    leaveOnEmptyCooldown: LEAVE_ON_EMPTY_DELAY_MS
                }
            };

            let result;
            try {
                result = await interaction.client.player.play(channel, playQuery, playOptions);
            } catch (error) {
                const shouldRetryWithOriginalQuery = error?.code === 'ERR_NO_RESULT' && playQuery !== query;
                if (!shouldRetryWithOriginalQuery) {
                    throw error;
                }

                result = await interaction.client.player.play(channel, query, playOptions);
            }

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
        } catch (error) {
            console.error('Play command error:', error);
            const safeMessage = clampReplyText(getUserFacingPlayError(error));
            await interaction.editReply({ content: safeMessage, embeds: [] });
        }
    }
};
