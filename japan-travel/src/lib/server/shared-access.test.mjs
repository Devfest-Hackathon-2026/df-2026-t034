import assert from "node:assert/strict";
import test from "node:test";
import { createSharedAccess, verifySharedRequest, DEFAULT_SHARED_LIMITS } from "./shared-access.ts";
import { createChatHandler, createCallControls } from "./chat.ts";
import { createSessionHandler } from "./session-handler.ts";

function database() {
  const records = new Map();
  let tail = Promise.resolve();
  return {
    records,
    run(operation) {
      const result = tail.then(async () => {
        const writes = new Map();
        const value = await operation({
          get: async (key) => { assert.equal(writes.size, 0, "Firestore requires reads before writes"); return structuredClone(records.get(key)); },
          set: (key, value) => writes.set(key, structuredClone(value)),
        });
        for (const [key, record] of writes) records.set(key, record);
        return value;
      });
      tail = result.catch(() => {});
      return result;
    },
  };
}
const now = Date.parse("2026-11-05T23:59:00Z");
const origin = "https://travel.example.test";
const conversation = [{ role: "user", content: "东京三日游" }];
function request(token, body = { messages: conversation }, headers = {}, url = `${origin}/api/chat`) {
  return new Request(url, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: JSON.stringify(body) });
}
async function fixture(limits = {}) {
  const documents = database();
  const access = createSharedAccess(documents, { ...DEFAULT_SHARED_LIMITS, ...limits });
  const invite = await access.createInvite({ now, expiresAt: now + 86400000, uses: 3 });
  const session = await access.redeemInvite(invite.inviteToken, now);
  return { documents, access, invite, session };
}
function gateway(access, overrides = {}) {
  return createChatHandler({
    getConfiguration: () => ({ isDevelopment: false, apiKey: "owner-provider-key", model: "test-model", accessMode: "shared", publicOrigin: origin }),
    generate: async () => ({ text: "真实 provider 注入点的测试回复", inputTokens: 10, outputTokens: 5, totalTokens: 15 }),
    sharedAccess: () => access,
    now: () => now,
    controls: createCallControls({ perClient: 100, global: 100, maxConcurrent: 10 }),
    ...overrides,
  });
}

