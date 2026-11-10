import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatEntry, ChatError, createUserTurn, sendChatRequest } from '@/lib/chat';
import { hasConversationContent, PlannerHistoryError, type PlannerConversation } from '@/lib/planner-history';
import { plannerHistory } from '@/lib/planner-history-storage';

let nextEntryId = 0;
function entryId() { return `chat-${Date.now()}-${++nextEntryId}`; }
function freshConversation(): PlannerConversation {
  return { id: entryId(), createdAt: Date.now(), updatedAt: Date.now(), messages: [], draft: '', pendingMessage: null };
}
export function usePlannerChat(options: { authorization?: () => Promise<string | undefined>; onAuthError?: (code: string) => void } = {}) {
  const [conversation, setConversation] = useState(freshConversation);
  const current = useRef(conversation);
  const [savedConversations, setSavedConversations] = useState<PlannerConversation[]>([]);
  const [historyReady, setHistoryReady] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyUpdating, setHistoryUpdating] = useState(false);
  const historyMutation = useRef(false);
  const [restoredMessageIds, setRestoredMessageIds] = useState<Set<string>>(() => new Set());
  const [inputReset, setInputReset] = useState({ value: '', revision: 0 });
  const [isSending, setIsSending] = useState(false);
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const finishReveal = useCallback(() => setRevealingId(null), []);
  const [error, setError] = useState<ChatError | null>(null);
  const inFlight = useRef(false);
  const activeRequest = useRef<AbortController | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(false);
  const ready = useRef(false);

  function resetNativeInput(value: string) { setInputReset(previous => ({ value, revision: previous.revision + 1 })); }
  async function persist(value: PlannerConversation) {
    if (!ready.current) return;
    try {
      const saved = await plannerHistory.save(value);
      if (mounted.current) { setSavedConversations(saved); setHistoryError(null); }
    } catch (failure) {
      if (mounted.current) setHistoryError(failure instanceof PlannerHistoryError ? failure.message : '聊天记录暂时无法保存，请保留当前页面。');
    }
  }
  function commit(value: PlannerConversation, mode: 'now' | 'draft' | 'none' = 'now') {
    clearTimeout(saveTimer.current);
    const next = mode === 'none' ? value : { ...value, updatedAt: Date.now() };
    current.current = next; setConversation(next);
    if (mode === 'now') void persist(next);
    else if (mode === 'draft') saveTimer.current = setTimeout(() => { void persist(next); }, 250);
  }
  async function flushHistory() { clearTimeout(saveTimer.current); await persist(current.current); }
  useEffect(() => {
    mounted.current = true;
    let active = true;
    void plannerHistory.load().then(items => {
      if (!active) return;
      setSavedConversations(items);
      const restored = items[0];
      if (restored) {
        current.current = restored; setConversation(restored);
        setInputReset(previous => ({ value: restored.draft, revision: previous.revision + 1 }));
        setRestoredMessageIds(new Set(restored.messages.filter(item => item.role === 'assistant').map(item => item.id)));
        if (restored.pendingMessage) setError(new ChatError('REQUEST_INTERRUPTED', '上次请求未完成，可以重试或编辑消息。'));
      }
    }).catch(failure => {
      if (active) setHistoryError(failure instanceof PlannerHistoryError ? failure.message : '无法读取本机聊天记录，本次聊天暂不覆盖旧记录。');
    }).finally(() => { if (active) { ready.current = true; setHistoryReady(true); } });
    return () => {
      active = false; mounted.current = false;
      activeRequest.current?.abort(); clearTimeout(saveTimer.current);
      if (ready.current && hasConversationContent(current.current)) void plannerHistory.save(current.current).catch(() => undefined);
    };
  }, []);

  async function request(userEntry: ChatEntry, keepDraft = false) {
    if (inFlight.current || historyMutation.current || !ready.current) return;
    const start = current.current;
    let messages;
    try { messages = createUserTurn(start.messages, userEntry.content); }
    catch (failure) { setError(failure as ChatError); return; }
    inFlight.current = true; setIsSending(true); setError(null);
    commit({ ...start, pendingMessage: userEntry, draft: keepDraft ? start.draft : '' });
    if (!keepDraft) resetNativeInput('');
    const controller = new AbortController(); activeRequest.current = controller;
    try {
      const reply = await sendChatRequest(messages, controller.signal, options.authorization);
      if (controller.signal.aborted || current.current.id !== start.id) return;
      const assistantId = entryId(); setRevealingId(assistantId);
      commit({ ...current.current, messages: [...start.messages, userEntry, { id: assistantId, role: 'assistant', content: reply }], pendingMessage: null });
    } catch (failure) {
      if (controller.signal.aborted) return;
      const issue = failure instanceof ChatError ? failure : new ChatError('REQUEST_FAILED', '这次请求未能完成，请重试。');
      setError(issue); options.onAuthError?.(issue.code);
    } finally {
      inFlight.current = false;
      if (!controller.signal.aborted) { activeRequest.current = null; setIsSending(false); }
    }
  }
  function setInput(value: string) { if (!historyMutation.current) commit({ ...current.current, draft: value }, 'draft'); }
  function sendText(text: string) {
    if (current.current.pendingMessage || inFlight.current || revealingId || !text.trim()) return;
    void request({ id: entryId(), role: 'user', content: text.trim() });
  }
  function send() { sendText(current.current.draft); }
  function retry() { if (current.current.pendingMessage && !inFlight.current) void request(current.current.pendingMessage, true); }
  function editFailedMessage() {
    const pending = current.current.pendingMessage;
    if (inFlight.current || !pending) return;
    commit({ ...current.current, draft: pending.content, pendingMessage: null }); resetNativeInput(pending.content); setError(null);
  }
  function startNewConversation(initialDraft = '') {
    if (inFlight.current || historyMutation.current || revealingId || !ready.current) return;
    void flushHistory(); commit({ ...freshConversation(), draft: initialDraft.slice(0, 4000) }, initialDraft ? 'now' : 'none');
    resetNativeInput(initialDraft.slice(0, 4000)); setRestoredMessageIds(new Set()); setError(null);
  }
  function selectConversation(value: PlannerConversation) {
    if (inFlight.current || historyMutation.current || revealingId || !ready.current || value.id === current.current.id) return;
    void flushHistory(); commit(value); resetNativeInput(value.draft);
    setRestoredMessageIds(new Set(value.messages.filter(item => item.role === 'assistant').map(item => item.id)));
    setError(value.pendingMessage ? new ChatError('REQUEST_INTERRUPTED', '上次请求未完成，可以重试或编辑消息。') : null);
  }
  async function deleteConversation(id: string) {
    if (inFlight.current || historyMutation.current || revealingId || !ready.current) return;
    historyMutation.current = true; setHistoryUpdating(true);
    clearTimeout(saveTimer.current);
    const deletingActive = id === current.current.id;
    if (deletingActive) { commit(freshConversation(), 'none'); resetNativeInput(''); setRestoredMessageIds(new Set()); setError(null); }
    try {
      const saved = await plannerHistory.remove(id); setSavedConversations(saved); setHistoryError(null);
      if (!deletingActive) await persist(current.current);
    } catch { setHistoryError('暂时无法删除这段聊天记录，请稍后重试。'); }
    finally { historyMutation.current = false; if (mounted.current) setHistoryUpdating(false); }
  }
  return {
    messages: conversation.pendingMessage ? [...conversation.messages, conversation.pendingMessage] : conversation.messages,
    input: conversation.draft, inputReset, setInput, isSending, revealingId, finishReveal, error,
    failedMessageId: error && conversation.pendingMessage ? conversation.pendingMessage.id : null,
    hasFailedMessage: Boolean(error && conversation.pendingMessage),
    send, sendText, retry, editFailedMessage, startNewConversation,
    savedConversations, activeConversationId: conversation.id, historyReady, historyUpdating, historyError, restoredMessageIds,
    selectConversation, deleteConversation, flushHistory,
  };
}
