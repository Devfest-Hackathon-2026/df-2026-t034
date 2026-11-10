import assert from 'node:assert/strict';
import test from 'node:test';
import { formatAssistantText, getAssistantBlocks, getAssistantHighlights, getHighlightedSegments, getDayHeading, getIllustratedBlocks, getBudgetRows } from '../src/lib/assistant-text.ts';
import { getBudgetEstimate, getPhotoReplyBlocks, resolvePhotoReply, getScheduleRows, replyRevealProgress } from '../src/lib/assistant-text.ts';

test('reply progress waits for each photo in reading order, including when an earlier photo is skipped', () => {
  const stops = [{ index: 1, end: 24 }, { index: 3, end: 70 }];
  const settled = new Map();
  assert.deepEqual(replyRevealProgress(stops, settled, 23, 100), { limit: 24, shown: 23, waitingIndex: undefined });
  assert.deepEqual(replyRevealProgress(stops, settled, 99, 100), { limit: 24, shown: 24, waitingIndex: 1 });
  settled.set(1, null);
  assert.deepEqual(replyRevealProgress(stops, settled, 99, 100), { limit: 70, shown: 70, waitingIndex: 3 });
  settled.set(3, { name: '乐园照片' });
  assert.deepEqual(replyRevealProgress(stops, settled, 100, 100), { limit: 100, shown: 100, waitingIndex: undefined });
});

test('park days without a separate introduction use the scheduled park photo', () => {
  const reply = 'Day 4｜迪士尼全天畅玩\n\n当日安排\n07:30｜吃早餐\n09:00｜进入东京迪士尼海洋\n\nDay 5｜日本环球影城\n\n当日安排\n09:00｜到USJ\n\nDay 6｜東京ディズニーランド\n\n**東京ディズニーランド**\n这里有城堡。\n\n当日安排\n09:00｜进入東京ディズニーランド';
  const blocks = getPhotoReplyBlocks(reply);
  assert.deepEqual(blocks.flatMap((block) => block.dayPhotos ?? []), ['東京ディズニーシー', 'ユニバーサル・スタジオ・ジャパン']);
  assert.deepEqual(blocks.flatMap((block) => block.attraction ?? []), ['東京ディズニーランド']);
  assert.deepEqual(blocks.flatMap((block) => block.scheduleDay ?? []), [4, 5, 6]);
  assert.deepEqual(getPhotoReplyBlocks('Day 1｜东京迪士尼全天\n\n当日安排\n09:00｜抵达舞浜站')[0].dayPhotos, ['東京ディズニーリゾート']);
});

test('a full itinerary preserves all 19 schedule sections and separates the budget and follow-up', () => {
  const days = Array.from({ length: 19 }, (_, index) => `Day ${index + 1}｜路线\n\n当日安排\n07:30｜在酒店吃早餐\n20:00｜返回住宿`);
  const budget = '币种｜CNY\n人数｜2\n范围｜全程，不含购物\n交通｜7300｜9000｜16000\n住宿｜6300｜9900｜16000\n餐饮｜3800｜5200｜8500';
  const parsed = getPhotoReplyBlocks([...days, '小结\n路线概览。', `预算对比\n${budget}`, '继续调整\n您想多留一天在九州吗？'].join('\n\n'));
  assert.deepEqual(parsed.flatMap((block) => block.scheduleDay ?? []), Array.from({ length: 19 }, (_, index) => index + 1));
  assert.deepEqual(parsed.slice(-3).map(({ heading }) => heading), ['小结', '预算对比', '继续调整']);
  assert.deepEqual(getBudgetEstimate(parsed.at(-2).body), {
    currency: 'CNY', travelers: 2, scope: '全程，不含购物',
    items: [
      { label: '交通', amounts: [7300, 9000, 16000] },
      { label: '住宿', amounts: [6300, 9900, 16000] },
      { label: '餐饮', amounts: [3800, 5200, 8500] },
    ],
  });
  assert.equal(getBudgetEstimate(budget.replace('8500', '待定')), null);
  assert.equal(getBudgetEstimate(budget.replace('人数｜2', '人数｜0')), null);
  assert.equal(getBudgetEstimate(budget + '\n合计｜17400｜24100｜40500'), null);
});

