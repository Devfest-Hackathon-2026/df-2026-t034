import test from 'node:test';
import assert from 'node:assert/strict';
import { tripBookingLink } from '../src/lib/trip-booking-links.ts';
import { tripPreparation, acceptPreparation } from '../src/lib/trip-preparation.ts';
import { inferDepartureCity, conversationDeparture, parseTripPlan, createSavedTrips } from '../src/lib/saved-trips.ts';
function fixture({ origin = '東京', city = '宇都宮', activity = '前往ハンターマウンテン塩原体验滑雪', introduction = '从东京出发，游览宇都宫。', sights = '**ハンターマウンテン塩原**\n滑雪场，设有雪道与缆车。' } = {}) {
  const reply = `${introduction}\n\n行程规划\n第1–3天：${city}\n\n行程详情\n\nDay 1｜${city}抵达\n\n当日安排\n活动｜从东京出发前往${city}\n活动｜在${city}酒店入住\n\nDay 2｜滑雪体验\n\n${sights}\n\n当日安排\n活动｜${activity}\n活动｜返回${city}酒店休息\n\nDay 3｜返回东京\n\n当日安排\n活动｜搭乘电车返回东京\n\n小结\n三天两夜轻松旅行。\n\n预算对比\n币种｜JPY\n人数｜2\n范围｜两人交通住宿及活动估算\n住宿｜10000｜20000｜30000\n车票｜8000｜10000｜12000\n餐饮｜4000｜8000｜12000`;
  return { id: 'test', sourceConversationId: 'chat', sourceMessageId: 'reply', title: '宇都宫三天两夜', createdAt: 1, updatedAt: 1, startDate: '2026-12-18', departureCity: origin, reply, bookings: [] };
}
test('explicit origins are recognized without assuming a mentioned destination is the origin', () => {
  assert.equal(inferDepartureCity('帮我安排宇都宫三天'), '');
  assert.equal(inferDepartureCity('从东京出发，去宇都宫三天'), '東京');
  assert.equal(inferDepartureCity('从宇都宫去东京'), '宇都宮');
  assert.equal(parseTripPlan(fixture().reply).days[0].city, '宇都宮');
});
test('Tokyo–Utsunomiya produces rail both ways, two consecutive nights, ski passes and equipment without extra calls', () => {
  const trip = fixture(), before = JSON.stringify(trip), { suggestions } = tripPreparation(trip);
  assert.deepEqual(suggestions.filter(s => ['train', 'flight'].includes(s.draft.kind)).map(s => [s.draft.kind, s.draft.from, s.draft.to]), [['train', '東京', '宇都宮'], ['train', '宇都宮', '東京']]);
  const stay = suggestions.find(s => s.draft.kind === 'hotel'); assert.equal(stay.draft.date, '2026-12-18'); assert.equal(stay.draft.endDate, '2026-12-20'); assert.match(stay.title, /2晚/);
  assert.ok(suggestions.some(s => /雪票/.test(s.title))); assert.ok(suggestions.some(s => /装备租赁/.test(s.title)));
  assert.ok(suggestions.every(s => !s.draft.booked && !s.problem)); assert.equal(JSON.stringify(trip), before);
});
test('explicit self-drive does not create rail or flight tickets', () => {
  const trip = fixture(); trip.reply = trip.reply.replace('从东京出发前往宇都宮', '从东京自驾前往宇都宮').replace('搭乘电车返回东京', '自驾返回东京');
  assert.ok(tripPreparation(trip).suggestions.every(s => s.draft.kind !== 'train' && s.draft.kind !== 'flight'));
});
test('known railway corridor is never sold as a flight even when generated text contains an airplane', () => {
  const trip = fixture(); trip.reply = trip.reply.replace('从东京出发前往宇都宮', '从东京乘飞机前往宇都宮');
  assert.ok(tripPreparation(trip).suggestions.every(s => s.draft.kind !== 'flight'));
});
test('already owned equipment does not suppress ski passes; sightseeing without skiing does not create ski pass or rental', () => {
  const owned = tripPreparation(fixture({ introduction: '从东京出发，自带雪具和雪服，不租装备。' })).suggestions;
  assert.ok(owned.some(s => /雪票/.test(s.title))); assert.ok(!owned.some(s => /装备租赁/.test(s.title)));
  const sightseeing = tripPreparation(fixture({ activity: '在ハンターマウンテン塩原只看雪拍照，不滑雪' })).suggestions;
  assert.ok(!sightseeing.some(s => /雪票|装备租赁/.test(s.title)));
});
test('unnamed ski destination is a clarification, not an invented resort or booking URL', () => {
  const result = tripPreparation(fixture({ sights: '', activity: '去滑雪，雪场待定' }));
  assert.ok(result.questions.some(q => /雪场名称未明确/.test(q))); assert.ok(!result.suggestions.some(s => s.draft.kind === 'attraction'));
});
test('uncertain origin, date and party cannot become confirmed bookings; no guessed airport', () => {
  const trip = fixture({ origin: '', introduction: '宇都宫旅行。' }); trip.startDate = ''; trip.reply = trip.reply.replace('预算对比', '其他费用');
  const result = tripPreparation(trip); assert.match(result.questions[0], /出发城市/); assert.ok(result.suggestions.some(s => s.problem));
  assert.throws(() => acceptPreparation(trip, result.suggestions.map(s => s.id)), /补充/); assert.equal(trip.bookings.length, 0);
  const remote = fixture({ origin: '東京', city: '札幌' }); assert.ok(tripPreparation(remote).suggestions.every(s => s.draft.kind !== 'flight'));
});
test('confirmation is atomic, stable and idempotent against repeat taps; completed states are never invented', () => {
  const trip = fixture(), ids = tripPreparation(trip).suggestions.map(s => s.id);
  assert.deepEqual(ids, tripPreparation(trip).suggestions.map(s => s.id));
  const updated = acceptPreparation(trip, ids); assert.equal(updated.bookings.length, ids.length); assert.ok(updated.bookings.every(b => !b.booked));
  assert.equal(tripPreparation(updated).suggestions.length, 0); assert.throws(() => acceptPreparation(updated, ids), /已变化/);
});
test('changed dates invalidate stale confirmation and retain manually saved items', () => {
  const trip = fixture(), ids = tripPreparation(trip).suggestions.map(s => s.id);
  assert.throws(() => acceptPreparation({ ...trip, startDate: '2026-12-25' }, ids), /已变化/);
  const updated = acceptPreparation(trip, ids); updated.bookings[0].booked = true;
  const shifted = { ...updated, startDate: '2026-12-25' };
  assert.ok(!tripPreparation(shifted).suggestions.some(s => s.draft.kind === 'hotel')); assert.equal(updated.bookings[0].booked, true);
});
test('partial hotel coverage leaves the remaining night; day trips reuse explicit return-to lodging city', () => {
  const trip = fixture(), stay = tripPreparation(trip).suggestions.find(s => s.draft.kind === 'hotel').draft;
  trip.bookings = [{ ...stay, endDate: '2026-12-19', booked: true }];
  const missing = tripPreparation(trip).suggestions.filter(s => s.draft.kind === 'hotel'); assert.equal(missing.length, 1); assert.equal(missing[0].draft.date, '2026-12-19');
  const base = fixture(); base.reply = base.reply.replace('第1–3天：宇都宮', '第1天：宇都宮\n第2天：日光\n第3天：宇都宮');
  const hotels = tripPreparation(base).suggestions.filter(s => s.draft.kind === 'hotel'); assert.equal(hotels.length, 1); assert.equal(hotels[0].draft.city, '宇都宮'); assert.match(hotels[0].title, /2晚/);
});
test('departure context and accepted suggestions survive storage without changing original reply or manual records', async () => {
  let raw = null; const store = createSavedTrips({ read: async () => raw, write: async v => { raw = v; } });
  const original = fixture(), { id, createdAt, updatedAt, bookings, ...input } = original;
  const saved = await store.save(input), ids = tripPreparation(saved).suggestions.map(s => s.id);
  await store.update(saved.id, t => acceptPreparation(t, ids));
  const reloaded = (await store.load())[0]; assert.equal(reloaded.departureCity, '東京'); assert.equal(reloaded.reply, original.reply); assert.equal(reloaded.bookings.length, ids.length);
});

