import assert from 'node:assert/strict';
import { writeFile, chmod } from 'node:fs/promises';

// Explicit live verification: this consumes up to six real Gemini admissions.
// Anonymous sessions are obtained from empty JSON. No invitation or cloud credential is required.
const [originArgument, reportPath] = process.argv.slice(2);
if (!originArgument || !reportPath) {
  console.error('Usage: node scripts/verify-shared-cloud.mjs HTTPS_ORIGIN PRIVATE_REPORT_JSON');
  process.exit(2);
}
const origin = new URL(originArgument);
assert.equal(origin.protocol, 'https:');
assert.equal(origin.pathname, '/');
assert.ok(!origin.username && !origin.password && !origin.search && !origin.hash);
// Owner-only private Cloud Run checks may supply a short-lived IAM token.
// Never put this token into an Expo environment or invitation link.
const platformIdentity = process.env.CLOUD_RUN_IDENTITY_TOKEN;
const report = { origin: origin.origin, checkedAt: new Date().toISOString(), checks: [], conversations: [] };

async function request(path, body, token) {
  const response = await fetch(new URL(path, origin), {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(platformIdentity ? { 'X-Serverless-Authorization': `Bearer ${platformIdentity}` } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(70000),
  });
  const data = await response.json();
  return { status: response.status, data };
}

try {
  const health = await request('/');
  assert.equal(health.status, 200);
  assert.equal(health.data.status, 'ok');
  report.checks.push({ name: 'cloud health', status: 200 });
  const unauthorized = await request('/api/chat', { messages: [{ role: 'user', content: '东京三天' }] });
  assert.equal(unauthorized.status, 401);
  report.checks.push({ name: 'no session denied', status: 401, code: unauthorized.data.error?.code });
  const invalid = await request('/api/session', { allowAnonymousTest: true });
  assert.equal(invalid.status, 400);
  report.checks.push({ name: 'client-selected session configuration denied', status: 400, code: invalid.data.error?.code });

  const conversations = [
    { name: 'Tokyo / two budget travelers', messages: [], prompts: ['我想去东京三天。', '两个人，经济型，喜欢动漫和美食。', '改成两天，保留动漫和美食。'] },
    { name: 'Kyoto / solo temple traveler', messages: [], prompts: ['我想去京都三天。', '一个人，预算宽裕，喜欢寺庙，不去动漫店。', '改成两天，保留寺庙体验。'] },
  ];
  const tokens = [];
  for (const conversation of conversations) {
    const activated = await request('/api/session', {});
    assert.equal(activated.status, 200, `Activation failed: ${activated.data.error?.code ?? activated.status}`);
    assert.match(activated.data.sessionToken, /^[A-Za-z0-9_-]{43}$/);
    tokens.push(activated.data.sessionToken);
    report.conversations.push({ name: conversation.name, messages: conversation.messages });
  }
  assert.notEqual(tokens[0], tokens[1]);
  for (let round = 0; round < 3; round++) {
    for (const [index, conversation] of conversations.entries()) {
      conversation.messages.push({ role: 'user', content: conversation.prompts[round] });
      const answer = await request('/api/chat', { messages: conversation.messages }, tokens[index]);
      assert.equal(answer.status, 200, `Conversation ${index + 1}, round ${round + 1}: ${answer.data.error?.code ?? answer.status}`);
      assert.ok(typeof answer.data.reply === 'string' && answer.data.reply.trim());
      conversation.messages.push({ role: 'assistant', content: answer.data.reply });
      console.log(JSON.stringify({ conversation: index + 1, round: round + 1, status: answer.status }));
    }
  }
  report.checks.push({ name: 'two distinct sessions, interleaved three-turn real conversations', passed: true });
  report.semanticReview = 'Review the final replies in this private report for city, people, budget, interests and two-day change. This is HTTP verification, not proof of two physical phones or two networks.';
} finally {
  await writeFile(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 });
  await chmod(reportPath, 0o600);
}
console.log('Cloud HTTP checks complete. Review the private transcript; physical-phone verification remains separate.');
