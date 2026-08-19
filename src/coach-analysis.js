export function normalizeEvaluation(score, sideToMove) {
  const value = score.type === 'mate'
    ? Math.sign(score.value || 1) * 100000
    : score.value;
  return sideToMove === 'w' ? value : -value;
}

export function classifyMove(beforeEvaluation, afterEvaluation, isBestMove = false) {
  const centipawnLoss = Math.max(0, beforeEvaluation - afterEvaluation);
  let classification;

  if (isBestMove && centipawnLoss <= 20) classification = 'Excellent';
  else if (centipawnLoss <= 60) classification = 'Good';
  else if (centipawnLoss <= 120) classification = 'Neutral';
  else if (centipawnLoss <= 250) classification = 'Mistake';
  else classification = 'Blunder';

  return { classification, centipawnLoss };
}

export function shouldRequestCoach({ classification, centipawnLoss, isBestMove, beforeMate, afterMate }) {
  return classification === 'Blunder'
    || classification === 'Mistake'
    || classification === 'Excellent'
    || (classification === 'Good' && isBestMove && centipawnLoss <= 30)
    || beforeMate !== afterMate;
}
