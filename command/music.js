const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
} = require('discord.js');
const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    NoSubscriberBehavior,
    VoiceConnectionStatus,
    entersState,
    StreamType,
} = require('@discordjs/voice');
const playDl = require('play-dl');
const QUEUE_PREVIEW_LIMIT = 10;
const YOUTUBE_STREAM_QUALITY = 2;
const VOICE_RECONNECTION_TIMEOUT = 5_000;
const DEFAULT_VOLUME = 0.5;

const guildStates = new Map();

function getState(guildId) {
    return guildStates.get(guildId);
}

function clearState(guildId) {
    const state = guildStates.get(guildId);
    if (!state) return;

    state.queue = [];
    state.current = null;

    try {
        state.player.stop(true);
    } catch (error) {
        console.debug('[music] Failed to stop player during cleanup:', error.message);
    }

    try {
        state.connection.destroy();
    } catch (error) {
        console.debug('[music] Failed to destroy connection during cleanup:', error.message);
    }

    guildStates.delete(guildId);
}

function getOrCreateState(interaction, voiceChannel) {
    const guildId = interaction.guild.id;
    let state = getState(guildId);

    if (state) {
        if (state.voiceChannelId !== voiceChannel.id) {
            throw new Error('BOT_IN_ANOTHER_CHANNEL');
        }
        state.textChannelId = interaction.channelId;
        return state;
    }

    const player = createAudioPlayer({
        behaviors: {
            noSubscriber: NoSubscriberBehavior.Pause,
        },
    });

    const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: interaction.guild.id,
        adapterCreator: interaction.guild.voiceAdapterCreator,
        selfDeaf: true,
    });

    connection.subscribe(player);

    state = {
        guildId,
        connection,
        player,
        queue: [],
        current: null,
        textChannelId: interaction.channelId,
        voiceChannelId: voiceChannel.id,
        volume: DEFAULT_VOLUME,
    };

    player.on(AudioPlayerStatus.Idle, async () => {
        await playNext(interaction.client, guildId);
    });

    player.on('error', async (error) => {
        console.error(`[music] Player error in guild ${guildId}:`, error.message);
        await sendToTextChannel(interaction.client, state.textChannelId, `❌ Lỗi phát nhạc: ${error.message}`);
        await playNext(interaction.client, guildId);
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
            await Promise.race([
                entersState(connection, VoiceConnectionStatus.Signalling, VOICE_RECONNECTION_TIMEOUT),
                entersState(connection, VoiceConnectionStatus.Connecting, VOICE_RECONNECTION_TIMEOUT),
            ]);
        } catch (_) {
            clearState(guildId);
        }
    });

    guildStates.set(guildId, state);
    return state;
}

async function sendToTextChannel(client, channelId, content) {
    if (!channelId) return;
    const channel = client.channels.cache.get(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) return;

    try {
        await channel.send({ content });
    } catch (_) {}
}

async function resolveTrack(query) {
    if (playDl.yt_validate(query) === 'video') {
        const info = await playDl.video_basic_info(query);
        return {
            title: info.video_details.title,
            url: info.video_details.url,
        };
    }

    const results = await playDl.search(query, {
        source: { youtube: 'video' },
        limit: 1,
    });

    if (!results.length) return null;

    return {
        title: results[0].title,
        url: results[0].url,
    };
}

async function playNext(client, guildId) {
    const state = getState(guildId);
    if (!state) return;

    const nextTrack = state.queue.shift();

    if (!nextTrack) {
        state.current = null;
        clearState(guildId);
        return;
    }

    state.current = nextTrack;

    try {
        const stream = await playDl.stream(nextTrack.url, {
            quality: YOUTUBE_STREAM_QUALITY,
            discordPlayerCompatibility: true,
        });

        const resource = createAudioResource(stream.stream, {
            inputType: stream.type || StreamType.Arbitrary,
            inlineVolume: true,
        });

        resource.volume.setVolume(state.volume);
        state.player.play(resource);

        await sendToTextChannel(
            client,
            state.textChannelId,
            `🎵 Đang phát: **${nextTrack.title}** (yêu cầu bởi <@${nextTrack.requestedBy}>)`,
        );
    } catch (error) {
        console.error(`[music] Stream error in guild ${guildId}:`, error.message);
        await sendToTextChannel(client, state.textChannelId, `❌ Không thể phát bài: **${nextTrack.title}**`);
        await playNext(client, guildId);
    }
}

