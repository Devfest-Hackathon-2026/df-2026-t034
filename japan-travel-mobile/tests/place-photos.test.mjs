import assert from 'node:assert/strict';
import test from 'node:test';
import { photoTitle, photoFromPage, loadPlacePhotos, loadReplyPhotos, placePhotoUrls, candidateFiles, choosePlacePhoto, exactEntityId, hasPhotoResolution, sceneQuality, scheduledLandmarks } from '../src/lib/place-photos.ts';
import { reviewedPlacePhoto } from '../src/lib/reviewed-place-photos.ts';

test('the Tokyo parks and Osaka Universal use distinct bundled photos for Japanese and Chinese names', () => {
  const names = ['东京迪士尼乐园', '东京迪士尼海洋乐园', '迪士尼', '大阪环球影城', 'USJ'];
  assert.deepEqual(names.map((name) => reviewedPlacePhoto(name, photoTitle(name))?.bundled),
    ['disneyland', 'disneySea', 'disneyResort', 'universalStudios', 'universalStudios']);
});

test('Ginza uses the verified shopping streetscape and excludes same-name neighborhoods', () => {
  const info = {
    thumburl: 'https://upload.wikimedia.org/a.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:A.jpg',
    width: 1280, height: 900,
    extmetadata: { Artist: { value: 'Author' }, LicenseShortName: { value: 'CC BY 4.0' } },
  };
  assert.equal(photoFromPage('银座', '銀座', { title: 'File:Ginza Cemetery 2025.jpg', imageinfo: [info] }), null);
  assert.equal(photoFromPage('银座', '銀座', { title: 'File:Togoshi Ginza 2025.jpg', imageinfo: [info] }), null);
  assert.ok(photoFromPage('银座', '銀座', { title: 'File:Ginza Wako 20241021.jpg', imageinfo: [info] }));
  assert.equal(reviewedPlacePhoto('银座', photoTitle('银座')).bundled, 'ginza');
  assert.deepEqual(scheduledLandmarks('逛谷中银座、户越银座和銀座線沿线'), []);
  assert.deepEqual(scheduledLandmarks('晚上去银座喝咖啡'), ['銀座']);
});

