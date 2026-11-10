import { validDate, type TripBooking } from './saved-trips.ts';
import { hotelCities, flightRoutes, railRoutes, attractionPages, officialAttractionPages } from './trip-booking-catalog.ts';

import { canonicalPlaceCity as canonical, matchesPlaceName as matchesName } from './trip-place-identity.ts';
import { admissionForPlace, type AdmissionEvidence } from './trip-admission.ts';

// Past or distant dates can be silently reset by third-party booking forms. Use the route page instead.
function searchableDate(value: string | undefined, maxDays: number): boolean {
  if (!value || !validDate(value)) return false;
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const days = (Date.parse(value) - Date.parse(today)) / 86400000;
  return days >= 0 && days <= maxDays;
}
const own = <T>(table: Record<string, T>, key: string): T | undefined => Object.hasOwn(table, key) ? table[key] : undefined;
export type BookingDestination = { label: string; url: string; shortLabel?: string };
export type BookingLink = { admission?: AdmissionEvidence; requirement?: string; url: string | null; precision: string; located: boolean; freeEntry?: boolean; entryKind: 'detail' | 'route' | 'hotel-results' | 'flight-results' | 'official' | 'unavailable'; prefilledFields: string[]; review: string; buttonLabel: string; alternatives: BookingDestination[]; fallback: BookingDestination };
const categoryPages = {
  hotel: { label: '打开酒店频道，手动填写条件', url: 'https://www.trip.com/hotels/?wkp=0' },
  flight: { label: '打开机票频道，手动填写航线', url: 'https://www.trip.com/flights/?wkp=0' },
  train: { label: '打开日本火车票频道，手动选择车站', url: 'https://www.trip.com/trains/japan/?wkp=0' },
  attraction: { label: '打开门票与体验频道，手动查找', url: 'https://www.trip.com/things-to-do/?wkp=0' },
};
export function tripBookingLink(item: Pick<TripBooking, 'kind' | 'city' | 'from' | 'to' | 'name'> & Partial<Pick<TripBooking, 'date' | 'endDate'>>): BookingLink {
  const city = canonical(item.city), from = canonical(item.from), to = canonical(item.to);
  const admission = item.kind === 'attraction' ? admissionForPlace(city, item.name) : undefined;
  const hotel = own(hotelCities, city), flightRoute = own(flightRoutes, `${from}|${to}`), railRoute = own(railRoutes, `${from}|${to}`);
  let path = '', precision = '', located = false, freeEntry = false;
  let entryKind: BookingLink['entryKind'] = 'unavailable';
  let requirement: string | undefined;
  let directUrl: string | undefined, buttonLabel = '选择查询入口';
  let alternatives: BookingDestination[] = [];
  let prefilledFields: string[] = [];
  let review = '日期、人数、成人儿童分类及具体产品需在 Trip.com 核对。';
  if (item.kind === 'hotel' && hotel) {
    located = true;
    if (item.date && item.endDate && searchableDate(item.date, 365) && searchableDate(item.endDate, 365) && item.endDate > item.date) {
      // Form-generated URL verified in a live browser: Sapporo, Dec 18–20 2026.
      path = `/hotels/list?city=${hotel.id}&checkin=${item.date.replaceAll('-', '/')}&checkout=${item.endDate.replaceAll('-', '/')}`;
      entryKind = 'hotel-results'; prefilledFields = ['城市', '入住日期', '退房日期'];
      precision = `已带入${city} · 入住${item.date} · 退房${item.endDate}`;
    } else { path = `/hotels/${hotel.slug}-hotels-list-${hotel.id}/`; entryKind = 'route'; prefilledFields = ['城市']; precision = `已定位${city}酒店列表`; }
    review = `${entryKind === 'hotel-results' ? '' : '未带入日期。'}未带入人数和房间数。网页可能沿用默认或上次条件，请先核对成人、儿童及房间数，再选择酒店。`;
  } else if (item.kind === 'flight' && flightRoute) {
    located = true; path = `/flights/${flightRoute}/`; entryKind = 'route'; prefilledFields = ['出发城市', '到达城市'];
    precision = `已定位${from} → ${to}航线（城市全部机场）`;
    // The official flight form template is verified for Tokyo–Sapporo and Shanghai–Hakodate.
    // Route slugs and city codes come only from reviewed Trip.com pages, never from AI text.
    const [routeSlug, codes] = flightRoute.split('/airfares-');
    const [fromSlug, toSlug] = routeSlug.split('-to-'), [fromCode, toCode] = codes.split('-');
    if (item.date && searchableDate(item.date, 330)) {
      path = `/flights/${routeSlug}/tickets-${codes}/?ddate=${item.date}&flighttype=s&departcityurl=${fromSlug}&arrivalcityurl=${toSlug}&departcitycode=${fromCode}&arrivalcitycode=${toCode}&sort=recommended`;
      entryKind = 'flight-results'; prefilledFields.push('出发日期'); precision += ` · 单程${item.date}`;
    }
    review = `${entryKind === 'flight-results' ? '已带入单程日期，' : '尚未带入日期，'}人数、成人儿童及实际机场需在 Trip.com 核对。`;
  } else if (item.kind === 'train' && railRoute) {
    located = true; path = `/trains/japan/route/${railRoute}/`; entryKind = 'route'; prefilledFields = ['出发城市', '到达城市']; precision = `已定位${from} → ${to}铁路路线`;
    review = '尚未带入日期和人数，请在 Trip.com 核对乘车日期、实际车站、成人儿童和席别。';
  } else if (item.kind === 'attraction') {
    const matches = attractionPages.filter(page => page.city === city && (matchesName(item.name, page.names) || (page.path.includes('nakasu-food-stalls-street-') && /^(?:(?:福[岡冈](?:[県縣县市])?)?中[洲州](?:屋台(?:街|[横橫]丁)?|[食美]食街)|Nakasu(?:FoodStallsStreet|Yatai(?:Yokocho)?))$/i.test(item.name.trim().replace(/\s/g, '')))));
    const sight = matches.length === 1 ? matches[0] : undefined;
    const official = officialAttractionPages.find(page => (page.city === city || page.baseCities?.includes(city)) && matchesName(item.name, page.names));
    if (sight && !official) {
      located = true; freeEntry = Boolean(sight.freeEntry); path = `/travel-guide/attraction/${sight.path}`; entryKind = 'detail'; prefilledFields = ['景点'];
      precision = `已定位${sight.names[0]}（${city}）详情${freeEntry ? ' · 免费进入，附加体验或消费另计' : ' · 是否可售以页面为准'}`;
      review = sight.visitNote || review;
      alternatives = sight.officialLinks ?? [];
    } else if (official) {
      requirement = official.requirement;
      located = true; directUrl = official.url; entryKind = 'official'; precision = official.note; review = '打开官方收费与预约说明，未带入日期和人数；请在官网选择适用票种和使用日期。'; buttonLabel = official.label;
    }
  }
  // Admission is established by official evidence, independently of Trip.com's product availability.
  if (admission) {
    freeEntry = admission.status === 'free';
    if (!located) {
      located = true; directUrl = admission.sources[0].url; entryKind = 'official';
      precision = admission.label; review = admission.note; buttonLabel = '官方参观说明';
    }
  }
  if (!located) {
    // Global keyword search returns hotels for many sight names and cannot search flights.
    // Deliberately return no automatic destination instead of sending users to unrelated results.
    precision = '尚未匹配到准确的预订入口，未查询实时库存。';
    review = '先核对名称、所在城市或路线；可复制条件后在对应频道手动查询。这里不会跳到通用酒店搜索。';
    prefilledFields = [];
  } else if (entryKind !== 'official') {
    buttonLabel = item.kind === 'hotel' ? '查看酒店' : item.kind === 'flight' ? '查询航班' : item.kind === 'train' ? '查询车票' : freeEntry ? '查看参观信息' : '查看景点与票务';
  }

  // Trip.com's iOS association excludes wkp=0 from app universal links.
  return { ...(admission ? { admission } : {}), ...(requirement ? { requirement } : {}), url: located ? directUrl ?? `https://www.trip.com${path}${path.includes('?') ? '&' : '?'}wkp=0` : null, precision, located, entryKind, prefilledFields, review, buttonLabel, alternatives, fallback: categoryPages[item.kind], ...(freeEntry ? { freeEntry } : {}) };
}
export function bookingCriteria(item: TripBooking): string {
  const admission = item.kind === 'attraction' ? admissionForPlace(item.city, item.name) : undefined;
  const party = admission?.status === 'free' ? `${item.people}人` : `${item.people}人（成人/儿童${item.kind === 'hotel' ? '及房间数' : ''}在 ${admission || tripBookingLink(item).entryKind === 'official' ? '官方页面' : 'Trip.com'} 核对）`;
  return [item.kind === 'hotel' ? `${item.city} 酒店` : item.kind === 'attraction' ? `${item.city} ${item.name}` : `${item.from} → ${item.to} ${item.kind === 'flight' ? '机票' : '火车票'}`,
    `${item.kind === 'hotel' ? '入住' : '日期'}：${item.date}${item.kind === 'hotel' ? `；退房：${item.endDate}` : ''}`,
    party].join('\n');
}
