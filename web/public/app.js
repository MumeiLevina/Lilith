const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const guildSelect = document.getElementById('guildSelect');
const queryInput = document.getElementById('queryInput');
const trackTitle = document.getElementById('trackTitle');
const queueList = document.getElementById('queueList');
const seekBar = document.getElementById('seekBar');
const volumeInput = document.getElementById('volumeInput');
const currentTime = document.getElementById('currentTime');
const totalTime = document.getElementById('totalTime');
const statusText = document.getElementById('statusText');
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');
const skipBtn = document.getElementById('skipBtn');
const stopBtn = document.getElementById('stopBtn');

let csrfToken = null;
let socket = null;
let currentGuildId = null;
let authenticated = false;

function formatMs(ms) {
  if (!ms || Number.isNaN(ms)) return '0:00';
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function setStatus(text) {
  statusText.textContent = text;
}

function renderState(state) {
  if (!state || !state.active || !state.nowPlaying) {
    trackTitle.textContent = 'No track';
    queueList.innerHTML = '<li>Không có bài chờ</li>';
    seekBar.value = 0;
    currentTime.textContent = '0:00';
    totalTime.textContent = '0:00';
    return;
  }

  trackTitle.textContent = state.nowPlaying.title || 'Unknown';
  seekBar.value = Number(state.progressPercent || 0);
  totalTime.textContent = state.nowPlaying.duration || '0:00';
  const durationMs = Number(state.nowPlaying.durationMs || 0);
  currentTime.textContent = formatMs((Number(state.progressPercent || 0) / 100) * durationMs);
  volumeInput.value = Number(state.volume || 100);

  if (!state.queue.length) {
    queueList.innerHTML = '<li>Không có bài chờ</li>';
  } else {
    queueList.innerHTML = state.queue
      .slice(0, 20)
      .map((track, idx) => `<li>${idx + 1}. ${track.title} <small>(${track.duration})</small></li>`)
      .join('');
  }
}

async function api(path, options = {}) {
  const method = options.method || 'GET';
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const response = await fetch(path, {
    credentials: 'include',
    ...options,
    method,
    headers
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data?.error?.message || `Request failed: ${response.status}`);
  }
  return data;
}

async function loadAuth() {
  const me = await api('/api/auth/me');
  authenticated = !!me.authenticated;

  if (!authenticated) {
    loginBtn.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
    setStatus('Please login to continue.');
    return;
  }

  csrfToken = me.csrfToken;
  loginBtn.classList.add('hidden');
  logoutBtn.classList.remove('hidden');
  setStatus(`Logged in as ${me.user.username}`);
}

async function loadGuilds() {
  if (!authenticated) return;
  const { guilds } = await api('/api/guilds');
  guildSelect.innerHTML = guilds.length
    ? guilds.map(g => `<option value="${g.id}">${g.name}</option>`).join('')
    : '<option value="">Không có server chung</option>';

  currentGuildId = guilds[0]?.id || null;
  if (currentGuildId) {
    connectSocket();
    socket.emit('guild:subscribe', { guildId: currentGuildId });
    await refreshState();
  }
}

function connectSocket() {
  if (socket) return;
  socket = io();
  const onState = payload => {
    if (!payload || payload.guildId !== currentGuildId) return;
    renderState(payload.state);
  };
  socket.on('music:state', onState);
  socket.on('music:progress', onState);
  socket.on('music:track_start', onState);
  socket.on('music:track_end', onState);
  socket.on('music:queue_update', onState);
  socket.on('music:queue_empty', onState);
  socket.on('music:error', ({ message }) => setStatus(message || 'Music error'));
}

function disconnectSocket() {
  if (!socket) return;
  socket.disconnect();
  socket = null;
}

async function refreshState() {
  if (!currentGuildId) return;
  const data = await api(`/api/music/now-playing?guildId=${encodeURIComponent(currentGuildId)}`);
  renderState(data.state);
}

async function doMusicAction(path, body = {}) {
  if (!currentGuildId) {
    setStatus('Vui lòng chọn server.');
    return;
  }
  const data = await api(path, {
    method: 'POST',
    body: JSON.stringify({ guildId: currentGuildId, ...body })
  });
  if (data.state) renderState(data.state);
}

loginBtn.addEventListener('click', () => {
  window.location.href = '/auth/discord';
});

logoutBtn.addEventListener('click', async () => {
  try {
    disconnectSocket();
    await api('/auth/logout', { method: 'POST' });
    window.location.reload();
  } catch (error) {
    setStatus(error.message);
  }
});

window.addEventListener('beforeunload', () => {
  disconnectSocket();
});

guildSelect.addEventListener('change', async (event) => {
  currentGuildId = event.target.value;
  if (!currentGuildId) return;
  connectSocket();
  socket.emit('guild:subscribe', { guildId: currentGuildId });
  await refreshState();
});

playBtn.addEventListener('click', async () => {
  try {
    const query = queryInput.value.trim();
    if (!query) {
      setStatus('Nhập từ khóa hoặc URL trước khi Play.');
      return;
    }
    await doMusicAction('/api/music/play', { query });
    setStatus('Play request sent.');
  } catch (error) {
    setStatus(error.message);
  }
});

pauseBtn.addEventListener('click', async () => {
  try { await doMusicAction('/api/music/pause'); setStatus('Paused.'); } catch (error) { setStatus(error.message); }
});
resumeBtn.addEventListener('click', async () => {
  try { await doMusicAction('/api/music/resume'); setStatus('Resumed.'); } catch (error) { setStatus(error.message); }
});
skipBtn.addEventListener('click', async () => {
  try { await doMusicAction('/api/music/skip'); setStatus('Skipped.'); } catch (error) { setStatus(error.message); }
});
stopBtn.addEventListener('click', async () => {
  try { await doMusicAction('/api/music/stop'); setStatus('Stopped.'); } catch (error) { setStatus(error.message); }
});

seekBar.addEventListener('change', async () => {
  try {
    const data = await api(`/api/music/now-playing?guildId=${encodeURIComponent(currentGuildId)}`);
    const durationMs = Number(data.state?.nowPlaying?.durationMs || 0);
    if (!durationMs) return;
    const targetSeconds = ((Number(seekBar.value) || 0) / 100) * (durationMs / 1000);
    await doMusicAction('/api/music/seek', { seconds: targetSeconds });
  } catch (error) {
    setStatus(error.message);
  }
});

volumeInput.addEventListener('change', async () => {
  try {
    await doMusicAction('/api/music/volume', { volume: Number(volumeInput.value) || 100 });
    setStatus('Volume updated.');
  } catch (error) {
    setStatus(error.message);
  }
});

(async function boot() {
  try {
    await loadAuth();
    await loadGuilds();
  } catch (error) {
    setStatus(error.message);
  }
})();
