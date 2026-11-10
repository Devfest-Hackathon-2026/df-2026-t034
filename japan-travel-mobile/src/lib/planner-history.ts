import type { ChatEntry } from './chat.ts';

export type PlannerConversation = {
  id: string; createdAt: number; updatedAt: number;
  messages: ChatEntry[]; draft: string; pendingMessage: ChatEntry | null;
};
type Storage = { read(): Promise<string | null>; write(value: string): Promise<void> };
const MAX_CONVERSATIONS = 20;
const MAX_STORAGE_BYTES = 1500000;
export class PlannerHistoryError extends Error {}
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
function entry(value: unknown, role?: 'user' | 'assistant'): ChatEntry {
  if (!object(value) || typeof value.id !== 'string' || value.id.length > 100 ||
      !['user', 'assistant'].includes(String(value.role)) || (role && value.role !== role) ||
      typeof value.content !== 'string' || !value.content.trim() || value.content.length > (value.role === 'user' ? 4000 : 14000)) {
    throw new PlannerHistoryError('无法读取已保存的聊天记录，本次聊天暂不覆盖旧记录。');
  }
  return { id: value.id, role: value.role as ChatEntry['role'], content: value.content };
}
function conversation(value: unknown): PlannerConversation {
  if (!object(value) || typeof value.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(value.id) ||
      !Number.isSafeInteger(value.createdAt) || !Number.isSafeInteger(value.updatedAt) ||
      !Array.isArray(value.messages) || value.messages.length > 40 || value.messages.length % 2 !== 0 ||
      typeof value.draft !== 'string' || value.draft.length > 4000) {
    throw new PlannerHistoryError('无法读取已保存的聊天记录，本次聊天暂不覆盖旧记录。');
  }
  const messages = value.messages.map((item, index) => entry(item, index % 2 === 0 ? 'user' : 'assistant'));
  if (messages.reduce((n, item) => n + item.content.length, 0) > 46000 || new Set(messages.map(item => item.id)).size !== messages.length) {
    throw new PlannerHistoryError('这段聊天记录过长，暂时无法保存，请先复制全文。');
  }
  return { id: value.id, createdAt: value.createdAt as number, updatedAt: value.updatedAt as number, messages,
    draft: value.draft, pendingMessage: value.pendingMessage === null ? null : entry(value.pendingMessage, 'user') };
}
export function conversationTitle(value: PlannerConversation) {
  return (value.messages[0]?.content ?? value.pendingMessage?.content ?? value.draft).replace(/\s+/g, ' ').trim().slice(0, 36) || '新对话';
}
export function conversationPreview(value: PlannerConversation) {
  return (value.pendingMessage?.content ?? value.messages.at(-1)?.content ?? value.draft).replace(/\*\*|\s+/g, ' ').trim().slice(0, 70);
}
export function hasConversationContent(value: PlannerConversation) {
  return value.messages.length > 0 || Boolean(value.pendingMessage || value.draft.trim());
}
// Serialize writes so an older save cannot overwrite a newer conversation.
// Persist only text fields, never credentials or Google photo metadata/images.
export function createPlannerHistory(storage: Storage) {
  let items: PlannerConversation[] = [];
  let loaded: Promise<void> | undefined;
  let queue: Promise<unknown> = Promise.resolve();
  const load = () => loaded ??= (async () => {
    const raw = await storage.read();
    if (!raw) return;
    let value: unknown;
    try { value = JSON.parse(raw); } catch { throw new PlannerHistoryError('无法读取已保存的聊天记录，本次聊天暂不覆盖旧记录。'); }
    if (!object(value) || value.version !== 1 || !Array.isArray(value.items) || value.items.length > MAX_CONVERSATIONS) {
      throw new PlannerHistoryError('无法读取已保存的聊天记录，本次聊天暂不覆盖旧记录。');
    }
    const parsed = value.items.map(conversation);
    if (new Set(parsed.map(item => item.id)).size !== parsed.length) throw new PlannerHistoryError('聊天记录存在重复编号，暂不覆盖旧记录。');
    items = parsed.sort((a, b) => b.updatedAt - a.updatedAt);
  })();
  async function write(next: PlannerConversation[]) {
    if (next.length > MAX_CONVERSATIONS) throw new PlannerHistoryError('本机已保存20段对话，请先在聊天历史里删除不需要的记录。');
    const raw = JSON.stringify({ version: 1, items: next });
    if (new TextEncoder().encode(raw).byteLength > MAX_STORAGE_BYTES) throw new PlannerHistoryError('本机聊天记录空间已满，请删除一些旧对话后再保存。');
    try { await storage.write(raw); } catch { throw new PlannerHistoryError('聊天记录暂未保存成功，请保留当前页面，稍后再试。'); }
    items = next;
    return [...items];
  }
  function enqueue(work: () => Promise<PlannerConversation[]>) {
    const result = queue.then(async () => { await load(); return work(); });
    queue = result.catch(() => undefined);
    return result;
  }
  return {
    async load() { await load(); await queue; return [...items]; },
    async save(value: PlannerConversation) {
      const safe = conversation(value);
      return enqueue(async () => {
        if (!hasConversationContent(safe)) return items.some(item => item.id === safe.id) ? write(items.filter(item => item.id !== safe.id)) : [...items];
        return write([safe, ...items.filter(item => item.id !== safe.id)].sort((a, b) => b.updatedAt - a.updatedAt));
      });
    },
    remove(id: string) { return enqueue(() => write(items.filter(item => item.id !== id))); },
  };
}