test('the 21-day format keeps the regional overview, every Day schedule, and budget tiers', () => {
  const days = Array.from({ length: 21 }, (_, index) => (
    `Day ${index + 1}｜${index === 20 ? '返程' : '当天目标'}\n\n当日安排\n活动｜在酒店附近吃早餐\n活动｜沿街散步（建议晚上去，适合看夜景）`
  ));
  const overview = '第1–7天：北海道\n第8–20天：东京及关西\n第21天：返程';
  const budget = '币种｜CNY\n人数｜2\n范围｜全程估算\n交通｜100｜200｜300\n住宿｜100｜200｜300\n餐饮｜100｜200｜300';
  const reply = ['先按三周安排。', `行程规划\n${overview}`, '行程详情', ...days, '小结\n跨城日留些休息时间。', `预算对比\n${budget}`].join('\n\n');
  const blocks = getPhotoReplyBlocks(reply);
  assert.equal(blocks.find((block) => block.heading === '行程规划').body, overview);
  const schedules = blocks.filter((block) => block.scheduleDay);
  assert.deepEqual(schedules.map((block) => block.scheduleDay), Array.from({ length: 21 }, (_, index) => index + 1));
  assert.equal(getScheduleRows(schedules[0].body)[1].value, '沿街散步（建议晚上去，适合看夜景）');
  assert.equal(blocks.at(-1).heading, '预算对比');
  assert.equal(getBudgetEstimate(blocks.at(-1).body).travelers, 2);
});

test('separates an older single-line Day overview into a short heading and normal body text', () => {
  const first = '入住新宿或涩谷区域。傍晚前往新宿御苑，随后在周边吃饭。';
  const fifth = '游览金閣寺，下午前往京都站附近的购物区，傍晚返回大阪休息。';
  const parsed = getPhotoReplyBlocks(`Day 1｜抵达东京，${first}\n\nDay 5｜上午继续在京都探索，${fifth}\n\nDay 6｜大阪 → 福冈`);
  assert.deepEqual(parsed, [
    { heading: 'Day 1｜抵达东京', body: first },
    { heading: 'Day 5｜上午继续在京都探索', body: fifth },
    { heading: 'Day 6｜大阪 → 福冈', body: '' },
  ]);
});

test('keeps both Day 10 sights when Gemini omits blank lines and uses translated names in the table', () => {
  const reply = 'Day 10｜小樽\n**小樽運河**\n沿着运河散步。\n**小樽オルゴール堂(小樽八音盒堂)**\n看看各式八音盒。\n当日安排：\n07:30｜起床吃早餐\n09:00｜坐电车\n10:30｜逛小樽运河\n12:30｜吃午餐\n14:30｜去小樽八音盒堂\n17:30｜吃晚饭\n20:00｜返回酒店';
  const parsed = getPhotoReplyBlocks(reply);
  assert.deepEqual(parsed.flatMap((block) => block.attraction ?? []), ['小樽運河', '小樽オルゴール堂(小樽八音盒堂)']);
  const display = resolvePhotoReply(parsed, new Set(['小樽運河', '小樽オルゴール堂(小樽八音盒堂)']));
  assert.equal(display.at(-1).scheduleDay, 10);
  assert.equal(getScheduleRows(display.at(-1).body).length, 7);
  assert.deepEqual(resolvePhotoReply(parsed, new Set(), true), parsed);
});

