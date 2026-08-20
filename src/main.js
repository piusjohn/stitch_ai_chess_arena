import { Chess } from 'chess.js';
import { createClient } from '@supabase/supabase-js';
import { classifyMove, normalizeEvaluation, shouldRequestCoach } from './coach-analysis.js';
import './styles.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
let currentUser = null;
let authReady = false;
let pendingAuthAction = null;

const pieces = {
  wp: '♙', wn: '♘', wb: '♗', wr: '♖', wq: '♕', wk: '♔',
  bp: '♟', bn: '♞', bb: '♝', br: '♜', bq: '♛', bk: '♚',
};
const names = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };
const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const nav = [
  ['♟', 'Play', true], ['◆', 'AI Opponents'], ['⚔', 'Training'],
  ['↶', 'History'], ['▥', 'Leaderboard'], ['⚙', 'Settings'],
];
const opponents = [
  { id: 'beginner', name: 'The Beginner', difficulty: 'Beginner', rating: 800, personality: 'Friendly and forgiving', description: 'A relaxed opponent for learning the basics.', avatar: 'B' },
  { id: 'strategist', name: 'The Strategist', difficulty: 'Intermediate', rating: 1400, personality: 'Patient and calculated', description: 'Builds positions carefully and waits for mistakes.', avatar: 'S' },
  { id: 'grandmaster', name: 'The Grandmaster', difficulty: 'Advanced', rating: 2000, personality: 'Aggressive and highly analytical', description: 'A serious challenge that punishes mistakes.', avatar: 'G' },
];

let game = new Chess();
let selected = null;
let legalMoves = [];
let pendingPromotion = null;
let captured = { w: [], b: [] };
let selectedOpponent = opponents[0];
let aiThinking = false;
let engine = null;
let engineRequest = null;
let engineReady = null;
let gameSession = 0;
let gameResult = null;
let analysisEngine = null;
let analysisReady = null;
let analysisRequest = null;
let analysisQueue = Promise.resolve();
let coachSequence = 0;
let coachHighlight = [];
let gameStartedAt = null;
let gameSaved = false;
const engineConfig = { beginner: { depth: 3, skill: 1 }, strategist: { depth: 7, skill: 8 }, grandmaster: { depth: 10, skill: 18 } };
const ENGINE_READY_TIMEOUT = 12000;
const ENGINE_MOVE_TIMEOUT = 20000;