test('Chinese origin aliases still use the correct rail corridor; staying with friends does not suggest a hotel', () => {
  const alias = tripPreparation(fixture({ origin: '东京' })); assert.equal(alias.suggestions.find(s => s.draft.kind === 'train').draft.from, '東京');
  const trip = fixture(); trip.reply = trip.reply.replaceAll('在宇都宮酒店入住', '住朋友家').replaceAll('返回宇都宮酒店休息', '住朋友家');
  assert.ok(tripPreparation(trip).suggestions.every(s => s.draft.kind !== 'hotel'));
});

test('origin context uses only user messages preceding the exact saved assistant reply', () => {
  const messages = [{ id: 'u1', role: 'user', content: '从东京出发去宇都宫' }, { id: 'a1', role: 'assistant', content: '方案' }, { id: 'u2', role: 'user', content: '从大阪出发去京都' }, { id: 'a2', role: 'assistant', content: '后来的方案' }];
  assert.equal(conversationDeparture(messages, 'a1'), '東京'); assert.equal(conversationDeparture(messages, 'a2'), '大阪'); assert.equal(conversationDeparture(messages, 'missing'), '');
});

test('Shanghai origin is retained, and an explicitly planned Hakodate ropeway gets its own paid-transport preparation', () => {
  assert.equal(inferDepartureCity('从上海出发去函馆'), '上海');
  const trip = fixture({ origin: '上海', city: '函館', introduction: '从上海出发去函馆。', sights: '**函館山展望台**\n欣赏夜景。', activity: '乘坐函馆山缆车前往函館山展望台欣赏夜景' });
  trip.reply = trip.reply.replace('从东京出发前往函館', '从上海乘飞机前往函館');
  const suggestions = tripPreparation(trip).suggestions;
  assert.ok(suggestions.some(s => s.draft.kind === 'flight' && s.draft.from === '上海' && s.draft.to === '函館'));
  assert.ok(suggestions.some(s => s.draft.name === '函館山ロープウェイ'));
});

