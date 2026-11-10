import type { PlacePhotoQuery, GooglePlacePhoto } from './google-place-photos.ts';
export type DiscoveryPhotoResult = { photo: GooglePlacePhoto | null; enabled: boolean; stop?: boolean; limitReached?: boolean };

// Construction never performs I/O. Only an explicit request() may bootstrap a
// session and request ONE sight. Coalesce fast taps; never retry automatically.
export function createDiscoveryPhotoLoader(query: PlacePhotoQuery, options: {
  connect: () => Promise<void>;
  load: (query: PlacePhotoQuery, signal: AbortSignal) => Promise<DiscoveryPhotoResult>;
}) {
  let flight: Promise<DiscoveryPhotoResult | null> | undefined;
  let controller: AbortController | undefined;
  let finished: DiscoveryPhotoResult | undefined;
  return {
    request() {
      if (finished) return Promise.resolve(finished);
      if (flight) return flight;
      const active = new AbortController(); controller = active;
      const task = (async () => {
        try {
          await options.connect();
          if (active.signal.aborted) return null;
          const result = await options.load({ name: query.name, city: query.city }, active.signal);
          if (active.signal.aborted) return null;
          if (result.photo || result.limitReached || !result.enabled) finished = result;
          return result;
        } catch { return active.signal.aborted ? null : { enabled: true, photo: null, stop: true } as DiscoveryPhotoResult; }
      })();
      flight = task;
      void task.finally(() => { if (flight === task) flight = undefined; });
      return task;
    },
    cancel() { controller?.abort(); },
  };
}
