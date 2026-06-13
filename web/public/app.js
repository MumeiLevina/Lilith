const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const guildSelect = document.getElementById('guildSelect');
const queryInput = document.getElementById('queryInput');
const trackTitle = document.getElementById('trackTitle');
const queueHeading = document.getElementById('queueHeading');
const queueList = document.getElementById('queueList');
const queuePagination = document.getElementById('queuePagination');
const queuePrevBtn = document.getElementById('queuePrevBtn');
const queueNextBtn = document.getElementById('queueNextBtn');
const queuePageInfo = document.getElementById('queuePageInfo');
const seekBar = document.getElementById('seekBar');
const volumeInput = document.getElementById('volumeInput');
const currentTime = document.getElementById('currentTime');
const totalTime = document.getElementById('totalTime');
const statusText = document.getElementById('statusText');
const pauseBtn = document.getElementById('pauseBtn');
const skipBtn = document.getElementById('skipBtn');
const stopBtn = document.getElementById('stopBtn');
const seekForwardBtn = document.getElementById('seekForwardBtn');
const loopBtn = document.getElementById('loopBtn');
const homeNavBtn = document.getElementById('homeNavBtn');
const favoritesNavBtn = document.getElementById('favoritesNavBtn');
const saveCurrentBtn = document.getElementById('saveCurrentBtn');
const genreChipButtons = Array.from(document.querySelectorAll('.chip-btn'));
const suggestionTitle = document.getElementById('suggestionTitle');
const suggestionHint = document.getElementById('suggestionHint');
const genreSuggestions = document.getElementById('genreSuggestions');

const FAVORITES_STORAGE_KEY = 'lilith:favorites:v1';
const initialGuildId = new URLSearchParams(window.location.search).get('guildId');

let csrfToken = null;
let socket = null;
let currentGuildId = null;
let authenticated = false;
let activeGenreKey = 'classic';
let favoritesViewActive = false;
let queuePage = 1;
let favoritesPage = 1;
let latestState = null;
let favoriteTracks = loadFavorites();

const DEFAULT_SUGGESTION_HINT = 'Tap a category to get music ideas.';
const SEARCH_RESULT_LIMIT = 8;
const QUEUE_PAGE_SIZE = 5;

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

function decodeDatasetValue(value) {
  try {
    return decodeURIComponent(String(value || ''));
  } catch {
    return String(value || '');
  }
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

function paginateItems(items, page, pageSize) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const startIndex = (currentPage - 1) * pageSize;

  return {
    currentPage,
    totalPages,
    startIndex,
    pageItems: items.slice(startIndex, startIndex + pageSize)
  };
}

function updateQueuePagination(totalItems, currentPage, totalPages) {
  if (!queuePagination || !queuePrevBtn || !queueNextBtn || !queuePageInfo) return;

  const showPagination = totalItems > QUEUE_PAGE_SIZE;
  queuePagination.classList.toggle('hidden', !showPagination);
  if (!showPagination) return;

  queuePageInfo.textContent = `Page ${currentPage} / ${totalPages}`;
  queuePrevBtn.disabled = currentPage <= 1;
  queueNextBtn.disabled = currentPage >= totalPages;
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

function loadFavorites() {
  try {
    const rawValue = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!rawValue) return [];

    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(track => track && typeof track === 'object' && typeof track.key === 'string')
      .slice(0, 200);
  } catch {
    return [];
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteTracks.slice(0, 200)));
  } catch {
    // Ignore quota/storage errors so playback controls still work.
  }
}

function createTrackKey(track) {
  const urlPart = String(track?.url || '').trim().toLowerCase();
  if (urlPart) return `url:${urlPart}`;

  const titlePart = String(track?.title || '').trim().toLowerCase();
  const durationPart = String(track?.duration || '').trim();
  return `title:${titlePart}|duration:${durationPart}`;
}

