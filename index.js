require('dotenv').config();
const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { Player } = require('discord-player');
const { DefaultExtractors } = require('@discord-player/extractor');
const { YoutubeExtractor } = require('discord-player-youtube');
const { hasDjPermission } = require('./utils/music');
const { setupWebServer } = require('./web/server');

const BUTTON_COLLECTOR_TIMEOUT_MS = 15 * 60 * 1000;

function parsePositiveInt(value, fallback) {
    const parsed = Number.parseInt(String(value || ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const MUSIC_CONNECTION_TIMEOUT_MS = parsePositiveInt(process.env.MUSIC_CONNECTION_TIMEOUT_MS, 30_000);
const MUSIC_PROBE_TIMEOUT_MS = parsePositiveInt(process.env.MUSIC_PROBE_TIMEOUT_MS, 10_000);
const YOUTUBE_TARGET_AUDIO_BITRATE = parsePositiveInt(process.env.YOUTUBE_TARGET_AUDIO_BITRATE, 128_000);
const YOUTUBE_MIN_AUDIO_BITRATE = Math.min(
    parsePositiveInt(process.env.YOUTUBE_MIN_AUDIO_BITRATE, 64_000),
    YOUTUBE_TARGET_AUDIO_BITRATE
);
const YOUTUBE_MAX_RETRIES = parsePositiveInt(process.env.YOUTUBE_MAX_RETRIES, 12);
const YOUTUBE_STALL_DETECTION_MS = parsePositiveInt(process.env.YOUTUBE_STALL_DETECTION_MS, 12_000);
const YOUTUBE_AUDIO_QUALITY = (process.env.YOUTUBE_AUDIO_QUALITY || 'HIGH').toUpperCase();

function getYoutubeAudioCodecScore(mimeType) {
    if (!mimeType) return 0;
    if (mimeType.includes('opus')) return 3;
    if (mimeType.includes('audio/webm')) return 2;
    if (mimeType.includes('audio/mp4') || mimeType.includes('m4a')) return 1;
    return 0;
}

function chooseYoutubeAudioFormat(formats) {
    if (!Array.isArray(formats) || !formats.length) return undefined;

    const candidates = formats
        .filter(format => {
            if (!format || typeof format !== 'object') return false;
            const width = Number(format.width) || 0;
            const height = Number(format.height) || 0;
            const bitrate = Number(format.bitrate) || Number(format.averageBitrate) || 0;
            return width === 0 && height === 0 && bitrate > 0;
        })
        .map(format => {
            const bitrate = Number(format.bitrate) || Number(format.averageBitrate) || 0;
            const mimeType = String(format.mimeType || '').toLowerCase();
            const codecScore = getYoutubeAudioCodecScore(mimeType);
            const aboveTargetPenalty = Math.max(0, bitrate - YOUTUBE_TARGET_AUDIO_BITRATE);
            const belowMinimumPenalty = Math.max(0, YOUTUBE_MIN_AUDIO_BITRATE - bitrate);
            const distancePenalty = Math.abs(YOUTUBE_TARGET_AUDIO_BITRATE - bitrate);

            return {
                format,
                bitrate,
                rank:
                    (codecScore * 1_000_000)
                    - (aboveTargetPenalty * 10)
                    - (belowMinimumPenalty * 5)
                    - distancePenalty
            };
        });

    if (!candidates.length) return undefined;

    candidates.sort((a, b) => {
        if (b.rank !== a.rank) return b.rank - a.rank;
        return b.bitrate - a.bitrate;
    });

    return candidates[0].format;
}

try {
    const ffmpegPath = require('ffmpeg-static');
    if (ffmpegPath && !process.env.FFMPEG_PATH) {
        process.env.FFMPEG_PATH = ffmpegPath;
    }
} catch {
    console.warn('ffmpeg-static is not available. Music playback may fail if FFmpeg is not installed system-wide.');
}

if (!process.env.YOUTUBE_COOKIE) {
    console.warn('YOUTUBE_COOKIE is not set. Some YouTube videos may require sign-in and fail to stream.');
}

// Create client instance
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ] 
});

// Collections
client.commands = new Collection();
client.cooldowns = new Collection();
client.player = new Player(client, {
    connectionTimeout: MUSIC_CONNECTION_TIMEOUT_MS,
    probeTimeout: MUSIC_PROBE_TIMEOUT_MS
});
client.musicReady = false;

client.player.extractors.loadMulti(DefaultExtractors)
    .then(() => client.player.extractors.register(YoutubeExtractor, {
        cookie: process.env.YOUTUBE_COOKIE,
        filterAutoplayTracks: true,
        sabrPlaybackOptions: {
            audioQuality: YOUTUBE_AUDIO_QUALITY,
            preferWebM: true,
            preferOpus: true,
            preferMP4: true,
            maxRetries: YOUTUBE_MAX_RETRIES,
            stallDetectionMs: YOUTUBE_STALL_DETECTION_MS,
            audioFormat: chooseYoutubeAudioFormat
        }
    }))
    .then(() => {
        client.musicReady = true;
        console.log('Music extractors loaded successfully.');
    })
    .catch(error => {
        client.musicReady = false;
        console.error('Failed to load music extractors. Music commands will be unavailable.', error);
    });

