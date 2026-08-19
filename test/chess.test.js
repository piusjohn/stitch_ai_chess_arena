import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';

test('normal movement, illegal movement, capture, and turn switching', () => {
  const game = new Chess();
  assert.equal(game.move('e4').san, 'e4');
  assert.equal(game.turn(), 'b');
  assert.throws(() => game.move({ from: 'e4', to: 'e6' }));
  game.move('d5');
  const capture = game.move('exd5');
  assert.equal(capture.captured, 'p');
});

test('detects check and checkmate', () => {
  const game = new Chess();
  game.move('f3'); game.move('e5'); game.move('g4'); game.move('Qh4#');
  assert.equal(game.inCheck(), true);
  assert.equal(game.isCheckmate(), true);
});

test('detects stalemate', () => {
  const game = new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  assert.equal(game.isStalemate(), true);
});

test('supports castling', () => {
  const game = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  assert.equal(game.move('O-O').san, 'O-O');
  assert.equal(game.get('g1').type, 'k');
  assert.equal(game.get('f1').type, 'r');
});

test('supports en passant', () => {
  const game = new Chess();
  game.move('e4'); game.move('a6'); game.move('e5'); game.move('d5');
  const move = game.move('exd6');
  assert.equal(move.flags.includes('e'), true);
  assert.equal(game.get('d5'), undefined);
});

test('supports promotion and reset', () => {
  const game = new Chess('8/P7/8/8/8/8/7p/4K2k w - - 0 1');
  game.move({ from: 'a7', to: 'a8', promotion: 'q' });
  assert.equal(game.get('a8').type, 'q');
  game.reset();
  assert.equal(game.history().length, 0);
  assert.equal(game.turn(), 'w');
});
