import { it } from 'node:test';
import assert from 'node:assert/strict';
import { createGeminiFallback } from '../src/providers/gemini.fallback';
import { GeminiProvider } from '../src/providers/gemini.provider';

async function withModels(models: string, test: () => Promise<void>) {
  const previous = process.env.GEMINI_FALLBACK_MODELS;
  process.env.GEMINI_FALLBACK_MODELS = models;
  try { await test(); } finally {
    if (previous === undefined) delete process.env.GEMINI_FALLBACK_MODELS;
    else process.env.GEMINI_FALLBACK_MODELS = previous;
  }
}

it('switches on SDK quota errors, skips cooling models, and recovers', async () => {
  await withModels('backup', async () => {
    let time = 0;
    const run = createGeminiFallback(() => time);
    const calls: string[] = [];
    const request = async (model: string) => {
      calls.push(model);
      if (model === 'primary') throw { message: JSON.stringify({ error: { code: 429 } }) };
      return 'backup response';
    };
    assert.equal(await run('primary', request), 'backup response');
    await run('primary', request);
    assert.deepEqual(calls, ['primary', 'backup', 'backup']);
    time = 60_001;
    assert.equal(await run('primary', async model => model), 'primary');
  });
});

it('stops after all models hit quota and makes no calls during cooldown', async () => {
  await withModels('backup,backup,primary', async () => {
    const run = createGeminiFallback(() => 0);
    const calls: string[] = [];
    const request = async (model: string) => { calls.push(model); throw { status: 429 }; };
    await assert.rejects(run('primary', request), (error: any) => error.status === 429);
    await assert.rejects(run('primary', request), (error: any) => error.status === 429);
    assert.deepEqual(calls, ['primary', 'backup']);
  });
});

it('does not switch on credentials, missing models, network or server errors', async () => {
  await withModels('backup', async () => {
    for (const status of [400, 401, 403, 404, 500, undefined]) {
      const calls: string[] = [];
      const failure = { status };
      await assert.rejects(createGeminiFallback()('primary', async model => { calls.push(model); throw failure; }), error => error === failure);
      assert.deepEqual(calls, ['primary']);
    }
  });
});

it('supports disabling fallback and bounds attempts', async () => {
  for (const [config, expected] of [['', ['primary']], ['one,two,three,four', ['primary', 'one', 'two']]] as const) {
    await withModels(config, async () => {
      const calls: string[] = [];
      await assert.rejects(createGeminiFallback()('primary', async model => { calls.push(model); throw { status: 429 }; }));
      assert.deepEqual(calls, expected);
    });
  }
});

it('chat retries the same conversation on the fallback model', async () => {
  await withModels('chat-backup', async () => {
    const provider = new GeminiProvider();
    const requests: any[] = [];
    (provider as any).getClient = () => ({ model: 'chat-primary', ai: { models: { generateContent: async (request: any) => {
      requests.push(request);
      if (request.model === 'chat-primary') throw { status: 429 };
      return { candidates: [{ content: { parts: [{ text: 'How can I help?' }] } }] };
    } } } });
    const response = await provider.generateResponse({ userMessage: 'Hello', messages: [], context: {} });
    assert.equal(response.content, 'How can I help?');
    assert.deepEqual(requests.map(request => request.model), ['chat-primary', 'chat-backup']);
    assert.deepEqual(requests[0].contents, requests[1].contents);
    assert.deepEqual(requests[0].config, requests[1].config);
  });
});
