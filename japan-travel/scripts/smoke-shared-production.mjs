import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { access } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';

await access('.next/standalone/server.js');
const probe = createServer();
probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const child = spawn(process.execPath, ['.next/standalone/server.js'], {
  env: {
    ...process.env, NODE_ENV: 'production', HOSTNAME: '127.0.0.1', PORT: String(port),
    CHAT_ACCESS_MODE: 'shared', CHAT_ALLOW_ANONYMOUS_TEST: 'false', CHAT_PUBLIC_ORIGIN: 'https://travel.example.test',
    GOOGLE_CLOUD_PROJECT: 'shared-test-project',
    GEMINI_API_KEY: 'not-a-real-provider-key', GEMINI_MODEL: 'test-model', GOOGLE_API_KEY: '',
    GOOGLE_APPLICATION_CREDENTIALS: '/non-existent-shared-smoke-credentials.json',
  },
  stdio: 'ignore',
});
try {
  let healthy = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (child.exitCode !== null) throw Error('Standalone server stopped before becoming ready');
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(500) });
      healthy = response.ok;
      if (healthy) { assert.deepEqual(await response.json(), { service: 'Japan Travel API', status: 'ok' }); break; }
    } catch { /* Wait only for the temporary local server. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(healthy, 'Standalone server did not become ready');
  // Core HTTP lets this localhost smoke reproduce the Host sent by a reverse
  // proxy. Native fetch intentionally ignores manually supplied Host headers.
  const post = (path, body, host = 'travel.example.test') => new Promise((resolve, reject) => {
    const content = JSON.stringify(body);
    const request = httpRequest({
      hostname: '127.0.0.1', port, path, method: 'POST',
      headers: { Host: host, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(content) },
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: response.statusCode })));
      response.on('error', reject);
    });
    request.setTimeout(3000, () => request.destroy(Error('Local smoke timed out')));
    request.on('error', reject);
    request.end(content);
  });
  const unauthenticated = await post('/api/chat', { messages: [{ role: 'user', content: '东京三天' }] });
  const missingSession = await unauthenticated.json();
  assert.equal(unauthenticated.status, 401, JSON.stringify(missingSession));
  assert.equal(missingSession.error.code, 'SESSION_REQUIRED');
  assert.equal((await post('/api/chat', { messages: [] }, 'untrusted.example')).status, 403);
  assert.equal((await post('/api/session', { invite: 'bad', apiKey: 'not accepted' })).status, 400);
  const disabled = await post('/api/session', {});
  assert.equal(disabled.status, 403);
  assert.equal((await disabled.json()).error.code, 'ANONYMOUS_TEST_DISABLED');
  assert.equal((await post('/api/place-photos', { places: [] })).status, 401);
  assert.equal((await post('/api/place-photos', { places: [] }, 'untrusted.example')).status, 403);
  for (const page of ['terms', 'privacy']) {
    const policy = await fetch(`http://127.0.0.1:${port}/legal/${page}`);
    assert.equal(policy.status, 200);
    assert.match(await policy.text(), /Google Maps Platform Terms/);
    assert.equal(policy.headers.get('cache-control'), 'no-store');
  }
  console.log('Production standalone smoke passed: health=200, missing session=401, untrusted host=403, invalid activation=400. No real provider or database credentials used.');
} finally {
  if (child.exitCode === null) { child.kill('SIGTERM'); await once(child, 'exit'); }
}
