import assert from 'node:assert/strict';
import test from 'node:test';
import { createChatSession } from '../src/lib/shared-chat-session.ts';
import { sendChatRequest, resolveChatEndpoint } from '../src/lib/chat.ts';

const baseUrl = 'https://travel.example.test', token = 's'.repeat(43), started = 1700000000000;
function storage() { let value = null; return { read: async () => value, write: async data => { value = data; }, clear: async () => { value = null; } }; }
function response(expiresAt = started + 14400000) { return Response.json({ sessionToken: token, expiresAt }); }

test('opening shared chat obtains an anonymous session without user credentials and restores it on reopening', async () => {
  const saved = storage(); let calls = 0;
  const session = createChatSession({ baseUrl, storage: saved, now: () => started, fetcher: async (url, init) => {
    calls++; assert.equal(url, `${baseUrl}/api/session`); assert.deepEqual(JSON.parse(init.body), {}); assert.equal(init.headers.Authorization, undefined); return response();
  } });
  await session.connect(); await session.connect();
  assert.equal(calls, 1); assert.equal(await session.authorization(), token);
  assert.deepEqual(Object.keys(JSON.parse(await saved.read())).sort(), ['base', 'expiresAt', 'kind', 'token']);
  const reopened = createChatSession({ baseUrl, storage: saved, now: () => started, fetcher: () => { throw Error('must not issue twice'); } });
  await reopened.connect(); assert.equal(await reopened.authorization(), token);
});

test('Strict Mode/remounts share a single anonymous bootstrap in flight', async () => {
  let resolve, calls = 0;
  const client = createChatSession({ baseUrl, storage: storage(), now: () => started, fetcher: async () => { calls++; return new Promise(done => { resolve = done; }); } });
  const a = client.connect(), b = client.connect(); assert.equal(a, b);
  await new Promise(done => setImmediate(done)); resolve(response()); await Promise.all([a, b]); assert.equal(calls, 1);
});

test('expired, legacy and other-service sessions cannot be silently reused; reconnect can renew an expired session', async () => {
  const saved = storage(); let clock = started, calls = 0;
  const client = createChatSession({ baseUrl, storage: saved, now: () => clock, fetcher: async () => { calls++; return response(clock + 14400000); } });
  await client.connect(); clock += 14400000;
  await assert.rejects(client.authorization(), { code: 'SESSION_EXPIRED' });
  await client.connect(); assert.equal(calls, 2);
  const other = createChatSession({ baseUrl: 'https://another.example.test', storage: saved, now: () => clock }); assert.equal(await other.restore(), false);
  await saved.write(JSON.stringify({ base: baseUrl, token, expiresAt: clock + 14400000 }));
  assert.equal(await createChatSession({ baseUrl, storage: saved, now: () => clock }).restore(), false);
});

test('forgetting a session prevents a delayed bootstrap from resurrecting it', async () => {
  const saved = storage(); let resolve;
  const client = createChatSession({ baseUrl, storage: saved, now: () => started, fetcher: async () => new Promise(done => { resolve = done; }) });
  const pending = client.connect(); await new Promise(done => setImmediate(done)); await client.forget(); resolve(response()); await pending;
  assert.equal(await saved.read(), null); await assert.rejects(client.authorization(), { code: 'SESSION_EXPIRED' });
});

test('disabled anonymous entry, issuance quota and generation quota are actionable and never auto-retried', async () => {
  for (const code of ['ANONYMOUS_TEST_DISABLED', 'SESSION_LIMIT_REACHED', 'DAILY_LIMIT_REACHED']) {
    let calls = 0;
    const client = createChatSession({ baseUrl, storage: storage(), fetcher: async () => { calls++; return Response.json({ error: { code, message: 'private diagnostic' } }, { status: code === 'ANONYMOUS_TEST_DISABLED' ? 403 : 429 }); } });
    await assert.rejects(client.connect(), error => error.code === code && !/private|密钥|邀请/.test(error.message)); assert.equal(calls, 1);
  }
});

test('stalled bootstraps time out and storage failure still allows the current live session', async () => {
  const stalled = createChatSession({ baseUrl, storage: storage(), timeoutMs: 5, fetcher: (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(Error('private')), { once: true })) });
  await assert.rejects(stalled.connect(), { code: 'SESSION_TIMEOUT' });
  const client = createChatSession({ baseUrl, now: () => started, storage: { read: async () => { throw Error('locked'); }, write: async () => { throw Error('locked'); }, clear: async () => {} }, fetcher: async () => response() });
  await client.connect(); assert.equal(await client.authorization(), token);
});

test('shared endpoints require HTTPS and never accept embedded URL credentials', () => {
  assert.throws(() => createChatSession({ baseUrl: 'http://travel.example.test', storage: storage() }));
  assert.throws(() => resolveChatEndpoint('https://user:password@travel.example.test', true));
});

test('shared chat sends only the session credential and complete user messages, without provider configuration', async t => {
  const oldMode = process.env.EXPO_PUBLIC_CHAT_ACCESS_MODE, oldUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  process.env.EXPO_PUBLIC_CHAT_ACCESS_MODE = 'shared'; process.env.EXPO_PUBLIC_API_BASE_URL = baseUrl;
  t.after(() => { if (oldMode === undefined) delete process.env.EXPO_PUBLIC_CHAT_ACCESS_MODE; else process.env.EXPO_PUBLIC_CHAT_ACCESS_MODE = oldMode; if (oldUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL; else process.env.EXPO_PUBLIC_API_BASE_URL = oldUrl; });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url, init) => { calls++; assert.equal(url, `${baseUrl}/api/chat`); assert.equal(init.headers.Authorization, `Bearer ${token}`); assert.deepEqual(JSON.parse(init.body), { messages: [{ role: 'user', content: '东京三天' }] }); return Response.json({ reply: '请问人数？' }); });
  await assert.rejects(sendChatRequest([{ role: 'user', content: '东京三天' }], new AbortController().signal), { code: 'SESSION_REQUIRED' }); assert.equal(calls, 0);
  assert.equal(await sendChatRequest([{ role: 'user', content: '东京三天' }], new AbortController().signal, async () => token), '请问人数？');
});

test('shared provider failures do not ask testers to supply credentials or pay', async t => {
  const oldMode = process.env.EXPO_PUBLIC_CHAT_ACCESS_MODE, oldUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  process.env.EXPO_PUBLIC_CHAT_ACCESS_MODE = 'shared'; process.env.EXPO_PUBLIC_API_BASE_URL = baseUrl;
  t.after(() => { if (oldMode === undefined) delete process.env.EXPO_PUBLIC_CHAT_ACCESS_MODE; else process.env.EXPO_PUBLIC_CHAT_ACCESS_MODE = oldMode; if (oldUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL; else process.env.EXPO_PUBLIC_API_BASE_URL = oldUrl; });
  let code;
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: { code, message: 'private credential diagnostic' } }, { status: 503 }));
  for (code of ['MISSING_API_KEY', 'GEMINI_BILLING_REQUIRED']) await assert.rejects(sendChatRequest([{ role: 'user', content: '东京' }], new AbortController().signal, async () => token), error => error.code === code && !/密钥|充值|private|邀请/.test(error.message));
});
