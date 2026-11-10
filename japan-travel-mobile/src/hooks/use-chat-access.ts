import { useCallback, useEffect, useState } from 'react';
import { ChatError, isSharedChatEnabled } from '@/lib/chat';
import { sharedChatSession } from '@/lib/chat-session-storage';

export function useChatAccess() {
  const shared = isSharedChatEnabled();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ cycle: number; ready: boolean; error: string | null }>({ cycle: -1, ready: false, error: null });
  const ready = !shared || (result.cycle === attempt && result.ready);
  const connecting = shared && result.cycle !== attempt;
  const error = shared && result.cycle === attempt ? result.error : null;
  useEffect(() => {
    if (!shared) return;
    let mounted = true;
    void (async () => {
      try {
        await sharedChatSession().connect();
        if (mounted) setResult({ cycle: attempt, ready: true, error: null });
      } catch (failure) {
        if (mounted) {
          const configurationError = failure instanceof ChatError && ['MISSING_API_URL', 'INVALID_API_URL'].includes(failure.code);
          setResult({ cycle: attempt, ready: false, error: configurationError ? '旅行助手正在准备中，请稍后再试。' : failure instanceof ChatError ? failure.message : '旅行助手暂时无法连接，请稍后重试。' });
        }
      }
    })();
    return () => { mounted = false; };
  }, [shared, attempt]);
  const authorization = useCallback(async () => shared ? sharedChatSession().authorization() : undefined, [shared]);
  const onAuthError = useCallback((code: string) => {
    if (!shared || !['SESSION_EXPIRED', 'SESSION_REQUIRED', 'ANONYMOUS_TEST_DISABLED'].includes(code)) return;
    setResult({ cycle: attempt, ready: false, error: code === 'ANONYMOUS_TEST_DISABLED' ? '匿名测试已关闭，请联系开发者。' : '测试会话已结束，请点击「重新连接」继续。' });
    void sharedChatSession().forget();
  }, [shared, attempt]);
  return { ready, connecting, error, authorization, onAuthError, reconnect: () => setAttempt((value) => value + 1) };
}
