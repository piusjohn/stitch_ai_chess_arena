import { Chess } from 'chess.js';
import './styles.css';

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
let selectionOpen = true;
let aiThinking = false;
let engine = null;
let engineRequest = null;
const engineConfig = { beginner: { depth: 3, skill: 1 }, strategist: { depth: 7, skill: 8 }, grandmaster: { depth: 10, skill: 18 } };

document.querySelector('#app').innerHTML = `
  <main class="app-shell">
    <aside class="sidebar">
      <div class="brand"><span class="brand-mark">♙</span><div><h1>AI Arena</h1><p>Grandmaster Level</p></div></div>
      <nav>${nav.map(([icon, label, active]) => `<button class="nav-item ${active ? 'active' : ''}" type="button"><span>${icon}</span>${label}</button>`).join('')}</nav>
      <button class="nav-item profile" type="button"><span>◎</span>Profile</button>
    </aside>

    <section id="selection-view" class="selection-view">
      <header class="selection-heading"><span>CHOOSE YOUR OPPONENT</span><h2>Who will you face?</h2><p>Select an opponent to begin your match.</p></header>
      <div id="opponent-list" class="opponent-list"></div>
      <button id="start-game" class="primary-action" type="button">PLAY <span>→</span></button>
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
      <section class="opponent-card"><span class="eyebrow">AI OPPONENT</span><div class="opponent-row"><span id="panel-avatar" class="avatar">AI</span><div><strong id="panel-opponent-name">Not connected</strong><small id="panel-opponent-meta">Opponent play is disabled</small></div></div><p id="engine-error" class="engine-error hidden-view">The opponent is unavailable right now.</p><button id="change-opponent" class="text-action" type="button">CHANGE OPPONENT</button></section>
      <section class="history-section"><div class="section-heading"><span>MOVE HISTORY</span><span id="move-count">0 moves</span></div><div id="history" class="history"><p class="empty">Your moves will appear here.</p></div></section>
      <section class="coach-card"><span class="eyebrow">AI COACH</span><p>Coach insights will become available in a later stage.</p><button disabled type="button">REQUEST INSIGHT</button></section>
    </aside>
  </main>

  <div id="promotion-modal" class="overlay hidden" role="dialog" aria-modal="true"><div class="modal promotion-modal"><span class="eyebrow">PAWN PROMOTION</span><h2>Choose a piece</h2><div id="promotion-options" class="promotion-options"></div></div></div>
  <div id="game-over" class="overlay hidden" role="dialog" aria-modal="true"><div class="modal"><span class="eyebrow" id="game-over-label">GAME OVER</span><h2 id="game-over-title">CHECKMATE</h2><p id="game-over-result">WHITE WINS</p><button id="play-again" type="button">PLAY AGAIN</button></div></div>
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
}

function disposeEngine() {
  if (engineRequest) engineRequest.reject(new Error('Engine stopped'));
  engineRequest = null;
  if (engine) { engine.postMessage('quit'); engine.terminate(); engine = null; }
}

function initEngine() {
  disposeEngine();
  engine = new Worker('/stockfish/stockfish.js');
  engine.onmessage = event => {
    const line = typeof event.data === 'string' ? event.data : '';
    if (line.startsWith('bestmove ') && engineRequest) {
      const bestmove = line.split(' ')[1]; const request = engineRequest; engineRequest = null; request.resolve(bestmove);
    }
  };
  engine.onerror = () => handleEngineError();
  engine.postMessage('uci');
  engine.postMessage('isready');
  const config = engineConfig[selectedOpponent.id];
  engine.postMessage(`setoption name Skill Level value ${config.skill}`);
}

function askEngine() {
  return new Promise((resolve, reject) => {
    if (!engine) return reject(new Error('Engine unavailable'));
    engineRequest = { resolve, reject };
    const config = engineConfig[selectedOpponent.id];
    engine.postMessage(`position fen ${game.fen()}`);
    engine.postMessage(`go depth ${config.depth}`);
  });
}

function handleEngineError() {
  if (engineRequest) engineRequest.reject(new Error('Engine unavailable'));
  engineRequest = null; aiThinking = false; setThinking(false);
  document.querySelector('#engine-error').classList.remove('hidden-view');
  disposeEngine();
}

async function playAiTurn() {
  if (game.isGameOver() || game.turn() !== 'b') return;
  setThinking(true);
  try {
    const bestmove = await askEngine();
    if (!bestmove || bestmove === '(none)' || game.isGameOver()) return;
    makeMove({ from: bestmove.slice(0, 2), to: bestmove.slice(2, 4), ...(bestmove[4] ? { promotion: bestmove[4] } : {}) }, true);
  } catch { handleEngineError(); }
  finally { if (!game.isGameOver()) setThinking(false); }
}

function openSelection() {
  disposeEngine();
  setThinking(false);
  selectionOpen = true;
  document.querySelector('#selection-view').classList.remove('hidden-view');
  document.querySelector('#game-view').classList.add('hidden-view');
  document.querySelector('.right-panel').classList.add('hidden-view');
  renderOpponents();
}

function startGame() {
  selectionOpen = false;
  resetGame();
  renderOpponentDetails();
  document.querySelector('#selection-view').classList.add('hidden-view');
  document.querySelector('#game-view').classList.remove('hidden-view');
  document.querySelector('.right-panel').classList.remove('hidden-view');
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
  const result = game.move(move);
  if (!result) return;
  if (result.captured) captured[result.color].push(result.captured);
  selected = null;
  legalMoves = [];
  pendingPromotion = null;
  promotionModal.classList.add('hidden');
  render();
  requestAnimationFrame(() => boardEl.querySelector(`[data-square="${result.to}"] .piece`)?.classList.add('piece-arrive'));
  handleGameState();
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
    showGameOver('CHECKMATE', winner);
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

function showGameOver(title, result) {
  setThinking(false);
  disposeEngine();
  document.querySelector('#game-over-title').textContent = title;
  document.querySelector('#game-over-result').textContent = result;
  gameOverModal.classList.remove('hidden');
}

function renderMeta() {
  const turn = game.turn() === 'w' ? 'White' : 'Black';
  const status = game.isCheckmate() ? 'Checkmate' : game.isDraw() ? 'Draw' : game.inCheck() ? 'Check' : 'Playing';
  document.querySelector('#turn-label').textContent = `${turn} to move${game.inCheck() ? ' · Check' : ''}`;
  document.querySelector('#turn-card').textContent = turn;
  document.querySelector('#status-card').textContent = status;
  document.querySelector('#status-card').classList.toggle('danger', game.inCheck());
  document.querySelector('#check-glow').classList.toggle('visible', game.inCheck());
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
  disposeEngine();
  game = new Chess(); selected = null; legalMoves = []; pendingPromotion = null; captured = { w: [], b: [] };
  promotionModal.classList.add('hidden'); gameOverModal.classList.add('hidden'); document.querySelector('#engine-error').classList.add('hidden-view'); setThinking(false); initEngine(); render();
}

document.querySelector('#undo').addEventListener('click', () => {
  const undone = game.undo();
  if (!undone) return;
  if (undone.captured) captured[undone.color].pop();
  selected = null; legalMoves = []; gameOverModal.classList.add('hidden'); render();
});
document.querySelector('#reset').addEventListener('click', resetGame);
document.querySelector('#play-again').addEventListener('click', () => { resetGame(); renderOpponentDetails(); });
document.querySelector('#start-game').addEventListener('click', startGame);
document.querySelector('#change-opponent').addEventListener('click', openSelection);
document.querySelector('.nav-item:nth-child(1)').addEventListener('click', startGame);
document.querySelector('.nav-item:nth-child(2)').addEventListener('click', openSelection);
renderOpponents();
render();

export { game, resetGame };
