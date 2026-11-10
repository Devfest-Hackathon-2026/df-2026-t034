import type { PlacePhoto } from './place-photos';

// The chat displays photographs only. Their complete attribution is available
// from Settings, without turning photos into external navigation controls.
let credits: readonly PlacePhoto[] = [];
const listeners = new Set<() => void>();
export function recordPhotoCredit(photo: PlacePhoto) {
  if (credits.some((item) => item.source === photo.source)) return;
  credits = [...credits, photo];
  listeners.forEach((listener) => listener());
}
export function getPhotoCredits() { return credits; }
export function subscribePhotoCredits(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
