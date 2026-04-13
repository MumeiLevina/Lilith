const path = require('path');
const crypto = require('crypto');
const http = require('http');
const express = require('express');
const session = require('express-session');
const { Server } = require('socket.io');
const { hasDjPermission } = require('../utils/music');
const musicControl = require('../utils/musicControl');

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const SESSION_COOKIE_NAME = 'lilith.sid';
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;

function randomToken() {
    return crypto.randomBytes(24).toString('hex');
}

function createApiError(status, code, message) {
    return { status, code, message };
}

function sendApiError(res, error) {
    res.status(error.status || 500).json({
        ok: false,
        error: {
            code: error.code || 'INTERNAL_ERROR',
            message: error.message || 'Đã xảy ra lỗi không xác định.'
        }
    });
}

async function discordRequest(url, accessToken) {
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        const body = await response.text();
        const error = new Error(`Discord API error (${response.status}): ${body}`);
        error.code = 'ERR_DISCORD_API';
        error.status = response.status;
        throw error;
    }

    return response.json();
}

async function refreshDiscordAccessToken(refreshToken) {
    const params = new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
    });

    const response = await fetch(`${DISCORD_API_BASE}/oauth2/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
    });

    if (!response.ok) {
        const body = await response.text();
        const error = new Error(`Failed to refresh token: ${body}`);
        error.code = 'ERR_TOKEN_REFRESH';
        throw error;
    }

    return response.json();
}

async function ensureAccessToken(req) {
    const sessionState = req.session?.discord;
    if (!sessionState?.accessToken) {
        throw createApiError(401, 'UNAUTHORIZED', 'Bạn chưa đăng nhập Discord.');
    }

    if (Date.now() < Number(sessionState.expiresAt || 0)) {
        return sessionState.accessToken;
    }

    if (!sessionState.refreshToken) {
        throw createApiError(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn.');
    }

    const refreshed = await refreshDiscordAccessToken(sessionState.refreshToken);
    req.session.discord = {
        ...sessionState,
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token || sessionState.refreshToken,
        expiresAt: Date.now() + (Number(refreshed.expires_in || 3600) * 1000) - 10_000
    };
    await new Promise((resolve, reject) => req.session.save(err => (err ? reject(err) : resolve())));
    return req.session.discord.accessToken;
}

function getGuildIconUrl(guild) {
    if (!guild?.icon) return null;
    return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`;
}

function resolveGuildIdFromQueue(queue) {
    return (
        queue?.guild?.id ||
        queue?.guildId ||
        queue?.metadata?.channel?.guildId ||
        queue?.channel?.guild?.id ||
        null
    );
}

function createRateLimiter() {
    const buckets = new Map();
    return (req, res, next) => {
        const key = `${req.session?.user?.id || req.ip}:${req.path}`;
        const now = Date.now();
        const existing = buckets.get(key);
        if (!existing || now - existing.startedAt > RATE_LIMIT_WINDOW_MS) {
            buckets.set(key, { startedAt: now, count: 1 });
            next();
            return;
        }

        existing.count += 1;
        if (existing.count > RATE_LIMIT_MAX_REQUESTS) {
            sendApiError(res, createApiError(429, 'RATE_LIMITED', 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.'));
            return;
        }
        next();
    };
}

function createCorsMiddleware() {
    const allowedOrigin = process.env.WEB_ORIGIN;
    return (req, res, next) => {
        if (!allowedOrigin) return next();
        const origin = req.headers.origin;
        if (origin && origin === allowedOrigin) {
            res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
            res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        }
        if (req.method === 'OPTIONS') {
            res.status(204).end();
            return;
        }
        next();
    };
}

function createSessionMiddleware() {
    if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
        throw new Error('SESSION_SECRET environment variable is required in production. Please set it to a secure random string.');
    }

    return session({
        name: SESSION_COOKIE_NAME,
        secret: process.env.SESSION_SECRET || 'lilith-dev-secret',
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 1000 * 60 * 60 * 24 * 7
        }
    });
}

