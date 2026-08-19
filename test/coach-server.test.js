import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { handleCoachRequest } from '../server/coach.js';

function requestWith(body) {
  const request = new EventEmitter();
  request.method = 'POST';
  queueMicrotask(() => {
    request.emit('data', JSON.stringify(body));
    request.emit('end');
  });
  return request;
}

function responseRecorder() {
  let resolve;
  const completed = new Promise(done => { resolve = done; });
  return {
    completed,
    response: {
      writeHead(status) { this.status = status; },
      end(body) { resolve({ status: this.status, body: JSON.parse(body) }); },
    },
  };
}

test('coach endpoint fails safely when the API key is absent', async () => {
  const recorder = responseRecorder();
  await handleCoachRequest(requestWith({ classification: 'Mistake' }), recorder.response, '');
  const result = await recorder.completed;
  assert.equal(result.status, 503);
  assert.equal(result.body.message, 'Coach temporarily unavailable.');
});

test('coach endpoint hides Gemini failures from the client', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false });
  try {
    const recorder = responseRecorder();
    await handleCoachRequest(requestWith({ classification: 'Blunder' }), recorder.response, 'test-key');
    const result = await recorder.completed;
    assert.equal(result.status, 503);
    assert.deepEqual(result.body, { message: 'Coach temporarily unavailable.' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
