import { ChatError, resolveChatEndpoint } from './chat.ts';
import { jsonTransport } from './json-transport.ts';

type Session = { kind: 'anonymous-test'; base: string; token: string; expiresAt: number };
export type SessionStorage = { read(): Promise<string | null>; write(value: string): Promise<void>; clear(): Promise<void> };

export function createChatSession(options: {
  baseUrl: string | undefined;
  storage: SessionStorage;
  fetcher?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
}) {
  const endpoint = resolveChatEndpoint(options.baseUrl, true).replace(/\/api\/chat$/, '/api/session');
  const base = endpoint.replace(/\/api\/session$/, '');
  const now = options.now ?? Date.now;
  let current: Session | undefined;
  let restoreFlight: Promise<boolean> | undefined;
  let connection: Promise<void> | undefined;
  let generation = 0;
  const valid = (value: unknown): value is Session => typeof value === 'object' && value !== null &&
    'kind' in value && value.kind === 'anonymous-test' && 'base' in value && value.base === base &&
    'token' in value && typeof value.token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value.token) &&
    'expiresAt' in value && typeof value.expiresAt === 'number' && Number.isSafeInteger(value.expiresAt) && value.expiresAt > now();

  function restore(): Promise<boolean> {
    if (valid(current)) return Promise.resolve(true);
    if (!restoreFlight) restoreFlight = (async () => {
      try {
        const stored = await options.storage.read();
        if (stored) {
          const parsed: unknown = JSON.parse(stored);
          if (valid(parsed)) { current = parsed; return true; }
        }
      } catch { /* A fresh anonymous session can still work in memory. */ }
      current = undefined;
      return false;
    })();
    return restoreFlight.then(() => valid(current));
  }

  function connect(): Promise<void> {
    if (connection) return connection;
    const requestGeneration = ++generation;
    const promise = (async () => {
      if (await restore()) return;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15000);
      try {
        const response = await (options.fetcher ?? jsonTransport)(endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}), signal: controller.signal,
        });
        let data: unknown;
        try { data = await response.json(); } catch { throw new ChatError('SESSION_UNAVAILABLE', '暂时无法连接旅行助手，请稍后重试。'); }
        if (!response.ok) {
          const code = typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'object' && data.error !== null &&
            'code' in data.error && typeof data.error.code === 'string' ? data.error.code : 'SESSION_UNAVAILABLE';
          const messages: Record<string, string> = {
            ANONYMOUS_TEST_DISABLED: '匿名测试已关闭，请联系开发者。',
            DAILY_LIMIT_REACHED: '今天的测试额度已用完，请明天再试或联系开发者。',
            SESSION_LIMIT_REACHED: '今天可建立的测试会话已用完，请明天再试或联系开发者。',
          };
          throw new ChatError(code, Object.hasOwn(messages, code) ? messages[code] : response.status === 429 ? '连接请求有些频繁，请稍后再试。' : '旅行助手暂时无法连接，请稍后重试。');
        }
        const candidate = typeof data === 'object' && data !== null && 'sessionToken' in data && 'expiresAt' in data
          ? { kind: 'anonymous-test', base, token: data.sessionToken, expiresAt: data.expiresAt } : undefined;
        if (!valid(candidate) || candidate.expiresAt > now() + 24 * 3600000 + 60000) throw new ChatError('SESSION_UNAVAILABLE', '暂时无法建立测试会话，请稍后重试。');
        if (requestGeneration !== generation) return;
        current = candidate;
        restoreFlight = Promise.resolve(true);
        try { await options.storage.write(JSON.stringify(candidate)); } catch { /* Keep the live session usable until this app closes. */ }
      } catch (error) {
        if (controller.signal.aborted) throw new ChatError('SESSION_TIMEOUT', '连接旅行助手超时，请稍后重试。');
        if (error instanceof ChatError) throw error;
        throw new ChatError('SESSION_UNAVAILABLE', '连接不上旅行助手，请检查网络后重试。');
      } finally { clearTimeout(timer); }
    })();
    connection = promise;
    // Strict Mode/remounts share one bootstrap. Failure never loops automatically.
    promise.then(() => { if (connection === promise) connection = undefined; }, () => { if (connection === promise) connection = undefined; });
    return promise;
  }

  return {
    restore, connect,
    async authorization() {
      if (connection) await connection;
      await restore();
      if (!valid(current)) throw new ChatError('SESSION_EXPIRED', '测试会话已结束，请重新连接旅行助手。');
      return current.token;
    },
    async forget() {
      generation++;
      current = undefined;
      restoreFlight = Promise.resolve(false);
      try { await options.storage.clear(); } catch { /* Never reuse an invalid token from memory. */ }
    },
  };
}