document.querySelector('#app').innerHTML = `
  <section id="auth-view" class="auth-view hidden-view">
    <div class="auth-panel">
      <div class="brand auth-brand"><span class="brand-mark">♙</span><div><h1>AI Chess Arena</h1><p>Grandmaster Level</p></div></div>
      <div id="auth-login-panel">
        <span class="eyebrow">WELCOME BACK</span><h2>Log in to play</h2>
        <form id="login-form" class="auth-form"><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Password<input name="password" type="password" autocomplete="current-password" minlength="6" required></label><button id="forgot-password" class="auth-link" type="button">Forgot password?</button><p id="login-error" class="auth-error" role="alert"></p><button class="primary-action" type="submit">LOGIN</button><div class="auth-divider"><span>OR</span></div><button id="google-login" class="secondary-action" type="button"><span aria-hidden="true">G</span> CONTINUE WITH GOOGLE</button></form>
        <p class="auth-switch">Don't have an account? <button id="show-signup" type="button">Sign up</button></p>
      </div>
      <div id="auth-signup-panel" class="hidden-view">
        <span class="eyebrow">JOIN THE ARENA</span><h2>Create your account</h2>
        <form id="signup-form" class="auth-form"><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Password<input name="password" type="password" autocomplete="new-password" minlength="6" required></label><label>Confirm password<input name="confirmPassword" type="password" autocomplete="new-password" minlength="6" required></label><p id="signup-error" class="auth-error" role="alert"></p><button class="primary-action" type="submit">CREATE ACCOUNT</button></form>
        <button id="google-signup" class="secondary-action" type="button"><span aria-hidden="true">G</span> CONTINUE WITH GOOGLE</button><p class="auth-switch">Already have an account? <button id="show-login" type="button">Log in</button></p>
      </div>
      <div id="auth-reset-panel" class="hidden-view">
        <span class="eyebrow">ACCOUNT RECOVERY</span><h2>Reset your password</h2>
        <form id="reset-form" class="auth-form"><label>Email<input name="email" type="email" autocomplete="email" required></label><p id="reset-request-message" class="auth-error" role="alert"></p><button class="primary-action" type="submit">SEND RESET LINK</button></form>
        <form id="update-password-form" class="auth-form hidden-view"><label>New password<input name="password" type="password" autocomplete="new-password" minlength="6" required></label><label>Confirm password<input name="confirmPassword" type="password" autocomplete="new-password" minlength="6" required></label><p id="reset-update-message" class="auth-error" role="alert"></p><button class="primary-action" type="submit">UPDATE PASSWORD</button></form>
        <p class="auth-switch"><button id="back-to-login" type="button">Back to log in</button></p>
      </div>
    </div>
  </section>
  <main class="app-shell">
    <aside class="sidebar">
      <div class="brand"><span class="brand-mark">♙</span><div><h1>AI Arena</h1><p>Grandmaster Level</p></div></div>
      <nav>${nav.map(([icon, label, active]) => `<button class="nav-item ${active ? 'active' : ''}" type="button"><span>${icon}</span>${label}</button>`).join('')}</nav>
      <button id="logout" class="nav-item profile" type="button"><span>↪</span>Log out</button>
    </aside>

    <section id="selection-view" class="selection-view">
      <header class="selection-heading"><span>CHOOSE YOUR OPPONENT</span><h2>Who will you face?</h2><p>Select an opponent to begin your match.</p></header>
      <div id="opponent-list" class="opponent-list"></div>
      <button id="start-game" class="primary-action" type="button">PLAY <span>→</span></button>
    </section>

    <section id="utility-view" class="utility-view hidden-view">
      <header class="selection-heading"><span id="utility-eyebrow">TRAINING</span><h2 id="utility-title">Training drills</h2><p id="utility-description">Practice with focused positions and review your progress.</p></header>
      <div id="utility-content" class="utility-content"></div>
    </section>

    <section id="game-view" class="game-area hidden-view">
      <header class="challenge"><span>LIVE MATCH</span><h2>Classic Chess</h2></header>
      <div class="player-strip opponent"><div><span id="game-avatar" class="avatar">AI</span><strong id="game-opponent-name">AI Opponent</strong><small id="game-opponent-meta">Coming soon</small></div><div><span id="ai-thinking" class="thinking hidden-view">AI IS THINKING...</span><div id="black-captured" class="captured"></div></div></div>
      <div class="board-frame"><div id="board" class="board" aria-label="Chessboard"></div><div id="check-glow" class="check-glow"></div></div>
      <div class="player-strip"><div><span class="avatar human">♙</span><strong>You</strong><small id="turn-label">White to move</small></div><div id="white-captured" class="captured"></div></div>
      <div class="board-actions"><button id="undo" class="icon-button" type="button" title="Undo move">↶</button><button id="reset" class="icon-button" type="button" title="Reset game">↺</button></div>
    </section>

    <aside class="right-panel hidden-view">
      <div class="panel-title"><h2>Game</h2><span>↗</span></div>
      <div class="status-grid"><div class="status-card"><span>◷ TURN</span><strong id="turn-card">White</strong></div><div class="status-card"><span>♔ STATUS</span><strong id="status-card">Playing</strong></div></div>
      <section class="opponent-card"><span class="eyebrow">AI OPPONENT</span><div class="opponent-row"><span id="panel-avatar" class="avatar">AI</span><div><strong id="panel-opponent-name">Not connected</strong><small id="panel-opponent-meta">Opponent play is disabled</small></div></div><div id="engine-error" class="engine-error hidden-view"><p>The opponent is unavailable right now. Restart the game to try again.</p><button id="retry-game" class="text-action" type="button">RESTART GAME</button></div><button id="change-opponent" class="text-action" type="button">CHANGE OPPONENT</button></section>
      <section class="history-section"><div class="section-heading"><span>MOVE HISTORY</span><span id="move-count">0 moves</span></div><div id="history" class="history"><p class="empty">Your moves will appear here.</p></div></section>
      <section class="coach-card"><span id="coach-status" class="eyebrow">AI COACH</span><strong id="coach-result" class="coach-result">READY</strong><p id="coach-explanation">Make a move and the coach will watch for important moments.</p><div id="better-move" class="better-move hidden-view"><span>BETTER MOVE</span><button id="better-move-button" type="button"></button></div><form id="coach-question-form" class="coach-question"><label for="coach-question">ASK ABOUT THE POSITION</label><div><input id="coach-question" type="text" maxlength="180" autocomplete="off" placeholder="What should I focus on?" aria-label="Ask the AI Coach about the current position"><button id="ask-coach" type="submit">ASK COACH</button></div></form></section>
    </aside>
  </main>

  <div id="promotion-modal" class="overlay hidden" role="dialog" aria-modal="true"><div class="modal promotion-modal"><span class="eyebrow">PAWN PROMOTION</span><h2>Choose a piece</h2><div id="promotion-options" class="promotion-options"></div></div></div>
  <div id="game-over" class="overlay hidden" role="dialog" aria-modal="true"><div class="modal result-modal"><span class="eyebrow" id="game-over-label">GAME OVER</span><h2 id="game-over-title">DRAW</h2><p id="game-over-opponent"></p><small id="game-over-detail"></small><div class="result-stats"><div><span>MOVES</span><strong id="result-moves">0</strong></div><div><span>CAPTURES</span><strong id="result-captures">0</strong></div><div><span>OPPONENT</span><strong id="result-opponent">—</strong></div></div><div class="coach-summary"><span>COACH SUMMARY</span><p id="coach-summary-text">Game complete.</p></div><p id="save-status" class="save-status" role="status"></p><button id="play-again" type="button">PLAY AGAIN</button></div></div>
`;

const boardEl = document.querySelector('#board');
const promotionModal = document.querySelector('#promotion-modal');
const gameOverModal = document.querySelector('#game-over');

function squareColor(file, rank) { return (file + rank) % 2 === 0 ? 'light' : 'dark'; }

function renderOpponents() {
  document.querySelector('#opponent-list').innerHTML = opponents.map(opponent => `
    <article class="opponent-choice ${selectedOpponent.id === opponent.id ? 'selected' : ''}" data-opponent="${opponent.id}" tabindex="0">
      <div class="choice-top"><span class="choice-avatar">${opponent.avatar}</span><div><h3>${opponent.name}</h3><span class="difficulty ${opponent.difficulty.toLowerCase()}">${opponent.difficulty}</span></div><span class="choice-check">✓</span></div>
      <div class="choice-rating"><span>RATING</span><strong>${opponent.rating}</strong></div><p><strong>${opponent.personality}</strong><br>${opponent.description}</p><button type="button" class="choice-button">${selectedOpponent.id === opponent.id ? 'SELECTED' : 'SELECT'}</button>
    </article>`).join('');
  document.querySelectorAll('.opponent-choice').forEach(card => {
    const choose = () => { selectedOpponent = opponents.find(opponent => opponent.id === card.dataset.opponent); renderOpponents(); };
    card.addEventListener('click', choose); card.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(); } });
  });
}

