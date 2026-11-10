import test from 'node:test';
import assert from 'node:assert/strict';
import { tripBookingLink } from '../src/lib/trip-booking-links.ts';
const item = { kind: 'attraction', city: '函馆', name: '函館山展望台', from: '上海', to: '函馆', date: '2026-12-18', endDate: '', people: 2 };
test('reported Shanghai–Hakodate route uses the actual flight search and date, never a global keyword page', () => {
  const link = tripBookingLink({ ...item, kind: 'flight' }), url = new URL(link.url);
  assert.equal(url.hostname, 'www.trip.com'); assert.equal(url.pathname, '/flights/shanghai-to-hakodate/tickets-sha-hkd/');
  assert.equal(url.searchParams.get('ddate'), '2026-12-18'); assert.equal(url.searchParams.get('departcitycode'), 'sha'); assert.equal(url.searchParams.get('arrivalcitycode'), 'hkd');
  assert.equal(link.entryKind, 'flight-results'); assert.equal(link.buttonLabel, '查询航班'); assert.match(link.review, /人数/); assert.equal(url.searchParams.get('adult'), null);
});
test('reported Hakodate observatory resolves its own detail and separates ropeway fare from free viewing', () => {
  for (const name of ['函館山展望台', '函馆山展望台', '函館山展望台（函馆山展望台）', 'Mt. Hakodate Observatory']) {
    const link = tripBookingLink({ ...item, name }); assert.match(link.url, /mt-hakodate-observatory-61929972/); assert.equal(link.entryKind, 'detail'); assert.equal(link.freeEntry, true); assert.match(link.review, /缆车需另外购票/);
    assert.ok(link.alternatives.some(a => a.url === 'https://334.co.jp/en/en-advance-ticket/'));
  }
});
test('reported Sapporo TV Tower resolves Japanese, Chinese and translated names to the actual attraction', () => {
  for (const name of ['さっぽろテレビ塔', '札幌电视塔', '札幌テレビ塔（札幌电视塔）', '札幌电视塔门票']) {
    const link = tripBookingLink({ ...item, city: '札幌', name }); assert.match(link.url, /sapporo-tv-tower-94200/); assert.equal(link.freeEntry, undefined); assert.match(link.review, /日期、票种和人数/);
  }
});
test('same-name wrong city, mixed sights and a bundled product cannot masquerade as an exact attraction match', () => {
  for (const bad of [{ city: '函館', name: 'さっぽろテレビ塔' }, { city: '北海道', name: '函館山展望台' }, { city: '札幌', name: '大通公園（札幌电视塔）' }, { city: '函館', name: '函館山展望台（缆车往返套票）' }]) {
    const link = tripBookingLink({ ...item, ...bad }); assert.equal(link.url, null, bad.name); assert.equal(link.entryKind, 'unavailable');
  }
});
test('unmapped categories return explicit manual channel choices, without opening a hotel search or claiming prefills', () => {
  const expected = { hotel: '/hotels/', flight: '/flights/', train: '/trains/japan/', attraction: '/things-to-do/' };
  for (const kind of Object.keys(expected)) {
    const link = tripBookingLink({ ...item, kind, city: '未知城市', from: '未知甲', to: '未知乙', name: '未收录 & token=abc' });
    assert.equal(link.url, null); assert.equal(link.buttonLabel, '选择查询入口'); assert.deepEqual(link.prefilledFields, []);
    const fallback = new URL(link.fallback.url); assert.equal(fallback.pathname, expected[kind]); assert.equal(fallback.hostname, 'www.trip.com'); assert.equal(fallback.searchParams.get('keyword'), null); assert.match(link.fallback.label, /手动/);
  }
});
test('past flight date falls back to the reviewed route only, not a fabricated dated result', () => {
  const link = tripBookingLink({ ...item, kind: 'flight', date: '2001-01-01' });
  assert.equal(link.entryKind, 'route'); assert.match(link.url, /airfares-sha-hkd/); assert.ok(!link.prefilledFields.includes('出发日期'));
});
test('Hakodate hotel search remains in hotel category and never reuses a sightseeing keyword', () => {
  const link = tripBookingLink({ ...item, kind: 'hotel', endDate: '2026-12-20' });
  const url = new URL(link.url); assert.equal(url.pathname, '/hotels/list'); assert.equal(url.searchParams.get('city'), '800'); assert.equal(url.searchParams.get('keyword'), null);
});
test('ropeway resolves its official ticket instructions rather than free mountain viewing', () => {
  const link = tripBookingLink({ ...item, name: '函館山ロープウェイ' }); assert.equal(link.entryKind, 'official'); assert.equal(link.url, 'https://334.co.jp/en/en-advance-ticket/'); assert.equal(link.freeEntry, undefined);
});

test('return flights preserve direction, and a ropeway product cannot silently match the free observatory', () => {
  const flight = tripBookingLink({ ...item, kind: 'flight', from: '函館', to: '上海' });
  assert.match(flight.url, /hakodate-to-shanghai\/tickets-hkd-sha/);
  const unknownPackage = tripBookingLink({ ...item, name: '函館山展望台（缆车往返套票）' });
  assert.equal(unknownPackage.url, null);
});

test('unrecognized city names cannot resolve through inherited object properties', () => {
  for (const city of ['constructor', '__proto__', 'toString']) {
    const link = tripBookingLink({ ...item, kind: 'hotel', city }); assert.equal(link.url, null); assert.equal(link.located, false);
  }
});

test('verified paid facilities use official admission instead of unrelated Trip.com search', () => {
  for (const [city,name,path] of [['東京','上野動物園','/ueno/visitor-info/tickets/'],['札幌','円山動物園','/zoo/info/riyo/kaienjikan.html']]) {
    const link=tripBookingLink({...item,city,name});assert.equal(link.entryKind,'official');assert.ok(new URL(link.url).pathname.startsWith(path));assert.equal(link.freeEntry,undefined);assert.deepEqual(link.prefilledFields,[]);
  }
  assert.equal(tripBookingLink({...item,city:'札幌',name:'大通公園（不明の施設）'}).url,null);
});
test('a ski day-trip separates verified Shiobara lift tickets and rental without inventing prices or resort URLs', () => {
  for (const city of ['宇都宫','那须盐原']) for (const [name,path] of [['ハンターマウンテン塩原 雪票 / 缆车票','/winter/ticket/'],['Hunter Mountain Shiobara 雪具 / 雪服租赁','/winter/rental/']]) {
    const link=tripBookingLink({...item,city,name});assert.equal(link.entryKind,'official');assert.equal(new URL(link.url).hostname,'www.hunter.co.jp');assert.equal(new URL(link.url).pathname,path);assert.deepEqual(link.prefilledFields,[]);assert.equal(link.freeEntry,undefined);
  }
  for(const bad of [{city:'札幌',name:'ハンターマウンテン塩原'},{city:'宇都宮',name:'Hunter Mountain New York'},{city:'宇都宮',name:'未知雪场 雪票 / 缆车票'}]) assert.equal(tripBookingLink({...item,...bad}).url,null);
});
