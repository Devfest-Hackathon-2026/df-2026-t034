import { getChatEndpoint } from './chat.ts';
import { sharedChatSession } from './chat-session-storage';
import { loadGooglePhoto, type PlacePhotoQuery } from './google-place-photos';

export async function requestGooglePhoto(query?: PlacePhotoQuery, signal?: AbortSignal) {
  try { return await loadGooglePhoto(query, {
    endpoint: getChatEndpoint().replace(/\/api\/chat$/, '/api/place-photos'),
    authorization: process.env.EXPO_PUBLIC_CHAT_ACCESS_MODE === 'shared' ? () => sharedChatSession().authorization() : undefined,
    signal,
  }); } catch { return { enabled: true, photo: null, stop: true }; }
}
