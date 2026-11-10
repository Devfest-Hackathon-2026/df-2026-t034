import assert from 'node:assert/strict';
import test from 'node:test';
import { discoveryFeed, discoveryPlaces, discoveryMapUrl, filterDiscoveryPlaces } from '../src/lib/discovery.ts';
import { createDiscoveryPhotoLoader } from '../src/lib/discovery-photo-loader.ts';
import { discoveryCover } from '../src/lib/discovery-covers.ts';

function reply(city, names) {
  return `行程规划\n第1天：${city}\n\n行程详情\n\nDay 1｜${city}散步\n\n${names.map(name => `**${name}**\n这里适合步行欣赏风景。`).join('\n\n')}\n\n当日安排\n${names.map(name => `活动｜前往${name}游览`).join('\n')}\n\n小结\n结束这次旅行。`;
}
function conversation(id, content, updatedAt = 1) {
  return { id, createdAt: 1, updatedAt, draft: '', pendingMessage: null, messages: [
    { id: `${id}-u`, role: 'user', content: '请安排旅行' },
    { id: `${id}-a`, role: 'assistant', content },
  ] };
}

test('reopened local chat produces identifiable Hokkaido sights without needing a new Gemini call', () => {
  const original = conversation('hokkaido', reply('札幌', ['大通公園', '狸小路商店街']));
  const restored = JSON.parse(JSON.stringify([original]));
  const places = discoveryPlaces(restored);
  assert.deepEqual(places.map(p => [p.name, p.city, p.region, p.conversationId]), [
    ['大通公園', '札幌', '北海道', 'hokkaido'], ['狸小路商店街', '札幌', '北海道', 'hokkaido'],
  ]);
  assert.equal(filterDiscoveryPlaces(places, '我想去北海道5天').length, 2);
  assert.equal(filterDiscoveryPlaces(places, '东京三天').length, 0);
});

test('latest revised plan replaces earlier destinations, deduplicates places and follows the latest source', () => {
  const edited = conversation('edited', reply('京都', ['清水寺']), 3);
  edited.messages.push({ id: 'edit-u', role: 'user', content: '改去东京' }, { id: 'edit-a', role: 'assistant', content: reply('東京', ['浅草寺']) });
  const places = discoveryPlaces([conversation('older', reply('東京', ['浅草寺']), 1), edited]);
  assert.deepEqual(places.map(p => [p.name, p.conversationId]), [['浅草寺', 'edited']]);
});

test('no fabricated recommendations from drafts, unanswered questions or an ambiguous city', () => {
  const draft = { ...conversation('draft', ''), messages: [], draft: '北海道5天' };
  assert.deepEqual(discoveryPlaces([draft, conversation('question', '请问玩几天？'), conversation('unknown', '**円山公園**\n一座公园。')]), []);
});

test('different cities retain distinct same-named places; removing a source chat removes its recommendations', () => {
  const sapporo = conversation('sapporo', reply('札幌', ['円山公園']), 2);
  const kyoto = conversation('kyoto', reply('京都', ['円山公園']), 1);
  const places = discoveryPlaces([sapporo, kyoto]);
  assert.equal(places.length, 2);
  assert.equal(new Set(places.map(p => p.id)).size, 2);
  assert.equal(filterDiscoveryPlaces(places, '', '北海道').length, 1);
  assert.deepEqual(discoveryPlaces([kyoto]).map(p => p.conversationId), ['kyoto']);
});

