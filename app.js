(function () {
  'use strict';

  const API = window.ZIKESTRIKE_API || 'https://backend.zikestrike.com';
  const MODE = window.ZIKESTRIKE_MODE || 'normal';

  const $ = (sel) => document.querySelector(sel);

  let state = {
    grade: null,
    questions: [],
    currentIndex: 0,
    streak: 0,
    isSecret: MODE === 'secret',
    games: [],
  };

  async function api(path, opts = {}) {
    return fetch(API + path, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      ...opts,
    });
  }

  async function bootstrap() {
    const res = await api('/api/bootstrap');
    const data = await res.json();
    state.streak = data.streak;
    state.isSecret = data.isSecret;
    updateStreakUI();
    if (data.refresh) location.reload();
  }

  async function loadGames() {
    const res = await api('/api/arcade/games');
    if (!res.ok) return [];
    const data = await res.json();
    return data.games || [];
  }

  function updateStreakUI() {
    document.querySelectorAll('#streak-count').forEach((el) => {
      el.textContent = state.streak;
    });
  }

  function gameCard(g) {
    const typeLabel = g.type === 'unity' ? 'Unity WebGL' : 'HTML5';
    return `
      <article class="game-card" style="--game-accent: ${g.accent}">
        <div class="game-art">
          <span class="game-tag">${g.tag}</span>
          <span class="game-type-badge">${typeLabel}</span>
        </div>
        <div class="game-body">
          <h3>${g.title}</h3>
          <p class="game-players">${typeLabel} · Instant play</p>
          <button class="btn btn-play" data-url="${g.url}" data-title="${g.title}">Play Now</button>
        </div>
      </article>`;
  }

  function renderSecretUI() {
    document.body.classList.add('secret-mode', 'games-site');
    $('#app').innerHTML = `
      <div class="games-shell">
        <nav class="games-nav">
          <div class="games-brand">
            <span class="brand-icon">⚡</span>
            <span class="brand-name">ZikeStrike<span class="brand-accent"> Arcade</span></span>
          </div>
          <div class="games-nav-right">
            <div class="streak-pill">
              <span class="flame">🔥</span>
              <span id="streak-count">${state.streak}</span>
            </div>
            <button class="btn btn-quiz-back" id="btn-leave-secret">← Back to Quiz</button>
          </div>
        </nav>

        <section class="games-hero">
          <div class="hero-glow"></div>
          <p class="hero-eyebrow">Members-only arcade</p>
          <h1>Play. Compete. Dominate.</h1>
          <p class="hero-sub">HTML5 and Unity WebGL games — hosted privately on the backend. Session required.</p>
          <div class="hero-stats">
            <div><strong>${state.games.length || '…'}</strong><span>Games</span></div>
            <div><strong>HTML</strong><span>& Unity</span></div>
            <div><strong>Live</strong><span>Now</span></div>
          </div>
        </section>

        <section class="games-section">
          <div class="section-head">
            <h2>HTML5 Games</h2>
            <span class="live-badge"><span class="live-dot"></span> Ready</span>
          </div>
          <div class="games-grid" id="html-games">${state.games.filter((g) => g.type === 'html').map(gameCard).join('') || '<p class="empty-msg">Loading…</p>'}</div>
        </section>

        <section class="games-section">
          <div class="section-head">
            <h2>Unity WebGL</h2>
            <span class="unity-badge">Drop builds in worker/static/games/unity/</span>
          </div>
          <div class="games-grid" id="unity-games">${state.games.filter((g) => g.type === 'unity').map(gameCard).join('') || '<p class="empty-msg">Loading…</p>'}</div>
        </section>

        <footer class="games-footer">
          <button class="btn btn-ghost" id="btn-leave-footer">Exit arcade → return to quiz</button>
        </footer>
      </div>

      <div class="game-player hidden" id="game-player">
        <div class="game-player-bar">
          <span id="game-player-title">Game</span>
          <button class="game-close" id="game-close" title="Close">✕</button>
        </div>
        <iframe id="game-frame" title="Game" allow="fullscreen; gamepad; autoplay" referrerpolicy="no-referrer"></iframe>
      </div>
      <div class="toast hidden" id="toast"></div>`;

    updateStreakUI();
    $('#btn-leave-secret').addEventListener('click', leaveSecret);
    $('#btn-leave-footer').addEventListener('click', leaveSecret);
    document.querySelectorAll('.btn-play').forEach((btn) => {
      btn.addEventListener('click', () => openGame(btn.dataset.url, btn.dataset.title));
    });
    $('#game-close').addEventListener('click', closeGame);
    $('#game-player').addEventListener('click', (e) => {
      if (e.target.id === 'game-player') closeGame();
    });
  }

  function openGame(url, title) {
    const player = $('#game-player');
    const frame = $('#game-frame');
    $('#game-player-title').textContent = title;
    frame.src = url;
    player.classList.remove('hidden');
    document.body.classList.add('game-open');
  }

  function closeGame() {
    const player = $('#game-player');
    const frame = $('#game-frame');
    frame.src = 'about:blank';
    player.classList.add('hidden');
    document.body.classList.remove('game-open');
  }

  async function leaveSecret() {
    const btn = $('#btn-leave-secret');
    if (btn) { btn.disabled = true; btn.textContent = 'Returning…'; }
    closeGame();
    try {
      const res = await api('/api/leave-secret', { method: 'POST', body: '{}' });
      if (!res.ok) {
        alert((await res.json()).error || 'Could not return to quiz');
        if (btn) { btn.disabled = false; btn.textContent = '← Back to Quiz'; }
        return;
      }
      state.isSecret = false;
      location.reload();
    } catch {
      alert('Network error — try again.');
      if (btn) { btn.disabled = false; btn.textContent = '← Back to Quiz'; }
    }
  }

  function renderQuizUI() {
    document.body.classList.remove('secret-mode', 'games-site', 'game-open');
    $('#app').innerHTML = `
      <div class="container">
        <header>
          <h1>ZikeStrike Quiz</h1>
          <p class="subtitle">Pick a grade and answer questions from the server.</p>
          <div class="streak-bar">
            <span class="flame">🔥</span>
            <span class="count" id="streak-count">${state.streak}</span>
            <span class="label">streak</span>
          </div>
        </header>
        <div class="card" id="setup-card">
          <label for="grade-select">Grade (1–12)</label>
          <select id="grade-select">
            <option value="">Select grade…</option>
            ${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">Grade ${i + 1}</option>`).join('')}
          </select>
          <button class="btn btn-primary" id="btn-start">Start</button>
        </div>
        <div class="card hidden" id="quiz-card">
          <div class="progress" id="progress"></div>
          <p class="question-text" id="question-text"></p>
          <label for="answer-input">Your answer</label>
          <input type="text" id="answer-input" autocomplete="off" placeholder="Enter answer" />
          <button class="btn btn-primary" id="btn-submit">Submit</button>
          <button class="btn btn-secondary" id="btn-back">Change grade</button>
          <div class="feedback" id="feedback"></div>
        </div>
      </div>`;

    updateStreakUI();
    $('#grade-select').addEventListener('change', (e) => { state.grade = Number(e.target.value) || null; });
    $('#btn-start').addEventListener('click', startQuiz);
    $('#btn-submit').addEventListener('click', submitAnswer);
    $('#btn-back').addEventListener('click', resetQuiz);
    $('#answer-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitAnswer(); });
  }

  async function startQuiz() {
    if (!state.grade) { alert('Please select a grade.'); return; }
    const res = await api(`/api/questions?grade=${state.grade}`);
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Failed to load questions'); return; }
    state.questions = data.questions;
    state.currentIndex = 0;
    $('#setup-card').classList.add('hidden');
    $('#quiz-card').classList.remove('hidden');
    renderProgress();
    showQuestion();
  }

  function resetQuiz() {
    state.questions = [];
    state.currentIndex = 0;
    $('#setup-card').classList.remove('hidden');
    $('#quiz-card').classList.add('hidden');
    hideFeedback();
  }

  function renderProgress() {
    $('#progress').innerHTML = state.questions.map((q, i) => {
      let cls = 'progress-dot';
      if (i === state.currentIndex) cls += ' active';
      else if (i < state.currentIndex) cls += ' done';
      return `<span class="${cls}" title="Q${q.index}"></span>`;
    }).join('');
  }

  function showQuestion() {
    const q = state.questions[state.currentIndex];
    if (!q) return;
    $('#question-text').textContent = q.text;
    $('#answer-input').value = '';
    $('#answer-input').focus();
    renderProgress();
    hideFeedback();
  }

  function hideFeedback() {
    const fb = $('#feedback');
    fb.className = 'feedback';
    fb.textContent = '';
  }

  function showFeedback(correct, message) {
    const fb = $('#feedback');
    fb.textContent = message;
    fb.className = `feedback visible ${correct ? 'correct' : 'incorrect'}`;
  }

  async function submitAnswer() {
    const answer = $('#answer-input').value.trim();
    if (!answer) return;
    const q = state.questions[state.currentIndex];
    const res = await api('/api/answer', {
      method: 'POST',
      body: JSON.stringify({ grade: state.grade, questionIndex: q.index, answer }),
    });
    const data = await res.json();
    state.streak = data.streak;
    updateStreakUI();
    showFeedback(data.correct, data.message);
    if (data.refreshPage || data.isSecret) { setTimeout(() => location.reload(), 800); return; }
    if (data.correct) {
      setTimeout(() => {
        state.currentIndex++;
        if (state.currentIndex >= state.questions.length) { alert('You finished all questions! Streak: ' + state.streak); resetQuiz(); }
        else showQuestion();
      }, 700);
    }
  }

  function startPoll() {
    setInterval(async () => {
      try {
        const res = await api('/api/poll');
        const data = await res.json();
        if (data.streak !== undefined) { state.streak = data.streak; updateStreakUI(); }
        if (data.refresh) location.reload();
        if (data.isSecret && MODE !== 'secret') location.reload();
        if (!data.isSecret && (MODE === 'secret' || state.isSecret)) location.reload();
      } catch (_) { /* ignore */ }
    }, 3000);
  }

  async function init() {
    await bootstrap();
    if (state.isSecret || MODE === 'secret') {
      state.games = await loadGames();
      renderSecretUI();
    } else {
      renderQuizUI();
    }
    startPoll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
