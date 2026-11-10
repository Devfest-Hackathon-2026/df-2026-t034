import assert from 'node:assert/strict';
import test from 'node:test';
import { dayPresentation, tripCover, checklistCounts, budgetSummary, shortDate, tripDateRange } from '../src/lib/trip-presentation.ts';

const day = { number: 2, city: '札幌', title: '东京出发去札幌', sights: [{ name: '大通公園', description: '在札幌市中心散步。' }], activities: [
  '从东京乘机飞往札幌，抵达新千岁机场', '在札幌大通公園悠闲散步', '前往札幌酒店办理入住并休息',
] };
function booking(id, kind, values = {}) { return { id, kind, day: 2, city: '札幌', from: '東京', to: '札幌', name: '', date: '2026-12-16', endDate: '', people: 2, booked: false, ...values }; }
test('existing flight, sight and hotel stay attach beneath the original matching activity, preserving sequence and dates', () => {
  const bookings = [booking('air', 'flight'), booking('park', 'attraction', { name: '大通公園' }), booking('stay', 'hotel', { endDate: '2026-12-18' })];
  const before = JSON.stringify({ day, bookings });
  const view = dayPresentation(day, bookings);
  assert.deepEqual(view.rows.map(r => r.text), day.activities);
  assert.deepEqual(view.rows.map(r => r.bookings.map(b => b.id)), [['air'], ['park'], ['stay']]);
  assert.equal(view.rows[1].sights[0].name, '大通公園'); assert.equal(view.rows[2].bookings[0].endDate, '2026-12-18');
  assert.equal(JSON.stringify({ day, bookings }), before);
  assert.ok(view.rows.every(row => row.hints.length === 0));
});
test('preparation suggestions do not invent saved bookings or inflate checklist counts', () => {
  const view = dayPresentation(day, []);
  assert.deepEqual(view.rows.map(r => r.hints.map(h => h.kind)), [['flight'], ['attraction'], ['hotel']]);
  assert.deepEqual(checklistCounts([]), { pending: 0, completed: 0, total: 0 });
  assert.ok(view.rows.every(row => row.bookings.length === 0));
});
test('ambiguous saved items remain visible once in the day extras; another day cannot leak into this day', () => {
  const view = dayPresentation(day, [booking('unknown', 'attraction', { name: '札幌芸術の森' }), booking('next-day', 'flight', { day: 3 })]);
  assert.deepEqual(view.unplacedBookings.map(b => b.id), ['unknown']);
  assert.ok(view.rows.every(row => row.bookings.length === 0));
});
test('a sightseeing city alone does not invent a hotel stay or a flight; same-day local subway is not sold as intercity rail', () => {
  const local = { ...day, activities: ['乘坐地铁前往大通公園，随后在市中心吃午餐'] };
  const view = dayPresentation(local, []);
  assert.deepEqual(view.rows[0].hints.map(h => h.kind), ['attraction']);
});
test('rail bookings stay next to original rail activity; repeated venue mentions do not duplicate a booking', () => {
  const railDay = { ...day, activities: ['乘坐新干线从东京前往京都', '参观大通公園', '再沿大通公園散步'] };
  const view = dayPresentation(railDay, [booking('rail', 'train'), booking('park', 'attraction', { name: '大通公園' })]);
  assert.deepEqual(view.rows.map(r => r.bookings.map(b => b.id)), [['rail'], ['park'], []]);
});
test('cover must be an actual itinerary sight with a matching municipality, never an arbitrary scenic hero', () => {
  assert.equal(tripCover({ days: [{ ...day, city: '京都' }] }), null);
  const cover = tripCover({ days: [day] }); assert.equal(cover.name, '大通公園'); assert.equal(cover.cover.asset, 'discoveryOdori');
  assert.equal(tripCover({ days: [{ ...day, sights: [] }] }), null);
});
test('budget summary uses the explicitly labelled economy tier and retains original currency and party size', () => {
  assert.deepEqual(budgetSummary({ budget: null }), null);
  const plan = { budget: { currency: 'CNY', travelers: 2, scope: '示例', items: [{ label: '交通', amounts: [1000, 2000, 3000] }, { label: '住宿', amounts: [2000, 4000, 6000] }] } };
  assert.deepEqual(budgetSummary(plan), { total: 3000, perPerson: 1500, travelers: 2, currency: '人民币' });
  assert.deepEqual(budgetSummary(plan, 1), { total: 6000, perPerson: 3000, travelers: 2, currency: '人民币' });
  assert.equal(budgetSummary(plan, 2).total, 9000);
});
test('checklist counts derive only from real saved manual states, including a free sightseeing arrangement', () => {
  assert.deepEqual(checklistCounts([booking('air', 'flight'), booking('free', 'attraction', { name: '中洲屋台街', booked: true })]), { pending: 1, completed: 1, total: 2 });
});
test('display calendar preserves dates across timezone and year boundaries, with an honest unset date', () => {
  assert.equal(shortDate('2026-12-16', true), '12月16日 周三');
  assert.equal(shortDate('', true), '日期待定');
  assert.equal(tripDateRange({ startDate: '2026-12-31' }, 2), '2026-12-31—2027-01-01');
  assert.equal(tripDateRange({ startDate: '' }, 2), '出发日期未定');
});

test('an existing multi-night stay follows its dates and actual lodging city, without duplicate suggestions or checkout-day reuse', () => {
  const stay = booking('stay', 'hotel', { day: 1, date: '2026-12-15', endDate: '2026-12-18', booked: true });
  const view = dayPresentation(day, [stay], '2026-12-16');
  assert.equal(view.rows[2].bookings[0].id, 'stay'); assert.ok(!view.rows.some(row => row.hints.some(h => h.kind === 'hotel')));
  const wrongCity = dayPresentation({ ...day, city: '京都', activities: ['在京都酒店办理入住'] }, [stay], '2026-12-16');
  assert.equal(wrongCity.rows[0].bookings.length, 0);
  const checkoutDay = dayPresentation(day, [stay], '2026-12-18'); assert.ok(checkoutDay.rows.every(row => row.bookings.length === 0));
  const dayTrip = dayPresentation({ ...day, city: '小樽', activities: ['游览小樽后返回札幌酒店休息'] }, [stay], '2026-12-16');
  assert.equal(dayTrip.rows[0].bookings[0].id, 'stay');
});
