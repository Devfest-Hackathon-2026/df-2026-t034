import assert from 'node:assert/strict';
import test from 'node:test';
import { createChatHandler, createCallControls } from '../japan-travel/src/lib/server/chat.ts';
import { createSharedAccess, DEFAULT_SHARED_LIMITS } from '../japan-travel/src/lib/server/shared-access.ts';
import { createSessionHandler } from '../japan-travel/src/lib/server/session-handler.ts';
import { createChatSession } from '../japan-travel-mobile/src/lib/shared-chat-session.ts';
import { sendChatRequest } from '../japan-travel-mobile/src/lib/chat.ts';

test('anonymous mobile startup and three-turn chat use one owner key and a persistent daily admission', async (t) => {
  const origin = 'https://travel.example.test';
  const beforeMode = process.env.EXPO_PUBLIC_CHAT_ACCESS_MODE, beforeUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  process.env.EXPO_PUBLIC_CHAT_ACCESS_MODE = 'shared'; process.env.EXPO_PUBLIC_API_BASE_URL = origin;
  t.after(() => {
    if (beforeMode === undefined) delete process.env.EXPO_PUBLIC_CHAT_ACCESS_MODE; else process.env.EXPO_PUBLIC_CHAT_ACCESS_MODE = beforeMode;
    if (beforeUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL; else process.env.EXPO_PUBLIC_API_BASE_URL = beforeUrl;
  });
  const records = new Map(); let queue = Promise.resolve();
  const documents = { run(operation) {
    const outcome = queue.then(async () => {
      const writes = new Map();
      const result = await operation({
        get: async (key) => { assert.equal(writes.size, 0); return structuredClone(records.get(key)); },
        set: (key, value) => writes.set(key, structuredClone(value)),
      });
      for (const [key, value] of writes) records.set(key, value);
      return result;
    });
    queue = outcome.catch(() => {}); return outcome;
  } };
  const now = Date.parse('2026-11-06T00:00:00Z');
  const access = createSharedAccess(documents, { ...DEFAULT_SHARED_LIMITS, dailyRequests: 3 }, { allowAnonymousTest: true });
  const bootstrap = createSessionHandler({ getConfiguration: () => ({ accessMode: 'shared', publicOrigin: origin, allowAnonymousTest: true }), anonymous: at => access.createAnonymousSession(at), redeem: (token, at) => access.redeemInvite(token, at), now: () => now });
  const seen = [];
  const makeChat = () => createChatHandler({
    getConfiguration: () => ({ isDevelopment: false, accessMode: 'shared', publicOrigin: origin, apiKey: 'server-owner-key-only', model: 'mock-provider' }),
    sharedAccess: () => createSharedAccess(documents, { ...DEFAULT_SHARED_LIMITS, dailyRequests: 3 }, { allowAnonymousTest: true }),
    now: () => now, controls: createCallControls({ perClient: 100, global: 100 }),
    generate: async (input) => {
      assert.equal(input.apiKey, 'server-owner-key-only'); seen.push(input.contents);
      return { text: ['请问人数和预算？', '两人经济型东京三日游。', '为两人改成东京两日游，保留动漫美食。'][seen.length - 1], inputTokens: 10, outputTokens: 5, totalTokens: 15 };
    },
  });
  let chat = makeChat(); const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    requests.push({ url, body: init.body, headers: init.headers });
    assert.ok(!JSON.stringify(init).includes('server-owner-key-only'));
    const request = new Request(url, init);
    return new URL(url).pathname === '/api/session' ? bootstrap(request) : chat(request);
  });
  let saved = null;
  const client = createChatSession({ baseUrl: origin, now: () => now, storage: { read: async () => saved, write: async (value) => { saved = value; }, clear: async () => { saved = null; } } });
  await client.connect();
  const history = [];
  for (const text of ['东京三天。', '两人经济型，喜欢动漫和美食。', '改成两天。']) {
    history.push({ role: 'user', content: text });
    const reply = await sendChatRequest(history, new AbortController().signal, client.authorization);
    history.push({ role: 'assistant', content: reply });
    // A new handler/service instance shares the same persistent quota state.
    chat = makeChat();
  }
  assert.match(history.at(-1).content, /两人.*两日游/);
  assert.deepEqual(seen[2].map((m) => m.role), ['user', 'model', 'user', 'model', 'user']);
  assert.equal(seen[2][2].parts[0].text, '两人经济型，喜欢动漫和美食。');
  assert.equal(requests.filter((r) => r.url.endsWith('/api/session')).length, 1);
  assert.equal(records.get('day_2026-11-06').requests, 3);
  assert.equal(records.get('day_2026-11-06').totalTokens, 45);
  await assert.rejects(sendChatRequest([...history, { role: 'user', content: '继续' }], new AbortController().signal, client.authorization), { code: 'DAILY_LIMIT_REACHED' });
  assert.equal(seen.length, 3);
  assert.ok(!JSON.stringify([...records]).includes('东京'));
});