test('pairs visited attractions with their own day schedule, including names without bold marks or using aliases', () => {
  const reply = [
    'Day 1｜札幌市区', '**大通公園**\n适合散步。', '**さっぽろテレビ塔(札幌电视塔)**\n可以看城市天际线。',
    '**小樽運河**\n傍晚适合拍照。', '**狸小路商店街**\n适合逛街。',
    '当日安排\n09:00｜大通公園散步\n11:00｜登札幌电视塔\n下午｜逛狸小路商店街',
    'Day 2｜东京', '明治神宮\n沿参道散步。', '渋谷スクランブル交差点\n看看街景。',
    '09:00｜去明治神宫\n10:30｜逛原宿\n12:00｜吃午餐\n14:00｜到涩谷十字路口\n17:30｜吃晚饭',
    '预算参考', '餐饮｜约3000日元\n交通｜约1000日元',
  ].join('\n\n');
  const blocks = resolvePhotoReply(getPhotoReplyBlocks(reply), new Set(['大通公園', '狸小路商店街', '小樽運河', '明治神宮', '渋谷スクランブル交差点']));
  assert.deepEqual(blocks.map(({ heading, photo }) => [heading, photo]), [
    ['Day 1｜札幌市区', undefined], ['大通公園', '大通公園'], ['狸小路商店街', '狸小路商店街'], ['当日安排', undefined],
    ['Day 2｜东京', undefined], ['明治神宮', '明治神宮'], ['渋谷スクランブル交差点', '渋谷スクランブル交差点'], ['当日安排', undefined],
    ['预算参考', undefined],
  ]);
  assert.deepEqual(getScheduleRows(blocks[3].body), [
    { label: '09:00', value: '大通公園散步' }, { label: '11:00', value: '登札幌电视塔' }, { label: '下午', value: '逛狸小路商店街' },
  ]);
  assert.deepEqual(blocks.flatMap((block) => block.scheduleDay ?? []), [1, 2]);
  assert.equal(getScheduleRows(blocks[7].body).length, 5);
  assert.equal(getScheduleRows(blocks.at(-1).body), null);
  assert.deepEqual(getPhotoReplyBlocks('Day 3｜返程\n\n上午｜去机场'), [
    { heading: 'Day 3｜返程', body: '' }, { heading: '当日安排', body: '上午｜去机场', scheduleDay: 3 },
  ]);
});

test('a full day keeps four scheduled highlights and omits an extra fifth card', () => {
  const names = ['三軒茶屋', '渋谷駅前交差点', '渋谷PARCO', '代々木公園', '明治神宮'];
  const sights = names.map((name) => `**${name}**\n这里适合短暂停留。`);
  const schedule = `当日安排\n${names.map((name, index) => `${10 + index}:00｜去${name}`).join('\n')}`;
  for (const reply of [['Day 1｜东京动漫巡礼', ...sights, schedule], ['景点推荐', ...sights]]) {
    assert.deepEqual(getPhotoReplyBlocks(reply.join('\n\n')).flatMap((block) => block.attraction ?? []), names.slice(0, 4));
  }
});

test('a Shiroyama overlook in the Kagoshima schedule gets the correct landmark identity', () => {
  const plan = (city, view) => `Day 20｜${city}闲暇\n\n**城山展望台**\n${view}\n\n当日安排\n活动｜早餐后前往城山展望台\n活动｜午餐`;
  const photo = (text) => getPhotoReplyBlocks(text).find((block) => block.heading === '城山展望台')?.attraction;
  assert.equal(photo(plan('鹿儿岛', '俯瞰樱岛。')), '鹿児島城山展望台');
  assert.equal(photo(plan('高山', '俯瞰市区。')), '城山展望台');
});

test('Maruyama Park uses the Sapporo photo only with Sapporo context', () => {
  const plan = (city) => `Day 5｜${city}散步\n\n**円山公園**\n在林荫道散步。\n\n当日安排\n活动｜逛圆山公园\n活动｜吃午餐`;
  const photo = (city) => getPhotoReplyBlocks(plan(city)).find((block) => block.heading === '円山公園')?.attraction;
  assert.equal(photo('札幌'), '札幌円山公園');
  assert.equal(photo('京都'), '円山公園');
});

