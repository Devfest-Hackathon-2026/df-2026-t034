import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTripPlan, createSavedTrips, tripDate, validDate, bookingProblem, tripContext, newBookingDraft, bookingNeedsDateReview, dateReviewCount, confirmBookingDates } from '../src/lib/saved-trips.ts';
import { tripBookingLink, bookingCriteria } from '../src/lib/trip-booking-links.ts';

function reply(count = 3, currency = 'JPY') {
  return `从东京出发，轻松体验北海道。\n\n行程规划\n第1天：東京\n第2–${count}天：札幌\n\n行程详情\n\n${Array.from({ length: count }, (_, i) => `Day ${i + 1}｜${i ? '札幌散步' : '东京漫步'}\n\n**${i ? '大通公園' : '浅草寺'}**\n这里可以步行欣赏风景。\n\n当日安排\n活动｜${i ? '在札幌的大通公園散步' : '前往浅草寺参拜'}\n活动｜在市中心品尝当地小吃`).join('\n\n')}\n\n小结\n东京到札幌，按顺序游玩。\n\n预算对比\n币种｜${currency}\n人数｜2\n范围｜两人全程住宿、交通及餐饮估算，不含购物\n住宿｜20000｜40000｜60000\n交通｜10000｜20000｜30000\n餐饮｜5000｜10000｜20000`;
}
const flight = { id: 'booking-1', kind: 'flight', day: 2, city: '札幌', from: '东京', to: '札幌', name: '', date: '2026-12-16', endDate: '', people: 2, booked: false };
const input = (content = reply()) => ({ sourceConversationId: 'conversation1', sourceMessageId: 'assistant1', title: '东京与北海道', reply: content, startDate: '2026-12-15' });
function memory() {
  let raw = null, fail = false;
  return { storage: { read: async () => raw, write: async v => { if (fail) throw Error('disk full'); await new Promise(resolve => setTimeout(resolve, 2)); raw = v; } }, get raw() { return raw; }, set raw(v) { raw = v; }, set fail(v) { fail = v; } };
}
test('full 14-day snapshot retains ordered activities, original summary, city and budget currency', () => {
  const plan = parseTripPlan(reply(14));
  assert.equal(plan.days.length, 14);
  assert.deepEqual(plan.days.map(d => d.number), Array.from({ length: 14 }, (_, i) => i + 1));
  assert.equal(plan.days[0].city, '東京'); assert.equal(plan.days[1].city, '札幌');
  assert.equal(plan.days[13].activities.length, 2);
  assert.equal(plan.days[0].sights[0].name, '浅草寺');
  assert.equal(plan.budget.travelers, 2); assert.equal(plan.budget.currency, 'JPY');
  assert.equal(parseTripPlan(reply(3, 'CNY')).budget.currency, 'CNY');
});
test('clarification, missing day, repeated day, incomplete last day or mismatched overview cannot become complete saved trips', () => {
  assert.equal(parseTripPlan('您想玩多少天？预算多少？'), null);
  assert.equal(parseTripPlan(reply().replace('Day 2｜', 'Day 4｜')), null);
  assert.equal(parseTripPlan(reply().replace('Day 2｜', 'Day 1｜')), null);
  assert.equal(parseTripPlan(reply().replace('第2–3天：札幌', '第2–14天：札幌')), null);
  assert.equal(parseTripPlan(reply().split('小结')[0]), null);
});
test('an unspecified region never becomes an assumed flight destination or lodging city', () => {
  const plan = parseTripPlan(reply().replaceAll('札幌', '北海道'));
  assert.equal(plan.days[1].city, '');
  assert.match(bookingProblem({ ...flight, to: '北海道' }), /细化到城市/);
});
test('invalid dates and party sizes are blocked; UTC date offsets span months and leap years', () => {
  assert.equal(validDate('2026-02-30'), false); assert.equal(validDate('2028-02-29'), true);
  assert.equal(validDate('2026-2-1'), false); assert.equal(tripDate('2026-12-31', 2), '2027-01-01');
  assert.equal(tripDate('2028-02-28', 3), '2028-03-01'); assert.equal(tripDate('', 1), '');
  assert.match(bookingProblem({ ...flight, people: 0 }), /人数/);
  assert.match(bookingProblem({ ...flight, kind: 'hotel', endDate: flight.date }), /退房/);
  assert.match(bookingProblem({ ...flight, from: '札幌' }), /不同/);
});
test('duplicate save is idempotent, changed reply is a separate version, reload does not depend on chat or providers', async () => {
  const mem = memory(), store = createSavedTrips(mem.storage);
  const [a, b] = await Promise.all([store.save(input()), store.save(input())]);
  assert.equal(a.id, b.id); assert.equal((await store.load()).length, 1);
  await store.save(input(reply(4)));
  const restored = await createSavedTrips(mem.storage).load(); assert.equal(restored.length, 2); assert.equal(restored[1].reply, reply());
  assert.doesNotMatch(mem.raw, /googleusercontent|apiKey|authorization|photoUri/);
});
test('queued checklist and settings writes preserve both changes and never shift already saved booking dates', async () => {
  const mem = memory(), store = createSavedTrips(mem.storage), trip = await store.save(input());
  await Promise.all([
    store.update(trip.id, t => ({ ...t, bookings: [...t.bookings, flight] })),
    store.update(trip.id, t => ({ ...t, title: '新版名称', startDate: '2027-01-01' })),
  ]);
  const [restored] = await store.load(); assert.equal(restored.title, '新版名称'); assert.equal(restored.bookings[0].date, flight.date);
  assert.equal(restored.bookings[0].booked, false);
  tripBookingLink(restored.bookings[0]); bookingCriteria(restored.bookings[0]);
  assert.equal((await store.load())[0].bookings[0].booked, false);
});
test('failed write does not destroy old snapshot and later edits can succeed; corrupt or future storage is never overwritten', async () => {
  const mem = memory(), store = createSavedTrips(mem.storage), trip = await store.save(input());
  const before = mem.raw; mem.fail = true;
  await assert.rejects(store.update(trip.id, t => ({ ...t, title: 'failed' })));
  assert.equal(mem.raw, before); mem.fail = false;
  await store.update(trip.id, t => ({ ...t, title: 'saved' })); assert.equal((await store.load())[0].title, 'saved');
  mem.raw = '{"version":99,"trips":[]}'; const corrupt = mem.raw;
  await assert.rejects(store.save(input())); assert.equal(mem.raw, corrupt);
});
test('official links use HTTPS allowlist and opt out of app links; malicious/unknown cities cannot change host or masquerade as a searched route', () => {
  const link = tripBookingLink(flight), url = new URL(link.url);
  assert.equal(url.hostname, 'www.trip.com'); assert.equal(url.protocol, 'https:'); assert.equal(url.searchParams.get('wkp'), '0');
  assert.equal(url.pathname, '/flights/tokyo-to-sapporo/tickets-tyo-spk/'); assert.equal(link.located, true);
  assert.equal(url.searchParams.get('ddate'), flight.date); assert.doesNotMatch(link.url, /adult|token|key/);
  assert.equal(tripBookingLink({ ...flight, from: 'https://evil.test', to: '北海道' }).located, false);
  assert.equal(tripBookingLink({ ...flight, kind: 'hotel', city: '札幌' }).located, true);
  assert.equal(tripBookingLink({ ...flight, kind: 'hotel', city: '未知城市' }).located, false);
});
test('continue discussion creates a bounded draft with saved version conditions and all day numbers, without mutating bookings or messages', async () => {
  const store = createSavedTrips(memory().storage), trip = await store.save(input(reply(14)));
  const before = JSON.stringify(trip), context = tripContext(trip);
  assert.match(context, /Day 14/); assert.match(context, /人数：2/); assert.match(context, /JPY/); assert.ok(context.length <= 4000);
  assert.equal(JSON.stringify(trip), before);
});

