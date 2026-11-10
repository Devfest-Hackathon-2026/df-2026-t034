import test from 'node:test';
import assert from 'node:assert/strict';
import { admissionForPlace, reviewedAdmissions } from '../src/lib/trip-admission.ts';
import { tripBookingLink } from '../src/lib/trip-booking-links.ts';
import { bookingDisplay, bookingGroups } from '../src/lib/trip-booking-display.ts';
import { tripPreparation } from '../src/lib/trip-preparation.ts';
const item = (name, city = '京都') => ({ id: name, kind: 'attraction', day: 1, city, name, from: '', to: '', date: '2027-02-03', endDate: '', people: 2, booked: false });
test('reported Kyoto Kamogawa has independent official admission evidence despite no Trip product', () => {
  for (const name of ['鴨川', '鸭川', '京都鴨川', '鴨川（Kamo River）', '鸭川门票']) {
    const evidence = admissionForPlace('京都市', name), display = bookingDisplay(item(name));
    assert.equal(evidence.status, 'free', name); assert.match(evidence.scope, /公共河岸/); assert.match(evidence.note, /特别活动/);
    assert.equal(evidence.checkedAt, '2026-11-09'); assert.ok(evidence.sources.every(source => new URL(source.url).protocol === 'https:'));
    assert.equal(display.freeOnly, true); assert.equal(display.showQuery, false); assert.equal(display.paidExtra, undefined);
    assert.equal(display.link.entryKind, 'official'); assert.equal(new URL(display.link.url).hostname, 'global.kyoto.travel');
    assert.equal(display.link.alternatives.length, 0); // Evidence must never masquerade as a paid add-on.
  }
});
test('wrong municipality, mixed places and paid products never inherit free riverbank access', () => {
  for (const [city, name] of [['千葉', '鴨川'], ['鴨川', '鴨川'], ['京都', '鴨川シーワールド'], ['京都', '鴨川（桂離宮）'], ['京都', '鴨川（川床套餐）'], ['京都', '鴨川 夜间特别活动'], ['京都', 'Kamogawa River Cruise'], ['京都', '鴨川（不明景点）']]) {
    assert.equal(admissionForPlace(city, name), undefined, name);
    assert.equal(tripBookingLink(item(name, city)).freeEntry, undefined, name);
  }
});
test('free general access does not imply free subfacilities or unrestricted palace admission', () => {
  assert.match(admissionForPlace('京都', '京都御苑').note, /拾翠亭/);
  assert.equal(admissionForPlace('京都', '京都御苑 拾翠亭'), undefined);
  assert.equal(bookingDisplay(item('京都御所')).freeOnly, true);
  for (const name of ['京都仙洞御所', '桂離宮']) {
    const display = bookingDisplay(item(name));
    assert.equal(display.freeOnly, false); assert.equal(display.showQuery, true); assert.equal(display.buttonLabel, '官方登记说明');
    assert.equal(display.link.entryKind, 'official'); assert.match(display.link.admission.label, /需登记/);
    assert.equal(new URL(display.link.url).hostname, 'sankan.kunaicho.go.jp');
  }
});
test('old free reminders are reclassified on read without removing saved dates or checked state', () => {
  const record = { ...item('鴨川'), booked: true }, before = JSON.stringify(record);
  const groups = bookingGroups([record]);
  assert.equal(groups.preparation.length, 0); assert.equal(groups.freeVisits[0], record); assert.equal(JSON.stringify(record), before);
});
test('officially free Kyoto sights are not suggested as tickets; registration still is actionable', () => {
  function trip(name) { return { id: 't', title: '京都', sourceConversationId: 'c', sourceMessageId: 'm', createdAt: 1, updatedAt: 1, startDate: '2027-02-03', departureCity: '京都', bookings: [], reply: `京都一日游\n\n行程规划\n第1天：京都\n\n行程详情\n\nDay 1｜散步\n\n**${name}**\n景点介绍。\n\n当日安排\n活动｜在${name}参观\n活动｜返回家中\n\n小结\n一天轻松游。` }; }
  for (const name of ['鴨川', '哲学の道', '岡崎公園', '京都御苑', '京都御所']) assert.ok(!tripPreparation(trip(name)).suggestions.some(s => s.draft.kind === 'attraction'), name);
  assert.ok(tripPreparation(trip('京都仙洞御所')).suggestions.some(s => s.draft.kind === 'attraction'));
});
test('all reviewed evidence carries a source, scope, review date and strict city identity', () => {
  for (const entry of reviewedAdmissions) {
    assert.ok(entry.sources.length && entry.scope && entry.note && entry.checkedAt);
    assert.equal(admissionForPlace('不明城市', entry.names[0]), undefined);
    assert.equal(admissionForPlace(entry.city, entry.names[0]), entry);
  }
});

test('new official free grounds suppress ticket tasks while paid subfacilities stay separate', () => {
  const cases=[['東京','上野公园','上野動物園'],['東京','代々木公園','代々木公園 特别活动'],['函館','五稜郭公園','五稜郭タワー'],['福岡','大濠公園','大濠公園 日本庭園'],['大阪','大阪城公園','大阪城天守閣'],['札幌','円山公園','円山動物園'],['京都','伏見稲荷大社','伏見稲荷大社 导览体验']];
  for(const [city,free,paid] of cases){
    assert.equal(bookingDisplay(item(free,city)).freeOnly,true,free);
    assert.equal(admissionForPlace(city,paid),undefined,paid);
    assert.notEqual(tripBookingLink(item(paid,city)).freeEntry,true,paid);
    assert.equal(admissionForPlace('其他城市',free),undefined);
  }
  assert.equal(admissionForPlace('京都','円山公園'),undefined);
  assert.equal(tripBookingLink(item('上野公园（动物园门票）','東京')).freeEntry,undefined);
});