test('a saved flight with Chinese city spelling does not trigger an unconfirmed transport question', () => {
  const trip = fixture({ origin: '上海', city: '函館', introduction: '上海出发的旅行。' });
  trip.bookings.push({ id: 'saved-air', kind: 'flight', day: 1, city: '函馆', from: '上海', to: '函馆', date: '2026-12-18', endDate: '', name: '', people: 2, booked: true });
  assert.ok(!tripPreparation(trip).questions.some(q => /上海 → 函館的交通方式/.test(q)));
});

test('verified free sights do not create automatic ticket preparation; paid ropeway remains separate', () => {
  const free = fixture({ origin: '東京', city: '東京', sights: '**浅草寺**\n参拜寺庙。', activity: '前往浅草寺参拜' });
  assert.ok(tripPreparation(free).suggestions.every(s => s.draft.kind !== 'attraction'));
  const ropeway = fixture({ origin: '上海', city: '函館', sights: '**函館山展望台**\n欣赏夜景。', activity: '乘坐函馆山缆车到函館山展望台看夜景' });
  const attractions = tripPreparation(ropeway).suggestions.filter(s => s.draft.kind === 'attraction');
  assert.deepEqual(attractions.map(s => s.draft.name), ['函館山ロープウェイ']);
});


test('generated ski pass and rental tasks resolve to their distinct official pages without extra AI calls', () => {
  const before=fixture(), snapshot=JSON.stringify(before);
  const tasks=tripPreparation(before).suggestions.filter(s=>/雪票|装备租赁/.test(s.title));
  assert.equal(tasks.length,2);
  const paths=tasks.map(s=>{const link=tripBookingLink(s.draft);assert.equal(link.entryKind,'official');return new URL(link.url).pathname;});
  assert.deepEqual(paths.sort(),['/winter/rental/','/winter/ticket/']);assert.equal(JSON.stringify(before),snapshot);
});