function toFavoriteTrack(track) {
  return {
    key: createTrackKey(track),
    title: String(track?.title || 'Unknown track'),
    duration: String(track?.duration || '0:00'),
    durationMs: Number(track?.durationMs) || null,
    url: String(track?.url || ''),
    source: String(track?.source || ''),
    requestedBy: String(track?.requestedBy || ''),
    addedAt: Date.now()
  };
}

function isTrackFavorited(track) {
  const key = createTrackKey(track);
  return favoriteTracks.some(item => item.key === key);
}

function toggleFavoriteTrack(track) {
  const key = createTrackKey(track);
  const existingIndex = favoriteTracks.findIndex(item => item.key === key);

  if (existingIndex >= 0) {
    const [removed] = favoriteTracks.splice(existingIndex, 1);
    saveFavorites();
    return { action: 'removed', track: removed };
  }

  const favoriteTrack = toFavoriteTrack(track);
  favoriteTracks.unshift(favoriteTrack);
  favoriteTracks = favoriteTracks.slice(0, 200);
  saveFavorites();
  return { action: 'added', track: favoriteTrack };
}

async function playTrackByQuery(query, title = 'Track') {
  const normalizedQuery = String(query || '').trim();
  if (!normalizedQuery) {
    setStatus('No playable source found for this track.');
    return;
  }

  const result = await doMusicAction('/api/music/play', { query: normalizedQuery, playNow: true });
  if (!result) return;

  queryInput.value = normalizedQuery;
  setStatus(`Đang phát: ${title}`);
}

function buildSearchCandidates() {
  const candidates = [];
  const seen = new Set();

  const pushCandidate = (track, source = '') => {
    if (!track) return;

    const title = String(track.title || '').trim();
    const artist = String(track.artist || '').trim();
    const duration = String(track.duration || '').trim();
    const query = String(track.query || track.url || title).trim();
    if (!title && !query) return;

    const key = `${query.toLowerCase()}|${title.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);

    candidates.push({
      title: title || query,
      artist,
      duration,
      query: query || title,
      source: String(source || track.source || '').trim()
    });
  };

  Object.values(GENRE_SUGGESTIONS).forEach(group => {
    group.forEach(song => {
      pushCandidate(song, 'Category');
    });
  });

  favoriteTracks.forEach(track => {
    pushCandidate(track, 'Favorite');
  });

  if (latestState?.nowPlaying) {
    pushCandidate(latestState.nowPlaying, 'Now Playing');
  }

  (latestState?.queue || []).forEach(track => {
    pushCandidate(track, 'Queue');
  });

  return candidates;
}

function renderSearchSuggestions(rawQuery) {
  if (!genreSuggestions || !suggestionTitle) return;

  const query = String(rawQuery || '').trim();
  if (!query) {
    renderGenreSuggestions(activeGenreKey);
    return;
  }

  const normalizedQuery = query.toLowerCase();
  const matches = buildSearchCandidates()
    .filter(item => {
      const haystack = `${item.title} ${item.artist} ${item.query} ${item.source}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    })
    .slice(0, SEARCH_RESULT_LIMIT);

  suggestionTitle.textContent = `Search: ${query}`;
  if (suggestionHint) {
    suggestionHint.textContent = 'Tap play to start immediately, or press Enter to play this query directly.';
  }

  if (!matches.length) {
    genreSuggestions.innerHTML = `<li class="suggestion-empty">No quick match for \"${escapeHtml(query)}\". Press Enter to play this query directly.</li>`;
    return;
  }

  genreSuggestions.innerHTML = matches.map((song, index) => {
    const safeTitle = escapeHtml(song.title);
    const metaParts = [song.artist, song.source, song.duration].filter(Boolean).map(escapeHtml);
    const safeMeta = metaParts.join(' · ');
    const encodedQuery = encodeURIComponent(song.query || song.title || query);
    const encodedTitle = encodeURIComponent(song.title || query);

    return `
      <li class="suggestion-item">
        <div class="suggestion-main">
          <p class="suggestion-track">${index + 1}. ${safeTitle}</p>
          <p class="suggestion-meta">${safeMeta || 'Suggested result'}</p>
        </div>
        <button
          class="suggestion-action"
          type="button"
          data-suggestion-play-query="${encodedQuery}"
          data-suggestion-play-title="${encodedTitle}"
          aria-label="Play ${safeTitle}"
        >&#9654;</button>
      </li>
    `;
  }).join('');
}

