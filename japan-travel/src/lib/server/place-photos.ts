import OpenCC from 'opencc-js';
import { ChatError, createCallControls, readJsonBody, verifyLocalRequest } from './chat.ts';
import { sessionToken, SharedAccessError, verifySharedRequest, type SharedChatAccess } from './shared-access.ts';

export type PlacePhotoQuery = { name: string; city: string };
export type GooglePlacePhoto = PlacePhotoQuery & {
  provider: 'google-places'; placeId: string; url: string; width: number; height: number;
  authors: { displayName: string; uri?: string }[]; mapsUri: string; termsUrl: string; privacyUrl: string;
};
type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const compare = OpenCC.Converter({ from: 'jp', to: 'cn' });
const normalize = (value: string) => compare(value).normalize('NFKC').replace(/髙/g, '高').replace(/[\s・·]/g, '').replace(/[（(][^()（）]*[)）]/g, '').toLowerCase();
export function safeHttps(value: unknown, domain?: RegExp): string | undefined {
  if (typeof value !== 'string') return;
  try {
    const url = new URL(value.startsWith('//') ? `https:${value}` : value);
    if (url.protocol !== 'https:' || url.username || url.password || (domain && !domain.test(url.hostname))) return;
    if ([...url.searchParams.keys()].some((key) => /key|token|signature/i.test(key))) return;
    return url.href;
  } catch { return; }
}
const mapsDomain = /^(?:(?:www\.|maps\.)?google\.(?:com|co\.jp)|maps\.app\.goo\.gl)$/;
export function matchingPlace(value: unknown, query: PlacePhotoQuery): value is RecordValue {
  if (!record(value) || !record(value.displayName) || typeof value.displayName.text !== 'string' || !record(value.postalAddress)) return false;
  const address = value.postalAddress;
  if (address.regionCode !== 'JP') return false;
  const name = normalize(query.name);
  const actual = normalize(value.displayName.text);
  // Do not substitute a neighboring landmark or a similarly named business.
  const area = (value: string) => { const text = normalize(value); return text.length >= 3 ? text.replace(/[都府県县市区區]$/u, '') : text; };
  const city = area(query.city);
  const locations = city === normalize('東京') ? [address.administrativeArea, address.locality, address.sublocality] : [address.locality, address.sublocality];
  // Japanese postal addresses can combine municipality + ward in locality,
  // or put the municipality in addressLines instead of a separate locality.
  // Require the 市 boundary; 京都府 alone must never admit 宇治市.
  const inCity = locations.some((item) => typeof item === 'string' && (area(item) === city || normalize(item).startsWith(city + '市'))) ||
    (Array.isArray(address.addressLines) && address.addressLines.some((line) => typeof line === 'string' && normalize(line).includes(city + '市')));
  const takaoName = normalize('高尾山薬王院');
  const verifiedTakaoAlias = name === takaoName && [takaoName + normalize('有喜寺'), normalize('大本山') + takaoName, normalize('大本山') + takaoName + normalize('有喜寺')].includes(actual);
  return inCity && (actual === name || verifiedTakaoAlias || (name.length >= 3 && actual === normalize(query.city) + name) || actual === name + normalize(query.city));
}
export function selectLandscapePhoto(value: unknown): RecordValue | undefined {
  if (!Array.isArray(value)) return;
  return value.filter((photo): photo is RecordValue => record(photo) && typeof photo.widthPx === 'number' && typeof photo.heightPx === 'number' &&
    photo.widthPx >= 1000 && photo.heightPx >= 650 && photo.widthPx / photo.heightPx >= 1.15 && photo.widthPx / photo.heightPx <= 2.3 &&
    typeof photo.name === 'string' && /^places\/[A-Za-z0-9_-]{1,256}\/photos\/[A-Za-z0-9_-]{1,2048}$/.test(photo.name) && Array.isArray(photo.authorAttributions))
    .sort((a, b) => Math.abs((a.widthPx as number) / (a.heightPx as number) - 1.55) - Math.abs((b.widthPx as number) / (b.heightPx as number) - 1.55))[0];
}
export async function findGooglePlacePhoto(query: PlacePhotoQuery, options: {
  apiKey: string; signal: AbortSignal; reserve: () => Promise<void>; fetcher?: typeof fetch; termsUrl: string; privacyUrl: string;
  onOmission?: (reason: string) => void;
}): Promise<GooglePlacePhoto | null> {
  const fetcher = options.fetcher ?? fetch;
  // A city-wide search for this abbreviated temple name can select Shinjuku
  // instead of Mount Takao. A qualified name is required, even for old clients.
  if (normalize(query.name) === normalize('薬王院')) { options.onOmission?.('AMBIGUOUS_NAME'); return null; }
  const call = async (url: string, init: RequestInit) => {
    if (options.signal.aborted) throw new Error('Cancelled photo lookup');
    await options.reserve(); // Each provider request, including failures, consumes a durable slot.
    if (options.signal.aborted) throw new Error('Cancelled photo lookup');
    const response = await fetcher(url, { ...init, signal: options.signal, cache: 'no-store', redirect: 'error' });
    if (!response.ok || Number(response.headers.get('content-length')) > 262144) throw new Error('Photo provider unavailable');
    const text = await response.text();
    if (text.length > 262144) throw new Error('Photo response too large');
    return JSON.parse(text) as unknown;
  };
  const search = await call('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': options.apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.postalAddress,places.photos,places.googleMapsUri' },
    body: JSON.stringify({ textQuery: `${query.name} ${query.city} 日本`, languageCode: 'ja', regionCode: 'JP', pageSize: 3 }),
  });
  const places = record(search) && Array.isArray(search.places) ? search.places.filter((place) => matchingPlace(place, query)) : [];
  // Ambiguous exact-name matches are safer to omit than to guess.
  if (places.length !== 1) { options.onOmission?.('NO_UNIQUE_PLACE'); return null; }
  const place = places[0] as RecordValue;
  const mapsUri = safeHttps(place.googleMapsUri, mapsDomain);
  const photo = selectLandscapePhoto(place.photos);
  if (!photo || !mapsUri || typeof place.id !== 'string' || !/^[A-Za-z0-9_-]{1,256}$/.test(place.id) ||
      !(photo.name as string).startsWith(`places/${place.id}/photos/`)) { options.onOmission?.('NO_SUITABLE_PHOTO'); return null; }
  const authors = (photo.authorAttributions as unknown[]).map((author) => {
    if (!record(author) || typeof author.displayName !== 'string' || !author.displayName.trim() || author.displayName.length > 200) return undefined;
    const uri = author.uri === undefined ? undefined : safeHttps(author.uri, mapsDomain);
    if (author.uri !== undefined && !uri) return undefined;
    return { displayName: author.displayName, ...(uri ? { uri } : {}) };
  });
  if (authors.some((author) => !author)) return null; // Never silently drop required credits.
  const media = await call(`https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=1400&maxHeightPx=1000&skipHttpRedirect=true`, {
    method: 'GET', headers: { 'X-Goog-Api-Key': options.apiKey },
  });
  const url = record(media) && safeHttps(media.photoUri, /^(?:[a-z0-9-]+\.)*googleusercontent\.com$/);
  if (!url || url.includes(options.apiKey)) return null;
  return { ...query, provider: 'google-places', placeId: place.id, url, width: photo.widthPx as number, height: photo.heightPx as number,
    authors: authors as GooglePlacePhoto['authors'], mapsUri, termsUrl: options.termsUrl, privacyUrl: options.privacyUrl };
}

