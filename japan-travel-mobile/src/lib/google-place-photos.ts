import { getDayHeading, type PhotoReplyBlock } from './assistant-text.ts';
import { jsonTransport } from './json-transport.ts';

export type GooglePlacePhoto = {
  provider: 'google-places'; name: string; city: string; source: string; placeId: string; url: string; width: number; height: number;
  authors: { displayName: string; uri?: string }[]; mapsUri: string; termsUrl: string; privacyUrl: string;
};
export type PlacePhotoQuery = { name: string; city: string };
const cities = [
  ['東京', '東京', '东京'], ['京都', '京都'], ['大阪', '大阪'], ['札幌', '札幌'], ['小樽', '小樽'], ['函館', '函館', '函馆'],
  ['福岡', '福岡', '福冈', '博多'], ['鹿児島', '鹿児島', '鹿儿岛'], ['那覇', '那覇', '那霸'], ['名古屋', '名古屋'],
  ['横浜', '横浜', '横滨'], ['奈良', '奈良'], ['宇治', '宇治'], ['神戸', '神戸', '神户'], ['広島', '広島', '广岛'],
  ['金沢', '金沢', '金泽'], ['仙台', '仙台'], ['鎌倉', '鎌倉', '镰仓'], ['日光', '日光'], ['箱根', '箱根'], ['富士河口湖', '河口湖'],
  ['旭川', '旭川'], ['富良野', '富良野'], ['美瑛', '美瑛'], ['登別', '登別', '登别'], ['洞爺湖', '洞爺湖', '洞爷湖'],
  ['釧路', '釧路', '钏路'], ['帯広', '帯広', '带广'], ['網走', '網走', '网走'],
];
function cityIn(text: string) {
  const found = cities.filter(([, ...aliases]) => aliases.some((alias) => text.includes(alias))).map(([city]) => city);
  return found.length === 1 ? found[0] : undefined;
}
// Use the day's city or its route range; never choose Kyoto's 円山公園 for Sapporo.
export function googlePhotoQueries(content: string, blocks: PhotoReplyBlock[]): Map<number, PlacePhotoQuery> {
  const routes = [...content.matchAll(/^第\s*(\d+)(?:\s*[–—-]\s*(\d+))?\s*天[：:]\s*(.+)$/gm)].map((match) => ({ first: +match[1], last: +(match[2] ?? match[1]), city: cityIn(match[3]) }));
  const singleCity = cityIn(content);
  const queries = new Map<number, PlacePhotoQuery>();
  let day = 0; let dayCity: string | undefined; let dayTitle = ''; const counts = new Map<number, number>();
  blocks.forEach((block, index) => {
    const heading = getDayHeading(block.heading ?? '');
    if (heading) { day = heading.number; dayTitle = heading.title; dayCity = cityIn(heading.title) ?? routes.find((route) => route.first <= day && route.last >= day)?.city; }
    const name = block.attraction ?? block.dayPhotos?.[0];
    if (!name || /美食示例|酒店|机场|空港|车站/.test(name) || (counts.get(day) ?? 0) >= 4) return;
    // The same temple name exists in Shinjuku and on Mount Takao. Use the
    // official full name only with local context; otherwise omit this image.
    // https://www.takaosan.or.jp/about_yakuouin.html
    if (/^(?:薬|藥|药)王院(?:[(（].*[)）])?$/.test(name)) {
      if (/高尾山|髙尾山/.test(dayTitle + block.body)) {
        queries.set(index, { name: '高尾山薬王院', city: '八王子' }); counts.set(day, (counts.get(day) ?? 0) + 1);
      }
      return;
    }
    const city = /[高髙]尾山/.test(name) ? '八王子' : cityIn(name) ?? dayCity ?? singleCity;
    if (!city) return; // No city evidence: omit instead of guessing.
    queries.set(index, { name, city }); counts.set(day, (counts.get(day) ?? 0) + 1);
  });
  return queries;
}
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
function https(value: unknown, domain?: RegExp): value is string {
  if (typeof value !== 'string') return false;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && (!domain || domain.test(url.hostname)); } catch { return false; }
}
export function parseGooglePhoto(value: unknown, query?: PlacePhotoQuery): GooglePlacePhoto | null {
  if (!object(value) || !query || value.provider !== 'google-places' || value.name !== query.name || value.city !== query.city || typeof value.placeId !== 'string' ||
      !https(value.url, /^(?:[a-z0-9-]+\.)*googleusercontent\.com$/) || !https(value.mapsUri, /^(?:(?:www\.|maps\.)?google\.(?:com|co\.jp)|maps\.app\.goo\.gl)$/) ||
      !https(value.termsUrl) || !https(value.privacyUrl) || typeof value.width !== 'number' || typeof value.height !== 'number' || value.width < 1000 || value.height < 650 ||
      !Array.isArray(value.authors) || !value.authors.every((author) => object(author) && typeof author.displayName === 'string' && author.displayName.length > 0 && (author.uri === undefined || https(author.uri)))) return null;
  return { ...value, source: value.mapsUri } as GooglePlacePhoto;
}
export async function loadGooglePhoto(query: PlacePhotoQuery | undefined, options: {
  endpoint: string; authorization?: () => Promise<string | undefined>; fetcher?: typeof fetch; signal?: AbortSignal;
}): Promise<{ enabled: boolean; photo: GooglePlacePhoto | null; stop?: boolean; limitReached?: boolean }> {
  const controller = new AbortController(); const cancel = () => controller.abort();
  options.signal?.addEventListener('abort', cancel, { once: true });
  if (options.signal?.aborted) cancel();
  const timer = setTimeout(cancel, 8000);
  try {
    const token = await options.authorization?.();
    const response = await (options.fetcher ?? jsonTransport)(options.endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ places: query ? [query] : [] }), signal: controller.signal,
    });
    if (response.status === 404) return { enabled: false, photo: null }; // Previous server compatibility.
    if (!response.ok) return { enabled: true, photo: null, stop: true };
    const data: unknown = await response.json();
    if (!object(data) || typeof data.enabled !== 'boolean' || !Array.isArray(data.photos)) return { enabled: true, photo: null, stop: true };
    const limitReached = Array.isArray(data.omissions) && data.omissions.some((item) => object(item) && item.reason === 'PHOTO_LIMIT_REACHED');
    return { ...(data.unavailable === true ? { stop: true } : {}), ...(limitReached ? { limitReached: true } : {}), enabled: data.enabled, photo: data.enabled ? parseGooglePhoto(data.photos[0], query) : null };
  } catch { return { enabled: true, photo: null, stop: true }; }
  finally { clearTimeout(timer); options.signal?.removeEventListener('abort', cancel); }
}