function updateGenreSelectionUi(genreKey) {
  genreChipButtons.forEach(button => {
    button.classList.toggle('is-active', button.dataset.genre === genreKey);
    button.classList.toggle('active', button.dataset.genre === genreKey);
  });
}

function renderGenreSuggestions(genreKey) {
  if (!genreSuggestions || !suggestionTitle) return;

  const normalizedGenre = normalizeGenre(genreKey);
  activeGenreKey = normalizedGenre;
  updateGenreSelectionUi(normalizedGenre);

  const label = GENRE_LABELS[normalizedGenre] || GENRE_LABELS.classic;
  suggestionTitle.textContent = `Suggested for ${label}`;
  if (suggestionHint) {
    suggestionHint.textContent = DEFAULT_SUGGESTION_HINT;
  }

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
          data-suggestion-play-query="${encodedQuery}"
          data-suggestion-play-title="${encodedTitle}"
          aria-label="Play ${safeTitle}"
        >&#9654;</button>
      </li>
    `;
  }).join('');
}

function updateSaveCurrentButton(track) {
  if (!saveCurrentBtn) return;

  if (!track) {
    saveCurrentBtn.disabled = true;
    saveCurrentBtn.classList.remove('is-active');
    saveCurrentBtn.textContent = '♡ Save';
    return;
  }

  saveCurrentBtn.disabled = false;
  const favorited = isTrackFavorited(track);
  saveCurrentBtn.classList.toggle('is-active', favorited);
  saveCurrentBtn.textContent = favorited ? '❤ Saved' : '♡ Save';
}

function renderQueueList(state) {
  if (!queueHeading || !queueList) return;

  queueHeading.textContent = 'Favorite Playlists';
  const tracks = state?.queue || [];

  if (!tracks.length) {
    queueList.innerHTML = '<li class="queue-empty">No tracks in queue</li>';
    updateQueuePagination(0, 1, 1);
    return;
  }

  const { currentPage, totalPages, startIndex, pageItems } = paginateItems(tracks, queuePage, QUEUE_PAGE_SIZE);
  queuePage = currentPage;

  queueList.innerHTML = pageItems
    .map((track, idx) => {
      const itemIndex = startIndex + idx;
      const safeTitle = escapeHtml(track.title || 'Unknown track');
      const safeDuration = escapeHtml(track.duration || '0:00');
      const favorited = isTrackFavorited(track);
      const encodedQuery = encodeURIComponent(String(track.url || track.title || ''));
      const encodedTitle = encodeURIComponent(String(track.title || 'Track'));

      return `
        <li class="queue-item">
          <div class="queue-thumb" aria-hidden="true"></div>
          <div>
            <p class="queue-title">${itemIndex + 1}. ${safeTitle}</p>
            <p class="queue-meta">${safeDuration}</p>
          </div>
          <div class="queue-actions">
            <button
              class="queue-play-btn"
              type="button"
              data-queue-play-query="${encodedQuery}"
              data-queue-play-title="${encodedTitle}"
              aria-label="Play ${safeTitle}"
            >&#9654;</button>
            <button
              class="queue-favorite-btn${favorited ? ' is-active' : ''}"
              type="button"
              data-queue-favorite-index="${itemIndex}"
              aria-label="Toggle favorite"
            >${favorited ? '❤' : '♡'}</button>
          </div>
        </li>
      `;
    })
    .join('');

  updateQueuePagination(tracks.length, currentPage, totalPages);
}

function renderFavoritesList() {
  if (!queueHeading || !queueList) return;

  queueHeading.textContent = 'Saved Favorites';
  const tracks = favoriteTracks;

  if (!tracks.length) {
    queueList.innerHTML = '<li class="queue-empty">You have not saved any favorite tracks yet.</li>';
    updateQueuePagination(0, 1, 1);
    return;
  }

  const { currentPage, totalPages, startIndex, pageItems } = paginateItems(tracks, favoritesPage, QUEUE_PAGE_SIZE);
  favoritesPage = currentPage;

  queueList.innerHTML = pageItems
    .map((track, idx) => {
      const itemIndex = startIndex + idx;
      const safeTitle = escapeHtml(track.title || 'Unknown track');
      const safeDuration = escapeHtml(track.duration || '0:00');
      const safeSource = escapeHtml(track.source || 'Unknown source');
      const encodedQuery = encodeURIComponent(String(track.url || track.title || ''));
      const encodedTitle = encodeURIComponent(String(track.title || 'Track'));

      return `
        <li class="queue-item">
          <div class="queue-thumb" aria-hidden="true"></div>
          <div>
            <p class="queue-title">${itemIndex + 1}. ${safeTitle}</p>
            <p class="queue-meta">${safeDuration} · ${safeSource}</p>
          </div>
          <div class="queue-actions">
            <button
              class="queue-play-btn"
              type="button"
              data-favorite-play-query="${encodedQuery}"
              data-favorite-play-title="${encodedTitle}"
              aria-label="Play ${safeTitle}"
            >&#9654;</button>
            <button
              class="queue-favorite-btn is-active"
              type="button"
              data-favorite-remove-index="${itemIndex}"
              aria-label="Remove favorite"
            >❤</button>
          </div>
        </li>
      `;
    })
    .join('');

  updateQueuePagination(tracks.length, currentPage, totalPages);
}

function setFavoritesView(active) {
  favoritesViewActive = !!active;
  homeNavBtn?.classList.toggle('is-active', !favoritesViewActive);
  favoritesNavBtn?.classList.toggle('is-active', favoritesViewActive);

  if (favoritesViewActive) {
    favoritesPage = 1;
    renderFavoritesList();
    return;
  }

  queuePage = 1;
  renderQueueList(latestState);
}

function updateLoopButtonState(state) {
  const repeatTrackEnabled = state?.repeatMode === 'track';
  loopBtn?.classList.toggle('is-active', !!repeatTrackEnabled);
}

function updatePauseButtonState(state) {
  if (!pauseBtn) return;

  const paused = !!state?.paused;
  pauseBtn.textContent = paused ? '▷' : '❚❚';
  pauseBtn.setAttribute('aria-label', paused ? 'Resume' : 'Pause');
}

function renderState(state) {
  latestState = state || null;

  if (!state || !state.active || !state.nowPlaying) {
    trackTitle.textContent = 'No track';
    seekBar.value = 0;
    currentTime.textContent = '0:00';
    totalTime.textContent = '0:00';
    updateSaveCurrentButton(null);
    updatePauseButtonState({ paused: false });
    updateLoopButtonState({ repeatMode: 'off' });

    if (!favoritesViewActive) {
      renderQueueList(state);
    }
    return;
  }

  trackTitle.textContent = state.nowPlaying.title || 'Unknown';
  seekBar.value = Number(state.progressPercent || 0);
  totalTime.textContent = state.nowPlaying.duration || '0:00';
  const durationMs = Number(state.nowPlaying.durationMs || 0);
  currentTime.textContent = formatMs((Number(state.progressPercent || 0) / 100) * durationMs);
  volumeInput.value = Number(state.volume || 100);

  updateSaveCurrentButton(state.nowPlaying);
  updatePauseButtonState(state);
  updateLoopButtonState(state);

  if (!favoritesViewActive) {
    renderQueueList(state);
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
    : '<option value="">No accessible servers found</option>';

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
    setStatus('No accessible dashboard server. Ask DJ/Admin to grant access via /dashboard grant.');
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
    setStatus('Please select a server.');
    return null;
  }

  const data = await api(path, {
    method: 'POST',
    body: JSON.stringify({ guildId: currentGuildId, ...body })
  });

  if (data.state) {
    renderState(data.state);
  }

  return data;
}

async function requestPlayFromInput() {
  try {
    const query = queryInput.value.trim();
    if (!query) {
      setStatus('Enter a keyword or URL before playing.');
      return;
    }

    await playTrackByQuery(query, query);
  } catch (error) {
    setStatus(error.message);
  }
}

async function seekByOffset(secondsOffset) {
  try {
    const state = latestState;
    if (!state?.active || !state.nowPlaying) {
      setStatus('No active track to seek.');
      return;
    }

    const durationMs = Number(state.nowPlaying.durationMs || 0);
    if (!durationMs) {
      setStatus('This track cannot be seeked.');
      return;
    }

    const currentMs = (Number(state.progressPercent || 0) / 100) * durationMs;
    const targetMs = Math.max(0, Math.min(durationMs, currentMs + (Number(secondsOffset) * 1000)));
    await doMusicAction('/api/music/seek', { seconds: targetMs / 1000 });
    setStatus(`Seeked ${secondsOffset > 0 ? '+' : ''}${Math.trunc(secondsOffset)} seconds.`);
  } catch (error) {
    setStatus(error.message);
  }
}

async function toggleRepeatTrack() {
  try {
    const data = await doMusicAction('/api/music/repeat');
    if (!data) return;

    if (data.repeatEnabled) {
      setStatus('Repeat for the current track is on.');
    } else {
      setStatus('Repeat for the current track is off.');
    }
  } catch (error) {
    setStatus(error.message);
  }
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

pauseBtn.addEventListener('click', async () => {
  try {
    if (!latestState?.active || !latestState.nowPlaying) {
      setStatus('No track is currently playing.');
      return;
    }

    if (latestState.paused) {
      await doMusicAction('/api/music/resume');
      setStatus('Resumed.');
      return;
    }

    await doMusicAction('/api/music/pause');
    setStatus('Paused.');
  } catch (error) {
    setStatus(error.message);
  }
});

seekForwardBtn.addEventListener('click', async () => {
  await seekByOffset(10);
});

skipBtn.addEventListener('click', async () => {
  try {
    await doMusicAction('/api/music/skip');
    setStatus('Skipped.');
  } catch (error) {
    setStatus(error.message);
  }
});

stopBtn.addEventListener('click', async () => {
  try {
    await doMusicAction('/api/music/stop');
    setStatus('Stopped.');
  } catch (error) {
    setStatus(error.message);
  }
});

loopBtn.addEventListener('click', async () => {
  await toggleRepeatTrack();
});

saveCurrentBtn?.addEventListener('click', () => {
  if (!latestState?.active || !latestState.nowPlaying) {
    setStatus('No active track to save as favorite.');
    return;
  }

  const result = toggleFavoriteTrack(latestState.nowPlaying);
  updateSaveCurrentButton(latestState.nowPlaying);

  if (favoritesViewActive) {
    renderFavoritesList();
  } else {
    renderQueueList(latestState);
  }

  if (result.action === 'added') {
    setStatus(`Added to favorites: ${result.track.title}`);
  } else {
    setStatus(`Removed from favorites: ${result.track.title}`);
  }
});

favoritesNavBtn?.addEventListener('click', () => {
  setFavoritesView(!favoritesViewActive);
  setStatus(favoritesViewActive ? 'Viewing saved favorites.' : 'Back to current queue.');
});

homeNavBtn?.addEventListener('click', () => {
  setFavoritesView(false);
  setStatus('Back to the current playlist.');
});

queryInput.addEventListener('keydown', async (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  await requestPlayFromInput();
});

queryInput.addEventListener('input', () => {
  renderSearchSuggestions(queryInput.value);
});

seekBar.addEventListener('change', async () => {
  try {
    const state = latestState;
    const durationMs = Number(state?.nowPlaying?.durationMs || 0);
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

queuePrevBtn?.addEventListener('click', () => {
  if (favoritesViewActive) {
    favoritesPage = Math.max(1, favoritesPage - 1);
    renderFavoritesList();
    return;
  }

  queuePage = Math.max(1, queuePage - 1);
  renderQueueList(latestState);
});

queueNextBtn?.addEventListener('click', () => {
  if (favoritesViewActive) {
    favoritesPage += 1;
    renderFavoritesList();
    return;
  }

  queuePage += 1;
  renderQueueList(latestState);
});

queueList?.addEventListener('click', async (event) => {
  const queuePlayButton = event.target.closest('[data-queue-play-query]');
  if (queuePlayButton) {
    try {
      const query = decodeDatasetValue(queuePlayButton.dataset.queuePlayQuery);
      const title = decodeDatasetValue(queuePlayButton.dataset.queuePlayTitle) || 'Track';
      await playTrackByQuery(query, title);
    } catch (error) {
      setStatus(error.message);
    }
    return;
  }

  const favoritePlayButton = event.target.closest('[data-favorite-play-query]');
  if (favoritePlayButton) {
    try {
      const query = decodeDatasetValue(favoritePlayButton.dataset.favoritePlayQuery);
      const title = decodeDatasetValue(favoritePlayButton.dataset.favoritePlayTitle) || 'Track';
      await playTrackByQuery(query, title);
    } catch (error) {
      setStatus(error.message);
    }
    return;
  }

  const favoriteIndexButton = event.target.closest('[data-queue-favorite-index]');
  if (favoriteIndexButton) {
    const index = Number(favoriteIndexButton.dataset.queueFavoriteIndex);
    const track = latestState?.queue?.[index];
    if (!track) return;

    const result = toggleFavoriteTrack(track);
    updateSaveCurrentButton(latestState?.nowPlaying || null);
    if (favoritesViewActive) {
      renderFavoritesList();
    } else {
      renderQueueList(latestState);
    }

    if (result.action === 'added') {
      setStatus(`Added to favorites: ${result.track.title}`);
    } else {
      setStatus(`Removed from favorites: ${result.track.title}`);
    }
    return;
  }

  const favoriteRemoveButton = event.target.closest('[data-favorite-remove-index]');
  if (favoriteRemoveButton) {
    const index = Number(favoriteRemoveButton.dataset.favoriteRemoveIndex);
    const track = favoriteTracks[index];
    if (!track) return;

    favoriteTracks.splice(index, 1);
    saveFavorites();
    updateSaveCurrentButton(latestState?.nowPlaying || null);
    renderFavoritesList();
    setStatus(`Removed from favorites: ${track.title}`);
  }
});

genreChipButtons.forEach(button => {
  button.addEventListener('click', () => {
    renderGenreSuggestions(button.dataset.genre);
  });
});

if (genreSuggestions) {
  genreSuggestions.addEventListener('click', async event => {
    const targetButton = event.target.closest('[data-suggestion-play-query]');
    if (!targetButton) return;

    try {
      const query = decodeDatasetValue(targetButton.dataset.suggestionPlayQuery);
      const title = decodeDatasetValue(targetButton.dataset.suggestionPlayTitle) || 'Track';
      await playTrackByQuery(query, title);
    } catch (error) {
      setStatus(error.message);
    }
  });
}

(async function boot() {
  try {
    renderGenreSuggestions(activeGenreKey);
    renderFavoritesList();
    setFavoritesView(false);
    updateSaveCurrentButton(null);
    await loadAuth();
    await loadGuilds();
  } catch (error) {
    setStatus(error.message);
  }
})();