test('booking drafts use the selected actual day and saved start date, not an assumed hotel or a purchased order', async () => {
  const store = createSavedTrips(memory().storage), trip = await store.save(input());
  const day = parseTripPlan(trip.reply).days[1];
  const draft = newBookingDraft(trip, day, 'flight');
  assert.equal(draft.from, '東京'); assert.equal(draft.to, '札幌'); assert.equal(draft.date, '2026-12-16'); assert.equal(draft.booked, false);
  const hotel = newBookingDraft(trip, day, 'hotel'); assert.equal(hotel.endDate, '2026-12-17');
});
test('long-plan continuation preserves every day label even when individual activities need shortening', async () => {
  const store = createSavedTrips(memory().storage), trip = await store.save(input(reply(31)));
  const context = tripContext(trip); assert.ok(context.length <= 4000); assert.match(context, /Day 31/);
});

test('Fukuoka Nakasu aliases open the reviewed exact free-entry attraction, never the generic booking homepage', () => {
  for (const name of ['中州屋台街', '中洲屋台街', '中洲屋台横丁', '福岡県中洲屋台橫丁', 'Nakasu Food Stalls Street']) {
    const link = tripBookingLink({ ...flight, kind: 'attraction', city: '福冈', name });
    assert.equal(link.located, true, name); assert.equal(link.freeEntry, true, name);
    assert.match(new URL(link.url).pathname, /fukuoka\/nakasu-food-stalls-street-145039597/);
  }
  assert.equal(tripBookingLink({ ...flight, kind: 'attraction', city: '東京', name: '中洲屋台街' }).located, false);
});