test('schedule-only landmarks get distinct photos before their own Day table, up to four', () => {
  const reply = [
    'Day 4｜东京', '当日安排\n15:00｜去芝公園看東京タワー\n17:00｜在六本木散步\n20:00｜登上展望台看夜景',
    'Day 5｜原宿与涩谷', '**明治神宮**\n沿参道散步。',
    '当日安排\n10:00｜走明治神宫参道\n12:00｜逛原宿竹下通\n16:00｜在涩谷スクランブル交差点拍照\n20:00｜逛 SHIBUYA SCRAMBLE SQUARE\n21:00｜去银座',
    'Day 6｜兵库', '当日安排\n09:00｜前往**姫路城**\n12:00｜吃午饭',
  ].join('\n\n');
  const blocks = getPhotoReplyBlocks(reply);
  assert.deepEqual(blocks.flatMap(({ attraction, scheduleDay }) => attraction ?? scheduleDay ?? []), [
    '芝公園', '東京タワー', '六本木', 4,
    '明治神宮', '竹下通り', '渋谷駅前交差点', '渋谷スクランブルスクエア', 5,
    '姫路城', 6,
  ]);
  assert.ok(blocks.find(({ attraction }) => attraction === '姫路城').photoOnly);
  assert.equal(getScheduleRows(blocks.at(-1).body)[0].value, '前往姫路城');
});

test('Naha and Fukuoka retain the place introductions and add only a matching dish photo per day', () => {
  const reply = [
    'Day 1｜那霸', '**國際通り(国际通)**\n沿街逛逛。', '**那覇市第一牧志公設市場**\n看看本地海产。',
    '当日安排\n15:00｜逛那霸国际通\n16:00｜去第一牧志公设市场\n18:00｜吃**沖縄そば**',
    'Day 4｜福冈', '**中洲博多屋台(博多路边摊)**\n在这里可以吃博多拉面。',
    '当日安排\n15:00｜在大濠公园散步\n19:30｜去中洲屋台吃晚饭',
  ].join('\n\n');
  const blocks = getPhotoReplyBlocks(reply);
  assert.deepEqual(blocks.flatMap(({ attraction }) => attraction ?? []), [
    '國際通り(国际通)', '那覇市第一牧志公設市場', '沖縄そば(冲绳面)',
    '中洲博多屋台(博多路边摊)', '大濠公園', '博多ラーメン(博多拉面)',
  ]);
  assert.ok(blocks.find(({ attraction }) => attraction === '博多ラーメン(博多拉面)').photoOnly);
  assert.deepEqual(getPhotoReplyBlocks('可以试试博多拉面，汤底浓郁。').flatMap(({ attraction }) => attraction ?? []), ['博多ラーメン(博多拉面)']);
  const fullDay = 'Day 1｜东京\n\n当日安排\n09:00｜逛银座\n10:00｜逛芝公园\n11:00｜看东京塔\n13:00｜逛六本木\n18:00｜吃博多拉面';
  assert.deepEqual(getPhotoReplyBlocks(fullDay).flatMap(({ attraction }) => attraction ?? []), ['銀座', '芝公園', '東京タワー', '六本木']);
});

test('Kyoto combined street names and Uji matcha retain their own photos', () => {
  const reply = [
    'Day 4｜京都东山', '**二年坂・三年坂**\n走石板路。', '当日安排\n活动｜逛二宁坂和产宁坂\n活动｜吃午饭',
    'Day 6｜宇治', '**宇治**\n以抹茶闻名。', '当日安排\n活动｜前往宇治吃抹茶甜点\n活动｜返回酒店',
  ].join('\n\n');
  assert.deepEqual(getPhotoReplyBlocks(reply).flatMap(({ attraction }) => attraction ?? []),
    ['二年坂・三年坂', '宇治抹茶（美食示例）']);
});