test('rejects horses, festival details and historical art even when the landmark name matches', () => {
  assert.equal(sceneQuality('Meiji Jingu horse.jpg', 'Meiji Shrine'), null);
  assert.equal(sceneQuality('道頓堀.jpg', 'Hiroshige woodblock print of Dotonbori', '2025'), null);
  assert.equal(sceneQuality('Dotonbori Osaka 1910.jpg'), null);
  assert.equal(sceneQuality('Dotonbori Osaka 1910.jpg', '', '2026-07-01'), null);
  assert.equal(sceneQuality('Shinsaibashi.jpg', 'An archival photograph of a shop window', '2026'), null);
  assert.equal(sceneQuality('Meiji Jingu sake barrel 2025.jpg'), null);
  assert.equal(sceneQuality('Meiji Jingu wedding 2026.jpg'), null);
  assert.ok(sceneQuality('Meiji Jingu main gate 2025.jpg'));
});
test('prefers recent representative scenes over older or unrelated alternatives', () => {
  const recent = { source: 'recent', quality: sceneQuality('Dotonbori canal 2025.jpg').score };
  const old = { source: 'old', quality: sceneQuality('Dotonbori canal 2005.jpg').score };
  assert.equal(choosePlacePhoto([recent, old], 'recent', () => 0.99), recent);
  assert.ok(sceneQuality('entrance.jpg', '', '2025-11-01').score > sceneQuality('entrance.jpg', '', '2010-11-01').score);
});
test('anime trips prefer varied modern streetscapes and Sangenjaya rejects the gym exterior', () => {
  const year = new Date().getUTCFullYear();
  const generic = { source: 'building', capturedYear: year, quality: 55 };
  const old = { source: 'old street', capturedYear: year - 12, quality: 44, urbanAccent: 22 };
  const first = { source: 'lit shops', capturedYear: year - 1, quality: 54, urbanAccent: 34 };
  const second = { source: 'alley', capturedYear: year - 4, quality: 47, urbanAccent: 22 };
  assert.equal(choosePlacePhoto([generic, old, first, second], undefined, () => 0, true), first);
  assert.equal(choosePlacePhoto([generic, old, first, second], [first.source, second.source], () => 0, true), second);
  assert.ok(sceneQuality('Carrot Tower and an alley in Sangenjaya.jpg', '', `${year - 4}`).score >= 30);
  assert.deepEqual(candidateFiles({ title: '三軒茶屋', pageimage: '三軒茶屋にあったスーパータイガージムの外観.jpg',
    images: [{ title: 'File:Carrot Tower and an alley in Sangenjaya, Setagaya, Tokyo.jpg' }] }),
  ['File:Carrot Tower and an alley in Sangenjaya, Setagaya, Tokyo.jpg']);
});
test('excludes marked mosaics, low-resolution thumbnails and a replica of a real landmark', () => {
  assert.equal(sceneQuality('Otaru Canal.jpg', 'Pixelated photograph'), null);
  assert.equal(sceneQuality('Outdoor film set of Shibuya Crossing 2020.jpg'), null);
  assert.equal(hasPhotoResolution(640, 480), false);
  assert.equal(hasPhotoResolution(1280, 720), true);
  const info = {
    thumburl: 'https://upload.wikimedia.org/a.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:A.jpg',
    width: 3000, height: 2000, thumbwidth: 640, thumbheight: 480,
    extmetadata: { Artist: { value: 'Author' }, LicenseShortName: { value: 'CC0' } },
  };
  assert.equal(photoFromPage('浅草寺', '浅草寺', { title: 'File:Temple.jpg', imageinfo: [info] }), null);
  const highRes = { ...info, thumbwidth: 1280, thumbheight: 800 };
  assert.equal(photoFromPage('浅草寺', '浅草寺', { title: 'File:Apsara senso-ji.jpg', imageinfo: [highRes] }), null);
  assert.ok(photoFromPage('浅草寺', '浅草寺', { title: 'File:Temple.jpg', imageinfo: [highRes] }));
});
test('the three reported landmarks use visually reviewed scene photos even when metadata APIs fail', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('metadata API unavailable'); };
  try {
    const photos = await loadPlacePhotos(['明治神宮', '渋谷スクランブル交差点(涩谷十字路口)', '道頓堀']);
    assert.deepEqual(photos.map((photo) => photo.capturedYear), [2025, 2026, 2026]);
    assert.ok(photos[0].source.includes('entrance_to_Meiji'));
    assert.ok(photos[1].source.includes('Shibuya_Crossing_in_July_2026'));
    assert.ok(photos[2].source.includes('Osaka_Dotonbori_yoru'));
    assert.equal(photoTitle('渋谷スクランブル交差点'), '渋谷駅前交差点');
  } finally { globalThis.fetch = original; }
});

test('reported landmarks use reviewed exterior photos without calling remote metadata', async () => {
  const original = globalThis.fetch;
  let lookups = 0;
  globalThis.fetch = async () => { lookups++; throw new Error('metadata unavailable'); };
  try {
    const names = ['太宰府天满宫', '城山展望台（鹿儿岛）', '东京晴空塔', '道顿堀', '北海道神宫'];
    const photos = await loadPlacePhotos(names);
    assert.equal(lookups, 0);
    assert.ok(['dazaifuGate', 'dazaifuHall'].includes(photos[0].bundled));
    assert.equal(photos[1].bundled, 'shiroyama');
    assert.equal(photos[2].bundled, 'skytree');
    assert.ok(['dotonbori', 'dotonboriAlt'].includes(photos[3].bundled));
    assert.equal(photos[4].bundled, 'hokkaidoJingu');
    const again = await loadPlacePhotos(names);
    assert.notEqual(again[0].source, photos[0].source);
    assert.notEqual(again[3].source, photos[3].source);
    assert.notEqual(photoTitle('城山展望台'), photoTitle(names[1]));
  } finally { globalThis.fetch = original; }
});