test("invitation use is atomic; tokens are hashed at rest and never stored in quota records", async () => {
  const documents = database();
  const access = createSharedAccess(documents);
  const invite = await access.createInvite({ now, expiresAt: now + 10000, uses: 1 });
  const results = await Promise.allSettled([access.redeemInvite(invite.inviteToken, now), access.redeemInvite(invite.inviteToken, now)]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const session = results.find((r) => r.status === "fulfilled").value;
  assert.equal(session.expiresAt, now + 10000);
  const stored = JSON.stringify([...documents.records]);
  assert.ok(!stored.includes(invite.inviteToken));
  assert.ok(!stored.includes(session.sessionToken));
  await assert.rejects(access.redeemInvite("bad", now), { code: "INVITE_INVALID" });
});

test("expired invitations, expired sessions, and revoked invitations cannot make provider calls", async () => {
  const { access, invite, session } = await fixture();
  let calls = 0;
  const generate = async () => { calls++; return { text: "not allowed" }; };
  await assert.rejects(access.redeemInvite(invite.inviteToken, now + 86400000), { code: "INVITE_INVALID" });
  const expired = gateway(access, { generate, now: () => session.expiresAt });
  assert.equal((await expired(request(session.sessionToken))).status, 401);
  await access.revokeInvite(invite.inviteId);
  assert.equal((await gateway(access, { generate })(request(session.sessionToken))).status, 401);
  assert.equal(calls, 0);
});

test("all invited users use the same server-owned Gemini key while only session credentials reach the app", async () => {
  const { access, invite, session } = await fixture();
  const second = await access.redeemInvite(invite.inviteToken, now);
  const inputs = [];
  const chat = gateway(access, { generate: async (input) => { inputs.push(input); return { text: "东京两人经济型旅行建议" }; } });
  for (const token of [session.sessionToken, second.sessionToken]) {
    const response = await chat(request(token));
    assert.equal(response.status, 200);
    assert.doesNotMatch(await response.text(), /owner-provider-key/);
  }
  assert.deepEqual(inputs.map((i) => i.apiKey), ["owner-provider-key", "owner-provider-key"]);
  assert.deepEqual(inputs[0].contents, [{ role: "user", parts: [{ text: "东京三日游" }] }]);
});

test("shared access fails closed for missing/unknown sessions, incorrect origins, and missing storage", async () => {
  const { access, session } = await fixture();
  let calls = 0;
  const chat = gateway(access, { generate: async () => { calls++; return { text: "no" }; } });
  assert.equal((await chat(request())).status, 401);
  assert.equal((await chat(request("a".repeat(43)))).status, 401);
  assert.equal((await chat(request(session.sessionToken, undefined, { Origin: "https://attacker.example" }))).status, 403);
  assert.equal((await chat(request(session.sessionToken, undefined, { Host: "attacker.example" }))).status, 403);
  const missing = await gateway(undefined)(request(session.sessionToken));
  assert.equal(missing.status, 503);
  assert.equal((await missing.json()).error.code, "SHARED_SERVICE_NOT_CONFIGURED");
  assert.equal(calls, 0);
  assert.throws(() => verifySharedRequest(request(), "http://travel.example.test"), { code: "SHARED_SERVICE_NOT_CONFIGURED" });
  assert.throws(() => verifySharedRequest(request(), "https://travel.example.test/path"), { code: "SHARED_SERVICE_NOT_CONFIGURED" });
});

test("native shared requests work behind the configured HTTPS reverse proxy", async () => {
  const { access, session } = await fixture();
  const response = await gateway(access)(request(session.sessionToken, undefined, { Host: "travel.example.test" }, "http://0.0.0.0:8080/api/chat"));
  assert.equal(response.status, 200);
});

test("daily global quota survives new instances and concurrent admissions cannot exceed it", async () => {
  const { documents, access, invite, session } = await fixture({ dailyRequests: 1 });
  const secondSession = await access.redeemInvite(invite.inviteToken, now);
  const otherInstance = createSharedAccess(documents, { ...DEFAULT_SHARED_LIMITS, dailyRequests: 1 });
  const outcomes = await Promise.allSettled([access.admit(session.sessionToken, now), otherInstance.admit(secondSession.sessionToken, now)]);
  assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(outcomes.find((r) => r.status === "rejected").reason.code, "DAILY_LIMIT_REACHED");
  assert.equal(documents.records.get("day_2026-11-05").requests, 1);
  const fresh = createSharedAccess(documents, { ...DEFAULT_SHARED_LIMITS, dailyRequests: 1 });
  await assert.rejects(fresh.admit(secondSession.sessionToken, now), { code: "DAILY_LIMIT_REACHED" });
  await fresh.admit(secondSession.sessionToken, now + 60000);
  assert.equal(documents.records.get("day_2026-11-06").requests, 1);
});

test("session quota and observed token totals persist without storing conversation content", async () => {
  const { documents, access, session } = await fixture({ sessionDailyRequests: 1 });
  const chat = gateway(access);
  assert.equal((await chat(request(session.sessionToken))).status, 200);
  const response = await gateway(createSharedAccess(documents, { ...DEFAULT_SHARED_LIMITS, sessionDailyRequests: 1 }))(request(session.sessionToken));
  assert.equal(response.status, 429);
  assert.ok(Number(response.headers.get("retry-after")) > 0);
  const day = documents.records.get("day_2026-11-05");
  assert.equal(day.requests, 1); assert.equal(day.totalTokens, 15);
  assert.doesNotMatch(JSON.stringify([...documents.records]), /东京|owner-provider-key/);
});

test("malformed input and missing owner configuration do not consume daily provider admission", async () => {
  const { documents, access, session } = await fixture();
  assert.equal((await gateway(access)(request(session.sessionToken, { messages: [] }))).status, 400);
  const missing = gateway(access, { getConfiguration: () => ({ isDevelopment: false, accessMode: "shared", publicOrigin: origin }) });
  assert.equal((await missing(request(session.sessionToken))).status, 503);
  assert.equal(documents.records.has("day_2026-11-05"), false);
});

test("a failed provider request still consumes one daily admission, preventing unlimited paid retries", async () => {
  const { documents, access, session } = await fixture({ sessionDailyRequests: 1 });
  const failed = gateway(access, { generate: async () => { throw Object.assign(new Error("private diagnostic"), { status: 503 }); } });
  assert.equal((await failed(request(session.sessionToken))).status, 502);
  assert.equal((await gateway(access)(request(session.sessionToken))).status, 429);
  assert.equal(documents.records.get("day_2026-11-05").failedRequests, 1);
});

test("session endpoint redeems only valid bounded JSON, returns no provider key and sanitizes errors", async () => {
  const { access, invite } = await fixture();
  const endpoint = createSessionHandler({
    getConfiguration: () => ({ accessMode: "shared", publicOrigin: origin }),
    redeem: (token, timestamp) => access.redeemInvite(token, timestamp), now: () => now,
  });
  const activation = (body, headers = {}) => request(undefined, body, headers, `${origin}/api/session`);
  const response = await endpoint(activation({ invite: invite.inviteToken }));
  assert.equal(response.status, 200);
  const session = await response.json();
  assert.match(session.sessionToken, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await endpoint(activation({ invite: "bad" }))).status, 401);
  assert.equal((await endpoint(activation({ invite: invite.inviteToken, apiKey: "not accepted" }))).status, 400);
  assert.equal((await endpoint(activation({ invite: "x".repeat(5000) }))).status, 413);
  assert.equal((await endpoint(activation({ invite: invite.inviteToken }, { Origin: "https://attacker.example" }))).status, 403);
});