test('associates a horizontal photo with its own day and keeps a day with no verified photo', () => {
  const reply = 'Day 1｜札幌\n下午：逛大通公園。晚上吃汤咖喱。\n\n配图：大通公園\n\nDay 2｜小樽\n上午：逛小樽運河。\n配图：明治神宮\n\n交通小提示\n从札幌坐 JR。\n配图：札幌駅';
  const blocks = getPhotoReplyBlocks(reply);
  assert.deepEqual(resolvePhotoReply(blocks, new Set(['大通公園', '明治神宮', '札幌駅'])), [
    { heading: 'Day 1｜札幌', body: '下午：逛大通公園。晚上吃汤咖喱。', dayPhotos: ['大通公園'], photo: '大通公園' },
    { heading: 'Day 2｜小樽', body: '上午：逛小樽運河。' },
    { heading: '交通小提示', body: '从札幌坐 JR。' },
  ]);
});

test('keeps only photo-backed attraction introductions and lets older replies match their own day', () => {
  const reply = '景点推荐\n\n**大通公園**\n散步看看电视塔。\n\n**小樽運河**\n傍晚适合拍照。\n\n行程草案\n\nDay 1｜札幌\n下午：去大通公園\n\nDay 2｜小樽\n下午：逛小樽運河';
  const blocks = getPhotoReplyBlocks(reply);
  const illustrated = resolvePhotoReply(blocks, new Set(['大通公園']));
  assert.deepEqual(illustrated.map(({ heading, photo }) => [heading, photo]), [
    ['景点推荐', undefined], ['大通公園', '大通公園'], ['行程草案', undefined],
    ['Day 1｜札幌', '大通公園'], ['Day 2｜小樽', undefined],
  ]);
  assert.deepEqual(resolvePhotoReply(blocks, new Set()).map(({ heading }) => heading), [
    '行程草案', 'Day 1｜札幌', 'Day 2｜小樽',
  ]);
});

test('initial draft keeps standalone sections, pairs each sight with its own description, and preserves budget rows', () => {
  const reply = '东京三天可以按区域慢慢逛。\n\n景点推荐\n\n**代々木公園(代代木公园)**\n适合散步。也可以坐下来休息。\n\n**明治神宮**\n从原宿顺路前往。\n\n行程草案\n可按你的想法调整\n\nDay 1：原宿\n上午：明治神宮\n下午：代々木公園\n晚上：附近吃饭\n\n预算参考\n人均每天，不含机票和住宿，以下为估算。\n\n餐饮｜约3000～5000日元\n市内交通｜约800～1200日元\n\n小结\n先把路线排顺，再按你喜欢的节奏细化。';
  const blocks = getIllustratedBlocks(reply);
  assert.ok(blocks.some((block) => block.heading === '景点推荐' && !block.body));
  const place = blocks.find((block) => block.heading === '代々木公園(代代木公园)');
  assert.deepEqual(place.places, ['代々木公園(代代木公园)']);
  assert.equal(place.body, '适合散步。也可以坐下来休息。');
  assert.ok(blocks.some((block) => block.heading === 'Day 1：原宿'));
  const budget = blocks.find((block) => block.body.startsWith('餐饮｜'));
  assert.deepEqual(getBudgetRows(budget.body), [{ label: '餐饮', value: '约3000～5000日元' }, { label: '市内交通', value: '约800～1200日元' }]);
  assert.ok(blocks.some((block) => block.heading === '小结'));
});
test('ordinary text and markdown separators never become budget rows', () => {
  assert.equal(getBudgetRows('秋葉原｜上野\n明治神宮｜原宿'), null);
  assert.equal(getBudgetRows('|项目|金额|\n|---|---|'), null);
  assert.equal(getBudgetRows('只有一行'), null);
});