test('entity fallback accepts one exact label or alias and refuses ambiguous or merely similar names', () => {
  assert.equal(exactEntityId([{ id: 'Q1', match: { text: '宇都宮二荒山神社' } }], '宇都宮二荒山神社'), 'Q1');
  assert.equal(exactEntityId([{ id: 'Q1', match: { text: '二荒山神社' } }], '宇都宮二荒山神社'), null);
  assert.equal(exactEntityId([{ id: 'Q1', match: { text: '同名神社' } }, { id: 'Q2', match: { text: '同名神社' } }], '同名神社'), null);
});
test('Japanese public-domain labels are accepted without loosening non-free license rules', () => {
  const file = { imageinfo: [{ thumburl: 'https://upload.wikimedia.org/shrine.jpg', descriptionurl: 'https://ja.wikipedia.org/wiki/File:Shrine.jpg', extmetadata: { Artist: { value: 'Photographer' }, LicenseShortName: { value: 'パブリック・ドメイン' } } }] };
  assert.equal(photoFromPage('宇都宮二荒山神社', '宇都宮二荒山神社', file).license, 'Public domain');
  for (const license of ['CC BY-SA 2.5', 'CC BY 2.1 JP']) {
    assert.equal(photoFromPage('試験寺', '試験寺', { imageinfo: [{ ...file.imageinfo[0], extmetadata: { ...file.imageinfo[0].extmetadata, LicenseShortName: { value: license } } }] }).license, license);
  }
});

test('candidate pool retains real subject photos and excludes maps, logos and unrelated pictures', () => {
  assert.deepEqual(candidateFiles({ title: '試験寺', pageimage: 'Temple.jpg', images: [
    { title: 'ファイル:試験寺 朝.jpg' }, { title: 'ファイル:試験寺 夜.jpg' },
    { title: 'ファイル:試験寺 map.png' }, { title: 'ファイル:試験寺 logo.jpg' },
    { title: 'ファイル:Other temple.jpg' }, { title: 'ファイル:Flag.svg' },
  ] }), ['File:Temple.jpg', 'ファイル:試験寺 朝.jpg', 'ファイル:試験寺 夜.jpg']);
});
test('random selection avoids the previous photo and safely handles a single photo or none', () => {
  const a = { source: 'a' }, b = { source: 'b' }, c = { source: 'c' };
  assert.equal(choosePlacePhoto([a, b, c], 'a', () => 0), b);
  assert.equal(choosePlacePhoto([a, b, c], 'a', () => 0.99), c);
  assert.equal(choosePlacePhoto([a, a], 'a'), a);
  assert.equal(choosePlacePhoto([]), null);
});
test('cycles through distinct subjects of the same place before repeating a recent photo', () => {
  const pool = ['a', 'b', 'c', 'd', 'e', 'f'].map((source) => ({ source, quality: 50 }));
  const seen = [];
  for (let i = 0; i < 5; i++) seen.unshift(choosePlacePhoto(pool, seen, () => 0).source);
  assert.equal(new Set(seen).size, 5);
  assert.notEqual(choosePlacePhoto(pool, seen, () => 0).source, seen[0]);
});

test('uses native place names and exact explicit aliases, not translations or fuzzy search', () => {
  assert.equal(photoTitle('**代々木公園(代代木公园)**'), '代々木公園');
  assert.equal(photoTitle('宇治平等院'), '平等院');
  assert.equal(photoTitle('白糸ノ滝(白丝瀑布)'), '白糸の滝 (静岡県)');
  assert.equal(photoTitle('白糸の滝'), '白糸の滝');
});

test('Shizuoka map covers fall back to verified subject photographs rather than maps or broadcast towers', () => {
  assert.deepEqual(candidateFiles({ title: '日本平', pageimage: 'Shizuoka map.svg', images: [
    { title: 'File:Shizuoka location map.jpg' }, { title: 'File:Mt Fuji at Nihondaira.jpg' },
    { title: 'File:Nihondaira Digital Tower s2.JPG' }, { title: 'File:Nihondaira stadium.jpg' },
  ] }), ['File:Mt Fuji at Nihondaira.jpg']);
  assert.deepEqual(candidateFiles({ title: '熱海温泉', pageimage: 'Japan Izu map.webp', images: [{ title: 'File:Oyu Atami Onsen.jpg' }] }), ['File:Oyu Atami Onsen.jpg']);
});