function renderOpponentDetails() {
  const meta = `${selectedOpponent.difficulty} · Rating ${selectedOpponent.rating}`;
  document.querySelector('#game-avatar').textContent = selectedOpponent.avatar;
  document.querySelector('#game-opponent-name').textContent = selectedOpponent.name;
  document.querySelector('#game-opponent-meta').textContent = meta;
  document.querySelector('#panel-avatar').textContent = selectedOpponent.avatar;
  document.querySelector('#panel-opponent-name').textContent = selectedOpponent.name;
  document.querySelector('#panel-opponent-meta').textContent = meta;
}

function setThinking(value) {
  aiThinking = value;
  document.querySelector('#ai-thinking').classList.toggle('hidden-view', !value);
  document.querySelector('#turn-label').textContent = value ? 'AI is thinking...' : `${game.turn() === 'w' ? 'White' : 'Black'} to move${game.inCheck() ? ' · Check' : ''}`;
  boardEl.classList.toggle('thinking-board', value);
  boardEl.setAttribute('aria-busy', String(value));
  document.querySelector('#undo').disabled = value || game.history().length === 0 || Boolean(gameResult);
}

function disposeEngine() {
  if (engineRequest) {
    clearTimeout(engineRequest.timeout);
    engineRequest.reject(new Error('Engine stopped'));
  }
  engineRequest = null;
  engineReady = null;
  if (engine) {
    engine.onmessage = null;
    engine.onerror = null;
    engine.postMessage('stop');
    engine.postMessage('quit');
    engine.terminate();
    engine = null;
  }
}

function disposeAnalysisEngine() {
  if (analysisRequest) {
    clearTimeout(analysisRequest.timeout);
    analysisRequest.reject(new Error('Analysis stopped'));
  }
  analysisRequest = null;
  analysisReady = null;
  analysisQueue = Promise.resolve();
  if (analysisEngine) {
    analysisEngine.onmessage = null;
    analysisEngine.onerror = null;
    analysisEngine.postMessage('stop');
    analysisEngine.postMessage('quit');
    analysisEngine.terminate();
    analysisEngine = null;
  }
}

function initAnalysisEngine() {
  if (analysisReady) return analysisReady;
  analysisReady = new Promise((resolve, reject) => {
    const worker = new Worker('/stockfish/stockfish.js');
    analysisEngine = worker;
    let initialized = false;
    const timeout = setTimeout(() => reject(new Error('Analysis initialization timed out')), ENGINE_READY_TIMEOUT);
    worker.onmessage = event => {
      const line = typeof event.data === 'string' ? event.data.trim() : '';
      if (line === 'uciok') {
        worker.postMessage('setoption name Skill Level value 20');
        worker.postMessage('isready');
      } else if (line === 'readyok') {
        clearTimeout(timeout);
        initialized = true;
        resolve(worker);
      } else if (line.startsWith('info ') && analysisRequest) {
        const match = line.match(/\bscore (cp|mate) (-?\d+)/);
        if (match) analysisRequest.score = { type: match[1], value: Number(match[2]) };
      } else if (line.startsWith('bestmove ') && analysisRequest) {
        const request = analysisRequest;
        analysisRequest = null;
        clearTimeout(request.timeout);
        request.resolve({ bestMove: line.split(/\s+/)[1], score: request.score });
      }
    };
    worker.onerror = () => {
      if (initialized && analysisRequest) {
        const request = analysisRequest;
        analysisRequest = null;
        clearTimeout(request.timeout);
        request.reject(new Error('Analysis engine unavailable'));
        disposeAnalysisEngine();
      } else reject(new Error('Analysis engine unavailable'));
    };
    worker.postMessage('uci');
  });
  analysisReady.catch(() => disposeAnalysisEngine());
  return analysisReady;
}

async function analyzePosition(fen) {
  const worker = await initAnalysisEngine();
  if (!worker || worker !== analysisEngine) throw new Error('Analysis engine unavailable');
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (analysisRequest?.resolve === resolve) analysisRequest = null;
      reject(new Error('Analysis timed out'));
    }, ENGINE_MOVE_TIMEOUT);
    analysisRequest = { resolve, reject, timeout, score: null };
    worker.postMessage(`position fen ${fen}`);
    worker.postMessage('go depth 8');
  });
}

function initEngine() {
  disposeEngine();
  engineReady = new Promise((resolve, reject) => {
    const worker = new Worker('/stockfish/stockfish.js');
    engine = worker;
    let uciReady = false;
    let initialized = false;
    const timeout = setTimeout(() => reject(new Error('Engine initialization timed out')), ENGINE_READY_TIMEOUT);
    worker.onmessage = event => {
      const line = typeof event.data === 'string' ? event.data.trim() : '';
      if (line === 'uciok') {
        uciReady = true;
        const config = engineConfig[selectedOpponent.id];
        worker.postMessage(`setoption name Skill Level value ${config.skill}`);
        worker.postMessage('ucinewgame');
        worker.postMessage('isready');
      } else if (line === 'readyok' && uciReady) {
        clearTimeout(timeout);
        initialized = true;
        resolve(worker);
      } else if (line.startsWith('bestmove ') && engineRequest) {
        const request = engineRequest;
        engineRequest = null;
        clearTimeout(request.timeout);
        request.resolve(line.split(/\s+/)[1]);
      }
    };
    worker.onerror = () => {
      clearTimeout(timeout);
      if (initialized) handleEngineError();
      else reject(new Error('Engine initialization failed'));
    };
    worker.postMessage('uci');
  });
  engineReady.catch(() => handleEngineError());
  return engineReady;
}

