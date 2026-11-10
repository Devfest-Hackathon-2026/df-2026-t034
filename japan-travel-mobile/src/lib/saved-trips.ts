import { getPhotoReplyBlocks, getDayHeading, getScheduleRows, getBudgetEstimate, formatAssistantText } from './assistant-text.ts';
import { budgetTiers, type BudgetTier } from './trip-budget.ts';
import type { BudgetEstimate } from './assistant-text.ts';

export type TripDay = { number: number; title: string; city: string; sights: { name: string; description: string }[]; activities: string[] };
export type TripPlan = { title: string; introduction: string; overview: string; summary: string; days: TripDay[]; budget: BudgetEstimate | null };
export type BookingKind = 'hotel' | 'flight' | 'train' | 'attraction';
export type TripBooking = { id: string; kind: BookingKind; day: number; city: string; from: string; to: string; name: string; date: string; endDate: string; people: number; booked: boolean; dateConfirmedForStartDate?: string };
export type SavedTrip = { id: string; sourceConversationId: string; sourceMessageId: string; createdAt: number; updatedAt: number; title: string; reply: string; startDate: string; bookings: TripBooking[]; budgetTier?: BudgetTier; departureCity?: string };

// Municipalities only. A region such as Hokkaido must never silently mean Sapporo.
const cities = [
  ['東京', '东京', '東京', 'Tokyo'], ['札幌', '札幌', 'Sapporo'], ['京都', '京都', 'Kyoto'], ['大阪', '大阪', 'Osaka'],
  ['函館', '函館', '函馆', 'Hakodate'], ['旭川', '旭川', 'Asahikawa'], ['小樽', '小樽', 'Otaru'], ['千歳', '千歳', '千岁', 'Chitose'],
  ['宇都宮', '宇都宮', '宇都宫', 'Utsunomiya'], ['日光', '日光', 'Nikko'], ['那須塩原', '那須塩原', '那须盐原', 'Nasushiobara'], ['軽井沢', '軽井沢', '轻井泽', 'Karuizawa'], ['長野', '長野', '长野', 'Nagano'], ['新潟', '新潟', 'Niigata'], ['仙台', '仙台', 'Sendai'], ['金沢', '金沢', '金泽', 'Kanazawa'], ['名古屋', '名古屋', 'Nagoya'], ['福岡', '福岡', '福冈', 'Fukuoka'], ['奈良', '奈良', 'Nara'], ['横浜', '横浜', '横滨', 'Yokohama'],
];
export function tripCity(text: string): string {
  const found = cities.filter(([, ...aliases]) => aliases.some(alias => text.toLowerCase().includes(alias.toLowerCase())));
  return found.length === 1 ? found[0][0] : '';
}
// Only explicit departure wording establishes the origin; a destination mention does not.
export function inferDepartureCity(text: string): string {
  const originMatches = [
    ...text.matchAll(/(?:从|從|自|出发地[：:]?|出發地[：:]?)\s*([^，。；\n]{1,30}?)(?:出发|出發|前往|去|乘坐|搭乘|乘车|乘車|乘机|乘機|往返)/g),
    ...text.matchAll(/\b(?:from|departing from|departure city[:：]?|starting in)\s+([A-Za-z ]{2,30}?)(?=\s+(?:to|for|by|on|with)\b|[,.;\n]|$)/gi),
    ...text.matchAll(/([^\s、。；\n]{1,20}?)(?:から出発|発で|発の|から)/g),
  ].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const found = originMatches
    .map(match => {
      const foreign = [['上海', '上海', 'Shanghai'], ['北京', '北京', 'Beijing'], ['广州', '广州', '廣州', 'Guangzhou'], ['哈尔滨', '哈尔滨', '哈爾濱', 'Harbin']]
        .filter(([, ...aliases]) => aliases.some(alias => match[1].toLowerCase().includes(alias.toLowerCase()))).map(([city]) => city);
      const candidates = [...new Set([tripCity(match[1]), ...foreign].filter(Boolean))];
      return candidates.length === 1 ? candidates[0] : '';
    }).filter(Boolean);
  return found.length ? found[found.length - 1] : '';
}
export function conversationDeparture(messages: { id: string; role: string; content: string }[], replyId: string): string {
  const index = messages.findIndex(message => message.id === replyId && message.role === 'assistant');
  if (index < 0) return '';
  return messages.slice(0, index).filter(message => message.role === 'user').map(message => inferDepartureCity(message.content)).filter(Boolean).at(-1) || '';
}
export function parseTripPlan(reply: string): TripPlan | null {
  if (!reply || reply.length > 14000) return null;
  const blocks = getPhotoReplyBlocks(reply);
  const days: TripDay[] = [];
  let current: TripDay | undefined;
  let details = !blocks.some(block => block.heading === '行程详情');
  const overview = blocks.find(block => block.heading === '行程规划')?.body ?? '';
  const route = new Map<number, string>();
  let expected = 0;
  for (const line of overview.split('\n')) {
    const m = line.match(/^第\s*(\d{1,2})(?:\s*[–—~～\-至到]\s*(\d{1,2}))?\s*天\s*[：:]\s*(.+)$/);
    if (!m) continue;
    const start = Number(m[1]), end = Number(m[2] ?? m[1]);
    if (start < 1 || end < start || end > 31) return null;
    expected = Math.max(expected, end);
    for (let n = start; n <= end; n++) route.set(n, tripCity(m[3]));
  }
  let summary = '', budget: BudgetEstimate | null = null;
  for (const block of blocks) {
    if (block.heading === '行程详情') { details = true; current = undefined; continue; }
    if (/^(小结|总结)$/.test(block.heading ?? '')) { summary = block.body; current = undefined; continue; }
    if (/^预算/.test(block.heading ?? '')) { budget = getBudgetEstimate(block.body) ?? budget; current = undefined; continue; }
    const day = getDayHeading(block.heading ?? '');
    if (details && day && !/安排$/.test(day.title)) {
      if (day.number !== days.length + 1 || day.number > 31) return null;
      current = { ...day, city: route.get(day.number) || tripCity(day.title), sights: [], activities: [] };
      days.push(current);
    }
    if (!current) continue;
    const rows = getScheduleRows(block.body);
    if (rows) current.activities.push(...rows.map(row => row.label === '活动' ? row.value : `${row.value}（${row.label}）`));
    else if (block.attraction && block.body && !block.photoOnly) current.sights.push({ name: block.attraction, description: block.body });
  }
  if (!days.length || days.some(day => !day.activities.length) || !summary || (expected && expected !== days.length)) return null;
  const destinations = [...new Set(days.map(day => day.city).filter(Boolean))];
  return {
    title: `${destinations.join(' · ') || '日本'} ${days.length}天旅行`,
    introduction: blocks.find(block => !block.heading)?.body ?? '', overview, summary, days, budget,
  };
}
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= '2000-01-01' && value <= '2100-12-31';
}
export function tripDate(start: string, day: number): string {
  if (!validDate(start) || !Number.isInteger(day) || day < 1 || day > 32) return '';
  const date = new Date(`${start}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + day - 1);
  return date.toISOString().slice(0, 10);
}
// Called only by the user's add-to-checklist action, never while rendering.
export function newBookingDraft(trip: SavedTrip, day: TripDay, kind: BookingKind, name = ''): TripBooking {
  const plan = parseTripPlan(trip.reply);
  return { id: `booking-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, kind, day: day.number,
    city: day.city, from: plan?.days[day.number - 2]?.city ?? '', to: day.city, name,
    date: tripDate(trip.startDate, day.number), endDate: kind === 'hotel' ? tripDate(trip.startDate, day.number + 1) : '', people: plan?.budget?.travelers ?? 0, booked: false, dateConfirmedForStartDate: trip.startDate };
}
export function bookingProblem(item: Omit<TripBooking, 'id' | 'booked'>): string {
  if (!['hotel', 'flight', 'train', 'attraction'].includes(item.kind) || !Number.isInteger(item.day) || item.day < 1 || item.day > 31) return '请选择有效的类别和行程天数。';
  if (![item.city, item.from, item.to, item.name].every(value => typeof value === 'string' && value.length <= 100)) return '地点或名称过长，请缩短到100字以内。';
  if (!validDate(item.date)) return '请输入有效日期，例如 2026-12-15。';
  if (!Number.isInteger(item.people) || item.people < 1 || item.people > 99) return '请输入1–99人的出行人数；成人、儿童请在 Trip.com 分别核对。';
  if (item.kind === 'hotel' && (!item.city.trim() || !validDate(item.endDate) || item.endDate <= item.date)) return '请确认住宿城市，退房日期应晚于入住日期。';
  if (item.kind === 'attraction' && (!item.city.trim() || !item.name.trim())) return '请填写景点名称和所在城市。';
  if (item.kind === 'flight' || item.kind === 'train') {
    if (!item.from.trim() || !item.to.trim() || item.from.trim() === item.to.trim()) return '请填写不同的出发城市和到达城市。';
    if (/^(北海道|关东|関東|关西|関西|九州|日本)$/.test(item.from.trim()) || /^(北海道|关东|関東|关西|関西|九州|日本)$/.test(item.to.trim())) return '请把地区细化到城市，例如北海道的札幌或函馆；机场、车站在 Trip.com 核对。';
  }
  return '';
}
export function bookingNeedsDateReview(trip: Pick<SavedTrip, 'startDate'>, item: TripBooking): boolean {
  return item.dateConfirmedForStartDate !== undefined && item.dateConfirmedForStartDate !== trip.startDate;
}
export function dateReviewCount(trip: Pick<SavedTrip, 'startDate' | 'bookings'>): number {
  return trip.bookings.filter(item => bookingNeedsDateReview(trip, item)).length;
}
export function confirmBookingDates(current: SavedTrip, viewed: SavedTrip, item: TripBooking): SavedTrip {
  const latest = current.bookings.find(b => b.id === item.id);
  if (!latest || current.startDate !== viewed.startDate || latest.date !== item.date || latest.endDate !== item.endDate)
    throw Error('日期已变更，请重新查看这项预订后再核对。');
  return { ...current, bookings: current.bookings.map(b => b.id === item.id ? { ...b, dateConfirmedForStartDate: current.startDate } : b) };
}
export function tripContext(trip: SavedTrip): string {
  const plan = parseTripPlan(trip.reply);
  if (!plan) return '';
  const budget = plan.budget;
  return [`请基于这份已保存的旅行版本继续帮我调整，先不要重新生成，等我补充修改要求。`, `名称：${trip.title}`, `出发日期：${trip.startDate || '未定'}`, `出发城市：${trip.departureCity || inferDepartureCity(trip.reply) || '待确认'}`,
    budget ? `人数：${budget.travelers}；预算币种：${budget.currency}；${budgetTiers[trip.budgetTier ?? 0]}全程估算：${budget.items.reduce((sum, row) => sum + row.amounts[trip.budgetTier ?? 0], 0)}；费用范围：${budget.scope}` : '人数和预算尚待确认',
    ...plan.days.map(day => `Day ${day.number}｜${day.title.slice(0, 45)}：${day.activities.join('；').slice(0, 50)}${day.activities.join('；').length > 50 ? '…' : ''}`), `原方案小结：${plan.summary.slice(0, 200)}`].join('\n').slice(0, 3900);
}

