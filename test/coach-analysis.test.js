import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyMove, normalizeEvaluation, shouldRequestCoach } from '../src/coach-analysis.js';

test('normalizes Stockfish scores to the player perspective', () => {
  assert.equal(normalizeEvaluation({ type: 'cp', value: 80 }, 'w'), 80);
  assert.equal(normalizeEvaluation({ type: 'cp', value: 80 }, 'b'), -80);
  assert.equal(normalizeEvaluation({ type: 'mate', value: -3 }, 'b'), 100000);
});

test('classifies moves from engine centipawn loss', () => {
  assert.equal(classifyMove(50, 45, true).classification, 'Excellent');
  assert.equal(classifyMove(50, 5).classification, 'Good');
  assert.equal(classifyMove(50, -20).classification, 'Neutral');
  assert.equal(classifyMove(50, -120).classification, 'Mistake');
  assert.equal(classifyMove(100, -300).classification, 'Blunder');
});

test('requests Gemini only for meaningful moves', () => {
  assert.equal(shouldRequestCoach({ classification: 'Neutral', centipawnLoss: 80 }), false);
  assert.equal(shouldRequestCoach({ classification: 'Mistake', centipawnLoss: 180 }), true);
  assert.equal(shouldRequestCoach({ classification: 'Excellent', centipawnLoss: 5 }), true);
});