export type PhotoConfiguration = { enabled: boolean; apiKey?: string; termsUrl?: string; privacyUrl?: string; accessMode?: string; publicOrigin?: string; isDevelopment: boolean };
export function createPlacePhotosHandler(dependencies: {
  configuration: () => PhotoConfiguration; access?: () => SharedChatAccess; fetcher?: typeof fetch; now?: () => number;
}) {
  const controls = createCallControls({ maxConcurrent: 2, global: 30, perClient: 30 });
  const now = dependencies.now ?? Date.now;
  // Local development is loopback/LAN-only and retains a process-wide hard cap.
  let localDay = ''; let localCalls = 0;
  return async (request: Request) => {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    request.signal.addEventListener('abort', cancel, { once: true });
    if (request.signal.aborted) cancel();
    const timeout = setTimeout(cancel, 16000);
    let release: (() => void) | undefined;
    try {
      const config = dependencies.configuration();
      const shared = config.accessMode === 'shared';
      if (shared) verifySharedRequest(request, config.publicOrigin);
      else if ((config.accessMode ?? 'local') === 'local') verifyLocalRequest(request, config.isDevelopment);
      else throw new ChatError(503, 'PHOTO_SERVICE_UNAVAILABLE', '图片服务尚未准备好。');
      const token = shared ? sessionToken(request) : undefined;
      if (!config.enabled) return Response.json({ enabled: false, photos: [] }, { headers: { 'Cache-Control': 'no-store' } });
      const termsUrl = safeHttps(config.termsUrl); const privacyUrl = safeHttps(config.privacyUrl);
      if (!config.apiKey?.trim() || !termsUrl || !privacyUrl) throw new ChatError(503, 'PHOTO_SERVICE_UNAVAILABLE', '图片服务尚未准备好，行程文字仍可使用。');
      release = controls.acquire('photos', now());
      const body = await readJsonBody(request, controller.signal, 4096);
      if (!record(body) || Object.keys(body).join() !== 'places' || !Array.isArray(body.places) || body.places.length > 4) throw new ChatError(400, 'INVALID_PHOTO_REQUEST', '每批最多查询四处景点。');
      const queries: PlacePhotoQuery[] = body.places.map((place: unknown) => {
        if (!record(place) || Object.keys(place).sort().join() !== 'city,name' || ![place.name, place.city].every((item) => typeof item === 'string' && item.trim().length >= 2 && item.length <= 100 && !/[\r\n\x00-\x1f]|https?:\/\//.test(item))) throw new ChatError(400, 'INVALID_PHOTO_REQUEST', '请提供景点日文名和城市。');
        return { name: (place.name as string).trim(), city: (place.city as string).trim() };
      });
      const access = shared ? dependencies.access?.() : undefined;
      if (shared && !access?.reservePhotoRequests) throw new ChatError(503, 'PHOTO_SERVICE_UNAVAILABLE', '图片服务尚未准备好。');
      const reserve = async (count = 1) => {
        if (access && token) return access.reservePhotoRequests!(token, now(), count);
        const day = new Date(now()).toISOString().slice(0, 10);
        if (localDay !== day) { localDay = day; localCalls = 0; }
        if (localCalls + count > 100) throw new SharedAccessError(429, 'PHOTO_LIMIT_REACHED', '今天的本地图片查询额度已用完。');
        localCalls += count;
      };
      await reserve(0);
      const photos: GooglePlacePhoto[] = [];
      const omissions: { name: string; city: string; reason: string }[] = [];
      let unavailable = false;
      // Serial within a batch keeps Google concurrency bounded by the two handler slots.
      for (const query of queries) {
        if (controller.signal.aborted) break;
        try {
          const photo = await findGooglePlacePhoto(query, { apiKey: config.apiKey.trim(), signal: controller.signal, reserve, fetcher: dependencies.fetcher, termsUrl, privacyUrl,
            onOmission: (reason) => omissions.push({ ...query, reason }) });
          if (photo) photos.push(photo);
        } catch (error) {
          omissions.push({ ...query, reason: error instanceof SharedAccessError && error.code === 'PHOTO_LIMIT_REACHED' ? 'PHOTO_LIMIT_REACHED' : 'PHOTO_PROVIDER_UNAVAILABLE' });
          unavailable = true; break; /* No retries, including quota or permission errors. */
        }
      }
      return Response.json({ enabled: true, photos, ...(omissions.length ? { omissions } : {}), ...(unavailable ? { unavailable: true } : {}) }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      const status = error instanceof ChatError || error instanceof SharedAccessError ? error.status : 503;
      const code = error instanceof ChatError || error instanceof SharedAccessError ? error.code : 'PHOTO_SERVICE_UNAVAILABLE';
      return Response.json({ error: { code, message: '图片暂不可用，行程文字仍可使用。' } }, { status, headers: { 'Cache-Control': 'no-store' } });
    } finally { clearTimeout(timeout); request.signal.removeEventListener('abort', cancel); release?.(); }
  };
}
