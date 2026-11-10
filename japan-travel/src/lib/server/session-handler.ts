import { ChatError, createCallControls, readJsonBody } from "./chat.ts";
import { SharedAccessError, verifySharedRequest } from "./shared-access.ts";

export function createSessionHandler(dependencies: {
  getConfiguration: () => { accessMode?: string; publicOrigin?: string; allowAnonymousTest?: boolean };
  redeem: (invite: string, now: number) => Promise<{ sessionToken: string; expiresAt: number }>;
  anonymous?: (now: number) => Promise<{ sessionToken: string; expiresAt: number }>;
  timeoutMs?: number;
  controls?: ReturnType<typeof createCallControls>;
  now?: () => number;
}) {
  const controls = dependencies.controls ?? createCallControls({ global: 20, perClient: 20 });
  const now = dependencies.now ?? Date.now;
  return async (request: Request): Promise<Response> => {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), dependencies.timeoutMs ?? 10000);
    const cancel = () => abort.abort();
    request.signal.addEventListener("abort", cancel, { once: true });
    if (request.signal.aborted) cancel();
    let release: (() => void) | undefined;
    let work: Promise<Response> | undefined;
    let stopWaiting: (() => void) | undefined;
    try {
      const config = dependencies.getConfiguration();
      if (config.accessMode !== "shared") throw new SharedAccessError(404, "SHARED_ACCESS_DISABLED", "此服务未启用共享测试。");
      verifySharedRequest(request, config.publicOrigin);
      release = controls.acquire("session", now());
      work = (async () => {
        const body = await readJsonBody(request, abort.signal, 4096);
        if (typeof body !== "object" || body === null || Array.isArray(body) ||
          Object.keys(body).some((key) => key !== "invite") || ("invite" in body && typeof body.invite !== "string")) {
          throw new SharedAccessError(400, "INVALID_SESSION_REQUEST", "无法建立测试会话，请重新连接。");
        }
        if (abort.signal.aborted) throw new SharedAccessError(504, "SESSION_TIMEOUT", "连接旅行助手超时，请稍后重试。");
        let session;
        if ("invite" in body && typeof body.invite === "string") {
          session = await dependencies.redeem(body.invite, now());
        } else {
          if (config.allowAnonymousTest !== true || !dependencies.anonymous) {
            throw new SharedAccessError(403, "ANONYMOUS_TEST_DISABLED", "匿名测试已关闭，请联系开发者。");
          }
          session = await dependencies.anonymous(now());
        }
        return Response.json(session, { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
      })();
      work.then(() => release?.(), () => release?.());
      return await Promise.race([work, new Promise<Response>((_resolve, reject) => {
        stopWaiting = () => reject(new SharedAccessError(504, "SESSION_TIMEOUT", "连接旅行助手超时，请稍后重试。"));
        if (abort.signal.aborted) stopWaiting();
        else abort.signal.addEventListener("abort", stopWaiting, { once: true });
      })]);
    } catch (error) {
      const failure = error instanceof SharedAccessError || error instanceof ChatError ? error :
        new SharedAccessError(503, "SHARED_SERVICE_UNAVAILABLE", "旅行助手暂时无法连接，请稍后重试。");
      const headers: Record<string, string> = { "Cache-Control": "no-store" };
      if (failure.retryAfter) headers["Retry-After"] = String(failure.retryAfter);
      return Response.json({ error: { code: failure.code, message: failure.message } }, { status: failure.status, headers });
    } finally {
      clearTimeout(timer);
      request.signal.removeEventListener("abort", cancel);
      if (stopWaiting) abort.signal.removeEventListener("abort", stopWaiting);
      if (!work) release?.();
    }
  };
}