async function askEngine() {
  const activeEngine = await engineReady;
  if (!activeEngine || activeEngine !== engine) throw new Error('Engine unavailable');
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (engineRequest?.resolve === resolve) engineRequest = null;
      reject(new Error('Engine move timed out'));
    }, ENGINE_MOVE_TIMEOUT);
    engineRequest = { resolve, reject, timeout };
    const config = engineConfig[selectedOpponent.id];
    activeEngine.postMessage(`position fen ${game.fen()}`);
    activeEngine.postMessage(`go depth ${config.depth}`);
  });
}

function handleEngineError() {
  if (engineRequest) {
    clearTimeout(engineRequest.timeout);
    engineRequest.reject(new Error('Engine unavailable'));
  }
  engineRequest = null;
  setThinking(false);
  document.querySelector('#engine-error').classList.remove('hidden-view');
  disposeEngine();
}

async function playAiTurn() {
  if (game.isGameOver() || game.turn() !== 'b') return;
  const session = gameSession;
  setThinking(true);
  try {
    const bestmove = await askEngine();
    if (session !== gameSession || !bestmove || bestmove === '(none)' || game.isGameOver()) return;
    makeMove({ from: bestmove.slice(0, 2), to: bestmove.slice(2, 4), ...(bestmove[4] ? { promotion: bestmove[4] } : {}) }, true);
  } catch {
    if (session === gameSession) handleEngineError();
  } finally {
    if (session === gameSession && !game.isGameOver()) setThinking(false);
  }
}

function resetCoach() {
  coachSequence += 1;
  coachHighlight = [];
  document.querySelector('#coach-status').textContent = 'AI COACH';
  document.querySelector('#coach-result').textContent = 'READY';
  document.querySelector('#coach-result').className = 'coach-result';
  document.querySelector('#coach-explanation').textContent = 'Make a move and the coach will watch for important moments.';
  document.querySelector('#better-move').classList.add('hidden-view');
  document.querySelector('#ask-coach').disabled = false;
}

function setCoachLoading(sequence) {
  if (sequence !== coachSequence) return;
  coachHighlight = [];
  document.querySelector('#coach-status').textContent = 'ANALYZING MOVE...';
  document.querySelector('#coach-result').textContent = 'COACHING';
  document.querySelector('#coach-result').className = 'coach-result loading';
  document.querySelector('#coach-explanation').textContent = 'AI Coach is analyzing...';
  document.querySelector('#better-move').classList.add('hidden-view');
}

function showCoachUnavailable(sequence) {
  if (sequence !== coachSequence) return;
  document.querySelector('#coach-status').textContent = 'AI COACH';
  document.querySelector('#coach-result').textContent = 'UNAVAILABLE';
  document.querySelector('#coach-result').className = 'coach-result';
  document.querySelector('#coach-explanation').textContent = 'Coach temporarily unavailable.';
  document.querySelector('#better-move').classList.add('hidden-view');
}

async function askCoachQuestion(question) {
  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) return;
  const sequence = ++coachSequence;
  const session = gameSession;
  const fen = game.fen();
  const history = game.history().slice(-12);
  setCoachLoading(sequence);
  document.querySelector('#ask-coach').disabled = true;
  analysisQueue = analysisQueue.then(async () => {
    const position = await analyzePosition(fen);
    if (!position.score || session !== gameSession || sequence !== coachSequence) return;
    const bestMoveSan = toSan(fen, position.bestMove);
    const analysis = {
      requestType: 'playerQuestion',
      question: trimmedQuestion,
      currentFen: fen,
      sideToMove: game.turn() === 'w' ? 'White' : 'Black',
      evaluation: normalizeEvaluation(position.score, game.turn()),
      mate: position.score.type === 'mate' ? position.score.value : null,
      bestMove: position.bestMove,
      betterMoveSan: bestMoveSan,
      moveHistory: history,
    };
    const response = await fetch('/api/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(analysis),
    });
    if (!response.ok) throw new Error('Coach unavailable');
    const data = await response.json();
    if (!data.explanation) throw new Error('Coach unavailable');
    if (sequence !== coachSequence) return;
    document.querySelector('#coach-status').textContent = 'AI COACH';
    document.querySelector('#coach-result').textContent = 'COACH ANSWER';
    document.querySelector('#coach-result').className = 'coach-result good';
    document.querySelector('#coach-explanation').textContent = data.explanation;
    const betterMove = document.querySelector('#better-move');
    if (bestMoveSan) {
      const button = document.querySelector('#better-move-button');
      button.textContent = bestMoveSan;
      button.dataset.from = position.bestMove.slice(0, 2);
      button.dataset.to = position.bestMove.slice(2, 4);
      betterMove.classList.remove('hidden-view');
    } else betterMove.classList.add('hidden-view');
  }).catch(() => showCoachUnavailable(sequence)).finally(() => {
    if (sequence === coachSequence) document.querySelector('#ask-coach').disabled = false;
  });
}

function coachLabel(classification) {
  return {
    Excellent: '✓ GREAT MOVE',
    Good: '✓ GOOD MOVE',
    Neutral: 'POSITION UPDATED',
    Mistake: '⚠️ MISTAKE',
    Blunder: '🔴 BLUNDER',
  }[classification];
}

