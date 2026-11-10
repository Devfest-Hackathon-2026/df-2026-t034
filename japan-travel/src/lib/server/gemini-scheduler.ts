// Shared by assessment and all itinerary segments in this process. Splitting a
// trip must not multiply the pre-existing two-provider-call concurrency bound.
export function createGeminiScheduler(maxConcurrent = 2, maxQueued = 4) {
  let active = 0;
  const queue: { start: () => void; cancel: () => void; signal: AbortSignal }[] = [];
  return function schedule<T>(signal: AbortSignal, work: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const abort = () => reject(new DOMException('Provider request cancelled', 'AbortError'));
      if (signal.aborted) { abort(); return; }
      const entry = { signal, cancel: () => {
        const index = queue.indexOf(entry);
        if (index >= 0) queue.splice(index, 1);
        signal.removeEventListener('abort', entry.cancel);
        abort();
      }, start: () => {
        signal.removeEventListener('abort', entry.cancel);
        if (signal.aborted) { abort(); return; }
        active++;
        // Hold the slot until the actual SDK work settles, even after abort.
        void Promise.resolve().then(work).then(resolve, reject).finally(() => {
          active--;
          while (active < maxConcurrent && queue.length) queue.shift()!.start();
        });
      } };
      if (active < maxConcurrent) entry.start();
      else if (queue.length >= maxQueued) reject(Object.assign(new Error('Provider queue full'), { status: 503 }));
      else { queue.push(entry); signal.addEventListener('abort', entry.cancel, { once: true }); }
    });
  };
}
export const withGeminiSlot = createGeminiScheduler();
