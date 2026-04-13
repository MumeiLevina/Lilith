const { PermissionsBitField } = require('discord.js');
const { QueueRepeatMode } = require('discord-player');

const LEAVE_ON_EMPTY_DELAY_MS = 60_000;
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

function normalizeQuery(rawQuery) {
    const query = (rawQuery || '').trim();
    if (!query) return query;
    if (!/^https?:\/\//i.test(query)) return query;

    try {
        const url = new URL(query);
        const host = url.hostname.toLowerCase();

        if (host === 'youtu.be') {
            const videoId = url.pathname.replace(/^\/+/, '').split('/')[0];
            const playlistId = url.searchParams.get('list');

            if (videoId && playlistId) return `https://www.youtube.com/watch?v=${videoId}&list=${playlistId}`;
            if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
            if (playlistId) return `https://www.youtube.com/playlist?list=${playlistId}`;
        }

        if (YOUTUBE_HOSTS.has(host)) {
            if (url.pathname === '/playlist') {
                const playlistId = url.searchParams.get('list');
                if (playlistId) return `https://www.youtube.com/playlist?list=${playlistId}`;
            }

            if (url.pathname === '/watch') {
                const videoId = url.searchParams.get('v');
                const playlistId = url.searchParams.get('list');
                if (videoId && playlistId) return `https://www.youtube.com/watch?v=${videoId}&list=${playlistId}`;
                if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
                if (playlistId) return `https://www.youtube.com/playlist?list=${playlistId}`;
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
            if (!isTrackingParam) filteredParams.append(key, value);
        }

        url.search = filteredParams.toString();
        return url.toString();
    } catch {
        return query;
    }
}

function toTrackArray(queue) {
    if (!queue?.tracks) return [];
    if (typeof queue.tracks.toArray === 'function') return queue.tracks.toArray();
    if (typeof queue.tracks.map === 'function') return queue.tracks.map(track => track);
    if (typeof queue.tracks[Symbol.iterator] === 'function') return Array.from(queue.tracks);
    return [];
}

function toSerializableTrack(track) {
    if (!track) return null;
    return {
        title: track.cleanTitle || track.title || 'Unknown',
        duration: track.duration || 'Unknown',
        durationMs: Number(track.durationMS) || null,
        thumbnail: track.thumbnail || null,
        url: track.url || null,
        source: track.source || null,
        requestedBy: track.requestedBy?.username || track.requestedBy?.tag || null
    };
}

function getQueue(client, guildId) {
    return client.player.nodes.get(guildId);
}

function repeatModeToKey(repeatMode) {
    switch (Number(repeatMode)) {
        case QueueRepeatMode.TRACK:
            return 'track';
        case QueueRepeatMode.QUEUE:
            return 'queue';
        case QueueRepeatMode.AUTOPLAY:
            return 'autoplay';
        case QueueRepeatMode.OFF:
        default:
            return 'off';
    }
}

function createState(client, guildId) {
    const queue = getQueue(client, guildId);
    if (!queue || !queue.currentTrack) {
        return {
            active: false,
            paused: false,
            volume: null,
            progressPercent: 0,
            progressBar: null,
            nowPlaying: null,
            queue: [],
            queueSize: 0,
            repeatMode: 'off'
        };
    }

    const timestamp = queue.node.getTimestamp?.() || {};
    return {
        active: true,
        paused: !!queue.node.isPaused?.(),
        volume: Number(queue.node.volume) || null,
        progressPercent: Number(timestamp.progress) || 0,
        progressBar: queue.node.createProgressBar?.() || null,
        nowPlaying: toSerializableTrack(queue.currentTrack),
        queue: toTrackArray(queue).map(toSerializableTrack),
        queueSize: Number(queue.tracks?.size) || toTrackArray(queue).length,
        repeatMode: repeatModeToKey(queue.repeatMode)
    };
}

function ensureVoicePermissions(channel, memberMe) {
    const botPermissions = channel.permissionsFor(memberMe);
    if (
        !botPermissions?.has(PermissionsBitField.Flags.Connect) ||
        !botPermissions?.has(PermissionsBitField.Flags.Speak)
    ) {
        const error = new Error('Bot cần quyền Connect và Speak trong voice channel này.');
        error.code = 'ERR_VOICE_PERMISSIONS';
        throw error;
    }
}

async function play({
    client,
    guildId,
    query,
    requestedBy,
    channel,
    metadataChannel
}) {
    const normalizedQuery = normalizeQuery(query);
    const playQuery = sanitizeYoutubeUrl(normalizedQuery);
    ensureVoicePermissions(channel, channel.guild.members.me);

    const playOptions = {
        requestedBy,
        nodeOptions: {
            metadata: {
                channel: metadataChannel
            },
            leaveOnEmpty: true,
            leaveOnEmptyCooldown: LEAVE_ON_EMPTY_DELAY_MS
        }
    };

    let result;
    try {
        result = await client.player.play(channel, playQuery, playOptions);
    } catch (error) {
        const shouldRetryWithOriginalQuery = error?.code === 'ERR_NO_RESULT' && playQuery !== query;
        if (!shouldRetryWithOriginalQuery) throw error;
        result = await client.player.play(channel, query, playOptions);
    }

    return {
        result,
        state: createState(client, guildId)
    };
}

function pause(client, guildId) {
    const queue = getQueue(client, guildId);
    if (!queue || !queue.currentTrack) {
        const error = new Error('Không có bài nào đang phát.');
        error.code = 'ERR_QUEUE_EMPTY';
        throw error;
    }
    if (queue.node.isPaused()) {
        const error = new Error('Nhạc đã đang tạm dừng rồi.');
        error.code = 'ERR_ALREADY_PAUSED';
        throw error;
    }
    queue.node.setPaused(true);
    return createState(client, guildId);
}

function resume(client, guildId) {
    const queue = getQueue(client, guildId);
    if (!queue || !queue.currentTrack) {
        const error = new Error('Không có bài nào để tiếp tục.');
        error.code = 'ERR_QUEUE_EMPTY';
        throw error;
    }
    if (!queue.node.isPaused()) {
        const error = new Error('Nhạc đang phát bình thường.');
        error.code = 'ERR_NOT_PAUSED';
        throw error;
    }
    queue.node.setPaused(false);
    return createState(client, guildId);
}

function skip(client, guildId) {
    const queue = getQueue(client, guildId);
    if (!queue || !queue.currentTrack) {
        const error = new Error('Hiện không có bài nào để skip.');
        error.code = 'ERR_QUEUE_EMPTY';
        throw error;
    }
    const skipped = queue.node.skip();
    if (!skipped) {
        const error = new Error('Không thể skip bài hiện tại.');
        error.code = 'ERR_SKIP_FAILED';
        throw error;
    }
    return createState(client, guildId);
}

function stop(client, guildId) {
    const queue = getQueue(client, guildId);
    if (!queue || !queue.currentTrack) {
        const error = new Error('Không có bài nào đang phát.');
        error.code = 'ERR_QUEUE_EMPTY';
        throw error;
    }
    queue.delete();
    return createState(client, guildId);
}

function seek(client, guildId, seconds) {
    const queue = getQueue(client, guildId);
    if (!queue || !queue.currentTrack) {
        const error = new Error('Không có bài nào đang phát.');
        error.code = 'ERR_QUEUE_EMPTY';
        throw error;
    }
    const durationMs = Number(queue.currentTrack.durationMS);
    const targetMs = Math.max(0, Number(seconds) * 1000);
    if (durationMs && targetMs > durationMs) {
        const error = new Error('Mốc seek vượt quá thời lượng bài hát.');
        error.code = 'ERR_SEEK_RANGE';
        throw error;
    }
    queue.node.seek(targetMs);
    return createState(client, guildId);
}

function setVolume(client, guildId, volume) {
    const queue = getQueue(client, guildId);
    if (!queue || !queue.currentTrack) {
        const error = new Error('Không có bài nào đang phát.');
        error.code = 'ERR_QUEUE_EMPTY';
        throw error;
    }
    const normalizedVolume = Math.max(0, Math.min(200, Number(volume)));
    if (Number.isNaN(normalizedVolume)) {
        const error = new Error('Volume không hợp lệ.');
        error.code = 'ERR_VOLUME_INVALID';
        throw error;
    }
    queue.node.setVolume(normalizedVolume);
    return createState(client, guildId);
}

function toggleTrackRepeat(client, guildId) {
    const queue = getQueue(client, guildId);
    if (!queue || !queue.currentTrack) {
        const error = new Error('Không có bài nào đang phát.');
        error.code = 'ERR_QUEUE_EMPTY';
        throw error;
    }

    const currentMode = Number(queue.repeatMode);
    const nextMode = currentMode === QueueRepeatMode.TRACK
        ? QueueRepeatMode.OFF
        : QueueRepeatMode.TRACK;

    queue.setRepeatMode(nextMode);

    return {
        state: createState(client, guildId),
        repeatEnabled: nextMode === QueueRepeatMode.TRACK
    };
}

module.exports = {
    createState,
    getQueue,
    pause,
    play,
    resume,
    sanitizeYoutubeUrl,
    seek,
    setVolume,
    skip,
    stop,
    toggleTrackRepeat,
    toSerializableTrack,
    toTrackArray
};