function showCoachResult(sequence, analysis, explanation) {
  if (sequence !== coachSequence) return;
  const resultEl = document.querySelector('#coach-result');
  document.querySelector('#coach-status').textContent = 'AI COACH';
  resultEl.textContent = coachLabel(analysis.classification);
  resultEl.className = `coach-result ${analysis.classification.toLowerCase()}`;
  document.querySelector('#coach-explanation').textContent = explanation;
  const betterMove = document.querySelector('#better-move');
  if (analysis.betterMoveSan && analysis.centipawnLoss > 60) {
    const button = document.querySelector('#better-move-button');
    button.textContent = analysis.betterMoveSan;
    button.dataset.from = analysis.bestMove.slice(0, 2);
    button.dataset.to = analysis.bestMove.slice(2, 4);
    betterMove.classList.remove('hidden-view');
  } else {
    betterMove.classList.add('hidden-view');
  }
}

function toSan(fen, uciMove) {
  if (!uciMove || uciMove === '(none)') return null;
  try {
    const position = new Chess(fen);
    return position.move({ from: uciMove.slice(0, 2), to: uciMove.slice(2, 4), ...(uciMove[4] ? { promotion: uciMove[4] } : {}) })?.san || null;
  } catch { return null; }
}

function analyzePlayerMove({ beforeFen, afterFen, move, history, session }) {
  const sequence = ++coachSequence;
  setCoachLoading(sequence);
  analysisQueue = analysisQueue.then(async () => {
    const [before, after] = await Promise.all([
      analyzePosition(beforeFen),
      analyzePosition(afterFen),
    ]);
    if (!before.score || !after.score || session !== gameSession || sequence !== coachSequence) return;
    const beforeEvaluation = normalizeEvaluation(before.score, 'w');
    const afterEvaluation = normalizeEvaluation(after.score, 'b');
    const actualMove = `${move.from}${move.to}${move.promotion || ''}`;
    const isBestMove = actualMove === before.bestMove;
    const classification = classifyMove(beforeEvaluation, afterEvaluation, isBestMove);
    const analysis = {
      ...classification,
      isBestMove,
      playerMove: move.san,
      playerMoveUci: actualMove,
      bestMove: before.bestMove,
      betterMoveSan: toSan(beforeFen, before.bestMove),
      beforeFen,
      afterFen,
      currentFen: afterFen,
      beforeEvaluation,
      afterEvaluation,
      beforeMate: before.score.type === 'mate' ? before.score.value : null,
      afterMate: after.score.type === 'mate' ? after.score.value : null,
      moveHistory: history.slice(-12),
    };
    if (!shouldRequestCoach(analysis)) {
      showCoachResult(sequence, analysis, classification.classification === 'Good' ? 'Position updated. This move keeps the game balanced.' : 'Position updated.');
      return;
    }
    try {
      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analysis),
      });
      if (!response.ok) throw new Error('Coach unavailable');
      const data = await response.json();
      if (!data.explanation) throw new Error('Coach unavailable');
      showCoachResult(sequence, analysis, data.explanation);
    } catch { showCoachUnavailable(sequence); }
  }).catch(() => showCoachUnavailable(sequence));
}

function openSelection() {
  gameSession += 1;
  disposeEngine();
  disposeAnalysisEngine();
  resetCoach();
  setThinking(false);
  document.querySelector('#selection-view').classList.remove('hidden-view');
  document.querySelector('#utility-view').classList.add('hidden-view');
  document.querySelector('#game-view').classList.add('hidden-view');
  document.querySelector('.right-panel').classList.add('hidden-view');
  renderOpponents();
}

async function showUtilityView(kind) {
  document.querySelector('#selection-view').classList.add('hidden-view');
  document.querySelector('#game-view').classList.add('hidden-view');
  document.querySelector('.right-panel').classList.add('hidden-view');
  const view = document.querySelector('#utility-view');
  view.classList.remove('hidden-view');
  const titles = {
    training: ['TRAINING', 'Training drills', 'Practice with focused positions and review your progress.'],
    history: ['HISTORY', 'Your games', 'Completed matches saved to your account.'],
    leaderboard: ['LEADERBOARD', 'Arena leaderboard', 'Your completed games and results.'],
    settings: ['SETTINGS', 'Account settings', 'Manage your session and app preferences.'],
  };
  const [eyebrow, title, description] = titles[kind];
  document.querySelector('#utility-eyebrow').textContent = eyebrow;
  document.querySelector('#utility-title').textContent = title;
  document.querySelector('#utility-description').textContent = description;
  const content = document.querySelector('#utility-content');
  if (kind === 'training') {
    content.innerHTML = '<div class="utility-grid"><button class="utility-card" data-training="beginner"><strong>TACTICS WARM-UP</strong><span>Play against The Beginner and build confidence.</span></button><button class="utility-card" data-training="grandmaster"><strong>DEEP CALCULATION</strong><span>Challenge The Grandmaster with precise moves.</span></button></div>';
    content.querySelectorAll('[data-training]').forEach(button => button.addEventListener('click', () => { selectedOpponent = opponents.find(item => item.id === button.dataset.training); startGame(); }));
  } else if (kind === 'settings') {
    content.innerHTML = `<div class="utility-card"><strong>ACCOUNT</strong><span>${currentUser?.email || 'Not signed in'}</span><button id="settings-logout" class="text-action" type="button">LOG OUT</button></div>`;
    content.querySelector('#settings-logout').addEventListener('click', () => document.querySelector('#logout').click());
  } else {
    content.innerHTML = '<p class="utility-loading">Loading your games...</p>';
    if (!supabase || !currentUser) { content.innerHTML = '<p class="utility-empty">Log in to see saved games.</p>'; return; }
    const { data, error } = await supabase.from('games').select('opponent_name, opponent_difficulty, result, move_count, completed_at').order('completed_at', { ascending: false }).limit(25);
    if (error) { content.innerHTML = '<p class="utility-empty">Games could not be loaded right now.</p>'; return; }
    if (!data?.length) { content.innerHTML = '<p class="utility-empty">No completed games yet. Start a match to build your record.</p>'; return; }
    const rows = data.map((game, index) => `<div class="utility-row"><span>${index + 1}</span><strong>${game.opponent_name}</strong><span>${game.result}</span><span>${game.move_count} moves</span><small>${new Date(game.completed_at).toLocaleDateString()}</small></div>`).join('');
    content.innerHTML = `<div class="utility-list">${rows}</div>`;
  }
}