test("session activation timeout retains its concurrency slot until storage settles", async () => {
  let settle;
  const endpoint = createSessionHandler({
    getConfiguration: () => ({ accessMode: "shared", publicOrigin: origin }), timeoutMs: 10,
    controls: createCallControls({ maxConcurrent: 1 }),
    redeem: () => new Promise((resolve) => { settle = resolve; }),
  });
  const activation = () => request(undefined, { invite: "a".repeat(43) }, {}, `${origin}/api/session`);
  assert.equal((await endpoint(activation())).status, 504);
  assert.equal((await endpoint(activation())).status, 503);
  settle({ sessionToken: "b".repeat(43), expiresAt: Date.now() + 10000 });
  await new Promise((resolve) => setImmediate(resolve));
});

test('anonymous entry requires an explicit server switch and disabling it rejects already-issued sessions', async () => {
  const documents = database(), closed = createSharedAccess(documents);
  await assert.rejects(closed.createAnonymousSession(now), { code: 'ANONYMOUS_TEST_DISABLED' });
  assert.equal(documents.records.size, 0);
  const open = createSharedAccess(documents, DEFAULT_SHARED_LIMITS, { allowAnonymousTest: true });
  const session = await open.createAnonymousSession(now); let calls = 0;
  const response = await gateway(closed, { generate: async () => { calls++; return { text: 'no' }; } })(request(session.sessionToken));
  assert.equal(response.status, 403); assert.equal((await response.json()).error.code, 'ANONYMOUS_TEST_DISABLED'); assert.equal(calls, 0);
  assert.equal((await gateway(open, { now: () => session.expiresAt })(request(session.sessionToken))).status, 401);
  assert.ok(!JSON.stringify([...documents.records]).includes(session.sessionToken));
});