test('real model budget labels for attractions and miscellaneous costs render as rows', () => {
  const text = '餐饮｜约15000～25000日元\n交通｜约3000～5000日元\n景点｜约5000～10000日元\n杂项｜约5000～8000日元';
  const blocks = getIllustratedBlocks(`预算参考\n按人均全程估算。\n\n${text}`);
  assert.equal(getBudgetRows(blocks.at(-1).body).length, 4);
  assert.equal(blocks.at(-1).heading, undefined);
});

test('puts each photo after its own recommendation even inside a dense numbered section', () => {
  const content = '4. 推荐的景点\n第一个推荐 **清水寺**，适合慢慢逛。\n第二个推荐 **平等院**，适合拍照。\n\n5. 交通\n从京都站出发。';
  assert.deepEqual(getIllustratedBlocks(content), [
    { heading: '4. 推荐的景点', body: '第一个推荐 清水寺，适合慢慢逛。', places: ['清水寺'] },
    { body: '第二个推荐 平等院，适合拍照。', places: ['平等院'] },
    { heading: '5. 交通', body: '从京都站出发。', places: [] },
  ]);
});
test('same-line recommendations split at a sentence boundary and repeated names do not repeat photos', () => {
  const blocks = getIllustratedBlocks('1. 景点\n先去**清水寺**看看。再去**平等院**散步。\n\n2. 返程\n从清水寺回酒店。');
  assert.deepEqual(blocks.map((block) => block.places), [['清水寺'], ['平等院'], []]);
  assert.equal(blocks[1].body, '再去平等院散步。');
  assert.ok(blocks[0].body.endsWith('看看。'));
});

test('only explicit day headings become day badges; ordinary advice keeps its numbering', () => {
  assert.deepEqual(getDayHeading('Day 2：自然风景与寺庙'), { number: 2, title: '自然风景与寺庙' });
  assert.deepEqual(getDayHeading('第3天 宇治散步'), { number: 3, title: '宇治散步' });
  assert.equal(getDayHeading('2. 每天少安排几个景点'), null);
  assert.equal(getDayHeading('D0 无效'), null);
  assert.deepEqual(getAssistantBlocks('D1 京都传统街道\n\n上午：清水寺\n下午：八坂神社\n\nD2 自然风景\n上午：嵐山'), [
    { heading: 'D1 京都传统街道', body: '上午：清水寺\n下午：八坂神社' },
    { heading: 'D2 自然风景', body: '上午：嵐山' },
  ]);
});

test('cleans the headings, emphasis and nested bullets seen in travel replies', () => {
  const reply = '### 行程概要\n\n* **Day 1：秋叶原**\n  * **美食**：汤咖喱\n\n\n你更喜欢*轻松*一点吗？';
  assert.equal(formatAssistantText(reply), '行程概要\n\nDay 1：秋叶原\n\n美食：汤咖喱\n\n你更喜欢轻松一点吗？');
});

test('preserves useful link destinations, prices, numbered days and plain text', () => {
  const reply = '1. C# 主题展\n2. 预算约 5,000 日元（估算）\n\n[官方信息](https://example.com/?a=1&b=2)\n费用 2 * 300 = 600';
  assert.equal(formatAssistantText(reply), '1. C# 主题展\n2. 预算约 5,000 日元（估算）\n\n官方信息 (https://example.com/?a=1&b=2)\n费用 2 * 300 = 600');
});

test('removes code fences and separators without dropping their contents', () => {
  assert.equal(formatAssistantText('```text\n__轻松路线__\n```\n---\n\n先逛池袋，再吃拉面。'), '轻松路线\n\n先逛池袋，再吃拉面。');
});

test('separates the recommendation from a following question in the screenshot', () => {
  const reply = '每天锁定一个主要区域会轻松很多，少一点折腾。你更倾向于秋叶原，还是池袋？';
  assert.equal(formatAssistantText(reply), '每天锁定一个主要区域会轻松很多，少一点折腾。\n\n你更倾向于秋叶原，还是池袋？');
});

