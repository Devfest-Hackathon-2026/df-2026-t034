import { getLanguage } from './i18n/core.ts';
import { jsonTransport } from './json-transport.ts';
export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export type ChatEntry = ChatMessage & { id: string };
export const MAX_MESSAGE_LENGTH = 4000;
export const MAX_MESSAGES = 40;
export const MAX_CONVERSATION_LENGTH = 32000;
const MAX_REPLY_LENGTH = 14000;
const REQUEST_TIMEOUT_MS = 105000;

export class ChatError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'ChatError';
    this.code = code;
  }
}

export function createUserTurn(history: ChatMessage[], text: string): ChatMessage[] {
  const content = text.trim();
  if (!content) throw new ChatError('EMPTY_MESSAGE', '请先输入你的旅行需求。');
  if (content.length > MAX_MESSAGE_LENGTH) throw new ChatError('MESSAGE_TOO_LONG', '这条消息太长了，请缩短后再发送。');
  const messages: ChatMessage[] = [...history, { role: 'user', content }];
  if (messages.length > MAX_MESSAGES || messages.reduce((total, item) => total + item.content.length, 0) > MAX_CONVERSATION_LENGTH) {
    throw new ChatError('CONVERSATION_TOO_LONG', '这段对话已经较长，请开始新对话，并带上需要保留的旅行条件。');
  }
  return messages;
}

export function resolveChatEndpoint(baseUrl: string | undefined, secure = false): string {
  if (!baseUrl?.trim()) throw new ChatError('MISSING_API_URL', '尚未连接 AI 服务，请先按项目说明配置服务地址。');
  try {
    const url = new URL(baseUrl.trim());
    if (!['http:', 'https:'].includes(url.protocol) || (secure && url.protocol !== 'https:') || url.username || url.password || url.search || url.hash) throw new Error('Invalid base URL');
    return `${url.toString().replace(/\/$/, '')}/api/chat`;
  } catch {
    throw new ChatError('INVALID_API_URL', 'AI 服务地址格式不正确，请检查手机端的服务地址配置。');
  }
}

export function getChatEndpoint(): string {
  // Expo requires this exact dot-notation expression to inline the public URL.
  try { return resolveChatEndpoint(process.env.EXPO_PUBLIC_API_BASE_URL, isSharedChatEnabled()); }
  catch (error) {
    if (isSharedChatEnabled()) throw new ChatError('SERVICE_NOT_READY', '旅行助手正在准备中，请稍后再试。');
    throw error;
  }
}

export function isSharedChatEnabled() { return process.env.EXPO_PUBLIC_CHAT_ACCESS_MODE === 'shared'; }

const errorMessages: Record<string, string> = {
  MISSING_API_KEY: 'AI 服务尚未配置密钥，请联系开发者完成服务端配置。',
  MISSING_MODEL: 'AI 服务尚未选择模型，请联系开发者配置 GEMINI_MODEL 并重启服务。',
  GEMINI_AUTH_ERROR: 'AI 服务的密钥无效或没有调用权限，请联系开发者检查服务端配置。',
  GEMINI_BILLING_REQUIRED: '团队 AI 服务的 API 余额暂不可用，请联系服务负责人。你不需要充值或填写密钥。',
  MISSING_VERTEX_CONFIG: 'AI 服务的项目或区域尚未配置，请联系服务负责人。',
  INVALID_GEMINI_PROVIDER: 'AI 服务的接入配置暂不可用，请联系服务负责人。',
  MODEL_UNAVAILABLE: '当前 AI 模型暂不可用，请联系开发者检查模型配置。',
  RATE_LIMITED: '请求有点频繁，或当前可用额度不足，请稍等一会儿再试。',
  GEMINI_RATE_LIMITED: 'AI 的调用频率或可用额度受限，请稍后重试，或联系服务负责人。',
  SERVER_BUSY: 'AI 服务正在忙，请稍等一会儿再试。',
  TIMEOUT: '等待回复超时，请稍后重试。',
  GEMINI_TIMEOUT: '等待 Gemini 回复超时，请稍后重试。',
  GEMINI_UNAVAILABLE: '暂时连接不上 Gemini，请稍后重试。',
  GEMINI_REQUEST_REJECTED: 'Gemini 未能接受这次请求，请编辑消息后重试；如仍失败，请检查模型配置。',
  LOCAL_DEVELOPMENT_ONLY: '聊天目前仅供本地开发，请用电脑的局域网地址连接以 npm run dev 启动的服务。',
  ORIGIN_NOT_ALLOWED: '此地址不允许当前页面连接，请检查本地开发服务地址。',
  EMPTY_RESPONSE: 'AI 这次没有返回文字，请重试。',
  RESPONSE_BLOCKED: 'AI 未能回答这条消息，请编辑内容后再试。',
  RESPONSE_TOO_LONG: 'AI 这次回复太长，未能完成。可以编辑消息，请它先给简要方案。',
  INCOMPLETE_ITINERARY: '这次行程没有生成完整，请点重试。',
  ITINERARY_CONSTRAINT_VIOLATION: '这次行程未能满足您限定的景点条件，请重试或编辑需求。',
  CONVERSATION_TOO_LONG: '这段对话已经较长，请开始新对话，并带上需要保留的旅行条件。',
  BODY_TOO_LARGE: '这段对话内容过多，请开始新对话，并带上需要保留的旅行条件。',
  MESSAGE_TOO_LONG: '这条消息太长了，请缩短后再发送。',
  SESSION_REQUIRED: '请先连接旅行助手，再开始聊天。',
  SESSION_EXPIRED: '测试会话已结束，请重新连接旅行助手。',
  ANONYMOUS_TEST_DISABLED: '匿名测试已关闭，请联系开发者。',
  SESSION_LIMIT_REACHED: '今天可建立的测试会话已用完，请明天再试或联系开发者。',
  DAILY_LIMIT_REACHED: '今天的测试额度已用完，请明天再试或联系开发者。',
  SHARED_SERVICE_NOT_CONFIGURED: '旅行助手正在准备中，请稍后再试。',
  SHARED_SERVICE_UNAVAILABLE: '旅行助手暂时无法连接，请稍后重试。',
  SERVICE_ADDRESS_NOT_ALLOWED: '旅行助手连接地址不正确，请使用正式测试入口。',
};

