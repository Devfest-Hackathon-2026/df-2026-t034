import assert from 'node:assert/strict';
import test from 'node:test';
import { ChatError, createUserTurn, resolveChatEndpoint, sendChatRequest } from '../src/lib/chat.ts';

test('builds the configured API URL and rejects unsafe or missing addresses', () => {
  assert.equal(resolveChatEndpoint(' http://192.168.1.23:3000/ '), 'http://192.168.1.23:3000/api/chat');
  for (const value of [undefined, '', 'not a URL', 'file:///tmp/test', 'https://user:secret@example.com', 'https://example.com?api_key=secret']) {
    assert.throws(() => resolveChatEndpoint(value), ChatError);
  }
});

test('three-turn itinerary edits retain the complete conversation without changing earlier history', () => {
  const firstTurn = createUserTurn([], '我想去东京三天');
  const secondTurn = createUserTurn([...firstTurn, { role: 'assistant', content: '请问人数和预算？' }], '两人，经济型');
  const completed = [...secondTurn, { role: 'assistant', content: '为两人安排经济型东京三日游。' }];
  const thirdTurn = createUserTurn(completed, ' 改为两天 ');
  assert.equal(completed.length, 4);
  assert.deepEqual(thirdTurn.map(({ content }) => content), ['我想去东京三天', '请问人数和预算？', '两人，经济型', '为两人安排经济型东京三日游。', '改为两天']);
});

test('rejects empty, oversized, and exhausted conversations rather than trimming history', () => {
  for (const text of [' ', '字'.repeat(4001)]) assert.throws(() => createUserTurn([], text), ChatError);
  assert.throws(() => createUserTurn(Array.from({ length: 40 }, () => ({ role: 'assistant', content: '已有内容' })), '继续'), { code: 'CONVERSATION_TOO_LONG' });
  assert.throws(() => createUserTurn(Array.from({ length: 8 }, () => ({ role: 'assistant', content: '字'.repeat(4000) })), '继续'), { code: 'CONVERSATION_TOO_LONG' });
});

function configure(t, fetchImplementation) {
  const previousUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://192.168.1.23:3000';
  t.after(() => {
    if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = previousUrl;
  });
  t.mock.method(globalThis, 'fetch', fetchImplementation);
}

test('sends complete role/content history to the backend and strips display-only fields', async (t) => {
  configure(t, async (url, options) => {
    assert.equal(url, 'http://192.168.1.23:3000/api/chat');
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), { messages: [{ role: 'user', content: '东京三日游' }] });
    return Response.json({ reply: '  好的，请问人数？  ' });
  });
  const reply = await sendChatRequest([{ id: 'local-only', role: 'user', content: '东京三日游' }], new AbortController().signal);
  assert.equal(reply, '好的，请问人数？');
});

test('shows a safe rate-limit error without displaying arbitrary upstream details', async (t) => {
  configure(t, async () => Response.json({ error: { code: 'RATE_LIMITED', message: 'raw secret or stack' } }, { status: 429 }));
  await assert.rejects(sendChatRequest([{ role: 'user', content: '东京' }], new AbortController().signal), (error) => error.code === 'RATE_LIMITED' && !error.message.includes('raw secret'));
});

test('the planner requests the full format and accepts long replies', async (t) => {
  const fullReply = '旅行安排'.repeat(1500);
  configure(t, async (_url, options) => {
    assert.equal(options.headers['X-Travel-Day-Photos'], '4');
    return Response.json({ reply: fullReply });
  });
  assert.equal(await sendChatRequest([{ role: 'user', content: '规划19天' }], new AbortController().signal), fullReply);
});

test('backend configuration, model, and timeout codes produce actionable errors', async (t) => {
  const cases = [
    ['MISSING_MODEL', 'GEMINI_MODEL'],
    ['GEMINI_AUTH_ERROR', '密钥'],
    ['GEMINI_BILLING_REQUIRED', '负责人'],
    ['MODEL_UNAVAILABLE', '模型'],
    ['GEMINI_RATE_LIMITED', '额度'],
    ['GEMINI_TIMEOUT', '超时'],
    ['LOCAL_DEVELOPMENT_ONLY', 'npm run dev'],
  ];
  configure(t, async () => Response.json({ error: { code: cases[0][0] } }, { status: 503 }));
  for (const [code, expectedText] of cases) {
    globalThis.fetch = async () => Response.json({ error: { code, message: 'private diagnostic' } }, { status: 503 });
    await assert.rejects(sendChatRequest([{ role: 'user', content: '东京' }], new AbortController().signal), (error) => error.code === code && error.message.includes(expectedText) && !error.message.includes('private'));
  }
});

test('rejects invalid JSON and blank replies', async (t) => {
  configure(t, async () => new Response('<html>wrong server</html>', { status: 200 }));
  await assert.rejects(sendChatRequest([{ role: 'user', content: '东京' }], new AbortController().signal), { code: 'INVALID_RESPONSE' });
  globalThis.fetch = async () => Response.json({ reply: '   ' });
  await assert.rejects(sendChatRequest([{ role: 'user', content: '东京' }], new AbortController().signal), { code: 'INVALID_RESPONSE' });
});

test('network failures remain actionable and never expose native error details', async (t) => {
  configure(t, async () => { throw new Error('private internal diagnostic'); });
  await assert.rejects(sendChatRequest([{ role: 'user', content: '东京' }], new AbortController().signal), (error) => error.code === 'NETWORK_ERROR' && error.message.includes('Wi-Fi') && !error.message.includes('private'));
});
test('body transport failure stays a network error and non-JSON gateway errors retain their status meaning', async (t) => {
  configure(t, async () => ({ text: async () => { throw Error('private network body failure'); } }));
  await assert.rejects(sendChatRequest([{ role: 'user', content: '东京' }], new AbortController().signal), { code: 'NETWORK_ERROR' });
  for (const [status, code] of [[429, 'GEMINI_RATE_LIMITED'], [504, 'GEMINI_TIMEOUT'], [503, 'SERVER_BUSY']]) {
    globalThis.fetch = async () => new Response('private gateway page', { status });
    await assert.rejects(sendChatRequest([{ role: 'user', content: '东京' }], new AbortController().signal), (error) => error.code === code && !error.message.includes('private'));
  }
});

test('cancels the underlying request when its screen is unmounted', async (t) => {
  configure(t, async (_url, options) => {
    assert.equal(options.signal.aborted, true);
    throw new Error('aborted');
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(sendChatRequest([{ role: 'user', content: '东京' }], controller.signal), { code: 'CANCELLED' });
});
