// Explicit opt-in live check: uses localhost, consumes Gemini requests, saves only
// fictional assessment dialogue. Never reads or prints environment secrets.
import { mkdir, writeFile } from 'node:fs/promises';
const base = 'http://127.0.0.1:5173';
const results = [];
const targeted = process.argv.includes('--targeted');
const outputPath = `output/assessment/${targeted ? 'targeted' : 'live'}-verification.json`;
await mkdir('output/assessment', { recursive: true });
async function request(path, body) {
  const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) });
  const data = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${data.error?.message || 'Request failed'}`);
  return data.data;
}
const { session } = await request('/api/conversations/sessions');
const questions = targeted ? [
  'Can I cancel order ORD-103? Please tell me what you can actually do.',
  'Can I cancel order ORD-999 instead?',
  'What is the shipping charge on exactly 499 rupees?',
] : [
  'Where is my order O R D one zero one?',
  'Can I cancel it?',
  'I bought another product 20 days ago and opened it. Can I return it for a refund?',
  'Can I cancel my other order?',
  'ORD-103',
  'Can you book me a flight to Goa?',
];
try {
  for (const question of questions) {
    const started = Date.now();
    const answer = await request(`/api/conversations/sessions/${session.id}/messages`, { message: question });
    const result = { question, response: answer.response, tools: answer.toolCalls.map(call => call.name), elapsedMs: Date.now() - started };
    results.push(result);
    console.log(JSON.stringify(result));
    await writeFile(outputPath, JSON.stringify({ sessionId: session.id, results }, null, 2));
  }
  const end = await request(`/api/conversations/sessions/${session.id}/end`);
  await writeFile(outputPath, JSON.stringify({ sessionId: session.id, results, summary: end.summary, transcript: end.transcript }, null, 2));
  console.log(JSON.stringify({ summary: end.summary, transcriptMessages: end.transcript.messages.length }));
} catch (error) {
  await writeFile(outputPath, JSON.stringify({ sessionId: session.id, results, error: error.message }, null, 2));
  console.error(error.message);
  process.exitCode = 1;
}