test('new anonymous sessions and service instances cannot reset persistent project generation quota', async () => {
  const documents = database(), limits = { ...DEFAULT_SHARED_LIMITS, dailyRequests: 2, sessionDailyRequests: 1 };
  const first = createSharedAccess(documents, limits, { allowAnonymousTest: true }), other = createSharedAccess(documents, limits, { allowAnonymousTest: true });
  const a = await first.createAnonymousSession(now), b = await other.createAnonymousSession(now), c = await other.createAnonymousSession(now);
  await first.admit(a.sessionToken, now);
  await assert.rejects(other.admit(a.sessionToken, now), { code: 'DAILY_LIMIT_REACHED' });
  const results = await Promise.allSettled([first.admit(b.sessionToken, now), other.admit(c.sessionToken, now)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.equal(documents.records.get('day_2026-11-05').requests, 2);
  const fresh = createSharedAccess(documents, limits, { allowAnonymousTest: true });
  await assert.rejects(fresh.createAnonymousSession(now), { code: 'DAILY_LIMIT_REACHED' });
  await assert.rejects(fresh.admit(b.sessionToken, now), { code: 'DAILY_LIMIT_REACHED' });
});

test('anonymous issuance has its own durable UTC-day cap without consuming generation admissions', async () => {
  const documents = database(), make = () => createSharedAccess(documents, DEFAULT_SHARED_LIMITS, { allowAnonymousTest: true, dailySessions: 2 });
  const results = await Promise.allSettled([make().createAnonymousSession(now), make().createAnonymousSession(now), make().createAnonymousSession(now)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 2); assert.equal(results.find(r => r.status === 'rejected').reason.code, 'SESSION_LIMIT_REACHED');
  assert.equal(documents.records.get('anonymous_sessions_2026-11-05').sessions, 2); assert.equal(documents.records.has('day_2026-11-05'), false);
  await make().createAnonymousSession(now + 60000); assert.equal(documents.records.get('anonymous_sessions_2026-11-06').sessions, 1);
});

test('anonymous HTTP bootstrap accepts only empty JSON under the server switch, never client-selected settings', async () => {
  const documents = database(), access = createSharedAccess(documents, DEFAULT_SHARED_LIMITS, { allowAnonymousTest: true }); let enabled = false, calls = 0;
  const endpoint = createSessionHandler({ getConfiguration: () => ({ accessMode: 'shared', publicOrigin: origin, allowAnonymousTest: enabled }), anonymous: at => { calls++; return access.createAnonymousSession(at); }, redeem: () => { throw Error('unused'); }, now: () => now });
  const activation = (body, headers = {}) => request(undefined, body, headers, `${origin}/api/session`);
  assert.equal((await endpoint(activation({}))).status, 403); assert.equal(calls, 0); enabled = true;
  const response = await endpoint(activation({})); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store'); assert.match((await response.json()).sessionToken, /^[A-Za-z0-9_-]{43}$/);
  for (const body of [{ allowAnonymousTest: true }, { apiKey: 'client-value' }, { model: 'client-model' }, { invite: null }]) assert.equal((await endpoint(activation(body))).status, 400);
  assert.equal((await endpoint(activation({}, { Origin: 'https://attacker.example' }))).status, 403); assert.equal(calls, 1);
});

test('photo quotas are atomic, persist across factories and sessions, and do not consume Gemini admissions', async () => {
  const documents = database();
  const options = { allowAnonymousTest: true };
  const photos = { dailyRequests: 3, sessionDailyRequests: 2 };
  const access = createSharedAccess(documents, DEFAULT_SHARED_LIMITS, options, photos);
  const first = await access.createAnonymousSession(now);
  await access.reservePhotoRequests(first.sessionToken, now, 0);
  assert.equal([...documents.records.keys()].filter(key=>key.startsWith('photo_day')).length,0);
  const concurrent = await Promise.allSettled([1,2,3].map(()=>access.reservePhotoRequests(first.sessionToken, now, 1)));
  assert.equal(concurrent.filter(item=>item.status==='fulfilled').length,2);
  const restored = createSharedAccess(documents, DEFAULT_SHARED_LIMITS, options, photos);
  const second = await restored.createAnonymousSession(now);
  await restored.reservePhotoRequests(second.sessionToken, now, 1);
  const third = await restored.createAnonymousSession(now);
  await assert.rejects(restored.reservePhotoRequests(third.sessionToken, now, 1),error=>error.code==='PHOTO_LIMIT_REACHED');
  assert.equal(documents.records.get('photo_day_2026-11-05').requests,3);
  assert.equal(documents.records.get('day_2026-11-05'),undefined);
  await restored.admit(first.sessionToken, now);
  assert.equal(documents.records.get('day_2026-11-05').requests,1);
  await assert.rejects(restored.reservePhotoRequests(first.sessionToken, now+DEFAULT_SHARED_LIMITS.sessionLifetimeMs,0),error=>error.code==='SESSION_EXPIRED');
  const disabled = createSharedAccess(documents, DEFAULT_SHARED_LIMITS, {allowAnonymousTest:false}, photos);
  await assert.rejects(disabled.reservePhotoRequests(second.sessionToken, now,0),error=>error.code==='ANONYMOUS_TEST_DISABLED');
});
