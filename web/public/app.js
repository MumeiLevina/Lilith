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
const genreChipButtons = Array.from(document.querySelectorAll('.chip-btn'));
const favoriteButtons = Array.from(document.querySelectorAll('.favorite-btn'));
const suggestionTitle = document.getElementById('suggestionTitle');
const genreSuggestions = document.getElementById('genreSuggestions');

let csrfToken = null;
let socket = null;
let currentGuildId = null;
let authenticated = false;
const initialGuildId = new URLSearchParams(window.location.search).get('guildId');
let activeGenreKey = 'classic';

const GENRE_LABELS = {
  classic: 'Classic',
  '90s': '90s',
  new: 'New',
  instrumental: 'Instrumental',
  modern: 'Modern'
};

const GENRE_SUGGESTIONS = {
  classic: [
    { title: 'Canon in D', artist: 'Pachelbel', duration: '06:05', query: 'Canon in D Pachelbel' },
    { title: 'Nocturne Op.9 No.2', artist: 'Chopin', duration: '04:32', query: 'Nocturne Op 9 No 2 Chopin' },
    { title: 'Moonlight Sonata', artist: 'Beethoven', duration: '05:15', query: 'Moonlight Sonata Beethoven' }
  ],
  '90s': [
    { title: 'Wonderwall', artist: 'Oasis', duration: '04:18', query: 'Oasis Wonderwall' },
    { title: 'Linger', artist: 'The Cranberries', duration: '04:35', query: 'The Cranberries Linger' },
    { title: 'Losing My Religion', artist: 'R.E.M.', duration: '04:29', query: 'REM Losing My Religion' }
  ],
  new: [
    { title: 'Espresso', artist: 'Sabrina Carpenter', duration: '02:55', query: 'Sabrina Carpenter Espresso' },
    { title: 'Birds of a Feather', artist: 'Billie Eilish', duration: '03:30', query: 'Billie Eilish Birds of a Feather' },
    { title: 'Fortnight', artist: 'Taylor Swift', duration: '03:48', query: 'Taylor Swift Fortnight' }
  ],
  instrumental: [
    { title: 'Time', artist: 'Hans Zimmer', duration: '04:35', query: 'Hans Zimmer Time' },
    { title: 'A Sky Full of Stars Piano', artist: 'The Piano Guys', duration: '04:11', query: 'A Sky Full of Stars Piano' },
    { title: 'Experience', artist: 'Ludovico Einaudi', duration: '05:15', query: 'Ludovico Einaudi Experience' }
  ],
  modern: [
    { title: 'Blinding Lights', artist: 'The Weeknd', duration: '03:20', query: 'The Weeknd Blinding Lights' },
    { title: 'Levitating', artist: 'Dua Lipa', duration: '03:23', query: 'Dua Lipa Levitating' },
    { title: 'As It Was', artist: 'Harry Styles', duration: '02:47', query: 'Harry Styles As It Was' }
  ]
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

function syncGuildQueryParam(guildId) {
  const url = new URL(window.location.href);
  if (guildId) {
    url.searchParams.set('guildId', guildId);
  } else {
    url.searchParams.delete('guildId');
  }
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function normalizeGenre(rawGenre) {
  const genre = String(rawGenre || '').trim().toLowerCase();
  return GENRE_SUGGESTIONS[genre] ? genre : 'classic';
}

function updateGenreSelectionUi(genreKey) {
  genreChipButtons.forEach(button => {
    button.classList.toggle('is-active', button.dataset.genre === genreKey);
    button.classList.toggle('active', button.dataset.genre === genreKey);
  });

  favoriteButtons.forEach(button => {
    button.classList.toggle('is-active', button.dataset.genre === genreKey);
  });
}

function renderGenreSuggestions(genreKey) {
  if (!genreSuggestions || !suggestionTitle) return;

  const normalizedGenre = normalizeGenre(genreKey);
  activeGenreKey = normalizedGenre;
  updateGenreSelectionUi(normalizedGenre);

  const label = GENRE_LABELS[normalizedGenre] || GENRE_LABELS.classic;
  suggestionTitle.textContent = `Suggested for ${label}`;

  const suggestions = GENRE_SUGGESTIONS[normalizedGenre] || [];
  if (!suggestions.length) {
    genreSuggestions.innerHTML = '<li class="suggestion-empty">No recommendations for this category yet.</li>';
    return;
  }

  genreSuggestions.innerHTML = suggestions.map((song, index) => {
    const safeTitle = escapeHtml(song.title);
    const safeArtist = escapeHtml(song.artist);
    const safeDuration = escapeHtml(song.duration);
    const encodedQuery = encodeURIComponent(song.query || song.title || '');
    const encodedTitle = encodeURIComponent(song.title || 'Track');

    return `
      <li class="suggestion-item">
        <div class="suggestion-main">
          <p class="suggestion-track">${index + 1}. ${safeTitle}</p>
          <p class="suggestion-meta">${safeArtist} · ${safeDuration}</p>
        </div>
        <button
          class="suggestion-action"
          type="button"
          data-suggestion-query="${encodedQuery}"
          data-suggestion-title="${encodedTitle}"
        >Use</button>
      </li>
    `;
  }).join('');
}

function renderState(state) {
  if (!state || !state.active || !state.nowPlaying) {
    trackTitle.textContent = 'No track';
    queueList.innerHTML = '<li class="queue-empty">No tracks in queue</li>';
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
    queueList.innerHTML = '<li class="queue-empty">No tracks in queue</li>';
  } else {
    queueList.innerHTML = state.queue
      .slice(0, 20)
      .map((track, idx) => {
        const safeTitle = escapeHtml(track.title || 'Unknown track');
        const safeDuration = escapeHtml(track.duration || '0:00');
        return `
          <li class="queue-item">
            <div class="queue-thumb" aria-hidden="true"></div>
            <div>
              <p class="queue-title">${idx + 1}. ${safeTitle}</p>
              <p class="queue-meta">${safeDuration}</p>
            </div>
            <span class="queue-cta" aria-hidden="true">▶</span>
          </li>
        `;
      })
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

  const preferredGuild = guilds.find(g => g.id === initialGuildId);
  currentGuildId = preferredGuild?.id || guilds[0]?.id || null;
  if (currentGuildId) {
    guildSelect.value = currentGuildId;
    syncGuildQueryParam(currentGuildId);
    connectSocket();
    socket.emit('guild:subscribe', { guildId: currentGuildId });
    await refreshState();
  } else {
    syncGuildQueryParam(null);
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
  const loginGuildId = currentGuildId || initialGuildId || guildSelect.value || '';
  const loginUrl = new URL('/auth/discord', window.location.origin);

  if (loginGuildId) {
    loginUrl.searchParams.set('guildId', loginGuildId);
  }

  window.location.href = `${loginUrl.pathname}${loginUrl.search}`;
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
  if (!currentGuildId) {
    syncGuildQueryParam(null);
    return;
  }
  syncGuildQueryParam(currentGuildId);
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

genreChipButtons.forEach(button => {
  button.addEventListener('click', () => {
    renderGenreSuggestions(button.dataset.genre);
  });
});

favoriteButtons.forEach(button => {
  button.addEventListener('click', () => {
    renderGenreSuggestions(button.dataset.genre);
  });
});

if (genreSuggestions) {
  genreSuggestions.addEventListener('click', event => {
    const targetButton = event.target.closest('[data-suggestion-query]');
    if (!targetButton) return;

    const query = decodeURIComponent(targetButton.dataset.suggestionQuery || '');
    const title = decodeURIComponent(targetButton.dataset.suggestionTitle || 'track');
    if (!query) return;

    queryInput.value = query;
    queryInput.focus();
    queryInput.select();
    setStatus(`Selected suggestion: ${title}`);
  });
}

(async function boot() {
  try {
    renderGenreSuggestions(activeGenreKey);
    await loadAuth();
    await loadGuilds();
  } catch (error) {
    setStatus(error.message);
  }
})();