function setActiveNav(index) {
  document.querySelectorAll('.sidebar nav .nav-item').forEach((item, itemIndex) => item.classList.toggle('active', itemIndex === index));
}

function startGame() {
  if (!currentUser) {
    pendingAuthAction = 'start-game';
    showAuth('login');
    return;
  }
  resetGame();
  renderOpponentDetails();
  document.querySelector('#utility-view').classList.add('hidden-view');
  document.querySelector('#selection-view').classList.add('hidden-view');
  document.querySelector('#game-view').classList.remove('hidden-view');
  document.querySelector('.right-panel').classList.remove('hidden-view');
}

async function saveCompletedGame(result, detail) {
  if (gameSaved || !supabase || !currentUser) return;
  gameSaved = true;
  const saveStatus = document.querySelector('#save-status');
  try {
    const { error } = await supabase.from('games').insert({
      opponent_id: selectedOpponent.id,
      opponent_name: selectedOpponent.name,
      opponent_difficulty: selectedOpponent.difficulty,
      result,
      status: detail,
      move_count: game.history().length,
      moves: game.history({ verbose: true }),
      starting_fen: new Chess().fen(),
      final_fen: game.fen(),
      player_accuracy: null,
      blunders: 0,
      mistakes: 0,
      great_moves: 0,
      started_at: gameStartedAt,
      completed_at: new Date().toISOString(),
    });
    if (error) throw error;
    saveStatus.textContent = 'Game saved.';
    saveStatus.classList.remove('save-failed');
  } catch (error) {
    gameSaved = false;
    saveStatus.textContent = 'Game could not be saved. Please try again.';
    saveStatus.classList.add('save-failed');
    if (import.meta.env.DEV) console.error('Failed to save completed game', error);
  }
}

function showAuth(mode = 'login') {
  document.querySelector('#auth-view').classList.remove('hidden-view');
  document.querySelector('.app-shell').classList.add('hidden-view');
  document.querySelector('#auth-login-panel').classList.toggle('hidden-view', mode !== 'login');
  document.querySelector('#auth-signup-panel').classList.toggle('hidden-view', mode !== 'signup');
  document.querySelector('#auth-reset-panel').classList.toggle('hidden-view', mode !== 'reset');
}

function showApp() {
  document.querySelector('#auth-view').classList.add('hidden-view');
  document.querySelector('.app-shell').classList.remove('hidden-view');
}

function authError(error) {
  const message = error?.message || 'Authentication failed. Please try again.';
  return message.toLowerCase().includes('invalid login credentials') ? 'Incorrect email or password.' : message;
}

async function initializeAuth() {
  const isRecovery = window.location.hash.includes('type=recovery');
  if (!supabase) {
    authReady = true;
    showAuth('login');
    document.querySelector('#login-error').textContent = 'Authentication is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.';
    return;
  }
  const { data } = await supabase.auth.getSession();
  currentUser = data.session?.user || null;
  authReady = true;
  if (isRecovery) {
    showAuth('reset');
    document.querySelector('#reset-form').classList.add('hidden-view');
    document.querySelector('#update-password-form').classList.remove('hidden-view');
  } else if (currentUser) {
    showApp();
    if (pendingAuthAction === 'start-game') { pendingAuthAction = null; startGame(); }
  } else {
    showAuth('login');
  }
  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    if (!currentUser) {
      pendingAuthAction = null;
      openSelection();
      showAuth('login');
    } else {
      showApp();
      if (pendingAuthAction === 'start-game') { pendingAuthAction = null; startGame(); }
    }
  });
}

function render() {
  const position = game.board();
  const last = game.history({ verbose: true }).at(-1);
  boardEl.innerHTML = '';
  position.forEach((row, rankIndex) => row.forEach((piece, fileIndex) => {
    const square = `${'abcdefgh'[fileIndex]}${8 - rankIndex}`;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `square ${squareColor(fileIndex, rankIndex)}`;
    el.dataset.square = square;
    el.setAttribute('aria-label', piece ? `${piece.color === 'w' ? 'White' : 'Black'} ${names[piece.type]} on ${square}` : square);
    if (selected === square) el.classList.add('selected');
    if (last && (last.from === square || last.to === square)) el.classList.add('last-move');
    if (last?.color === 'b' && (last.from === square || last.to === square)) el.classList.add('ai-move');
    if (game.inCheck() && piece?.type === 'k' && piece.color === game.turn()) el.classList.add('in-check');
    if (coachHighlight.includes(square)) el.classList.add('coach-highlight');
    const legal = legalMoves.find(move => move.to === square);
    if (legal) el.classList.add(piece ? 'legal-capture' : 'legal-move');
    if (piece) {
      const token = document.createElement('span');
      token.className = `piece ${piece.color}`;
      token.textContent = pieces[`${piece.color}${piece.type}`];
      el.append(token);
    }
    if (fileIndex === 0) el.insertAdjacentHTML('beforeend', `<span class="rank-label">${8 - rankIndex}</span>`);
    if (rankIndex === 7) el.insertAdjacentHTML('beforeend', `<span class="file-label">${'abcdefgh'[fileIndex]}</span>`);
    el.addEventListener('click', onSquareClick);
    boardEl.append(el);
  }));
  renderMeta();
}

