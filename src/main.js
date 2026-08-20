import { Chess } from 'chess.js';
import { createClient } from '@supabase/supabase-js';
import { classifyMove, normalizeEvaluation } from './coach-analysis.js';
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
  ['▥', 'Dashboard', true], ['♟', 'Play'], ['📖', 'Learn'], ['⚔', 'Train'], ['↶', 'Games'], ['⚙', 'Profile'],
];
const opponents = [
  { id: 'beginner', name: 'The Beginner', difficulty: 'Beginner', rating: 800, personality: 'Friendly and forgiving', description: 'A relaxed opponent for learning the basics.', avatar: 'B' },
  { id: 'strategist', name: 'The Strategist', difficulty: 'Intermediate', rating: 1400, personality: 'Patient and calculated', description: 'Builds positions carefully and waits for mistakes.', avatar: 'S' },
  { id: 'aggressor', name: 'The Aggressor', difficulty: 'Intermediate', rating: 1550, personality: 'Tactical and attacking', description: 'Creates sharp positions and looks for forcing moves.', avatar: 'A' },
  { id: 'trickster', name: 'The Trickster', difficulty: 'Advanced', rating: 1750, personality: 'Complicated and unpredictable', description: 'Tests your calculation with unusual ideas.', avatar: 'T' },
  { id: 'endgame', name: 'The Endgame Master', difficulty: 'Advanced', rating: 1850, personality: 'Precise and technical', description: 'Trades down and wins small advantages.', avatar: 'E' },
  { id: 'grandmaster', name: 'The Grandmaster', difficulty: 'Advanced', rating: 2000, personality: 'Aggressive and highly analytical', description: 'A serious challenge that punishes mistakes.', avatar: 'G' },
];
const coreTrainingPuzzles = [
  { id: 'pawn-capture', title: 'Pawn Breakthrough', piece: '♙', category: 'Pawn', fen: '7k/8/3p4/4P3/8/8/8/6K1 w - - 0 1', solution: 'e5d6', solutionSan: 'exd6', instruction: 'Pawns capture diagonally. Take the pawn on d6.', lesson: 'Pawns move forward but capture one square diagonally. Passed pawns become more dangerous as they approach promotion.', tip: 'Use pawn captures to open files and create passed pawns.' },
  { id: 'pawn-push', title: 'Passed Pawn Push', piece: '♙', category: 'Pawn', fen: '7k/8/8/8/8/8/4P3/6K1 w - - 0 1', solution: 'e2e4', solutionSan: 'e4', instruction: 'Push the pawn two squares from its starting rank.', lesson: 'A pawn may move two squares on its first move when both squares are clear.', tip: 'Advance pawns to claim space, but do not weaken your king unnecessarily.' },
  { id: 'pawn-promotion', title: 'Promote to a Queen', piece: '♙', category: 'Pawn', fen: '8/P7/7k/8/8/8/8/6K1 w - - 0 1', solution: 'a7a8q', solutionSan: 'a8=Q+', instruction: 'Advance the pawn and promote it to the strongest piece.', lesson: 'A pawn reaching the last rank promotes, usually to a queen.', tip: 'Passed pawns on the seventh rank demand immediate attention.' },
  { id: 'knight-fork', title: 'Knight Fork', piece: '♘', category: 'Knight', fen: 'q3k3/8/8/1N6/8/8/8/6K1 w - - 0 1', solution: 'b5c7', solutionSan: 'Nc7+', instruction: 'Knights jump in an L shape. Fork the king and queen.', lesson: 'Knights jump over pieces and attack in an L shape: two squares one way, then one sideways. They are strongest near the center.', tip: 'Look for forks where one knight attacks two valuable pieces.' },
  { id: 'knight-center', title: 'Central Knight', piece: '♘', category: 'Knight', fen: '7k/8/8/8/3N4/8/8/6K1 w - - 0 1', solution: 'd4f5', solutionSan: 'Nf5', instruction: 'Jump the knight to a central outpost.', lesson: 'Knights need central squares to influence many targets.', tip: 'A centralized knight can attack six or eight squares at once.' },
  { id: 'knight-check', title: 'Knight Check', piece: '♘', category: 'Knight', fen: '7k/8/8/3N4/8/8/8/6K1 w - - 0 1', solution: 'd5f6', solutionSan: 'Nf6+', instruction: 'Use the knight jump to give check.', lesson: 'Knight checks are difficult to block because knights jump directly.', tip: 'Scan for knight checks before slower attacking moves.' },
  { id: 'bishop-diagonal', title: 'Long Diagonal', piece: '♗', category: 'Bishop', fen: 'r6k/8/8/8/8/8/6B1/6K1 w - - 0 1', solution: 'g2a8', solutionSan: 'Bxa8', instruction: 'Bishops control diagonals. Capture the rook from long range.', lesson: 'Bishops slide diagonally and always remain on one square color. Open diagonals make them powerful long-range pieces.', tip: 'Move blocking pawns so your bishops can see across the board.' },
  { id: 'bishop-develop', title: 'Develop the Bishop', piece: '♗', category: 'Bishop', fen: '7k/8/8/8/8/8/4P3/2B3K1 w - - 0 1', solution: 'c1f4', solutionSan: 'Bf4', instruction: 'Develop the bishop to an active diagonal.', lesson: 'Develop minor pieces toward useful diagonals before launching attacks.', tip: 'Look for squares where the bishop has a clear line and supports the center.' },
  { id: 'bishop-check', title: 'Diagonal Check', piece: '♗', category: 'Bishop', fen: '7k/8/8/8/8/8/8/B5K1 w - - 0 1', solution: 'a1g7', solutionSan: 'Bg7+', instruction: 'Slide along the diagonal to check the king.', lesson: 'A bishop can attack a king from far away when the diagonal is open.', tip: 'Count blockers before committing to a long diagonal attack.' },
  { id: 'mate-back-rank', title: 'Open-File Rook', piece: '♖', category: 'Rook', fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1', solution: 'e1e8', solutionSan: 'Re8#', instruction: 'Rooks dominate open files. Deliver the back-rank mate.', lesson: 'Rooks slide horizontally and vertically. They thrive on open files, behind passed pawns, and on the seventh rank.', tip: 'Connect your rooks and place them on files without pawns.' },
  { id: 'rook-file', title: 'Claim the Open File', piece: '♖', category: 'Rook', fen: '7k/8/8/8/8/8/8/R5K1 w - - 0 1', solution: 'a1a8', solutionSan: 'Ra8+', instruction: 'Lift the rook up the open file to give check.', lesson: 'Open files are highways for rooks.', tip: 'Put rooks on open files and behind passed pawns.' },
  { id: 'rook-rank', title: 'Seventh-Rank Rook', piece: '♖', category: 'Rook', fen: '7k/8/8/8/8/8/R7/6K1 w - - 0 1', solution: 'a2h2', solutionSan: 'Rh2', instruction: 'Slide across the rank to attack from the side.', lesson: 'Rooks can switch between files and ranks quickly.', tip: 'Side checks and lateral attacks are core rook skills.' },
  { id: 'mate-one', title: 'Queen Finish', piece: '♕', category: 'Queen', fen: '7k/6Q1/6K1/8/8/8/8/8 w - - 0 1', solution: 'g7h7', solutionSan: 'Qh7#', instruction: 'Combine the queen and king to checkmate immediately.', lesson: 'The queen combines rook and bishop movement. Her power makes her valuable, but early queen adventures often lose time.', tip: 'Use the queen with support; do not let opponents chase her repeatedly.' },
  { id: 'queen-check', title: 'Queen Check', piece: '♕', category: 'Queen', fen: '7k/8/8/8/8/8/8/Q5K1 w - - 0 1', solution: 'a1h8', solutionSan: 'Qh8+', instruction: 'Use the queen’s diagonal power to give check.', lesson: 'The queen can attack along ranks, files, and diagonals.', tip: 'Checks force a response, but always check whether the queen can be captured.' },
  { id: 'queen-capture', title: 'Queen Sweep', piece: '♕', category: 'Queen', fen: '7k/8/8/8/8/8/6r1/Q5K1 w - - 0 1', solution: 'a1g1', solutionSan: 'Qg1', instruction: 'Slide along the rank to create a strong attacking position.', lesson: 'The queen combines long-range movement with strong tactical reach.', tip: 'Before attacking, look for open lines and forcing threats.' },
  { id: 'king-activate', title: 'Activate the King', piece: '♔', category: 'King', fen: '7k/8/8/8/8/4P3/4K3/8 w - - 0 1', solution: 'e2d3', solutionSan: 'Kd3', instruction: 'In simple endings, centralize the king toward the action.', lesson: 'The king moves one square in any direction. Keep it sheltered early, then activate it as pieces leave the board.', tip: 'In endgames, treat your king as a fighting piece.' },
  { id: 'king-capture', title: 'King Takes Space', piece: '♔', category: 'King', fen: '7k/8/8/8/8/8/3p4/3K4 w - - 0 1', solution: 'd1e2', solutionSan: 'Ke2', instruction: 'Step toward the center and support the pawn race.', lesson: 'King activity often decides pawn endings.', tip: 'Centralize your king while checking that the destination is safe.' },
  { id: 'king-opposition', title: 'Take the Opposition', piece: '♔', category: 'King', fen: '7k/8/8/8/8/3k4/8/3K4 w - - 0 1', solution: 'd1e2', solutionSan: 'Ke2', instruction: 'Move toward the opposition in this king ending.', lesson: 'Opposition is the key to many king-and-pawn endings.', tip: 'Place the kings on the same file or rank with an odd number of squares between them.' },
];

function createMovementMasteryLessons() {
  const templates = [
    { category: 'Knight', piece: '♘', fen: '7k/8/8/8/3N4/8/8/6K1 w - - 0 1' },
    { category: 'Bishop', piece: '♗', fen: '7k/8/8/8/3B4/8/8/6K1 w - - 0 1' },
    { category: 'Rook', piece: '♖', fen: '7k/8/8/8/3R4/8/8/6K1 w - - 0 1' },
    { category: 'Queen', piece: '♕', fen: '7k/8/8/8/3Q4/8/8/6K1 w - - 0 1' },
    { category: 'King', piece: '♔', fen: '7k/8/8/8/3K4/8/8/8 w - - 0 1' },
  ];
  const lessons = [];
  templates.forEach(template => {
    const position = new Chess(template.fen);
    const moves = position.moves({ verbose: true });
    for (let round = 0; round < 17 && lessons.length < 82; round += 1) {
      const move = moves[round % moves.length];
      lessons.push({ id: `mastery-${template.category.toLowerCase()}-${round + 1}`, title: `${template.category} Movement ${round + 1}`, piece: template.piece, category: template.category, fen: template.fen, solution: `${move.from}${move.to}${move.promotion || ''}`, solutionSan: move.san, instruction: `Move the ${template.category.toLowerCase()} from ${move.from} to ${move.to}.`, lesson: `Movement mastery ${round + 1}: recognize every legal ${template.category.toLowerCase()} path from the center.`, tip: `Select the piece to reveal its legal destinations, then find ${move.to}.` });
    }
  });
  return lessons;
}

const trainingPuzzles = [...coreTrainingPuzzles, ...createMovementMasteryLessons()].slice(0, 100);

function academyProgressKey() { return `ai-chess-academy:${currentUser?.id || 'guest'}`; }
function loadAcademyProgress() { try { return JSON.parse(localStorage.getItem(academyProgressKey()) || '[]'); } catch { return []; } }
function learnProgressKey() { return `ai-chess-learn:${currentUser?.id || 'guest'}`; }
function loadLearnProgress() { try { return JSON.parse(localStorage.getItem(learnProgressKey()) || '[]'); } catch { return []; } }
function dailyPuzzle() { return trainingPuzzles[new Date().getDate() % trainingPuzzles.length]; }
function streakKey() { return `ai-chess-puzzle-streak:${currentUser?.id || 'guest'}`; }
function loadPuzzleStreak() { try { return JSON.parse(localStorage.getItem(streakKey()) || '{"current":0,"best":0,"date":""}'); } catch { return { current: 0, best: 0, date: '' }; } }
function recordPuzzleResult(correct) {
  const today = new Date().toISOString().slice(0, 10); const streak = loadPuzzleStreak();
  if (streak.date === today) return streak;
  streak.current = correct ? streak.current + 1 : 0; streak.best = Math.max(streak.best, streak.current); streak.date = today;
  localStorage.setItem(streakKey(), JSON.stringify(streak)); return streak;
}

function generatedTrainingKey() { return `ai-chess-training:${currentUser?.id || 'guest'}`; }
function loadGeneratedTraining() {
  try { return JSON.parse(localStorage.getItem(generatedTrainingKey()) || '[]'); } catch { return []; }
}
function saveGeneratedTraining(analysis) {
  if (!currentUser || !['Mistake', 'Blunder'].includes(analysis.classification) || !analysis.bestMove || !analysis.betterMoveSan) return;
  try {
    const validation = new Chess(analysis.beforeFen);
    const verified = validation.move({ from: analysis.bestMove.slice(0, 2), to: analysis.bestMove.slice(2, 4), ...(analysis.bestMove[4] ? { promotion: analysis.bestMove[4] } : {}) });
    if (!verified) return;
    const exercises = loadGeneratedTraining().filter(item => item.fen !== analysis.beforeFen);
    exercises.unshift({ id: `mistake-${Date.now()}`, title: `Review ${analysis.playerMove}`, category: analysis.classification, fen: analysis.beforeFen, solution: analysis.bestMove, solutionSan: verified.san, instruction: `You played ${analysis.playerMove}. Find Stockfish's stronger move.`, explanation: `${analysis.playerMove} lost about ${Math.round((analysis.centipawnLoss || 0) / 10) / 10} pawns of evaluation. ${verified.san} keeps more control of the position.`, generated: true });
    localStorage.setItem(generatedTrainingKey(), JSON.stringify(exercises.slice(0, 8)));
  } catch { /* Invalid engine output is never stored as training. */ }
}

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
let moveAnalyses = [];
let onlineRoom = null;
let onlineColor = null;
let onlineChannel = null;
let onlineMovePending = false;
const engineConfig = { beginner: { depth: 3, skill: 1 }, strategist: { depth: 7, skill: 8 }, aggressor: { depth: 7, skill: 11 }, trickster: { depth: 8, skill: 13 }, endgame: { depth: 8, skill: 15 }, grandmaster: { depth: 10, skill: 18 } };
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
      <section class="share-play"><span>PLAY WITH A FRIEND</span><strong>Share a private room code</strong><div><button id="create-room" type="button">CREATE ROOM</button><input id="room-code" maxlength="6" placeholder="CODE" aria-label="Room code"><button id="join-room" type="button">JOIN</button></div><p id="room-status"></p></section>
    </section>

    <section id="utility-view" class="utility-view hidden-view">
      <header class="selection-heading"><span id="utility-eyebrow">TRAINING</span><h2 id="utility-title">Training drills</h2><p id="utility-description">Practice with focused positions and review your progress.</p></header>
      <div id="utility-content" class="utility-content"></div>
    </section>

    <section id="game-view" class="game-area hidden-view">
      <header class="challenge"><span>LIVE MATCH</span><h2>Classic Chess</h2><small id="arena-signal" class="arena-signal">OPENING RADAR · Develop a new piece before moving the queen</small></header>
      <div class="player-strip opponent"><div><span id="game-avatar" class="avatar">AI</span><strong id="game-opponent-name">AI Opponent</strong><small id="game-opponent-meta">Coming soon</small></div><div><span id="ai-thinking" class="thinking hidden-view">AI IS THINKING...</span><div id="black-captured" class="captured"></div></div></div>
      <div class="board-frame"><div id="board" class="board" aria-label="Chessboard"></div><div id="check-glow" class="check-glow"></div></div>
      <div class="player-strip"><div><span class="avatar human">♙</span><strong>You</strong><small id="turn-label">White to move</small></div><div id="white-captured" class="captured"></div></div>
      <div class="board-actions"><button id="fullscreen-board" class="icon-button" type="button" title="Fullscreen board">⛶</button><button id="undo" class="icon-button" type="button" title="Undo move">↶</button><button id="reset" class="icon-button" type="button" title="Reset game">↺</button></div>
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
    const choose = () => { selectedOpponent = opponents.find(item => item.id === card.dataset.opponent); renderOpponents(); };
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
    worker.postMessage('go depth 6');
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

function requestGameSummary() {
  const meaningful = moveAnalyses.filter(item => item.classification !== 'Neutral');
  if (!meaningful.length) return 'You kept the game stable throughout. Keep developing pieces, protecting your king, and look for forcing moves before committing.';
  const strongest = meaningful.filter(item => ['Excellent', 'Good'].includes(item.classification)).sort((a, b) => (b.evaluationSwing || 0) - (a.evaluationSwing || 0))[0];
  const biggest = meaningful.filter(item => ['Mistake', 'Blunder'].includes(item.classification)).sort((a, b) => (b.centipawnLoss || 0) - (a.centipawnLoss || 0))[0];
  const mistakes = meaningful.filter(item => ['Mistake', 'Blunder'].includes(item.classification));
  const weakness = mistakes.some(item => item.playerMove?.toLowerCase().includes('q')) ? 'queen timing and development' : mistakes.length > 1 ? 'tactical awareness' : 'careful calculation';
  const opening = game.history().slice(0, 8).filter((_, index) => index % 2 === 0).length;
  const lines = [
    `${gameResult === 'YOU WIN' ? 'You converted the game successfully' : gameResult === 'AI WINS' ? 'The position became difficult to hold' : 'The game stayed competitive'} across ${game.history().length} moves.`,
    strongest ? `Your strongest moment was ${strongest.playerMove}, classified as ${strongest.classification.toLowerCase()}.` : `Your opening included ${opening} developing moves before the critical phase.`,
    biggest ? `The main turning point was ${biggest.playerMove}${biggest.betterMoveSan ? `; ${biggest.betterMoveSan} was the stronger alternative` : ''}. For your next games, focus on ${weakness} before committing to an attack.` : 'For your next games, keep prioritizing development, king safety, and forcing moves.',
  ];
  return lines.join(' ');
}

function setCoachLoading(sequence) {
  if (sequence !== coachSequence) return;
  coachHighlight = [];
  document.querySelector('#coach-status').textContent = 'STOCKFISH';
  document.querySelector('#coach-result').textContent = 'EVALUATING';
  document.querySelector('#coach-result').className = 'coach-result loading';
  document.querySelector('#coach-explanation').textContent = 'Checking the move with Stockfish...';
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
    if (!response.ok) {
      const failure = await response.json().catch(() => null);
      throw new Error(failure?.message || 'Coach unavailable');
    }
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
  }).catch(error => {
    if (sequence !== coachSequence) return;
    document.querySelector('#coach-status').textContent = 'AI COACH';
    document.querySelector('#coach-result').textContent = 'CHAT ERROR';
    document.querySelector('#coach-result').className = 'coach-result blunder';
    document.querySelector('#coach-explanation').textContent = error?.message || 'Gemini is unavailable. Check the server API key and try again.';
  }).finally(() => {
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

function stockfishMoveExplanation(analysis) {
  const better = analysis.betterMoveSan ? ` The engine's stronger option was ${analysis.betterMoveSan}.` : '';
  if (analysis.classification === 'Excellent') return `Excellent choice. This move matches the engine's best line and keeps your position on track.`;
  if (analysis.classification === 'Good') return `Good move. You improved or maintained the position without giving the opponent a clear advantage.`;
  if (analysis.classification === 'Neutral') return 'Position updated. Look for development, king safety, and forcing moves before making the next decision.';
  if (analysis.classification === 'Mistake') return `This move gives away approximately ${Math.round((analysis.centipawnLoss || 0) / 100 * 10) / 10} pawns of evaluation.${better} Before moving, check the opponent's forcing replies.`;
  return `This is a serious error and changes the evaluation significantly.${better} Pause to scan checks, captures, and threats before committing.`;
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
    const before = await analyzePosition(beforeFen);
    const after = await analyzePosition(afterFen);
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
    moveAnalyses.push(analysis);
    saveGeneratedTraining(analysis);
    showCoachResult(sequence, analysis, stockfishMoveExplanation(analysis));
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
    learn: ['LEARN', 'Chess lessons', 'Build a strong foundation with short, focused lessons.'],
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
  if (kind === 'learn') {
    const completed = loadLearnProgress();
    const nextIndex = Math.min(completed.length, trainingPuzzles.length - 1);
    content.innerHTML = `<div class="learn-hero compact"><div><span>LEARN · ${completed.length}/${trainingPuzzles.length}</span><strong>${completed.length === trainingPuzzles.length ? 'Academy complete' : `Level ${completed.length + 1}`}</strong></div><div class="learn-progress"><i style="width:${completed.length / trainingPuzzles.length * 100}%"></i></div></div><div class="learn-list">${trainingPuzzles.map((lesson, index) => { const unlocked = index <= nextIndex; const done = completed.includes(lesson.id); return `<article class="learn-item ${done ? 'done' : ''} ${unlocked ? '' : 'locked'}"><b>${done ? '✓' : String(index + 1).padStart(2, '0')}</b><div><span>${lesson.category}</span><h3>${lesson.title}</h3><p>${lesson.instruction}</p></div><button class="text-action" data-learn-puzzle="${lesson.id}" ${unlocked ? '' : 'disabled'} type="button">${done ? 'REVIEW' : unlocked ? 'START' : 'LOCKED'}</button></article>`; }).join('')}</div>`;
    content.querySelectorAll('[data-learn-puzzle]').forEach(button => button.addEventListener('click', () => openTrainingPuzzle(button.dataset.learnPuzzle)));
  } else if (kind === 'training') {
    const generated = loadGeneratedTraining();
    const allPuzzles = [...generated, ...trainingPuzzles];
    const completed = loadAcademyProgress();
    const streak = loadPuzzleStreak(); const daily = dailyPuzzle();
    const mistakeCount = generated.reduce((counts, puzzle) => ({ ...counts, [puzzle.category]: (counts[puzzle.category] || 0) + 1 }), {});
    const repeated = Object.entries(mistakeCount).sort((a, b) => b[1] - a[1])[0];
    content.innerHTML = `<section class="daily-puzzle"><div><span>DAILY PUZZLE</span><strong>${daily.title}</strong><p>${daily.instruction}</p></div><div class="streak-badge"><b>${streak.current}</b><small>DAY STREAK</small><em>BEST ${streak.best}</em></div><button class="primary-action" data-puzzle="${daily.id}" type="button">SOLVE TODAY'S PUZZLE</button></section><div class="academy-progress"><span>PIECE ACADEMY</span><strong>${completed.length} / ${trainingPuzzles.length} MASTERED</strong><div><i style="width:${completed.length / trainingPuzzles.length * 100}%"></i></div></div>${generated.length ? `<section class="mistake-dna"><span>MISTAKE DNA</span><strong>${repeated?.[0] || 'Calculation'}</strong><p>Your personal training queue contains ${generated.length} verified positions from your own games. Start here to break the pattern.</p></section><p class="training-section-label">FROM YOUR GAMES</p>` : ''}<div class="utility-grid training-grid">${allPuzzles.map(puzzle => `<button class="utility-card training-card ${completed.includes(puzzle.id) ? 'completed' : ''}" data-puzzle="${puzzle.id}"><b class="piece-token">${puzzle.piece || '◎'}</b><strong>${puzzle.title}</strong><span>${puzzle.category}${puzzle.generated ? ' · PERSONALIZED' : ' · PIECE ACADEMY'}</span><small>${puzzle.instruction}</small><i>${completed.includes(puzzle.id) ? 'MASTERED ✓' : 'START LESSON →'}</i></button>`).join('')}</div>`;
    content.querySelectorAll('[data-puzzle]').forEach(button => button.addEventListener('click', () => openTrainingPuzzle(button.dataset.puzzle)));
  } else if (kind === 'settings') {
    const profileKey = `ai-chess-profile:${currentUser?.id || 'guest'}`;
    const profile = JSON.parse(localStorage.getItem(profileKey) || '{}');
    content.innerHTML = `<div class="utility-card"><strong>PLAYER PROFILE</strong><span>${currentUser?.email || 'Not signed in'}</span><label class="profile-edit">DISPLAY NAME<input id="display-name" value="${profile.displayName || ''}" maxlength="30" placeholder="Chess learner"></label><button id="save-profile" class="primary-action" type="button">SAVE PROFILE</button><button id="settings-logout" class="text-action" type="button">LOG OUT</button></div>`;
    content.querySelector('#save-profile').addEventListener('click', () => { localStorage.setItem(profileKey, JSON.stringify({ displayName: content.querySelector('#display-name').value.trim() })); content.querySelector('#save-profile').textContent = 'SAVED'; });
    content.querySelector('#settings-logout').addEventListener('click', () => document.querySelector('#logout').click());
  } else {
    content.innerHTML = '<p class="utility-loading">Loading your games...</p>';
    if (!supabase || !currentUser) { content.innerHTML = '<p class="utility-empty">Log in to see saved games.</p>'; return; }
    const { data, error } = await supabase.from('games').select('opponent_name, opponent_difficulty, result, move_count, moves, mistakes, blunders, player_accuracy, completed_at').order('completed_at', { ascending: false }).limit(25);
    if (error) { content.innerHTML = '<p class="utility-empty">Games could not be loaded right now.</p>'; return; }
    if (!data?.length) { content.innerHTML = '<p class="utility-empty">No completed games yet. Start a match to build your record.</p>'; return; }
    const search = kind === 'history' ? '<input id="history-filter" class="history-filter" placeholder="Filter by opponent, result, or date" autocomplete="off">' : '';
    const renderRows = list => list.map((game, index) => `<button class="utility-row game-history-row" data-game-index="${data.indexOf(game)}" type="button"><span>${index + 1}</span><strong>${game.opponent_name}</strong><span>${game.result}</span><span>${game.move_count} moves</span><small>${new Date(game.completed_at).toLocaleDateString()}</small></button>`).join('');
    content.innerHTML = `${renderProgress(data)}${renderChessProfile(data)}${search}<div class="utility-list">${renderRows(data)}</div>`;
    const list = content.querySelector('.utility-list');
    content.querySelector('#history-filter')?.addEventListener('input', event => { const query = event.target.value.toLowerCase(); list.innerHTML = renderRows(data.filter(game => `${game.opponent_name} ${game.result} ${game.completed_at}`.toLowerCase().includes(query))); list.querySelectorAll('[data-game-index]').forEach(row => row.addEventListener('click', () => openSavedGameAnalysis(data[Number(row.dataset.gameIndex)]))); });
    content.querySelectorAll('[data-game-index]').forEach(row => row.addEventListener('click', () => openSavedGameAnalysis(data[Number(row.dataset.gameIndex)])));
  }
}

function openSavedGameAnalysis(savedGame) {
  const moves = Array.isArray(savedGame.moves) ? savedGame.moves : [];
  let moveIndex = 0;
  let reviewSequence = 0;
  const reviewCache = new Map();
  const content = document.querySelector('#utility-content');
  content.innerHTML = `<div class="analysis-session"><div class="analysis-toolbar"><button id="analysis-back" class="text-action" type="button">BACK TO GAMES</button><strong>${savedGame.opponent_name} · ${savedGame.result}</strong></div><div id="saved-analysis-board" class="training-board"></div><div class="analysis-controls"><button id="analysis-prev" type="button">PREVIOUS</button><span id="analysis-move-label">START POSITION</span><button id="analysis-next" type="button">NEXT</button></div><div class="analysis-detail"><span>ENGINE REVIEW</span><p id="analysis-review">Select a move to evaluate the position.</p></div></div>`;
  const board = content.querySelector('#saved-analysis-board');
  const renderPosition = async () => {
    const sequence = ++reviewSequence;
    const position = new Chess();
    moves.slice(0, moveIndex).forEach(move => position.move(move));
    board.innerHTML = '';
    position.board().forEach((row, rankIndex) => row.forEach((piece, fileIndex) => {
      const square = `${'abcdefgh'[fileIndex]}${8 - rankIndex}`;
      const button = document.createElement('button'); button.type = 'button'; button.className = `square ${squareColor(fileIndex, rankIndex)}`; button.disabled = true;
      if (piece) button.innerHTML = `<span class="piece ${piece.color}">${pieces[`${piece.color}${piece.type}`]}</span>`;
      board.append(button);
    }));
    content.querySelector('#analysis-move-label').textContent = moveIndex ? `MOVE ${moveIndex}: ${moves[moveIndex - 1]?.san || ''}` : 'START POSITION';
    content.querySelector('#analysis-prev').disabled = moveIndex === 0;
    content.querySelector('#analysis-next').disabled = moveIndex === moves.length;
    const review = content.querySelector('#analysis-review');
    if (!moveIndex) { review.textContent = 'Select a move to evaluate the position.'; return; }
    if (reviewCache.has(moveIndex)) { review.textContent = reviewCache.get(moveIndex); return; }
    review.textContent = 'Stockfish is evaluating this move...';
    try {
      const before = new Chess(); moves.slice(0, moveIndex - 1).forEach(move => before.move(move));
      const played = moves[moveIndex - 1];
      const beforeFen = before.fen();
      const afterFen = position.fen();
      const beforeAnalysis = await analyzePosition(beforeFen);
      const afterAnalysis = await analyzePosition(afterFen);
      if (sequence !== reviewSequence || !beforeAnalysis.score || !afterAnalysis.score) return;
      const playerColor = played.color || before.turn();
      const beforeScore = normalizeEvaluation(beforeAnalysis.score, playerColor);
      const afterScore = normalizeEvaluation(afterAnalysis.score, playerColor === 'w' ? 'b' : 'w');
      const uci = `${played.from}${played.to}${played.promotion || ''}`;
      const classification = classifyMove(beforeScore, afterScore, uci === beforeAnalysis.bestMove);
      const analysis = { ...classification, playerMove: played.san, bestMove: beforeAnalysis.bestMove, betterMoveSan: toSan(beforeFen, beforeAnalysis.bestMove) };
      const text = `YOUR MOVE: ${played.san} · ENGINE: ${(afterScore / 100).toFixed(1)} · CLASSIFICATION: ${classification.classification.toUpperCase()} · BETTER MOVE: ${analysis.betterMoveSan || '—'} · COACH: ${stockfishMoveExplanation(analysis)}`;
      reviewCache.set(moveIndex, text);
      review.textContent = text;
    } catch { if (sequence === reviewSequence) review.textContent = 'Stockfish analysis is unavailable for this move.'; }
  };
  content.querySelector('#analysis-back').addEventListener('click', () => showUtilityView('history'));
  content.querySelector('#analysis-prev').addEventListener('click', () => { moveIndex -= 1; renderPosition(); });
  content.querySelector('#analysis-next').addEventListener('click', () => { moveIndex += 1; renderPosition(); });
  renderPosition();
}

function openTrainingPuzzle(id) {
  const puzzle = [...loadGeneratedTraining(), ...trainingPuzzles].find(item => item.id === id);
  if (!puzzle) return;
  const content = document.querySelector('#utility-content');
  content.innerHTML = `<div class="training-exercise"><section class="tutor-stage"><div id="tutor-avatar" class="tutor-avatar" aria-label="Coach Maya"><div class="tutor-neck"></div><div class="tutor-hair"></div><div class="tutor-face"><span class="tutor-brow left"></span><span class="tutor-brow right"></span><span class="tutor-eye left"></span><span class="tutor-eye right"></span><span class="tutor-nose"></span><span class="tutor-mouth"></span></div></div><div class="tutor-dialogue"><span>COACH MAYA · YOUR LESSON GUIDE</span><p id="tutor-message">Welcome back. Let’s master the ${puzzle.category.toLowerCase()}.</p></div></section><section class="lesson-brief"><div class="lesson-hero"><b>${puzzle.piece || '◎'}</b><div><span>${puzzle.category} LESSON</span><strong>${puzzle.title}</strong></div></div><p class="piece-lesson">${puzzle.lesson || puzzle.instruction}</p><aside class="coach-tip">${puzzle.tip || 'Look at every forcing move before choosing.'}</aside><p class="lesson-objective"><span>YOUR TASK</span>${puzzle.instruction}</p></section><div id="training-board" class="training-board" aria-label="Training chess position"></div><p id="training-feedback" class="training-feedback">Select the ${puzzle.category.toLowerCase()} to reveal its legal moves.</p><div class="lesson-actions"><button id="back-training" class="text-action" type="button">← ACADEMY</button><div><button id="retry-training" class="text-action hidden-view" type="button">TRY AGAIN</button><button id="next-training" class="text-action hidden-view" type="button">NEXT LESSON →</button></div></div></div>`;
  const speak = text => {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const avatar = content.querySelector('#tutor-avatar');
    const message = content.querySelector('#tutor-message');
    if (message) message.textContent = text;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.02; utterance.pitch = 1.08;
    const voices = speechSynthesis.getVoices();
    utterance.voice = voices.find(voice => /en.*(natural|google|samantha|daniel)/i.test(`${voice.lang} ${voice.name}`)) || voices.find(voice => voice.lang.startsWith('en')) || null;
    utterance.onstart = () => avatar?.classList.add('speaking');
    utterance.onend = utterance.onerror = () => avatar?.classList.remove('speaking');
    speechSynthesis.speak(utterance);
  };
  setTimeout(() => speak(`Welcome to ${puzzle.title}. ${puzzle.instruction}`), 350);
  const position = new Chess(puzzle.fen);
  const isDaily = puzzle.id === dailyPuzzle().id;
  let selectedTrainingSquare = null;
  const board = content.querySelector('#training-board');
  const renderTrainingPosition = () => {
    board.innerHTML = '';
    position.board().forEach((row, rankIndex) => row.forEach((piece, fileIndex) => {
      const square = `${'abcdefgh'[fileIndex]}${8 - rankIndex}`;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `square ${squareColor(fileIndex, rankIndex)}${selectedTrainingSquare === square ? ' selected' : ''}`;
      if (selectedTrainingSquare && position.moves({ square: selectedTrainingSquare, verbose: true }).some(move => move.to === square)) button.classList.add(piece ? 'legal-capture' : 'legal-move');
      button.dataset.square = square;
      if (piece) button.innerHTML = `<span class="piece ${piece.color}">${pieces[`${piece.color}${piece.type}`]}</span>`;
      button.addEventListener('click', () => {
        const ownPiece = position.get(square);
        if (!selectedTrainingSquare) { if (ownPiece?.color === position.turn()) { selectedTrainingSquare = square; renderTrainingPosition(); } return; }
        if (ownPiece?.color === position.turn()) { selectedTrainingSquare = square; renderTrainingPosition(); return; }
        const feedback = content.querySelector('#training-feedback');
        let move;
        try { move = position.move({ from: selectedTrainingSquare, to: square, promotion: 'q' }); } catch { move = null; }
        if (!move) { selectedTrainingSquare = null; feedback.textContent = 'That move is not legal in this position.'; feedback.className = 'training-feedback error'; renderTrainingPosition(); return; }
        const played = `${move.from}${move.to}${move.promotion || ''}`;
        renderTrainingPosition();
        if (played === puzzle.solution) { const streak = isDaily ? recordPuzzleResult(true) : null; feedback.textContent = `Excellent! You found ${puzzle.solutionSan}.${streak ? ` Daily streak: ${streak.current}.` : ''} ${puzzle.explanation || puzzle.tip || 'This is the verified winning move.'}`; feedback.className = 'training-feedback success'; speak(feedback.textContent); const progress = new Set(loadAcademyProgress()); if (!puzzle.generated) { progress.add(puzzle.id); localStorage.setItem(academyProgressKey(), JSON.stringify([...progress])); const learn = new Set(loadLearnProgress()); learn.add(puzzle.id); localStorage.setItem(learnProgressKey(), JSON.stringify([...learn])); } content.querySelector('#next-training').classList.remove('hidden-view'); }
        else { if (isDaily) recordPuzzleResult(false); feedback.textContent = `Not quite. The correct move is ${puzzle.solutionSan}. ${puzzle.explanation || puzzle.instruction}`; feedback.className = 'training-feedback error'; speak(feedback.textContent); }
        content.querySelector('#retry-training').classList.remove('hidden-view');
        board.querySelectorAll('button').forEach(item => { item.disabled = true; });
      });
      board.append(button);
    }));
  };
  renderTrainingPosition();
  content.querySelector('#retry-training').addEventListener('click', () => openTrainingPuzzle(id));
  content.querySelector('#next-training').addEventListener('click', () => { const index = trainingPuzzles.findIndex(item => item.id === id); openTrainingPuzzle(trainingPuzzles[(index + 1) % trainingPuzzles.length].id); });
  content.querySelector('#back-training').addEventListener('click', () => showUtilityView('training'));
}

function setActiveNav(index) {
  document.querySelectorAll('.sidebar nav .nav-item').forEach((item, itemIndex) => item.classList.toggle('active', itemIndex === index));
}

function buildChessProfile(games) {
  if (games.length < 3) return null;
  const signals = { Opening: [], Tactics: [], 'King safety': [], Calculation: [], Endgames: [] };
  games.forEach(saved => {
    const moves = Array.isArray(saved.moves) ? saved.moves : [];
    const whiteMoves = moves.filter(move => move.color === 'w');
    const opening = whiteMoves.slice(0, 8);
    const queenMoves = opening.filter(move => move.piece === 'q').length;
    const developedMinors = new Set(opening.filter(move => ['n', 'b'].includes(move.piece)).map(move => move.from)).size;
    signals.Opening.push(Math.max(20, Math.min(100, 55 + developedMinors * 12 - Math.max(0, queenMoves - 1) * 18)));
    const forcingMoves = whiteMoves.filter(move => move.captured || move.san?.includes('+')).length;
    signals.Tactics.push(Math.min(100, 42 + forcingMoves * 7));
    const castled = whiteMoves.some(move => move.flags?.includes('k') || move.flags?.includes('q'));
    signals['King safety'].push(castled ? 82 : 42);
    signals.Calculation.push(Math.max(25, 78 - Number(saved.blunders || 0) * 20 - Number(saved.mistakes || 0) * 9));
    const reachedEndgame = moves.length >= 50;
    const resultBonus = saved.result === 'YOU WIN' ? 15 : saved.result === 'DRAW' ? 8 : 0;
    signals.Endgames.push(reachedEndgame ? Math.min(95, 48 + resultBonus) : 55);
  });
  return Object.entries(signals).map(([name, values]) => ({ name, score: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) })).sort((a, b) => a.score - b.score);
}

function renderChessProfile(games) {
  const profile = buildChessProfile(games);
  if (!profile) return `<section class="profile-card"><strong>YOUR CHESS PROFILE</strong><p>Complete ${3 - games.length} more ${3 - games.length === 1 ? 'game' : 'games'} to detect recurring patterns reliably.</p></section>`;
  const weakest = profile[0];
  return `<section class="profile-card"><strong>YOUR CHESS PROFILE</strong>${profile.map(item => `<div class="profile-skill"><span>${item.name}</span><div><i style="width:${item.score}%"></i></div><b>${item.score}%</b></div>`).join('')}<p>Your recent games suggest that ${weakest.name.toLowerCase()} is currently the area with the most room for improvement.</p></section>`;
}

function renderProgress(games) {
  const wins = games.filter(item => item.result === 'YOU WIN').length;
  const losses = games.filter(item => item.result === 'AI WINS').length;
  const draws = games.filter(item => item.result === 'DRAW').length;
  const achievements = [];
  if (wins) achievements.push('First Victory');
  if (games.length >= 10) achievements.push('10 Games Played');
  if (games.some(item => item.opponent_name === 'The Strategist' && item.result === 'YOU WIN')) achievements.push('Beat The Strategist');
  return `<section class="progress-card"><strong>YOUR PROGRESS</strong><div class="progress-stats"><span>GAMES <b>${games.length}</b></span><span>WINS <b>${wins}</b></span><span>LOSSES <b>${losses}</b></span><span>DRAWS <b>${draws}</b></span><span>BLUNDERS <b>${games.reduce((sum, item) => sum + Number(item.blunders || 0), 0)}</b></span><span>MISTAKES <b>${games.reduce((sum, item) => sum + Number(item.mistakes || 0), 0)}</b></span></div><p>${achievements.length ? achievements.join(' · ') : 'Keep playing to unlock your first achievement.'}</p></section>`;
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
    const analyzed = moveAnalyses.length || 1;
    const mistakes = moveAnalyses.filter(item => item.classification === 'Mistake').length;
    const blunders = moveAnalyses.filter(item => item.classification === 'Blunder').length;
    const greatMoves = moveAnalyses.filter(item => item.classification === 'Excellent').length;
    const averageLoss = moveAnalyses.reduce((sum, item) => sum + Math.min(Number(item.centipawnLoss || 0), 1000), 0) / analyzed;
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
      player_accuracy: Math.max(0, Math.round(100 - averageLoss / 10)),
      blunders,
      mistakes,
      great_moves: greatMoves,
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
  if (currentUser && !localStorage.getItem(`ai-chess-onboarded:${currentUser.id}`) && !document.querySelector('#onboarding')) {
    const onboarding = document.createElement('div');
    onboarding.id = 'onboarding'; onboarding.className = 'overlay'; onboarding.innerHTML = '<div class="modal"><span class="eyebrow">WELCOME TO AI CHESS ARENA</span><h2>Improve with every game</h2><p>Choose an opponent, play a game, review your moves, and train the weaknesses Stockfish finds.</p><button id="start-onboarding" type="button">GET STARTED</button><button id="skip-onboarding" class="text-action" type="button">SKIP</button></div>';
    document.body.append(onboarding);
    const close = () => { localStorage.setItem(`ai-chess-onboarded:${currentUser.id}`, '1'); onboarding.remove(); };
    onboarding.querySelector('#start-onboarding').addEventListener('click', close);
    onboarding.querySelector('#skip-onboarding').addEventListener('click', close);
  }
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
  if (game.isGameOver() || pendingPromotion || aiThinking || onlineMovePending || (!onlineRoom && game.turn() !== 'w') || (onlineRoom && game.turn() !== onlineColor)) return;
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
  if (onlineRoom && !isAi && game.turn() !== onlineColor) return;
  const beforeFen = game.fen();
  let result;
  try { result = game.move(move); } catch { return; }
  if (!result) return;
  if (onlineRoom && !isAi) {
    submitOnlineMove(result, game.fen(), beforeFen);
    return;
  }
  if (result.captured) captured[result.color].push(result.captured);
  selected = null;
  legalMoves = [];
  pendingPromotion = null;
  promotionModal.classList.add('hidden');
  render();
  requestAnimationFrame(() => boardEl.querySelector(`[data-square="${result.to}"] .piece`)?.classList.add('piece-arrive'));
  handleGameState();
  if (!isAi) analyzePlayerMove({ beforeFen, afterFen: game.fen(), move: result, history: game.history(), session: gameSession });
  if (!onlineRoom && !isAi && !game.isGameOver() && game.turn() === 'b') playAiTurn();
}

async function submitOnlineMove(result, nextFen, beforeFen) {
  const position = new Chess(beforeFen);
  const move = position.move({ from: result.from, to: result.to, ...(result.promotion ? { promotion: result.promotion } : {}) });
  if (!move || !supabase || !onlineRoom) return;
  onlineMovePending = true;
  document.querySelector('#room-status').textContent = 'Move sent...';
  const expectedVersion = onlineRoom.version;
  const { data, error } = await supabase.rpc('submit_room_move', { room_id: onlineRoom.id, expected_version: expectedVersion, move_data: move, next_fen: nextFen });
  if (error || !data) { onlineMovePending = false; game = new Chess(beforeFen); render(); document.querySelector('#room-status').textContent = 'Move rejected. Reconnecting to the room.'; return; }
  applyOnlineRoom(data);
}

function applyOnlineRoom(room) {
  if (onlineRoom && Number(room.version) < Number(onlineRoom.version || 0)) return;
  if (onlineRoom && Number(room.version) === Number(onlineRoom.version) && room.fen === onlineRoom.fen && !onlineMovePending) return;
  onlineRoom = room;
  onlineMovePending = false;
  game = new Chess(room.fen);
  gameResult = room.status === 'complete' ? 'DRAW' : null;
  renderOpponentDetails(); render(); setThinking(false);
  document.querySelector('#room-status').textContent = room.turn === onlineColor ? 'Your turn.' : 'Opponent turn.';
}

async function enterOnlineRoom(room) {
  onlineRoom = room; onlineColor = room.host_id === currentUser.id ? 'w' : 'b';
  applyOnlineRoom(room);
  disposeEngine(); disposeAnalysisEngine();
  document.querySelector('#utility-view').classList.add('hidden-view');
  document.querySelector('#selection-view').classList.add('hidden-view');
  document.querySelector('#game-view').classList.remove('hidden-view');
  document.querySelector('.right-panel').classList.remove('hidden-view');
  if (onlineChannel) await supabase.removeChannel(onlineChannel);
  onlineChannel = supabase.channel(`room:${room.id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chess_rooms', filter: `id=eq.${room.id}` }, payload => applyOnlineRoom(payload.new)).subscribe();
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
  const summaryEl = document.querySelector('#coach-summary-text');
  summaryEl.textContent = requestGameSummary();
  coachSequence += 1;
  gameOverModal.classList.remove('hidden');
  saveCompletedGame(result, detail);
  analysisQueue.catch(() => {}).finally(() => {
    if (gameResult === result) {
      summaryEl.textContent = requestGameSummary();
      disposeAnalysisEngine();
    }
  });
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
  renderArenaSignal();
}

function renderArenaSignal() {
  const signal = document.querySelector('#arena-signal');
  if (!signal) return;
  if (game.isGameOver()) { signal.textContent = 'REVIEW MODE · Open the Coach for your key lesson'; return; }
  if (game.inCheck()) { signal.textContent = 'TACTICAL ALERT · Resolve the check first'; return; }
  if (game.history().length < 8) { signal.textContent = 'OPENING RADAR · Develop a new piece before moving the queen'; return; }
  signal.textContent = 'MOVE RADAR · Scan checks, captures, and threats before you commit';
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
  game = new Chess(); gameStartedAt = new Date().toISOString(); gameSaved = false; moveAnalyses = []; selected = null; legalMoves = []; pendingPromotion = null; captured = { w: [], b: [] }; gameResult = null;
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
document.querySelector('#fullscreen-board').addEventListener('click', async () => {
  const frame = document.querySelector('.board-frame');
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await frame.requestFullscreen();
  } catch { /* Fullscreen may be unavailable in embedded browsers. */ }
});
document.addEventListener('fullscreenchange', () => { document.querySelector('#fullscreen-board').textContent = document.fullscreenElement ? '×' : '⛶'; });
document.querySelector('#retry-game').addEventListener('click', resetGame);
document.querySelector('#play-again').addEventListener('click', () => { resetGame(); renderOpponentDetails(); });
document.querySelector('#start-game').addEventListener('click', startGame);
document.querySelector('#create-room').addEventListener('click', async () => {
  const status = document.querySelector('#room-status');
  if (!supabase || !currentUser) { status.textContent = 'Log in to create a room.'; return; }
  const code = crypto.randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase();
  const { data, error } = await supabase.from('chess_rooms').insert({ code, host_id: currentUser.id, status: 'waiting' }).select().single();
  status.textContent = error ? 'Could not create room.' : `Room ${code} created. Waiting for your friend...`;
  document.querySelector('#room-code').value = code;
  if (data) {
    onlineRoom = data; onlineColor = 'w';
    if (onlineChannel) await supabase.removeChannel(onlineChannel);
    onlineChannel = supabase.channel(`room:${data.id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chess_rooms', filter: `id=eq.${data.id}` }, payload => { if (payload.new.status === 'active') enterOnlineRoom(payload.new); }).subscribe();
  }
});
document.querySelector('#join-room').addEventListener('click', async () => {
  const code = document.querySelector('#room-code').value.trim().toUpperCase();
  const status = document.querySelector('#room-status');
  if (!supabase || !currentUser || code.length !== 6) { status.textContent = 'Enter a valid six-character room code.'; return; }
  const { data, error } = await supabase.rpc('join_chess_room', { room_code: code });
  if (error || !data) { status.textContent = 'Room not found.'; return; }
  if (error || !data) { status.textContent = 'Room unavailable or already full.'; return; }
  await enterOnlineRoom(data);
  status.textContent = 'Joined room. Your opponent is ready.';
});
document.querySelector('#change-opponent').addEventListener('click', openSelection);
document.querySelectorAll('.sidebar nav .nav-item').forEach((item, index) => item.addEventListener('click', () => {
  setActiveNav(index);
  if (index === 0) showUtilityView('leaderboard');
  else if (index === 1) { document.querySelector('#utility-view').classList.add('hidden-view'); openSelection(); }
  else showUtilityView(['learn', 'training', 'history', 'settings'][index - 2]);
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
