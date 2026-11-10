import { tripBookingLink } from './trip-booking-links.ts';
import { bookingProblem, inferDepartureCity, parseTripPlan, tripCity, tripDate, type SavedTrip, type TripBooking, type TripDay } from './saved-trips.ts';

export type PreparationSuggestion = { id: string; title: string; reason: string; draft: TripBooking; problem: string };
const normalize = (text: string) => text.normalize('NFKC').replace(/东京/g, '東京').replace(/宇都宫/g, '宇都宮').replace(/函馆/g, '函館').replace(/福冈/g, '福岡').replace(/\s/g, '').toLowerCase();
const same = (a: string, b: string) => Boolean(a && b) && normalize(a) === normalize(b);
const railPairs = new Set(['東京|宇都宮', '東京|日光', '東京|那須塩原', '宇都宮|日光', '東京|軽井沢', '東京|長野', '東京|新潟', '東京|仙台', '東京|名古屋', '東京|京都', '東京|大阪', '大阪|京都', '京都|奈良', '大阪|奈良']);
const railPreferred = (from: string, to: string) => railPairs.has(`${from}|${to}`) || railPairs.has(`${to}|${from}`);
const flight = /(?:乘机|乘機|搭乘飞机|搭乘飛機|乘飞机|乘飛機|飞往|飛往|飞抵|飛抵|航班|早班机|早班機|fly to|flight to|flight from|take a flight|flying to|arrive by air|飛行機|フライト|航空便)/i;
const rail = /新干线|新幹線|特急|JR|城际列车|城際列車|火车|火車|电车|電車|列车|列車|train|rail|shinkansen|電車|列車|新幹線/i;
const road = /自驾|自駕|开车|開車|租车|租車|包车|包車|高速巴士|长途巴士|長途巴士|self.drive|drive to|driving|rental car|coach|highway bus|自家用車|レンタカー|車で|高速バス/i;
const ski = /滑雪|スキー|スノーボード|ski(?:ing)?|snowboard/i;
const skipSki = /不(?:去|要|安排|用|需)?滑雪|取消滑雪|不滑雪|只(?:参观|參觀|看雪|拍照)|仅(?:参观|看雪)|no skiing|not ski|without skiing|sightseeing only|スキーはしない|滑らない|滑りません|見学のみ/i;
const rentalOwned = /自带(?:雪具|装备|裝備|雪板|滑雪板|雪服)|自備(?:雪具|裝備)|已(?:有|租|备好|備好).{0,8}(?:雪具|装备|裝備|雪板|雪服)|不用租|不租|无需租|無需租|bring.{0,20}(?:own|equipment)|own ski|no rental|持参|レンタル不要/i;
function hash(text: string) { let n = 2166136261; for (const char of text) n = Math.imul(n ^ char.charCodeAt(0), 16777619); return (n >>> 0).toString(36); }
function routeMode(from: string, to: string, text: string): 'train' | 'flight' | null {
  const affirmative = text.replace(/(?:不|无需|無需)(?:自驾|自駕|开车|開車|租车|租車|包车|包車)/g, '');
  if (road.test(affirmative)) return null;
  if (railPreferred(from, to)) return 'train';
  if (flight.test(text)) return 'flight';
  if (rail.test(text)) return 'train';
  return null; // Unknown transport is a question, never an invented flight.
}
function lodgingCity(day: TripDay) {
  for (const activity of [...day.activities].reverse()) {
    const match = activity.match(/(?:返回|回到|回|前往)([^，。；]{1,20}?)(?:酒店|旅馆|旅館|民宿)/);
    if (match && tripCity(match[1])) return tripCity(match[1]);
    const localized = activity.match(/(?:return to|back to)\s+(.{1,35}?)(?:hotel|accommodation|lodging)/i) ?? activity.match(/(.{1,20}?)の(?:ホテル|宿)に(?:戻|帰)/);
    if (localized && tripCity(localized[1])) return tripCity(localized[1]);
  }
  return day.city;
}
function matchesSaved(item: TripBooking, saved: TripBooking) {
  if (item.kind !== saved.kind) return false;
  if (item.kind === 'hotel') return same(item.city, saved.city) && (item.date && saved.date ? item.date >= saved.date && item.endDate <= saved.endDate : item.day === saved.day);
  if (item.day !== saved.day) return false;
  return item.kind === 'attraction' ? same(item.name, saved.name) && same(item.city, saved.city) : same(item.from, saved.from) && same(item.to, saved.to);
}
export function tripPreparation(trip: SavedTrip): { suggestions: PreparationSuggestion[]; questions: string[] } {
  const plan = parseTripPlan(trip.reply);
  if (!plan) return { suggestions: [], questions: [] };
  const origin = tripCity(trip.departureCity || '') || trip.departureCity || inferDepartureCity(plan.introduction);
  const suggestions: PreparationSuggestion[] = [], questions: string[] = [];
  if (!origin) questions.push('出发城市尚未确定，请补充后再整理往返交通。');
  const add = (draft: TripBooking, title: string, reason: string) => {
    if (trip.bookings.some(saved => matchesSaved(draft, saved))) return;
    const id = `suggestion-${hash([draft.kind, draft.day, draft.city, draft.from, draft.to, draft.name, draft.date, draft.endDate, draft.people].join('|'))}`;
    if (!suggestions.some(s => s.id === id)) suggestions.push({ id, title, reason, draft: { ...draft, id }, problem: bookingProblem(draft) });
  };
  const base = (day: TripDay, kind: TripBooking['kind']): TripBooking => ({ id: '', kind, day: day.number, city: day.city, from: '', to: '', name: '', date: tripDate(trip.startDate, day.number), endDate: '', people: plan.budget?.travelers ?? 0, booked: false, dateConfirmedForStartDate: trip.startDate });
  const route = (from: string, to: string, day: TripDay, text: string, returning = false) => {
    if (!from || !to || same(from, to)) return;
    if (trip.bookings.some(b => (b.kind === 'flight' || b.kind === 'train') && b.day === day.number && same(b.from, from) && same(b.to, to))) return;
    if (/不(?:坐|乘|搭乘)(?:飞机|飛機)/.test(text) && !railPreferred(from, to)) { questions.push(`请确认${from} → ${to}的陆路交通方式。`); return; }
    const mode = routeMode(from, to, text);
    if (!mode) { if (!road.test(text)) questions.push(`${from} → ${to}的交通方式尚不明确，请确认车票、航班或其他方式。`); return; }
    add({ ...base(day, mode), from, to }, `${returning ? '返程 · ' : ''}${from} → ${to}${mode === 'train' ? '车票' : '机票'}`,
      railPreferred(from, to) ? '这段路线优先核对铁路，未默认推荐机票；具体班次和席别在网站确认。' : '从当天交通安排识别，未选择具体班次或机场。');
  };
  let previous = origin;
  for (const day of plan.days) {
    // Only the transport portion before arrival establishes the intercity mode;
    // an airport on another day or local subway later that day cannot choose it.
    const text = day.activities.join('；');
    if (day.city && previous && !same(previous, day.city)) {
      const transport = day.activities.find(a => (normalize(a).includes(normalize(previous)) && normalize(a).includes(normalize(day.city))) || flight.test(a)) ?? day.activities[0] ?? '';
      route(previous, day.city, day, transport);
    }
    if (day.city) previous = day.city;
    for (const sight of day.sights) {
      const activity = day.activities.filter(a => normalize(a).includes(normalize(sight.name))).join('；');
      const context = `${sight.name} ${sight.description} ${activity}`;
      if (ski.test(context) && !skipSki.test(activity)) {
        add({ ...base(day, 'attraction'), name: `${sight.name} 雪票 / 缆车票`.slice(0, 100) }, `${sight.name} · 雪票 / 缆车票`, '滑雪活动通常需要核对雪票、缆车及营业季；可能含在套餐内，请勿重复购买。');
        if (!rentalOwned.test(`${plan.introduction} ${text}`)) add({ ...base(day, 'attraction'), name: `${sight.name} 雪具 / 雪服租赁`.slice(0, 100) }, `${sight.name} · 装备租赁`, '如未自带装备，核对雪板、雪靴、雪服及尺码；只是建议，不代表必须租赁。');
      } else if (!tripBookingLink({ kind: 'attraction', city: day.city, name: sight.name, from: '', to: '' }).freeEntry && !skipSki.test(activity) && !trip.bookings.some(b => b.kind === 'attraction' && b.day === day.number && same(b.name, sight.name) && same(b.city, day.city))) {
        add({ ...base(day, 'attraction'), name: sight.name }, `${sight.name} · 参观 / 门票要求`, '先核对是否免费、需预约或需购票；并非每个景点都需要门票。');
      }
    }
    if (day.city === '函館' && day.activities.some(a => /函[館馆]山/.test(a) && /(?:乘坐|搭乘|乘).{0,15}(?:缆车|纜車)|ロープウェイ|ropeway/i.test(a) && !/不(?:乘|坐|用)|徒步|步行上山/.test(a))) {
      add({ ...base(day, 'attraction'), name: '函館山ロープウェイ' }, '函馆山 · 缆车票', '当天明确安排乘缆车上山，缆车票与免费展望台参观分开核对。');
    }
    // A ski activity may have no separate highlighted attraction block.
    const unnamedSki = day.activities.find(a => ski.test(a) && !skipSki.test(a));
    if (unnamedSki && !day.sights.some(s => ski.test(s.name) || normalize(unnamedSki).includes(normalize(s.name)))) questions.push(`Day ${day.number}有滑雪安排，但雪场名称未明确，请确认雪场后查询雪票与装备。`);
  }
  // Group only uncovered nights. A one-night booking cannot hide a missing second night.
  const coveredNight = (day: TripDay, city: string) => trip.bookings.some(b => {
    if (b.kind !== 'hotel' || !same(b.city, city)) return false;
    const nights = Math.max(1, (Date.parse(b.endDate) - Date.parse(b.date)) / 86400000);
    return (tripDate(trip.startDate, day.number) >= b.date && tripDate(trip.startDate, day.number) < b.endDate) ||
      (b.dateConfirmedForStartDate !== undefined && b.dateConfirmedForStartDate !== trip.startDate && day.number >= b.day && day.number < b.day + nights);
  });
  for (let i = 0; i < plan.days.length - 1;) {
    const day = plan.days[i], city = lodgingCity(day);
    if (!city) { questions.push(`Day ${day.number}的过夜城市待确认。`); i++; continue; }
    if (coveredNight(day, city)) { i++; continue; }
    if (day.activities.some(a => /住朋友家|住亲戚家|住親戚家|返回家中|回家休息|不用订酒店|无需住宿|無需住宿|stay with friends|stay with family|return home|no hotel|友人宅|実家|自宅に|ホテル不要/i.test(a))) { i++; continue; }
    if (same(city, origin) && !day.activities.some(a => /酒店|旅馆|旅館|民宿|住宿|过夜|過夜|hotel|accommodation|lodging|overnight|ホテル|旅館|宿泊/i.test(a))) { i++; continue; }
    let j = i + 1;
    while (j < plan.days.length - 1 && same(lodgingCity(plan.days[j]), city) && !coveredNight(plan.days[j], city) && !plan.days[j].activities.some(a => /住朋友家|住亲戚家|住親戚家|返回家中|回家休息|不用订酒店|无需住宿|無需住宿|stay with friends|stay with family|return home|no hotel|友人宅|実家|自宅に|ホテル不要/i.test(a))) j++;
    const hotel: TripBooking = { ...base(day, 'hotel'), city, endDate: tripDate(trip.startDate, plan.days[j].number) };
    add(hotel, `${city} · ${j - i}晚住宿`, '按相邻日期的城市及返回住宿文字整理；过夜地点需确认，往返游玩城市不自动算住宿。');
    i = j;
  }
  const last = plan.days[plan.days.length - 1];
  if (origin && previous && !same(previous, origin)) {
    const finalText = last.activities.filter(a => /返程|返回|回到|回家|帰宅|帰路|帰国|戻る|return|back to|go home/i.test(a)).join('；');
    if (finalText) route(previous, origin, last, finalText, true);
    else questions.push(`是否从${previous}返回${origin}尚未确定，未自动添加返程票。`);
  }
  return { suggestions, questions: [...new Set(questions)] };
}
export function acceptPreparation(trip: SavedTrip, ids: string[]): SavedTrip {
  const { suggestions } = tripPreparation(trip);
  const selected = suggestions.filter(s => ids.includes(s.id));
  if (selected.length !== new Set(ids).size) throw Error('行程或清单已变化，请重新查看建议后确认。');
  if (selected.some(s => s.problem)) throw Error('请先补充日期、人数或地点，再确认准备事项。');
  return { ...trip, bookings: [...trip.bookings, ...selected.map(s => s.draft)] };
}
