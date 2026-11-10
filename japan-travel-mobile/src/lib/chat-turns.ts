import type { ChatEntry } from './chat';

export const CHAT_VERTICAL_PADDING = 20;
export type ChatTurn = { id: string; user: ChatEntry; assistant?: ChatEntry };

export function groupChatTurns(messages: ChatEntry[]): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (const message of messages) {
    if (message.role === 'user') turns.push({ id: message.id, user: message });
    else if (turns.length) turns[turns.length - 1].assistant = message;
  }
  return turns;
}

export function turnScrollOffset(y: number): number {
  return Math.max(0, y - CHAT_VERTICAL_PADDING);
}

export function minimumTurnHeight(viewportHeight: number): number {
  return Math.max(0, viewportHeight - CHAT_VERTICAL_PADDING * 2);
}