test('longer recommendations fetch more than three places while keeping the eight-place bound', async () => {
  const original = globalThis.fetch;
  let requested = 0;
  globalThis.fetch = async (url) => {
    requested = new URL(url).searchParams.get('titles').split('|').length;
    return Response.json({ query: { pages: [] } });
  };
  try {
    const photos = await loadPlacePhotos(Array.from({ length: 10 }, (_, i) => `長旅試験${i}`));
    assert.equal(requested, 8);
    assert.equal(photos.length, 8);
  } finally { globalThis.fetch = original; }
});
test('requires safe real image/source hosts, attribution and a reusable license', () => {
  const file = { imageinfo: [{ thumburl: 'https://upload.wikimedia.org/a.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:A.jpg', extmetadata: { Artist: { value: '<a href="x">Photographer</a>' }, LicenseShortName: { value: 'CC BY-SA 4.0' } } }] };
  assert.equal(photoFromPage('清水寺', '清水寺', file).credit, 'Photographer');
  assert.equal(photoFromPage('清水寺', '清水寺', { imageinfo: [{ ...file.imageinfo[0], thumburl: 'https://fake.example/a.jpg' }] }), null);
  for (const license of ['Fair use', 'All rights reserved', '']) {
    assert.equal(photoFromPage('清水寺', '清水寺', { imageinfo: [{ ...file.imageinfo[0], extmetadata: { ...file.imageinfo[0].extmetadata, LicenseShortName: { value: license } } }] }), null);
  }
});
test('resolves exact redirected titles, rejects disambiguation and reuses in-flight requests', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls++;
    const params = new URL(url).searchParams;
    assert.equal(params.get('list'), null);
    if (params.get('prop')?.includes('pageimages')) return Response.json({ query: {
      redirects: [{ from: '試験寺旧称', to: '試験寺' }], pages: [
        { title: '試験寺', pageimage: 'Temple_photo.jpg' },
        { title: '曖昧テスト', pageimage: 'Other.jpg', pageprops: { disambiguation: '' } },
      ],
    } });
    return Response.json({ query: { pages: [{ title: 'ファイル:Temple photo.jpg', imageinfo: [{ thumburl: 'https://upload.wikimedia.org/temple.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Temple.jpg', extmetadata: { Artist: { value: 'Author' }, LicenseShortName: { value: 'CC0' } } }] }] } });
  };
  try {
    const names = ['試験寺旧称', '曖昧テスト', '存在しないテスト'];
    const [a, b] = await Promise.all([loadPlacePhotos(names), loadPlacePhotos(names)]);
    assert.deepEqual(a, b);
    assert.equal(a[0].name, '試験寺旧称');
    assert.equal(a[1], null); assert.equal(a[2], null); assert.equal(calls, 4); // two article queries and two fallbacks for the missing name
  } finally { globalThis.fetch = original; }
});

test('missing article photos fall back through an exact entity to its linked Commons image', async () => {
  const original = globalThis.fetch;
  const actions = [];
  globalThis.fetch = async (url) => {
    const params = new URL(url).searchParams;
    actions.push(params.get('action'));
    if (params.get('action') === 'wbsearchentities') return Response.json({ search: [{ id: 'Q987654', match: { text: '別名試験寺' } }] });
    if (params.get('action') === 'wbgetentities') return Response.json({ entities: { Q987654: {
      sitelinks: { jawiki: { title: '正式名称試験寺' } },
      claims: { P18: [{ rank: 'normal', mainsnak: { datavalue: { value: 'Verified temple.jpg' } } }] },
    } } });
    if (params.get('prop') === 'imageinfo') {
      assert.equal(new URL(url).hostname, 'commons.wikimedia.org');
      assert.equal(params.get('titles'), 'File:Verified temple.jpg');
      return Response.json({ query: { pages: [{ title: 'File:Verified temple.jpg', imageinfo: [{
        thumburl: 'https://upload.wikimedia.org/verified.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Verified_temple.jpg',
        extmetadata: { Artist: { value: 'Author' }, LicenseShortName: { value: 'CC BY-SA 4.0' } },
      }] }] } });
    }
    return Response.json({ query: { pages: [] } });
  };
  try {
    const [photo] = await loadPlacePhotos(['別名試験寺']);
    assert.equal(photo.name, '別名試験寺');
    assert.ok(decodeURIComponent(photo.page).endsWith('正式名称試験寺'));
    assert.deepEqual(actions, ['query', 'wbsearchentities', 'wbgetentities', 'query']);
  } finally { globalThis.fetch = original; }
});
test('explicit retry bypasses an earlier cached miss', async () => {
  const original = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async () => { attempts++; return Response.json({ query: { pages: [] }, search: [] }); };
  try {
    assert.deepEqual(await loadPlacePhotos(['再試行試験寺']), [null]);
    const first = attempts;
    await loadPlacePhotos(['再試行試験寺']);
    assert.equal(attempts, first);
    await loadPlacePhotos(['再試行試験寺'], { refresh: true });
    assert.ok(attempts > first);
  } finally { globalThis.fetch = original; }
});

