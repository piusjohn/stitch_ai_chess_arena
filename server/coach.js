const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const MAX_BODY_SIZE = 12000;

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', chunk => {
      body += chunk;
      if (body.length > MAX_BODY_SIZE) reject(new Error('Request too large'));
    });
    request.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { reject(new Error('Invalid request')); }
    });
    request.on('error', reject);
  });
}

export async function handleCoachRequest(request, response, apiKey = process.env.GEMINI_API_KEY) {
  if (request.method !== 'POST') {
    sendJson(response, 405, { message: 'Coach temporarily unavailable.' });
    return;
  }

  if (!apiKey) {
    sendJson(response, 503, { message: 'Coach temporarily unavailable.' });
    return;
  }

  try {
    const analysis = await readJson(request);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const prompt = {
      role: 'You are an expert but friendly chess coach for beginners.',
      task: analysis.requestType === 'playerQuestion'
        ? 'Answer the player question about the supplied position using the supplied Stockfish evaluation and best move.'
        : 'Explain the supplied engine analysis of the player move.',
      rules: [
        'Explain only the supplied Stockfish analysis.',
        'Never decide legality or reclassify the move.',
        'Never contradict the supplied evaluation or invent chess facts.',
        'Use plain language and no more than three short sentences.',
        'Return plain text without Markdown formatting.',
        'If the player asks something the supplied analysis cannot establish, say so briefly instead of guessing.',
        'Focus on one useful lesson. Mention the supplied better move only when present.',
      ],
      stockfishAnalysis: analysis,
    };
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: JSON.stringify(prompt) }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 384 },
      }),
    });
    clearTimeout(timeout);
    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.json().catch(() => null);
      console.error(`[AI Coach] Gemini ${geminiResponse.status}: ${errorBody?.error?.message || 'Request failed'}`);
      throw new Error('Gemini request failed');
    }
    const data = await geminiResponse.json();
    const explanation = data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
    if (!explanation) throw new Error('Empty Gemini response');
    sendJson(response, 200, { explanation: explanation.slice(0, 600) });
  } catch (error) {
    if (error?.name === 'AbortError') console.error('[AI Coach] Gemini request timed out.');
    else if (error?.message !== 'Gemini request failed') console.error(`[AI Coach] ${error?.message || 'Unexpected failure'}`);
    sendJson(response, 503, { message: 'Coach temporarily unavailable.' });
  }
}
