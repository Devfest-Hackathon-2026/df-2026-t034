import { createHash, randomBytes } from "node:crypto";

export class SharedAccessError extends Error {
  status: number;
  code: string;
  retryAfter?: number;
  constructor(
    status: number,
    code: string,
    message: string,
    retryAfter?: number,
  ) { super(message); this.name = "SharedAccessError"; this.status = status; this.code = code; this.retryAfter = retryAfter; }
}

export type StoredRecord = Record<string, unknown>;
export interface AtomicDocuments {
  run<T>(operation: (transaction: {
    get(key: string): Promise<StoredRecord | undefined>;
    set(key: string, value: StoredRecord): void;
  }) => Promise<T>): Promise<T>;
}

export type SharedLimits = {
  dailyRequests: number;
  sessionDailyRequests: number;
  sessionLifetimeMs: number;
};
export const DEFAULT_SHARED_LIMITS: SharedLimits = {
  dailyRequests: 100,
  sessionDailyRequests: 20,
  sessionLifetimeMs: 4 * 60 * 60 * 1000,
};
export type AnonymousTestOptions = { allowAnonymousTest?: boolean; dailySessions?: number };
export type Admission = { sessionId: string; day: string };
export type Usage = { status: number; inputTokens?: number; outputTokens?: number; totalTokens?: number };
export interface SharedChatAccess {
  admit(token: string, now: number): Promise<Admission>;
  recordUsage(admission: Admission, usage: Usage): Promise<void>;
  reservePhotoRequests?(token: string, now: number, count: number): Promise<void>;
}

function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function opaqueToken() { return randomBytes(32).toString("base64url"); }
function number(record: StoredRecord | undefined, key: string): number {
  const value = record?.[key];
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}
function expires(record: StoredRecord | undefined, now: number) {
  return !record || record.revoked === true || number(record, "expiresAt") <= now;
}
function addUsage(record: StoredRecord | undefined, usage: Usage): StoredRecord {
  const updated = { ...record };
  for (const key of ["inputTokens", "outputTokens", "totalTokens"] as const) {
    if (typeof usage[key] === "number" && Number.isSafeInteger(usage[key]) && usage[key]! >= 0) {
      updated[key] = number(record, key) + usage[key]!;
    }
  }
  updated.completedRequests = number(record, "completedRequests") + 1;
  updated.failedRequests = number(record, "failedRequests") + (usage.status >= 400 ? 1 : 0);
  return updated;
}

export function verifySharedRequest(request: Request, publicOrigin: string | undefined) {
  let configured: URL;
  try {
    configured = new URL(publicOrigin ?? "");
    if (configured.protocol !== "https:" || configured.username || configured.password ||
      configured.pathname !== "/" || configured.search || configured.hash) throw new Error("invalid origin");
  } catch {
    throw new SharedAccessError(503, "SHARED_SERVICE_NOT_CONFIGURED", "共享旅行助手尚未准备好，请稍后再试。");
  }
  const host = request.headers.get("host")?.toLowerCase() ?? new URL(request.url).host.toLowerCase();
  if (host !== configured.host.toLowerCase()) {
    throw new SharedAccessError(403, "SERVICE_ADDRESS_NOT_ALLOWED", "旅行助手连接地址不正确，请使用正式测试入口。");
  }
  const origin = request.headers.get("origin");
  if ((origin && origin !== configured.origin) || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new SharedAccessError(403, "ORIGIN_NOT_ALLOWED", "此页面不能连接旅行助手，请从 App 打开。");
  }
}

export function sessionToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(header);
  if (!match) throw new SharedAccessError(401, "SESSION_REQUIRED", "请先连接旅行助手，再开始聊天。");
  return match[1];
}

