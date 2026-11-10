import { getLanguage, intlLanguage } from './i18n/core.ts';
import type { BudgetTier } from './trip-budget.ts';
import { discoveryCover, type DiscoveryCover } from './discovery-covers.ts';
import { photoNameAppears } from './place-photos.ts';
import { tripDate, validDate, type BookingKind, type SavedTrip, type TripBooking, type TripDay, type TripPlan } from './saved-trips.ts';

const normalize = (text: string) => text.normalize('NFKC').replace(/东京/g, '東京').replace(/札幌市/g, '札幌').replace(/福冈/g, '福岡').replace(/中州/g, '中洲').replace(/\s/g, '').toLowerCase();
const flightActivity = /航班|乘机|乘機|乘飞机|乘飛機|搭乘飞机|搭乘飛機|飞往|飛往|飞抵|飛抵|早班机|早班機|国内航线|國內航線|flight|fly to|flying|plane|飛行機|フライト/i;
const railActivity = /新干线|新幹線|城际|城際|特急列车|特急列車|JR.*(?:列车|列車|电车|電車)|(?:列车|列車).*JR|train|rail|shinkansen|電車|新幹線/i;
const stayActivity = /入住|住宿|安顿|安頓|(?:回到|返回|回|前往|抵达|抵達).{0,12}(?:酒店|旅馆|旅館|民宿).{0,10}(?:休息|安顿|安頓|办理|辦理)|(?:酒店|旅馆|旅館).{0,10}(?:办理入住|辦理入住)|hotel|check.in|accommodation|lodging|ホテル|宿泊/i;
export type BookingHint = { kind: BookingKind; name: string };
export type DayActivity = { index: number; text: string; sights: TripDay['sights']; bookings: TripBooking[]; hints: BookingHint[] };
const mentions = (name: string, text: string) => Boolean(name.trim()) && (photoNameAppears(name, text) || normalize(text).includes(normalize(name)));
export function dayPresentation(day: TripDay, bookings: TripBooking[], date = '') {
  // An already saved multi-night stay can apply to later days without creating
  // another booking. Require its dates and an explicit city/return-stay match.
  const applicable = bookings.filter(item => item.day === day.number || (item.kind === 'hotel' && validDate(date) && date >= item.date && date < item.endDate &&
    ((day.city && normalize(item.city) === normalize(day.city)) || day.activities.some(text => stayActivity.test(text) && mentions(item.city, text)))));
  const rows: DayActivity[] = day.activities.map((text, index) => ({ index, text, sights: [], bookings: [], hints: [] }));
  const unplacedSights: TripDay['sights'] = [], unplacedBookings: TripBooking[] = [];
  for (const sight of day.sights) {
    const row = rows.find(row => mentions(sight.name, row.text));
    if (row) row.sights.push(sight); else unplacedSights.push(sight);
  }
  for (const booking of applicable) {
    let row: DayActivity | undefined;
    if (booking.kind === 'attraction') row = rows.find(row => mentions(booking.name, row.text));
    else if (booking.kind === 'hotel') row = [...rows].reverse().find(row => stayActivity.test(row.text));
    else {
      const matches = rows.filter(row => (booking.kind === 'flight' ? flightActivity : railActivity).test(row.text));
      row = matches.find(row => mentions(booking.from, row.text) || mentions(booking.to, row.text)) ?? matches[0];
    }
    if (row) row.bookings.push(booking); else unplacedBookings.push(booking);
  }
  let suggestedFlight = false, suggestedRail = false, suggestedStay = false;
  for (const row of rows) {
    if (flightActivity.test(row.text) && !suggestedFlight && !applicable.some(item => item.kind === 'flight')) {
      row.hints.push({ kind: 'flight', name: '' }); suggestedFlight = true;
    }
    if (railActivity.test(row.text) && !suggestedRail && !applicable.some(item => item.kind === 'train')) {
      row.hints.push({ kind: 'train', name: '' }); suggestedRail = true;
    }
    // Only attach a lodging suggestion where the original text mentions lodging;
    // a sightseeing city does not establish an overnight stay.
    if (stayActivity.test(row.text) && !suggestedStay && !applicable.some(item => item.kind === 'hotel')) {
      row.hints.push({ kind: 'hotel', name: '' }); suggestedStay = true;
    }
    for (const sight of row.sights) if (!applicable.some(item => item.kind === 'attraction' && mentions(item.name, sight.name))) row.hints.push({ kind: 'attraction', name: sight.name });
  }
  return { rows, unplacedSights, unplacedBookings };
}
export function tripCover(plan: TripPlan): { name: string; cover: DiscoveryCover } | null {
  for (const day of plan.days) for (const sight of day.sights) {
    const cover = discoveryCover({ name: sight.name, city: day.city });
    if (cover) return { name: sight.name, cover };
  }
  return null;
}
export function checklistCounts(bookings: TripBooking[]) {
  const completed = bookings.filter(item => item.booked).length;
  return { pending: bookings.length - completed, completed, total: bookings.length };
}
export function shortDate(value: string, weekday = false) {
  if (!validDate(value)) return '日期待定';
  const date = new Date(`${value}T00:00:00Z`);
  if (getLanguage() !== 'zh') return new Intl.DateTimeFormat(intlLanguage(getLanguage()), { month: 'short', day: 'numeric', ...(weekday ? { weekday: 'short' as const } : {}), timeZone: 'UTC' }).format(date);
  return `${date.getUTCMonth() + 1}月${date.getUTCDate()}日${weekday ? ` 周${'日一二三四五六'[date.getUTCDay()]}` : ''}`;
}
export function tripDateRange(trip: SavedTrip, days: number) {
  if (!validDate(trip.startDate)) return '出发日期未定';
  const end = tripDate(trip.startDate, days);
  const format = (value: string) => value.slice(5).replace('-', '.');
  return trip.startDate.slice(0, 4) === end.slice(0, 4) ? `${trip.startDate.slice(0, 4)} · ${format(trip.startDate)}—${format(end)}` : `${trip.startDate}—${end}`;
}
export function budgetSummary(plan: TripPlan, tier: BudgetTier = 0) {
  if (!plan.budget) return null;
  const total = plan.budget.items.reduce((sum, item) => sum + item.amounts[tier], 0);
  return { total, perPerson: total / plan.budget.travelers, travelers: plan.budget.travelers, currency: plan.budget.currency === 'JPY' ? '日元' : '人民币' };
}
export function bookingHeading(item: TripBooking) {
  return item.kind === 'flight' || item.kind === 'train' ? `${item.from} → ${item.to}` : item.kind === 'hotel' ? `${item.city}住宿` : item.name;
}
export function bookingDateNote(item: TripBooking) {
  return item.kind === 'hotel' ? `${shortDate(item.date)}—${shortDate(item.endDate)} · ${item.people}人` : `${shortDate(item.date)} · ${item.people}人`;
}