test('empty history shows clearly labelled editorial cards with complete reusable covers', () => {
  const feed = discoveryFeed([]);
  assert.ok(feed.length >= 6);
  assert.ok(feed.every(place => place.origin === 'collection' && !place.conversationId && !place.schedule));
  for (const place of feed) {
    const cover = discoveryCover(place);
    assert.ok(cover?.asset && cover.photo.credit && cover.photo.license);
    assert.match(cover.photo.source, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    assert.match(cover.licenseUrl, /^https:\/\/creativecommons\.org\//);
    assert.doesNotMatch(JSON.stringify(cover), /googleusercontent|places\.googleapis/);
  }
});

test('covers require exact landmark and city evidence; unknown places do not start remote fallbacks', () => {
  assert.equal(discoveryCover({ name: '大通公園', city: '京都' }), null);
  assert.equal(discoveryCover({ name: '円山公園', city: '京都' }), null);
  assert.equal(discoveryCover({ name: '円山公園', city: '札幌' }).asset, 'maruyamaPark');
  assert.equal(discoveryCover({ name: '小樽運河', city: '小樽' }).asset, 'discoveryOtaru');
  assert.equal(discoveryCover({ name: '未收录的景点', city: '東京' }), null);
});

test('detail retains the source description and original ordered day activities without altering history', () => {
  const value = conversation('original', reply('札幌', ['北海道神宮', '大通公園']));
  const before = JSON.stringify(value);
  const places = discoveryPlaces([value]);
  const sight = places.find(place => place.name === '北海道神宮');
  assert.equal(sight.description, '这里适合步行欣赏风景。');
  assert.equal(sight.schedule.day, 1);
  assert.deepEqual(sight.schedule.items, ['前往北海道神宮游览', '前往大通公園游览']);
  assert.equal(JSON.stringify(value), before);
  const map = new URL(discoveryMapUrl(sight));
  assert.equal(map.hostname, 'www.google.com');
  assert.equal(map.searchParams.get('query'), '札幌 北海道神宮 日本');
  assert.equal(map.searchParams.has('key'), false);
});

test('constructing or reopening an unclicked detail performs zero I/O; fast taps coalesce and successful images do not refetch', async () => {
  let connections = 0, calls = 0;
  const loader = createDiscoveryPhotoLoader({ name: '大通公園', city: '札幌', privateField: 'not sent' }, {
    connect: async () => { connections++; },
    load: async query => { calls++; assert.deepEqual(query, { name: '大通公園', city: '札幌' }); await new Promise(resolve => setTimeout(resolve, 2)); return { enabled: true, photo: { provider: 'google-places' } }; },
  });
  await Promise.resolve(); assert.equal(calls, 0); assert.equal(connections, 0);
  await Promise.all([loader.request(), loader.request(), loader.request()]);
  assert.equal(calls, 1); assert.equal(connections, 1);
  await loader.request(); assert.equal(calls, 1);
});

test('failures wait for an explicit retry; quota exhaustion never automatically spends more requests', async () => {
  let calls = 0;
  const loader = createDiscoveryPhotoLoader({ name: '大通公園', city: '札幌' }, {
    connect: async () => {}, load: async () => { calls++; throw Error('private network details'); },
  });
  assert.deepEqual(await loader.request(), { enabled: true, photo: null, stop: true });
  await new Promise(resolve => setTimeout(resolve, 2)); assert.equal(calls, 1);
  await loader.request(); assert.equal(calls, 2);
  let quotaCalls = 0;
  const limited = createDiscoveryPhotoLoader({ name: '大通公園', city: '札幌' }, {
    connect: async () => {}, load: async () => { quotaCalls++; return { enabled: true, photo: null, limitReached: true }; },
  });
  await limited.request(); await limited.request(); assert.equal(quotaCalls, 1);
});

test('closing the detail while session connection is pending prevents the Places request', async () => {
  let resolveConnection; let calls = 0;
  const loader = createDiscoveryPhotoLoader({ name: '大通公園', city: '札幌' }, {
    connect: () => new Promise(resolve => { resolveConnection = resolve; }),
    load: async () => { calls++; return { enabled: true, photo: null }; },
  });
  const pending = loader.request(); loader.cancel(); resolveConnection();
  assert.equal(await pending, null); assert.equal(calls, 0);
});

test('uncovered user sights stay searchable while exact licensed local covers appear first', () => {
  const value = conversation('takao', reply('東京', ['高尾山薬王院']));
  const feed = discoveryFeed([value]);
  assert.ok(feed.slice(0, 4).every(place => discoveryCover(place)));
  assert.ok(feed.slice(0, 4).every(place => place.region === '東京'));
  const original = filterDiscoveryPlaces(feed, '高尾山薬王院')[0];
  assert.equal(original.conversationId, 'takao');
  assert.equal(original.origin, 'chat');
  assert.equal(discoveryCover(original), null);
});