export async function sendChatRequest(messages: ChatMessage[], signal: AbortSignal, authorization?: () => Promise<string | undefined>): Promise<string> {
  const endpoint = getChatEndpoint();
  const controller = new AbortController();
  let timedOut = false;
  const abortRequest = () => controller.abort();
  signal.addEventListener('abort', abortRequest, { once: true });
  if (signal.aborted) controller.abort();
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, REQUEST_TIMEOUT_MS);
  try {
    const token = await authorization?.();
    if (isSharedChatEnabled() && !token) throw new ChatError('SESSION_REQUIRED', errorMessages.SESSION_REQUIRED);
    const response = await jsonTransport(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Travel-Day-Photos': '4', 'X-Travel-Language': getLanguage(), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ messages: messages.map(({ role, content }) => ({ role, content })) }),
      signal: controller.signal,
    });
    // Read transport errors separately from JSON syntax failures. Previously a
    // broken response body was reported as a wrong server address on iPhone.
    let raw: string;
    try { raw = await response.text(); }
    catch { throw new Error('Response body interrupted'); }
    let data: unknown;
    try { data = JSON.parse(raw.replace(/^\uFEFF/, '')); }
    catch {
      if (controller.signal.aborted) throw new Error('Aborted response');
      // Only metadata: never log response text, messages, tokens or headers.
      console.warn('chat_response_unreadable', { status: response.status, characters: raw.length, contentType: response.headers.get('content-type')?.split(';')[0] });
      if (response.status === 429) throw new ChatError('GEMINI_RATE_LIMITED', errorMessages.GEMINI_RATE_LIMITED);
      if (response.status === 504) throw new ChatError('GEMINI_TIMEOUT', errorMessages.GEMINI_TIMEOUT);
      if (response.status >= 500) throw new ChatError('SERVER_BUSY', errorMessages.SERVER_BUSY);
      throw new ChatError('INVALID_RESPONSE', '暂时无法读取 AI 回复，请检查网络后重试。');
    }
    if (!response.ok) {
      const code = typeof data === 'object' && data !== null && 'error' in data &&
        typeof data.error === 'object' && data.error !== null && 'code' in data.error &&
        typeof data.error.code === 'string' ? data.error.code : 'REQUEST_FAILED';
      const fallback = response.status === 429 ? errorMessages.RATE_LIMITED : response.status >= 500
        ? 'AI 服务暂时不可用，请稍后重试。' : '这次请求未能完成，请编辑消息或稍后重试。';
      const configurationFailure = isSharedChatEnabled() && ['MISSING_API_KEY', 'MISSING_MODEL', 'GEMINI_AUTH_ERROR', 'MODEL_UNAVAILABLE', 'GEMINI_BILLING_REQUIRED', 'MISSING_VERTEX_CONFIG', 'INVALID_GEMINI_PROVIDER'].includes(code);
      throw new ChatError(code, configurationFailure ? '旅行助手暂时不可用，请稍后再试或联系开发者。' : Object.hasOwn(errorMessages, code) ? errorMessages[code] : fallback);
    }
    if (typeof data !== 'object' || data === null || !('reply' in data) || typeof data.reply !== 'string' || !data.reply.trim() || data.reply.length > MAX_REPLY_LENGTH) {
      throw new ChatError('INVALID_RESPONSE', 'AI 服务没有返回有效的文字回复，请重试。');
    }
    return data.reply.trim();
  } catch (error) {
    if (timedOut || (error instanceof Error && error.name === 'TimeoutError')) throw new ChatError('TIMEOUT', '等待回复超时，请检查网络后重试。');
    if (signal.aborted) throw new ChatError('CANCELLED', '请求已取消。');
    if (error instanceof ChatError) throw error;
    throw new ChatError('NETWORK_ERROR', isSharedChatEnabled() ? '连接不上旅行助手，请检查手机网络后重试。' : '连接不上 AI 服务，请确认电脑服务已启动，手机和电脑连接同一 Wi-Fi。');
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', abortRequest);
  }
}