const kinds = ['hotel', 'flight', 'train', 'attraction'];
function cleanTrip(value: unknown): SavedTrip {
  if (!value || typeof value !== 'object') throw Error('本机行程格式无法读取，原记录已保留。');
  const t = value as SavedTrip;
  const parsedPlan = typeof t.reply === 'string' ? parseTripPlan(t.reply) : null;
  const text = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;
  if (!text(t.id, 120) || !t.id || !text(t.sourceConversationId, 120) || !text(t.sourceMessageId, 120) ||
    (t.departureCity !== undefined && !text(t.departureCity, 100)) || !text(t.title, 100) || !t.title.trim() || !text(t.reply, 14000) || !parsedPlan ||
    !Number.isFinite(t.createdAt) || !Number.isFinite(t.updatedAt) || t.createdAt <= 0 || t.updatedAt < t.createdAt ||
    (t.budgetTier !== undefined && ![0, 1, 2].includes(t.budgetTier)) || (t.startDate !== '' && !validDate(t.startDate)) || !Array.isArray(t.bookings) || t.bookings.length > 150) throw Error('本机行程格式无法读取，原记录已保留。');
  const ids = new Set<string>();
  const bookings = t.bookings.map(b => {
    if (!b || !text(b.id, 120) || !b.id || ids.has(b.id) || !kinds.includes(b.kind) || bookingProblem(b) ||
      b.day > parsedPlan!.days.length || typeof b.booked !== 'boolean' || !text(b.endDate, 10) || (b.dateConfirmedForStartDate !== undefined && b.dateConfirmedForStartDate !== '' && !validDate(b.dateConfirmedForStartDate))) throw Error('本机预订清单格式无法读取，原记录已保留。');
    ids.add(b.id);
    return { id: b.id, kind: b.kind, day: b.day, city: b.city, from: b.from, to: b.to, name: b.name, date: b.date, endDate: b.endDate, people: b.people, booked: b.booked, dateConfirmedForStartDate: b.dateConfirmedForStartDate ?? t.startDate };
  });
  return { id: t.id, sourceConversationId: t.sourceConversationId, sourceMessageId: t.sourceMessageId, createdAt: t.createdAt, updatedAt: t.updatedAt, title: t.title.trim(), reply: t.reply, startDate: t.startDate, bookings, budgetTier: t.budgetTier ?? 0, departureCity: t.departureCity?.trim() ?? '' };
}
export function createSavedTrips(storage: { read: () => Promise<string | null>; write: (value: string) => Promise<void> }) {
  let queue: Promise<unknown> = Promise.resolve();
  async function read() {
    const raw = await storage.read();
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (data.version !== 1 || !Array.isArray(data.trips) || data.trips.length > 20) throw Error('本机行程版本无法读取，原记录已保留。');
    const trips = data.trips.map(cleanTrip);
    if (new Set(trips.map((t: SavedTrip) => t.id)).size !== trips.length) throw Error('本机行程编号重复，原记录已保留。');
    return trips as SavedTrip[];
  }
  function change<T>(action: (trips: SavedTrip[]) => { trips: SavedTrip[]; result: T }) {
    const task = queue.then(async () => {
      const { trips, result } = action(await read());
      if (trips.length > 20) throw Error('最多保存20份行程，请先删除不需要的方案。');
      const raw = JSON.stringify({ version: 1, trips: trips.map(cleanTrip) });
      if (raw.length > 500000) throw Error('本机行程空间已满，请先整理记录。');
      await storage.write(raw); return result;
    });
    queue = task.catch(() => undefined); return task;
  }
  return {
    async load() { await queue; return read(); },
    save(input: Pick<SavedTrip, 'sourceConversationId' | 'sourceMessageId' | 'title' | 'reply' | 'startDate'> & Pick<Partial<SavedTrip>, 'departureCity'>) {
      return change(trips => {
        const same = trips.find(t => t.sourceConversationId === input.sourceConversationId && t.sourceMessageId === input.sourceMessageId && t.reply === input.reply);
        if (same) return { trips, result: same };
        const now = Date.now();
        const trip = cleanTrip({ ...input, id: `trip-${now}-${Math.random().toString(36).slice(2, 10)}`, createdAt: now, updatedAt: now, bookings: [] });
        return { trips: [trip, ...trips], result: trip };
      });
    },
    update(id: string, edit: (trip: SavedTrip) => SavedTrip) {
      return change(trips => {
        const index = trips.findIndex(t => t.id === id);
        if (index < 0) throw Error('这份行程已删除，请返回行程列表。');
        const original = trips[index];
        const updated = cleanTrip({ ...edit(original), id: original.id, reply: original.reply, sourceConversationId: original.sourceConversationId, sourceMessageId: original.sourceMessageId, createdAt: original.createdAt, updatedAt: Date.now() });
        trips[index] = updated; return { trips, result: updated };
      });
    },
    remove(id: string) { return change(trips => ({ trips: trips.filter(t => t.id !== id), result: undefined })); },
  };
}
export function plainTripText(reply: string) { return formatAssistantText(reply); }
