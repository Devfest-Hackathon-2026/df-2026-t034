import test from 'node:test';
import assert from 'node:assert/strict';
import { createLanguagePreference, getLanguage, publishLanguage, subscribeLanguage, translate, localizePlanOutline, localizeTimingHints } from '../src/lib/i18n/core.ts';
import { messages } from '../src/lib/i18n/messages.ts';
import { inferDepartureCity } from '../src/lib/saved-trips.ts';
import { tripPreparation } from '../src/lib/trip-preparation.ts';

test('first launch needs a choice; valid saved preferences are reused and invalid values ignored', async () => {
  for (const value of [null, '', 'fr', '{bad}', 'constructor']) assert.equal(await createLanguagePreference({ read: async () => value, write: async () => {} }).load(), null);
  for (const value of ['zh', 'en', 'ja']) assert.equal(await createLanguagePreference({ read: async () => value, write: async () => {} }).load(), value);
});
test('language changes only after persistence succeeds, and failed writes preserve current language', async () => {
  publishLanguage('zh'); let stored = null, changes = 0;
  const unsubscribe = subscribeLanguage(() => changes++);
  const preference = createLanguagePreference({ read: async () => stored, write: async value => { stored = value; } });
  await preference.save('en'); assert.equal(getLanguage(), 'en'); assert.equal(await preference.load(), 'en'); assert.equal(changes, 1);
  await assert.rejects(createLanguagePreference({ read: async () => null, write: async () => { throw Error('disk'); } }).save('ja'));
  assert.equal(getLanguage(), 'en'); unsubscribe(); publishLanguage('zh');
});
test('every translation preserves parameters; unknown prose and object prototype names are untouched', () => {
  for (const [key, entry] of Object.entries(messages)) for (const language of ['en', 'ja']) {
    assert.ok(entry[language]?.trim(), `${language}: ${key}`);
    assert.deepEqual([...entry[language].matchAll(/\{\d+\}/g)].map(m => m[0]).sort(), [...key.matchAll(/\{\d+\}/g)].map(m => m[0]).sort(), key);
  }
  assert.equal(translate('发现', 'en'), 'Discover'); assert.equal(translate('设置', 'ja'), '設定');
  assert.equal(translate('查看Day 3安排', 'en'), 'View Day 3 plan');
  assert.equal(translate('约 ¥4,300', 'en'), 'Approx. ¥4,300');
  assert.equal(translate('陌生的用户原文保持不变', 'en'), '陌生的用户原文保持不变');
  assert.equal(translate('constructor', 'en'), 'constructor');
  assert.equal(translate('待确认 {0}项 · 已完成 {1}项', 'en', [2, 1]), '2 to review · 1 completed');
});
test('localized outline does not modify the original persisted reply', () => {
  const original = '第1–2天：東京\n第3天：札幌';
  assert.equal(localizePlanOutline(original, 'en'), 'Day 1–2: Tokyo\nDay 3: Sapporo');
  assert.equal(localizePlanOutline(original, 'ja'), '1～2日目：東京\n3日目：札幌');
  assert.equal(original, '第1–2天：東京\n第3天：札幌');
});
test('English and Japanese departure cities are explicit, never inferred from destination-only mentions', () => {
  for (const [value, city] of [['From Tokyo to Utsunomiya for three days', '東京'], ['Starting in Shanghai, flying to Hakodate', '上海'], ['東京から出発、宇都宮へ3日間', '東京']]) assert.equal(inferDepartureCity(value), city);
  assert.equal(inferDepartureCity('Plan three days in Utsunomiya'), '');
});
test('English and Japanese itineraries retain rail and hotel suggestions with stable structured markers', () => {
  for (const activity of ['Take the train from 東京 to 宇都宮 and check in at the hotel', '東京から電車で宇都宮へ移動してホテルにチェックイン']) {
    const trip = { id: 't', title: 'Trip', reply: `Plan\n\n行程规划\n第1–2天：宇都宮\n\n行程详情\n\nDay 1｜Travel\n\n当日安排\n活动｜${activity}\n活动｜Walk around town\n\nDay 2｜Return\n\n当日安排\n活动｜Return to 東京 by train\n活动｜Return home\n\n小结\nA short trip.`, startDate: '2026-12-18', departureCity: '東京', bookings: [] };
    const { suggestions } = tripPreparation(trip);
    assert.ok(suggestions.some(s => s.draft.kind === 'train')); assert.ok(suggestions.some(s => s.draft.kind === 'hotel'));
    assert.ok(!suggestions.some(s => s.draft.kind === 'flight'));
  }
});

test('combined date and duration labels localize completely, while only fixed format hints change in itinerary prose', () => {
  assert.equal(translate('2026 · 12.18—12.18 · 1天 · 1人', 'ja'), '2026 · 12.18—12.18・1日間・1人');
  const original = '浅草寺を見学します（建议晚上去，适合看夜景）';
  assert.equal(localizeTimingHints(original, 'ja'), '浅草寺を見学します（夜景を楽しむなら夜がおすすめです）');
  assert.equal(original, '浅草寺を見学します（建议晚上去，适合看夜景）');
});