function onSquareClick(event) {
  if (game.isGameOver() || pendingPromotion || aiThinking || game.turn() !== 'w') return;
  const square = event.currentTarget.dataset.square;
  const piece = game.get(square);
  if (!selected) {
    if (piece?.color === game.turn()) selectSquare(square);
    return;
  }
  if (piece?.color === game.turn()) { selectSquare(square); return; }
  const move = legalMoves.find(candidate => candidate.to === square);
  if (!move) { clearSelection(); return; }
  if (move.flags.includes('p')) { showPromotion(selected, square); return; }
  makeMove({ from: selected, to: square });
}

function selectSquare(square) {
  selected = square;
  legalMoves = game.moves({ square, verbose: true });
  render();
}

function clearSelection() { selected = null; legalMoves = []; render(); }

function makeMove(move, isAi = false) {
  const beforeFen = game.fen();
  let result;
  try { result = game.move(move); } catch { return; }
  if (!result) return;
  if (result.captured) captured[result.color].push(result.captured);
  selected = null;
  legalMoves = [];
  pendingPromotion = null;
  promotionModal.classList.add('hidden');
  render();
  requestAnimationFrame(() => boardEl.querySelector(`[data-square="${result.to}"] .piece`)?.classList.add('piece-arrive'));
  handleGameState();
  if (!isAi) analyzePlayerMove({ beforeFen, afterFen: game.fen(), move: result, history: game.history(), session: gameSession });
  if (!isAi && !game.isGameOver() && game.turn() === 'b') playAiTurn();
}

function showPromotion(from, to) {
  pendingPromotion = { from, to };
  const color = game.turn();
  document.querySelector('#promotion-options').innerHTML = ['q', 'r', 'b', 'n'].map(type => `<button type="button" data-piece="${type}" aria-label="Promote to ${names[type]}">${pieces[`${color}${type}`]}</button>`).join('');
  document.querySelectorAll('#promotion-options button').forEach(button => button.addEventListener('click', () => makeMove({ ...pendingPromotion, promotion: button.dataset.piece })));
  promotionModal.classList.remove('hidden');
}

function handleGameState() {
  if (game.isCheckmate()) {
    const winner = game.turn() === 'w' ? 'AI WINS' : 'YOU WIN';
    showGameOver(winner, 'Checkmate');
  } else if (game.isDraw()) {
    showGameOver('DRAW', drawReason());
  }
}

function drawReason() {
  if (game.isStalemate()) return 'STALEMATE';
  if (game.isThreefoldRepetition()) return 'THREEFOLD REPETITION';
  if (game.isInsufficientMaterial()) return 'INSUFFICIENT MATERIAL';
  return 'DRAW';
}

function showGameOver(result, detail) {
  if (gameResult) return;
  gameResult = result;
  setThinking(false);
  disposeEngine();
  document.querySelector('#game-over-title').textContent = result;
  document.querySelector('#game-over-opponent').textContent = `Against ${selectedOpponent.name}`;
  document.querySelector('#game-over-detail').textContent = detail;
  document.querySelector('#result-moves').textContent = String(game.history().length);
  document.querySelector('#result-captures').textContent = String(captured.w.length + captured.b.length);
  document.querySelector('#result-opponent').textContent = selectedOpponent.difficulty;
  const coachText = document.querySelector('#coach-explanation').textContent.trim();
  document.querySelector('#coach-summary-text').textContent = coachText && !coachText.includes('analyzing')
    ? coachText
    : 'Game complete. Review the move history and try a fresh approach next game.';
  coachSequence += 1;
  disposeAnalysisEngine();
  gameOverModal.classList.remove('hidden');
  saveCompletedGame(result, detail);
  document.querySelector('#play-again').focus();
}

function renderMeta() {
  const turn = game.turn() === 'w' ? 'White' : 'Black';
  const status = game.isCheckmate() ? 'Checkmate' : game.isDraw() ? 'Draw' : game.inCheck() ? 'Check' : 'Playing';
  document.querySelector('#turn-label').textContent = `${turn} to move${game.inCheck() ? ' · Check' : ''}`;
  document.querySelector('#turn-card').textContent = turn;
  document.querySelector('#status-card').textContent = status;
  document.querySelector('#status-card').classList.toggle('danger', game.inCheck());
  document.querySelector('#check-glow').classList.toggle('visible', game.inCheck());
  document.querySelector('#undo').disabled = aiThinking || game.history().length === 0 || Boolean(gameResult);
  renderHistory();
  renderCaptured('w');
  renderCaptured('b');
}

function renderHistory() {
  const moves = game.history();
  document.querySelector('#move-count').textContent = `${moves.length} ${moves.length === 1 ? 'move' : 'moves'}`;
  const rows = [];
  for (let i = 0; i < moves.length; i += 2) rows.push(`<div class="history-row"><span>${i / 2 + 1}.</span><strong>${moves[i]}</strong><strong>${moves[i + 1] || ''}</strong></div>`);
  const history = document.querySelector('#history');
  history.innerHTML = rows.join('') || '<p class="empty">Your moves will appear here.</p>';
  history.scrollTop = history.scrollHeight;
}

function renderCaptured(color) {
  const sorted = [...captured[color]].sort((a, b) => values[b] - values[a]);
  document.querySelector(`#${color === 'w' ? 'white' : 'black'}-captured`).innerHTML = sorted.map(type => `<span>${pieces[`${color === 'w' ? 'b' : 'w'}${type}`]}</span>`).join('');
}