test('cached pools choose again for new replies without requerying or changing earlier results', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls++;
    if (new URL(url).searchParams.get('prop')?.includes('pageimages')) return Response.json({ query: { pages: [{
      title: '写真試験寺', pageimage: '写真試験寺 朝.jpg', images: [{ title: 'ファイル:写真試験寺 夜.jpg' }],
    }] } });
    return Response.json({ query: { pages: ['朝', '夜'].map((scene) => ({ title: `ファイル:写真試験寺 ${scene}.jpg`, imageinfo: [{
      thumburl: `https://upload.wikimedia.org/${scene}.jpg`, descriptionurl: `https://commons.wikimedia.org/wiki/File:${scene}.jpg`,
      extmetadata: { Artist: { value: 'Author' }, LicenseShortName: { value: 'CC0' } },
    }] })) } });
  };
  try {
    const first = await loadPlacePhotos(['写真試験寺']);
    const originalSource = first[0].source;
    const second = await loadPlacePhotos(['写真試験寺']);
    assert.notEqual(second[0].source, originalSource);
    assert.equal(first[0].source, originalSource);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = original; }
});
test('photo API failure leaves the text conversation usable', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('offline'); };
  try { assert.deepEqual(await loadPlacePhotos(['オフライン試験']), [null]); }
  finally { globalThis.fetch = original; }
});

test('photo lookup reaches the last day even when the reply contains more than 21 unique sights', async () => {
  const original = globalThis.fetch;
  const names = Array.from({ length: 24 }, (_, index) => `旅行後半試験${index}`);
  const lookedUp = new Set();
  globalThis.fetch = async (url) => {
    const params = new URL(url).searchParams;
    if (params.get('prop')?.includes('pageimages')) {
      const titles = params.get('titles').split('|');
      titles.forEach((title) => lookedUp.add(title));
      return Response.json({ query: { pages: titles.map((title) => ({ title, pageimage: `${title}.jpg` })) } });
    }
    return Response.json({ query: { pages: params.get('titles').split('|').map((title) => ({ title, imageinfo: [{
      thumburl: 'https://upload.wikimedia.org/test.jpg',
      descriptionurl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`,
      extmetadata: { Artist: { value: 'Author' }, LicenseShortName: { value: 'CC0' } },
    }] })) } });
  };
  try {
    const photos = [];
    await loadReplyPhotos(names, (photo) => photos.push(photo.name), () => true);
    assert.deepEqual(lookedUp, new Set(names));
    assert.deepEqual(new Set(photos), new Set(names));
  } finally { globalThis.fetch = original; }
});

test('alternate Wikimedia host serves the same validated thumbnail path', () => {
  const image = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Otaru.jpg/960px-Otaru.jpg?utm_source=ja.wikipedia.org';
  assert.deepEqual(placePhotoUrls({ image }), [image, 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Otaru.jpg/960px-Otaru.jpg']);
  assert.deepEqual(placePhotoUrls({ image: 'https://other.example/Otaru.jpg' }), []);
});