function formatQueue(state) {
    if (!state) return 'Không có hàng chờ nào.';

    const nowPlaying = state.current
        ? `▶️ Đang phát: **${state.current.title}**`
        : '⏹️ Hiện không phát bài nào.';

    if (!state.queue.length) return `${nowPlaying}\n\nHàng chờ trống.`;

    const queueText = state.queue
        .slice(0, QUEUE_PREVIEW_LIMIT)
        .map((track, index) => `${index + 1}. ${track.title}`)
        .join('\n');
    const hiddenCount = Math.max(0, state.queue.length - QUEUE_PREVIEW_LIMIT);
    const hiddenText = hiddenCount > 0 ? `\n...và ${hiddenCount} bài khác.` : '';

    return `${nowPlaying}\n\n📜 Hàng chờ:\n${queueText}${hiddenText}`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('music')
        .setDescription('Phát nhạc trong voice channel')
        .addSubcommand((sub) =>
            sub
                .setName('play')
                .setDescription('Phát hoặc thêm bài vào hàng chờ')
                .addStringOption((option) =>
                    option
                        .setName('query')
                        .setDescription('Tên bài hát hoặc link YouTube')
                        .setRequired(true),
                ),
        )
        .addSubcommand((sub) => sub.setName('skip').setDescription('Bỏ qua bài hiện tại'))
        .addSubcommand((sub) => sub.setName('pause').setDescription('Tạm dừng bài hiện tại'))
        .addSubcommand((sub) => sub.setName('resume').setDescription('Tiếp tục phát bài'))
        .addSubcommand((sub) => sub.setName('stop').setDescription('Dừng phát và xóa hàng chờ'))
        .addSubcommand((sub) => sub.setName('queue').setDescription('Xem hàng chờ hiện tại'))
        .addSubcommand((sub) =>
            sub
                .setName('volume')
                .setDescription('Chỉnh âm lượng')
                .addIntegerOption((option) =>
                    option
                        .setName('value')
                        .setDescription('Âm lượng từ 1 đến 100')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(100),
                ),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Connect),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (subcommand === 'queue') {
            return interaction.reply({ content: formatQueue(getState(guildId)), ephemeral: true });
        }

        if (subcommand === 'stop') {
            const state = getState(guildId);
            if (!state) {
                return interaction.reply({ content: 'Không có nhạc đang phát.', ephemeral: true });
            }
            clearState(guildId);
            return interaction.reply({ content: '⏹️ Đã dừng nhạc và xóa hàng chờ.' });
        }

        const voiceChannel = interaction.member?.voice?.channel;
        if (!voiceChannel) {
            return interaction.reply({
                content: 'Bạn cần vào voice channel trước khi dùng lệnh nhạc.',
                ephemeral: true,
            });
        }

        const permissions = voiceChannel.permissionsFor(interaction.guild.members.me);
        if (!permissions?.has(PermissionFlagsBits.Connect) || !permissions?.has(PermissionFlagsBits.Speak)) {
            return interaction.reply({
                content: 'Bot không có quyền Connect/Speak trong voice channel này.',
                ephemeral: true,
            });
        }

        let state;
        try {
            state = getOrCreateState(interaction, voiceChannel);
        } catch (error) {
            if (error.message === 'BOT_IN_ANOTHER_CHANNEL') {
                return interaction.reply({
                    content: 'Bot đang hoạt động ở một voice channel khác.',
                    ephemeral: true,
                });
            }

            console.error(error);
            return interaction.reply({
                content: 'Không thể khởi tạo trình phát nhạc.',
                ephemeral: true,
            });
        }

        if (subcommand === 'play') {
            const query = interaction.options.getString('query', true);
            await interaction.deferReply();

            try {
                const track = await resolveTrack(query);
                if (!track) {
                    return interaction.editReply('Không tìm thấy bài hát phù hợp.');
                }

                state.queue.push({
                    ...track,
                    requestedBy: interaction.user.id,
                });

                if (state.player.state.status !== AudioPlayerStatus.Playing) {
                    await playNext(interaction.client, guildId);
                    return interaction.editReply(`✅ Bắt đầu phát: **${track.title}**`);
                }

                return interaction.editReply(`✅ Đã thêm vào hàng chờ: **${track.title}**`);
            } catch (error) {
                console.error(error);
                return interaction.editReply('Không thể xử lý yêu cầu phát nhạc.');
            }
        }

        if (subcommand === 'skip') {
            if (!state.current) {
                return interaction.reply({ content: 'Không có bài nào để skip.', ephemeral: true });
            }
            state.player.stop(true);
            return interaction.reply({ content: '⏭️ Đã skip bài hiện tại.' });
        }

        if (subcommand === 'pause') {
            const paused = state.player.pause();
            if (!paused) {
                return interaction.reply({ content: 'Không thể tạm dừng lúc này.', ephemeral: true });
            }
            return interaction.reply({ content: '⏸️ Đã tạm dừng.' });
        }

        if (subcommand === 'resume') {
            const resumed = state.player.unpause();
            if (!resumed) {
                return interaction.reply({ content: 'Không có bài nào đang tạm dừng.', ephemeral: true });
            }
            return interaction.reply({ content: '▶️ Đã tiếp tục phát.' });
        }

        if (subcommand === 'volume') {
            const value = interaction.options.getInteger('value', true);
            state.volume = value / 100;

            const resource = state.player.state.resource;
            if (resource?.volume) {
                resource.volume.setVolume(state.volume);
            }

            return interaction.reply({ content: `🔊 Âm lượng đã đặt: **${value}%**` });
        }

        return interaction.reply({ content: 'Lệnh không hợp lệ.', ephemeral: true });
    },
};