export function createSharedAccess(documents: AtomicDocuments, limits: SharedLimits = DEFAULT_SHARED_LIMITS, anonymous: AnonymousTestOptions = {}, photos: { dailyRequests: number; sessionDailyRequests: number } = { dailyRequests: 100, sessionDailyRequests: 40 }) {
  if (![limits.dailyRequests, limits.sessionDailyRequests, limits.sessionLifetimeMs].every((value) => Number.isSafeInteger(value) && value > 0)) {
    throw new Error("Shared limits must be positive integers");
  }
  if (![photos.dailyRequests, photos.sessionDailyRequests].every((value) => Number.isSafeInteger(value) && value > 0)) throw new Error("Photo limits must be positive integers");
  const dailySessions = anonymous.dailySessions ?? 100;
  if (!Number.isSafeInteger(dailySessions) || dailySessions < 1) throw new Error("Anonymous session limit must be a positive integer");
  return {
    async createAnonymousSession(now: number) {
      if (anonymous.allowAnonymousTest !== true) {
        throw new SharedAccessError(403, "ANONYMOUS_TEST_DISABLED", "匿名测试已关闭，请联系开发者。");
      }
      const token = opaqueToken();
      const id = hash(token);
      const day = new Date(now).toISOString().slice(0, 10);
      const expiresAt = now + limits.sessionLifetimeMs;
      await documents.run(async (transaction) => {
        const global = await transaction.get(`day_${day}`);
        const issued = await transaction.get(`anonymous_sessions_${day}`);
        const retryAfter = Math.max(1, Math.ceil((Date.parse(`${day}T00:00:00.000Z`) + 86400000 - now) / 1000));
        if (number(global, "requests") >= limits.dailyRequests) {
          throw new SharedAccessError(429, "DAILY_LIMIT_REACHED", "今天的测试额度已用完，请明天再试或联系开发者。", retryAfter);
        }
        if (number(issued, "sessions") >= dailySessions) {
          throw new SharedAccessError(429, "SESSION_LIMIT_REACHED", "今天可建立的测试会话已用完，请明天再试或联系开发者。", retryAfter);
        }
        transaction.set(`anonymous_sessions_${day}`, { sessions: number(issued, "sessions") + 1 });
        transaction.set(`session_${id}`, { kind: "anonymous-test", createdAt: now, expiresAt, revoked: false });
      });
      return { sessionToken: token, expiresAt };
    },

    async createInvite(options: { now: number; expiresAt: number; uses: number }) {
      if (!Number.isSafeInteger(options.uses) || options.uses < 1 || options.uses > 100 ||
        !Number.isSafeInteger(options.expiresAt) || options.expiresAt <= options.now ||
        options.expiresAt - options.now > 72 * 60 * 60 * 1000) throw new Error("Invalid invite bounds");
      const token = opaqueToken();
      const id = hash(token);
      await documents.run(async (transaction) => {
        if (await transaction.get(`invite_${id}`)) throw new Error("Invite collision");
        transaction.set(`invite_${id}`, { expiresAt: options.expiresAt, remainingUses: options.uses, createdAt: options.now, revoked: false });
      });
      return { inviteToken: token, inviteId: id, expiresAt: options.expiresAt };
    },

    async revokeInvite(id: string) {
      if (!/^[a-f0-9]{64}$/.test(id)) throw new Error("Invalid invite ID");
      await documents.run(async (transaction) => {
        const record = await transaction.get(`invite_${id}`);
        if (!record) throw new Error("Invite not found");
        transaction.set(`invite_${id}`, { ...record, revoked: true });
      });
    },

    async redeemInvite(inviteToken: string, now: number) {
      if (!/^[A-Za-z0-9_-]{43}$/.test(inviteToken)) {
        throw new SharedAccessError(401, "INVITE_INVALID", "这份测试邀请无效，请向邀请人获取新的链接。");
      }
      const inviteId = hash(inviteToken);
      const token = opaqueToken();
      const id = hash(token);
      const expiresAt = await documents.run(async (transaction) => {
        const invite = await transaction.get(`invite_${inviteId}`);
        if (expires(invite, now) || number(invite, "remainingUses") < 1) {
          throw new SharedAccessError(401, "INVITE_INVALID", "这份测试邀请已失效或用完，请向邀请人获取新的链接。");
        }
        const expiry = Math.min(number(invite, "expiresAt"), now + limits.sessionLifetimeMs);
        transaction.set(`invite_${inviteId}`, { ...invite, remainingUses: number(invite, "remainingUses") - 1 });
        transaction.set(`session_${id}`, { inviteId, createdAt: now, expiresAt: expiry, revoked: false });
        return expiry;
      });
      return { sessionToken: token, expiresAt };
    },

    async admit(token: string, now: number): Promise<Admission> {
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
        throw new SharedAccessError(401, "SESSION_EXPIRED", "测试会话已失效，请重新连接旅行助手。");
      }
      const id = hash(token);
      const day = new Date(now).toISOString().slice(0, 10);
      const globalKey = `day_${day}`;
      const sessionKey = `session_day_${id}_${day}`;
      await documents.run(async (transaction) => {
        const session = await transaction.get(`session_${id}`);
        if (expires(session, now)) {
          throw new SharedAccessError(401, "SESSION_EXPIRED", "测试会话已失效，请重新连接旅行助手。");
        }
        if (session?.kind === "anonymous-test") {
          if (anonymous.allowAnonymousTest !== true) {
            throw new SharedAccessError(403, "ANONYMOUS_TEST_DISABLED", "匿名测试已关闭，请联系开发者。");
          }
        } else {
          const inviteId = session?.inviteId;
          if (session?.kind !== undefined || typeof inviteId !== "string" || !/^[a-f0-9]{64}$/.test(inviteId)) {
            throw new SharedAccessError(401, "SESSION_EXPIRED", "测试会话已失效，请重新连接旅行助手。");
          }
          const invite = await transaction.get(`invite_${inviteId}`);
          if (expires(invite, now)) throw new SharedAccessError(401, "SESSION_EXPIRED", "测试会话已失效，请重新连接旅行助手。");
        }
        const global = await transaction.get(globalKey);
        const individual = await transaction.get(sessionKey);
        if (number(global, "requests") >= limits.dailyRequests || number(individual, "requests") >= limits.sessionDailyRequests) {
          const retryAfter = Math.max(1, Math.ceil((Date.parse(`${day}T00:00:00.000Z`) + 86400000 - now) / 1000));
          throw new SharedAccessError(429, "DAILY_LIMIT_REACHED", "今天的测试额度已用完，请明天再试或联系开发者。", retryAfter);
        }
        transaction.set(globalKey, { ...global, requests: number(global, "requests") + 1 });
        transaction.set(sessionKey, { ...individual, requests: number(individual, "requests") + 1 });
      });
      return { sessionId: id, day };
    },


    async reservePhotoRequests(token: string, now: number, count: number) {
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new SharedAccessError(401, "SESSION_EXPIRED", "测试会话已失效，请重新连接旅行助手。");
      if (!Number.isSafeInteger(count) || count < 0 || count > 8) throw new Error("Invalid photo reservation");
      const id = hash(token);
      const day = new Date(now).toISOString().slice(0, 10);
      const globalKey = `photo_day_${day}`;
      const individualKey = `photo_session_day_${id}_${day}`;
      await documents.run(async (transaction) => {
        const session = await transaction.get(`session_${id}`);
        if (expires(session, now)) {
          throw new SharedAccessError(401, "SESSION_EXPIRED", "测试会话已失效，请重新连接旅行助手。");
        }
        if (session?.kind === "anonymous-test") {
          if (anonymous.allowAnonymousTest !== true) {
            throw new SharedAccessError(403, "ANONYMOUS_TEST_DISABLED", "匿名测试已关闭，请联系开发者。");
          }
        } else {
          const inviteId = session?.inviteId;
          if (session?.kind !== undefined || typeof inviteId !== "string" || !/^[a-f0-9]{64}$/.test(inviteId)) {
            throw new SharedAccessError(401, "SESSION_EXPIRED", "测试会话已失效，请重新连接旅行助手。");
          }
          const invite = await transaction.get(`invite_${inviteId}`);
          if (expires(invite, now)) throw new SharedAccessError(401, "SESSION_EXPIRED", "测试会话已失效，请重新连接旅行助手。");
        }
        const global = await transaction.get(globalKey);
        const individual = await transaction.get(individualKey);
        if (number(global, "requests") + count > photos.dailyRequests || number(individual, "requests") + count > photos.sessionDailyRequests) {
          throw new SharedAccessError(429, "PHOTO_LIMIT_REACHED", "今天的图片查询额度已用完，行程文字仍可使用。");
        }
        if (count) {
          transaction.set(globalKey, { requests: number(global, "requests") + count });
          transaction.set(individualKey, { requests: number(individual, "requests") + count });
        }
      });
    },

    async recordUsage(admission: Admission, usage: Usage) {
      const globalKey = `day_${admission.day}`;
      const sessionKey = `session_day_${admission.sessionId}_${admission.day}`;
      await documents.run(async (transaction) => {
        const global = await transaction.get(globalKey);
        const individual = await transaction.get(sessionKey);
        transaction.set(globalKey, addUsage(global, usage));
        transaction.set(sessionKey, addUsage(individual, usage));
      });
    },
  };
}