test('unmapped attractions do not auto-open global hotel search or pretend a product has been found', () => {
  const link = tripBookingLink({ ...flight, kind: 'attraction', city: '京都', name: '未收录景点 & x=1' });
  assert.equal(link.url, null); assert.equal(link.entryKind, 'unavailable'); assert.equal(link.located, false);
  assert.deepEqual(link.prefilledFields, []); assert.equal(new URL(link.fallback.url).pathname, '/things-to-do/');
  assert.match(link.fallback.label, /手动/); assert.match(link.precision, /尚未匹配/);
});


test('budget selection persists per trip after reload and continuation uses the selected tier and original currency', async () => {
  const mem = memory(), store = createSavedTrips(mem.storage);
  const a = await store.save(input()), b = await store.save({ ...input(reply(3, 'CNY')), sourceMessageId: 'different' });
  const selected = await store.update(a.id, t => ({ ...t, budgetTier: 2 }));
  const reloaded = await createSavedTrips(mem.storage).load();
  assert.equal(reloaded.find(t => t.id === a.id).budgetTier, 2); assert.equal(reloaded.find(t => t.id === b.id).budgetTier, 0);
  assert.match(tripContext(selected), /豪华型全程估算：110000/); assert.match(tripContext(selected), /预算币种：JPY/);
  mem.fail = true;
  await assert.rejects(store.update(a.id, t => ({ ...t, budgetTier: 1 })), /disk full/);
  assert.equal((await store.load()).find(t => t.id === a.id).budgetTier, 2);
});
test('legacy records normalize additive fields safely; date edits flag existing bookings without moving dates or unchecking them', async () => {
  const mem = memory(), store = createSavedTrips(mem.storage);
  const trip = await store.save(input()); await store.update(trip.id, t => ({ ...t, bookings: [{ ...flight, booked: true }, { ...flight, id: 'stay', kind: 'hotel', endDate: '2026-12-20' }] }));
  const legacy = JSON.parse(mem.raw); delete legacy.trips[0].budgetTier;
  legacy.trips[0].bookings.forEach(b => delete b.dateConfirmedForStartDate); mem.raw = JSON.stringify(legacy);
  const loaded = (await store.load())[0]; assert.equal(loaded.budgetTier, 0); assert.equal(dateReviewCount(loaded), 0);
  const renamed = await store.update(trip.id, t => ({ ...t, title: '改个名字' })); assert.equal(dateReviewCount(renamed), 0);
  const shifted = await store.update(trip.id, t => ({ ...t, startDate: '2026-12-22' }));
  assert.equal(dateReviewCount(shifted), 2); assert.equal(shifted.bookings[0].booked, true);
  assert.equal(shifted.bookings[0].date, '2026-12-16'); assert.equal(shifted.bookings[1].endDate, '2026-12-20');
  const toggled = await store.update(trip.id, t => ({ ...t, bookings: t.bookings.map(b => ({ ...b, booked: !b.booked })) }));
  assert.equal(dateReviewCount(toggled), 2); // completion does not acknowledge dates
  const confirmed = await store.update(trip.id, t => confirmBookingDates(t, toggled, toggled.bookings[0]));
  assert.equal(dateReviewCount(confirmed), 1); assert.equal(confirmed.bookings[0].date, flight.date);
  assert.equal(confirmed.bookings[0].booked, false);
  assert.equal(dateReviewCount((await createSavedTrips(mem.storage).load())[0]), 1);
  assert.throws(() => confirmBookingDates({ ...confirmed, startDate: '' }, confirmed, confirmed.bookings[0]), /日期已变更/);
  assert.throws(() => confirmBookingDates({ ...confirmed, bookings: [{ ...confirmed.bookings[0], date: '2026-12-25' }] }, confirmed, confirmed.bookings[0]), /日期已变更/);
  mem.fail = true; await assert.rejects(store.update(trip.id, t => confirmBookingDates(t, confirmed, confirmed.bookings[1])), /disk full/);
  assert.equal(dateReviewCount((await store.load())[0]), 1);
});
test('reverting trip date clears only matching baseline warnings; unset dates and newly created items stay honest', async () => {
  const store = createSavedTrips(memory().storage), trip = await store.save(input());
  await store.update(trip.id, t => ({ ...t, bookings: [{ ...flight, dateConfirmedForStartDate: t.startDate }] }));
  const unset = await store.update(trip.id, t => ({ ...t, startDate: '' })); assert.equal(bookingNeedsDateReview(unset, unset.bookings[0]), true);
  const restored = await store.update(trip.id, t => ({ ...t, startDate: trip.startDate })); assert.equal(dateReviewCount(restored), 0);
});
test('new Trip.com catalog matches exact municipalities, preserves route direction, and declares only verified prefills', () => {
  const hotel = tripBookingLink({ ...flight, kind: 'hotel', city: 'Nagoya', date: '2026-12-18', endDate: '2026-12-20' });
  const h = new URL(hotel.url); assert.equal(h.searchParams.get('city'), '360'); assert.equal(h.searchParams.get('checkin'), '2026/12/18'); assert.equal(h.searchParams.get('checkout'), '2026/12/20');
  assert.equal(h.searchParams.get('adult'), null); assert.equal(h.searchParams.get('crn'), null); assert.equal(hotel.entryKind, 'hotel-results'); assert.match(hotel.review, /未带入人数和房间数/);
  const dated = tripBookingLink(flight); assert.equal(new URL(dated.url).searchParams.get('ddate'), flight.date); assert.equal(dated.entryKind, 'flight-results');
  const reversed = tripBookingLink({ ...flight, from: '札幌', to: '東京' }); assert.match(reversed.url, /sapporo-to-tokyo/); assert.equal(reversed.entryKind, 'flight-results'); assert.ok(reversed.prefilledFields.includes('出发日期'));
  assert.equal(tripBookingLink({ ...flight, from: '京都' }).located, false);
  assert.equal(tripBookingLink({ ...flight, to: '北海道' }).located, false);
  const temple = tripBookingLink({ ...flight, kind: 'attraction', city: '京都', name: '清水寺' }); assert.equal(temple.entryKind, 'detail'); assert.match(temple.url, /78812/);
  assert.equal(tripBookingLink({ ...flight, kind: 'attraction', city: '東京', name: '清水寺' }).located, false);
  const park = tripBookingLink({ ...flight, kind: 'attraction', city: '札幌', name: '大通公園' }); assert.equal(park.freeEntry, true);
  const unknown = tripBookingLink({ ...flight, kind: 'hotel', city: 'https://evil.example/?x=1' }); assert.equal(unknown.url, null); assert.equal(new URL(unknown.fallback.url).hostname, 'www.trip.com'); assert.equal(unknown.entryKind, 'unavailable');
});
