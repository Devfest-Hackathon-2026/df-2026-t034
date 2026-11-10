import assert from 'node:assert/strict';
import test from 'node:test';
import { bookingDisplay, bookingGroups } from '../src/lib/trip-booking-display.ts';
const item = (city, name, extra = {}) => ({ id: name, kind: 'attraction', day: 1, city, name, from: '', to: '', date: '2026-12-18', endDate: '', people: 2, booked: false, ...extra });
test('verified free sightseeing has a badge and no booking query action', () => {
  for (const [city, name] of [['東京', '浅草寺'], ['札幌', '大通公園'], ['札幌', '北海道神宮'], ['小樽', '小樽運河'], ['福岡', '中洲屋台街']]) {
    const display = bookingDisplay(item(city, name));
    assert.equal(display.freeVisit, true, name); assert.equal(display.showQuery, false); assert.equal(display.buttonLabel, ''); assert.equal(display.paidExtra, undefined); assert.equal(display.freeOnly, true);
  }
});
test('free Hakodate viewing keeps one distinct paid ropeway action, not a redundant sightseeing query', () => {
  const display = bookingDisplay(item('函馆', '函館山展望台'));
  assert.equal(display.freeVisit, true); assert.equal(display.showQuery, false); assert.equal(display.freeOnly, false);
  assert.equal(display.paidExtra.url, 'https://334.co.jp/en/en-advance-ticket/'); assert.equal(display.buttonLabel, '缆车票务');
});
test('paid tickets and unknown admission retain useful entry choices rather than silently assuming free entry', () => {
  const paid = bookingDisplay(item('札幌', 'さっぽろテレビ塔')); assert.equal(paid.showQuery, true); assert.equal(paid.freeVisit, false); assert.equal(paid.buttonLabel, '票务信息');
  const unknown = bookingDisplay(item('札幌', '未收录景点')); assert.equal(unknown.showQuery, true); assert.equal(unknown.freeOnly, false); assert.equal(unknown.buttonLabel, '选择入口');
});
test('free saved reminders are separated without deletion, state changes or rewriting existing links', () => {
  const records = [item('札幌', '大通公園', { booked: true }), item('函館', '函館山展望台'), item('札幌', 'さっぽろテレビ塔')];
  const before = JSON.stringify(records), groups = bookingGroups(records);
  assert.deepEqual(groups.freeVisits.map(b => b.id), ['大通公園']); assert.equal(groups.freeVisits[0].booked, true);
  assert.deepEqual(groups.preparation.map(b => b.id), ['函館山展望台', 'さっぽろテレビ塔']);
  assert.equal(groups.freeVisits.length + groups.preparation.length, records.length); assert.equal(JSON.stringify(records), before);
});