function resetGame() {
  gameSession += 1;
  disposeEngine();
  disposeAnalysisEngine();
  game = new Chess(); gameStartedAt = new Date().toISOString(); gameSaved = false; selected = null; legalMoves = []; pendingPromotion = null; captured = { w: [], b: [] }; gameResult = null;
  promotionModal.classList.add('hidden'); gameOverModal.classList.add('hidden'); document.querySelector('#save-status').textContent = ''; document.querySelector('#save-status').classList.remove('save-failed'); document.querySelector('#engine-error').classList.add('hidden-view'); resetCoach(); setThinking(false); initEngine(); render();
}

document.querySelector('#undo').addEventListener('click', () => {
  if (aiThinking || game.history().length === 0) return;
  const undoneMoves = [];
  undoneMoves.push(game.undo());
  if (game.turn() === 'b' && game.history().length) undoneMoves.push(game.undo());
  undoneMoves.filter(Boolean).forEach(undone => {
    if (undone.captured) captured[undone.color].pop();
  });
  disposeAnalysisEngine();
  resetCoach();
  selected = null; legalMoves = []; gameResult = null; gameOverModal.classList.add('hidden'); render();
});
document.querySelector('#better-move-button').addEventListener('click', event => {
  coachHighlight = [event.currentTarget.dataset.from, event.currentTarget.dataset.to].filter(Boolean);
  render();
});
document.querySelector('#coach-question-form').addEventListener('submit', event => {
  event.preventDefault();
  const input = document.querySelector('#coach-question');
  const question = input.value;
  if (!question.trim()) return;
  askCoachQuestion(question);
});
document.querySelector('#reset').addEventListener('click', resetGame);
document.querySelector('#retry-game').addEventListener('click', resetGame);
document.querySelector('#play-again').addEventListener('click', () => { resetGame(); renderOpponentDetails(); });
document.querySelector('#start-game').addEventListener('click', startGame);
document.querySelector('#change-opponent').addEventListener('click', openSelection);
document.querySelectorAll('.sidebar nav .nav-item').forEach((item, index) => item.addEventListener('click', () => {
  setActiveNav(index);
  if (index === 0) startGame();
  else if (index === 1) { document.querySelector('#utility-view').classList.add('hidden-view'); openSelection(); }
  else showUtilityView(['training', 'history', 'leaderboard', 'settings'][index - 2]);
}));
document.querySelector('#show-signup').addEventListener('click', () => showAuth('signup'));
document.querySelector('#show-login').addEventListener('click', () => showAuth('login'));
document.querySelector('#back-to-login').addEventListener('click', () => showAuth('login'));
document.querySelector('#forgot-password').addEventListener('click', () => showAuth('reset'));
async function signInWithGoogle() {
  if (!supabase) {
    document.querySelector('#login-error').textContent = 'Authentication is not configured. Set Supabase environment variables.';
    return;
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) document.querySelector('#login-error').textContent = authError(error);
}
document.querySelector('#google-login').addEventListener('click', signInWithGoogle);
document.querySelector('#google-signup').addEventListener('click', signInWithGoogle);
document.querySelector('#logout').addEventListener('click', async () => { if (supabase) await supabase.auth.signOut(); else { currentUser = null; openSelection(); } });
document.querySelector('#login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget; const errorEl = document.querySelector('#login-error'); errorEl.textContent = '';
  if (!supabase) { errorEl.textContent = 'Authentication is not configured. Set Supabase environment variables.'; return; }
  const { error } = await supabase.auth.signInWithPassword({ email: form.email.value.trim(), password: form.password.value });
  if (error) { errorEl.textContent = authError(error); return; }
  form.reset();
});
document.querySelector('#signup-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget; const errorEl = document.querySelector('#signup-error'); errorEl.textContent = '';
  if (form.password.value !== form.confirmPassword.value) { errorEl.textContent = 'Passwords do not match.'; return; }
  if (!supabase) { errorEl.textContent = 'Authentication is not configured. Set Supabase environment variables.'; return; }
  const { data, error } = await supabase.auth.signUp({ email: form.email.value.trim(), password: form.password.value });
  if (error) { errorEl.textContent = authError(error); return; }
  form.reset();
  if (data.session) {
    errorEl.textContent = '';
    return;
  }
  if (!data.session) errorEl.textContent = 'Account created. Check your email to confirm your address, then log in.';
});
document.querySelector('#reset-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget; const message = document.querySelector('#reset-request-message'); message.textContent = '';
  if (!supabase) { message.textContent = 'Authentication is not configured.'; return; }
  const { error } = await supabase.auth.resetPasswordForEmail(form.email.value.trim(), { redirectTo: window.location.origin });
  message.textContent = error ? authError(error) : 'Check your email for a password reset link.';
});
document.querySelector('#update-password-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget; const message = document.querySelector('#reset-update-message'); message.textContent = '';
  if (form.password.value !== form.confirmPassword.value) { message.textContent = 'Passwords do not match.'; return; }
  const { error } = await supabase.auth.updateUser({ password: form.password.value });
  if (error) { message.textContent = authError(error); return; }
  form.reset(); message.textContent = 'Password updated. You can now log in.';
  setTimeout(() => showAuth('login'), 1200);
});
renderOpponents();
render();
initializeAuth();

if (window.location.hash.includes('type=recovery')) {
  showAuth('reset');
  document.querySelector('#reset-form').classList.add('hidden-view');
  document.querySelector('#update-password-form').classList.remove('hidden-view');
}

export { game, resetGame };