function setupWebServer(client) {
    if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET || !process.env.DISCORD_OAUTH_REDIRECT_URI) {
        throw new Error('DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, and DISCORD_OAUTH_REDIRECT_URI are required for dashboard OAuth2.');
    }

    const app = express();
    const server = http.createServer(app);
    const io = new Server(server, {
        cors: process.env.WEB_ORIGIN ? { origin: process.env.WEB_ORIGIN, credentials: true } : undefined
    });

    const sessionMiddleware = createSessionMiddleware();
    const rateLimiter = createRateLimiter();
    const csrfProtectedMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

    app.use(createCorsMiddleware());
    app.use(express.json());
    app.use(sessionMiddleware);

    io.use((socket, next) => {
        sessionMiddleware(socket.request, {}, next);
    });

    function requireAuth(req, res, next) {
        if (!req.session?.user?.id) {
            sendApiError(res, createApiError(401, 'UNAUTHORIZED', 'Bạn chưa đăng nhập Discord.'));
            return;
        }

        if (!req.session.csrfToken) {
            req.session.csrfToken = randomToken();
        }
        next();
    }

    function requireCsrf(req, res, next) {
        if (!csrfProtectedMethods.has(req.method)) {
            next();
            return;
        }

        const csrfToken = req.headers['x-csrf-token'];
        if (!csrfToken || csrfToken !== req.session?.csrfToken) {
            sendApiError(res, createApiError(403, 'CSRF_INVALID', 'CSRF token không hợp lệ.'));
            return;
        }
        next();
    }

    async function getUserGuildContexts(req) {
        const accessToken = await ensureAccessToken(req);
        const userGuilds = await discordRequest(`${DISCORD_API_BASE}/users/@me/guilds`, accessToken);
        const userGuildSet = new Set((userGuilds || []).map(guild => guild.id));

        const sharedGuilds = client.guilds.cache
            .filter(guild => userGuildSet.has(guild.id))
            .map(guild => guild);

        const result = [];
        for (const guild of sharedGuilds) {
            let member;
            try {
                member = await guild.members.fetch(req.session.user.id);
            } catch {
                continue;
            }

            const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
            result.push({
                id: guild.id,
                name: guild.name,
                icon: getGuildIconUrl({ id: guild.id, icon: guild.icon }),
                memberVoiceChannelId: member.voice?.channelId || null,
                memberVoiceChannelName: member.voice?.channel?.name || null,
                botVoiceChannelId: me?.voice?.channelId || null,
                botVoiceChannelName: me?.voice?.channel?.name || null,
                canControl: hasDjPermission(member)
            });
        }
        return result;
    }

    async function resolveGuildContext(req) {
        const guildId = req.body?.guildId || req.query?.guildId;
        if (!guildId) throw createApiError(400, 'GUILD_REQUIRED', 'Thiếu guildId.');
        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (!guild) throw createApiError(404, 'GUILD_NOT_FOUND', 'Không tìm thấy server.');
        const member = await guild.members.fetch(req.session.user.id).catch(() => null);
        if (!member) throw createApiError(403, 'MEMBER_NOT_FOUND', 'Không tìm thấy thành viên trong server.');
        const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
        const memberVoiceChannel = member.voice?.channel;
        if (!memberVoiceChannel) {
            throw createApiError(403, 'VOICE_REQUIRED', 'Bạn cần vào voice channel trước.');
        }
        const botVoiceChannelId = me?.voice?.channelId;
        if (botVoiceChannelId && botVoiceChannelId !== member.voice.channelId) {
            throw createApiError(403, 'VOICE_MISMATCH', 'Bạn cần ở cùng voice channel với bot.');
        }

        return {
            guild,
            guildId: guild.id,
            member,
            memberVoiceChannel
        };
    }

    function ensureMusicReady(req, res, next) {
        if (!client.musicReady) {
            sendApiError(res, createApiError(503, 'MUSIC_NOT_READY', 'Tính năng nhạc chưa sẵn sàng.'));
            return;
        }
        next();
    }

    function audit(req, action, guildId) {
        const userId = req.session?.user?.id || 'unknown';
        console.log(`[AUDIT] action=${action} guild=${guildId || 'n/a'} user=${userId}`);
    }

    function emitGuildState(guildId, eventName = 'music:state') {
        if (!guildId) return;
        io.to(`guild:${guildId}`).emit(eventName, {
            guildId,
            state: musicControl.createState(client, guildId),
            at: Date.now()
        });
    }

    app.get('/', (req, res) => {
        res.redirect('/dashboard');
    });

    app.use('/dashboard', express.static(path.join(__dirname, 'public')));

    app.get('/auth/discord', (req, res) => {
        const state = randomToken();
        req.session.oauthState = state;

        const params = new URLSearchParams({
            client_id: process.env.DISCORD_CLIENT_ID,
            response_type: 'code',
            redirect_uri: process.env.DISCORD_OAUTH_REDIRECT_URI,
            scope: 'identify guilds',
            state
        });
        res.redirect(`${DISCORD_API_BASE}/oauth2/authorize?${params.toString()}`);
    });

    app.get('/auth/discord/callback', async (req, res) => {
        try {
            const { code, state } = req.query;
            if (!code || !state || state !== req.session.oauthState) {
                throw createApiError(400, 'OAUTH_STATE_INVALID', 'OAuth state không hợp lệ.');
            }
            delete req.session.oauthState;

            const params = new URLSearchParams({
                client_id: process.env.DISCORD_CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code,
                redirect_uri: process.env.DISCORD_OAUTH_REDIRECT_URI
            });

            const tokenResponse = await fetch(`${DISCORD_API_BASE}/oauth2/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString()
            });
            if (!tokenResponse.ok) {
                const body = await tokenResponse.text();
                throw createApiError(401, 'OAUTH_TOKEN_FAILED', `Không thể xác thực Discord: ${body}`);
            }
            const tokenData = await tokenResponse.json();
            const user = await discordRequest(`${DISCORD_API_BASE}/users/@me`, tokenData.access_token);

            req.session.user = {
                id: user.id,
                username: user.username,
                avatar: user.avatar
                    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
                    : null
            };
            req.session.discord = {
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token,
                expiresAt: Date.now() + (Number(tokenData.expires_in || 3600) * 1000) - 10_000
            };
            req.session.csrfToken = randomToken();
            res.redirect('/dashboard');
        } catch (error) {
            const payload = error?.status ? error : createApiError(500, 'OAUTH_ERROR', error.message);
            sendApiError(res, payload);
        }
    });

    app.post('/auth/logout', requireAuth, requireCsrf, (req, res) => {
        req.session.destroy(() => {
            res.clearCookie(SESSION_COOKIE_NAME);
            res.json({ ok: true });
        });
    });

    app.get('/api/auth/me', async (req, res) => {
        if (!req.session?.user?.id) {
            res.json({ ok: true, authenticated: false, loginUrl: '/auth/discord' });
            return;
        }

        try {
            await ensureAccessToken(req);
        } catch {
            req.session.destroy(() => {});
            res.json({ ok: true, authenticated: false, loginUrl: '/auth/discord' });
            return;
        }

        if (!req.session.csrfToken) {
            req.session.csrfToken = randomToken();
        }

        res.json({
            ok: true,
            authenticated: true,
            user: req.session.user,
            csrfToken: req.session.csrfToken
        });
    });

    app.get('/api/guilds', requireAuth, rateLimiter, async (req, res) => {
        try {
            const guilds = await getUserGuildContexts(req);
            res.json({ ok: true, guilds });
        } catch (error) {
            const payload = error?.status ? error : createApiError(500, 'GUILDS_FETCH_FAILED', error.message);
            sendApiError(res, payload);
        }
    });

    async function runMusicAction(req, res, actionName, actionHandler, requireDj = true) {
        try {
            const context = await resolveGuildContext(req);
            if (requireDj && !hasDjPermission(context.member)) {
                throw createApiError(403, 'DJ_REQUIRED', `Bạn cần role DJ hoặc quyền quản trị để dùng ${actionName}.`);
            }

            const result = await actionHandler(context);
            audit(req, actionName, context.guildId);
            emitGuildState(context.guildId);
            res.json({
                ok: true,
                guildId: context.guildId,
                ...result
            });
        } catch (error) {
            if (error?.status) {
                sendApiError(res, error);
                return;
            }
            sendApiError(res, createApiError(400, error.code || 'MUSIC_ACTION_FAILED', error.message));
        }
    }

    app.post('/api/music/play', requireAuth, requireCsrf, rateLimiter, ensureMusicReady, async (req, res) => {
        await runMusicAction(req, res, 'play', async (context) => {
            const query = String(req.body?.query || '').trim();
            if (!query) throw createApiError(400, 'QUERY_REQUIRED', 'Thiếu query bài hát.');

            const metadataChannel = context.guild.systemChannel
                || context.guild.channels.cache.find(channel => typeof channel.isTextBased === 'function' && channel.isTextBased());

            const { result, state } = await musicControl.play({
                client,
                guildId: context.guildId,
                query,
                requestedBy: { username: req.session.user.username || req.session.user.id },
                channel: context.memberVoiceChannel,
                metadataChannel
            });

            return {
                state,
                searchResultType: result.searchResult?.playlist ? 'playlist' : 'track'
            };
        }, false);
    });

    app.post('/api/music/pause', requireAuth, requireCsrf, rateLimiter, ensureMusicReady, async (req, res) => {
        await runMusicAction(req, res, 'pause', async (context) => ({
            state: musicControl.pause(client, context.guildId)
        }));
    });

    app.post('/api/music/resume', requireAuth, requireCsrf, rateLimiter, ensureMusicReady, async (req, res) => {
        await runMusicAction(req, res, 'resume', async (context) => ({
            state: musicControl.resume(client, context.guildId)
        }));
    });

    app.post('/api/music/skip', requireAuth, requireCsrf, rateLimiter, ensureMusicReady, async (req, res) => {
        await runMusicAction(req, res, 'skip', async (context) => ({
            state: musicControl.skip(client, context.guildId)
        }));
    });

    app.post('/api/music/stop', requireAuth, requireCsrf, rateLimiter, ensureMusicReady, async (req, res) => {
        await runMusicAction(req, res, 'stop', async (context) => ({
            state: musicControl.stop(client, context.guildId)
        }));
    });

    app.post('/api/music/seek', requireAuth, requireCsrf, rateLimiter, ensureMusicReady, async (req, res) => {
        await runMusicAction(req, res, 'seek', async (context) => {
            const seconds = Number(req.body?.seconds);
            if (Number.isNaN(seconds)) throw createApiError(400, 'SEEK_INVALID', 'Giá trị seek không hợp lệ.');
            return { state: musicControl.seek(client, context.guildId, seconds) };
        });
    });

    app.post('/api/music/volume', requireAuth, requireCsrf, rateLimiter, ensureMusicReady, async (req, res) => {
        await runMusicAction(req, res, 'volume', async (context) => {
            const volume = Number(req.body?.volume);
            if (Number.isNaN(volume)) throw createApiError(400, 'VOLUME_INVALID', 'Giá trị volume không hợp lệ.');
            return { state: musicControl.setVolume(client, context.guildId, volume) };
        });
    });

    app.get('/api/music/queue', requireAuth, rateLimiter, ensureMusicReady, async (req, res) => {
        await runMusicAction(req, res, 'queue', async (context) => ({
            state: musicControl.createState(client, context.guildId)
        }), false);
    });

    app.get('/api/music/now-playing', requireAuth, rateLimiter, ensureMusicReady, async (req, res) => {
        await runMusicAction(req, res, 'now-playing', async (context) => ({
            state: musicControl.createState(client, context.guildId)
        }), false);
    });

    io.on('connection', socket => {
        const sessionUser = socket.request?.session?.user;
        if (!sessionUser?.id) {
            socket.emit('auth:error', { message: 'Unauthorized' });
            socket.disconnect();
            return;
        }

        socket.on('guild:subscribe', async ({ guildId }) => {
            try {
                const guild = await client.guilds.fetch(guildId);
                const member = await guild.members.fetch(sessionUser.id);
                if (!member) return;
                socket.join(`guild:${guildId}`);
                socket.emit('music:state', {
                    guildId,
                    state: musicControl.createState(client, guildId),
                    at: Date.now()
                });
            } catch {
                socket.emit('guild:error', { guildId, message: 'Không thể subscribe server này.' });
            }
        });
    });

    client.player.events.on('playerStart', queue => {
        emitGuildState(resolveGuildIdFromQueue(queue), 'music:track_start');
    });
    client.player.events.on('audioTrackAdd', queue => {
        emitGuildState(resolveGuildIdFromQueue(queue), 'music:queue_update');
    });
    client.player.events.on('audioTracksAdd', queue => {
        emitGuildState(resolveGuildIdFromQueue(queue), 'music:queue_update');
    });
    client.player.events.on('playerSkip', queue => {
        emitGuildState(resolveGuildIdFromQueue(queue), 'music:track_skip');
    });
    client.player.events.on('playerFinish', queue => {
        emitGuildState(resolveGuildIdFromQueue(queue), 'music:track_end');
    });
    client.player.events.on('playerTrigger', queue => {
        emitGuildState(resolveGuildIdFromQueue(queue), 'music:queue_update');
    });
    client.player.events.on('disconnect', queue => {
        emitGuildState(resolveGuildIdFromQueue(queue), 'music:disconnect');
    });
    client.player.events.on('error', queue => {
        emitGuildState(resolveGuildIdFromQueue(queue), 'music:error');
    });
    client.player.events.on('playerError', queue => {
        emitGuildState(resolveGuildIdFromQueue(queue), 'music:error');
    });
    client.player.events.on('emptyQueue', queue => {
        emitGuildState(resolveGuildIdFromQueue(queue), 'music:queue_empty');
    });

    const progressInterval = setInterval(() => {
        try {
            for (const queue of client.player.nodes.cache.values()) {
                const guildId = resolveGuildIdFromQueue(queue);
                if (guildId) emitGuildState(guildId, 'music:progress');
            }
        } catch (error) {
            console.error('Failed to emit progress tick:', error);
        }
    }, 2000);

    const port = Number(process.env.WEB_PORT) || 3000;
    server.listen(port, () => {
        console.log(`Web dashboard running at http://localhost:${port}/dashboard`);
    });
    server.on('close', () => clearInterval(progressInterval));

    return {
        app,
        io,
        server,
        emitGuildState,
        progressInterval
    };
}

module.exports = {
    setupWebServer
};