test('keeps existing paragraph breaks and link punctuation without adding empty paragraphs', () => {
  const reply = '先逛秋叶原。\n\n参考 https://example.com/trip?q=tokyo。\n\n你觉得怎么样？';
  assert.equal(formatAssistantText(reply), reply);
});

test('separates Japanese place headings and their descriptions into readable blocks', () => {
  assert.deepEqual(getAssistantBlocks('秋葉原ラジオ会館(秋叶原无线电会馆)\n适合逛手办和模型。\n\n你想先逛哪一个？'), [
    { heading: '秋葉原ラジオ会館(秋叶原无线电会馆)', body: '适合逛手办和模型。' },
    { body: '你想先逛哪一个？' },
  ]);
});

test('keeps ordinary sentences and a multiline list as body text', () => {
  assert.deepEqual(getAssistantBlocks('先确认预算，\n再选择住宿。\n\n• 秋叶原\n• 池袋'), [
    { body: '先确认预算，\n再选择住宿。' },
    { body: '秋叶原' },
    { body: '池袋' },
  ]);
});

test('keeps numbered guide sections with their own paragraphs and a soft closing', () => {
  const reply = '京都想轻松玩，少排点就好。\n\n1. 住宿选对位置\n\n住在交通方便的地方。累了随时回去歇一会儿。\n\n2. 留一点空白\n逛书店，或者沿鸭川慢慢走。\n\n如果你告诉我待几天，我可以接着帮你排路线。';
  assert.deepEqual(getAssistantBlocks(reply), [
    { body: '京都想轻松玩，少排点就好。' },
    { heading: '1. 住宿选对位置', body: '住在交通方便的地方。累了随时回去歇一会儿。' },
    { heading: '2. 留一点空白', body: '逛书店，或者沿鸭川慢慢走。' },
    { body: '如果你告诉我待几天，我可以接着帮你排路线。' },
  ]);
  assert.equal(formatAssistantText(reply), reply);
});

test('removes legacy bullet symbols without dropping their text', () => {
  assert.equal(formatAssistantText('1. 吃饭别太赶\n• 午餐错开高峰。\n● 看到咖啡馆就歇一会。'), '1. 吃饭别太赶\n\n午餐错开高峰。\n\n看到咖啡馆就歇一会。');
  assert.equal(formatAssistantText('•午餐错开高峰。\n▪ 留时间喝杯咖啡。'), '午餐错开高峰。\n\n留时间喝杯咖啡。');
});

test('turns recommended Japanese names into emphasis without visible markers', () => {
  const reply = '2. 值得优先去的景点\n**代々木公園(代代木公园)**适合散步，**明治神宮**适合感受参道氛围。';
  const highlights = getAssistantHighlights(reply);
  assert.deepEqual(highlights, ['代々木公園(代代木公园)', '明治神宮']);
  const plain = formatAssistantText(reply);
  const segments = getHighlightedSegments(plain, highlights);
  assert.equal(segments.map((segment) => segment.text).join(''), plain);
  assert.deepEqual(segments.filter((segment) => segment.bold).map((segment) => segment.text), highlights);
  assert.doesNotMatch(plain, /\*\*/);
});

test('keeps longer-trip recommendations up to eight unique names and preserves unmarked text', () => {
  assert.deepEqual(getAssistantHighlights('**清水寺** **清水寺** **嵐山** **金閣寺** **銀閣寺** **1. 标题**'), ['清水寺', '嵐山', '金閣寺', '銀閣寺']);
  assert.equal(getAssistantHighlights(Array.from({ length: 10 }, (_, i) => `**景点${i}**`).join(' ')).length, 8);
  assert.deepEqual(getHighlightedSegments('正文不变。', []), [{ text: '正文不变。', bold: false }]);
});