client.player.events.on('connection', queue => {
    queue.metadata?.channel?.send(`🎧 Đã tham gia kênh voice **${queue.channel?.name || 'Unknown'}**.`);
});

client.player.events.on('playerStart', async (queue, track) => {
    const channel = queue.metadata?.channel;
    if (!channel) return;

    const controls = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('music_skip')
            .setLabel('⏭️ Skip')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('music_stop')
            .setLabel('⏹️ Stop')
            .setStyle(ButtonStyle.Danger)
    );

    const nowPlayingEmbed = new EmbedBuilder()
        .setColor('#6D9EEB')
        .setTitle('🎶 Đang phát bài mới')
        .setDescription(`**${track.cleanTitle}**`)
        .addFields(
            { name: 'Thời lượng', value: track.duration || 'Không rõ', inline: true },
            { name: 'Yêu cầu bởi', value: `${track.requestedBy || 'Unknown'}`, inline: true }
        );

    if (track.thumbnail) {
        nowPlayingEmbed.setThumbnail(track.thumbnail);
    }

    const message = await channel.send({ embeds: [nowPlayingEmbed], components: [controls] });
    queue.metadata.controlsCollector?.stop('new_track');
    const collector = message.createMessageComponentCollector({ time: BUTTON_COLLECTOR_TIMEOUT_MS });
    queue.metadata.controlsCollector = collector;

    collector.on('collect', async interaction => {
        if (!interaction.isButton()) return;
        const queue = interaction.client.player.nodes.get(interaction.guildId);

        if (!queue || !queue.currentTrack) {
            await interaction.reply({ content: 'Không còn bài nào trong hàng đợi.', ephemeral: true });
            return;
        }

        const memberVoiceChannel = interaction.member?.voice?.channelId;
        const botVoiceChannel = interaction.guild?.members.me?.voice?.channelId;

        if (!memberVoiceChannel || memberVoiceChannel !== botVoiceChannel) {
            await interaction.reply({
                content: 'Bạn cần ở cùng kênh voice với bot để dùng nút điều khiển.',
                ephemeral: true
            });
            return;
        }

        if (!hasDjPermission(interaction.member)) {
            await interaction.reply({
                content: `Bạn cần role **${process.env.DJ_ROLE_NAME || 'DJ'}** (hoặc quyền quản trị) để dùng nút điều khiển.`,
                ephemeral: true
            });
            return;
        }

        if (interaction.customId === 'music_skip') {
            const skipped = queue.node.skip();
            await interaction.reply({
                content: skipped ? '⏭️ Đã chuyển sang bài tiếp theo.' : 'Không thể skip lúc này.',
                ephemeral: true
            });
            return;
        }

        if (interaction.customId === 'music_stop') {
            queue.delete();
            await interaction.reply({ content: '⏹️ Đã dừng nhạc và xóa hàng đợi.', ephemeral: true });
        }
    });

    collector.on('end', () => {
        if (queue.metadata?.controlsCollector === collector) {
            delete queue.metadata.controlsCollector;
        }
    });
});

client.player.events.on('emptyQueue', queue => {
    queue.metadata?.controlsCollector?.stop('queue_empty');
    queue.metadata?.channel?.send('✅ Hàng đợi trống, bot sẽ rời kênh voice.');
    queue.delete();
});

client.player.events.on('error', (queue, error) => {
    console.error('Music queue error:', error);
    queue?.metadata?.channel?.send('⚠️ Đã xảy ra lỗi khi phát nhạc.');
});

client.player.events.on('playerError', (queue, error) => {
    console.error('Music player error:', error);
    queue?.metadata?.channel?.send('⚠️ Không thể phát bài hát này, đang thử bài kế tiếp.');
});

setupWebServer(client);

function normalizeMongoUri(uri) {
    if (!uri || typeof uri !== 'string') return uri;

    const match = uri.match(/^(mongodb(?:\+srv)?:\/\/)([^@]+)@(.*)$/i);
    if (!match) return uri;

    const prefix = match[1];
    const credentials = match[2];
    const rest = match[3];
    const separatorIndex = credentials.indexOf(':');

    if (separatorIndex === -1) return uri;

    const rawUsername = credentials.slice(0, separatorIndex);
    const rawPassword = credentials.slice(separatorIndex + 1);

    const normalizeCredential = value => {
        try {
            return encodeURIComponent(decodeURIComponent(value));
        } catch {
            return encodeURIComponent(value);
        }
    };

    const username = normalizeCredential(rawUsername);
    const password = normalizeCredential(rawPassword);

    return `${prefix}${username}:${password}@${rest}`;
}

// Connect to MongoDB
mongoose.connect(normalizeMongoUri(process.env.MONGODB_URI))
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Load commands
const commandsPath = path.join(__dirname, 'command');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing required properties.`);
    }
}

// Load events
const eventsPath = path.join(__dirname, 'event');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// Login to Discord
client.login(process.env.DISCORD_TOKEN);
