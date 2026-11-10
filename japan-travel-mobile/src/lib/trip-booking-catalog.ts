// Official Trip.com pages reviewed 2026-11-09. Extend only after checking title + municipality.
// No prices, inventory or AI-provided URLs are stored here.
export const hotelCities: Record<string, { slug: string; id: number }> = {
  '東京': { slug: 'tokyo', id: 228 }, '札幌': { slug: 'sapporo', id: 641 },
  '京都': { slug: 'kyoto', id: 734 }, '大阪': { slug: 'osaka', id: 219 },
  '函館': { slug: 'hakodate', id: 800 }, '宇都宮': { slug: 'utsunomiya', id: 35778 }, '福岡': { slug: 'fukuoka', id: 248 }, '名古屋': { slug: 'nagoya', id: 360 },
};
export const flightRoutes: Record<string, string> = {
  '上海|函館': 'shanghai-to-hakodate/airfares-sha-hkd', '函館|上海': 'hakodate-to-shanghai/airfares-hkd-sha',
  '東京|札幌': 'tokyo-to-sapporo/airfares-tyo-spk', '札幌|東京': 'sapporo-to-tokyo/airfares-spk-tyo',
  '東京|大阪': 'tokyo-to-osaka/airfares-tyo-osa', '大阪|東京': 'osaka-to-tokyo/airfares-osa-tyo',
  '東京|福岡': 'tokyo-to-fukuoka/airfares-tyo-fuk', '福岡|東京': 'fukuoka-to-tokyo/airfares-fuk-tyo',
  '大阪|札幌': 'osaka-to-sapporo/airfares-osa-spk', '札幌|大阪': 'sapporo-to-osaka/airfares-spk-osa',
};
export const railRoutes: Record<string, string> = {
  '東京|宇都宮': 'tokyo-to-utsunomiya', '宇都宮|東京': 'utsunomiya-to-tokyo',
  '東京|京都': 'tokyo-to-kyoto', '京都|東京': 'kyoto-to-tokyo',
  '大阪|京都': 'osaka-to-kyoto', '東京|大阪': 'tokyo-to-osaka',
};
export type AttractionPage = { city: string; names: string[]; path: string; freeEntry?: boolean; visitNote?: string; officialLinks?: { label: string; url: string; shortLabel?: string }[] };
export const attractionPages: AttractionPage[] = [
  { city: '函館', names: ['五稜郭タワー', '五棱郭塔', '五稜郭塔', 'Goryokaku Tower', 'Goryōkaku Tower'], path: 'hakodate/gorykaku-tower-94328', visitNote: '这是观景塔页面，登塔票与公园参观分开核对。' },
  { city: '小樽', names: ['小樽運河', '小樽运河', 'Otaru Canal'], path: 'otaru/otaru-canal-90716', freeEntry: true, visitNote: '运河沿岸参观免费；游船等付费体验不包含在内。' },
  { city: '札幌', names: ['北海道神宮', '北海道神宫', 'Hokkaido Jingu', 'Hokkaido Shrine'], path: 'sapporo/hokkaido-jingu-90554', freeEntry: true },
  { city: '函館', names: ['函館山展望台', '函馆山展望台', '函館山展望臺', 'Mt. Hakodate Observatory', 'Mount Hakodate Observatory'], path: 'hakodate/mt-hakodate-observatory-61929972', freeEntry: true, visitNote: '展望台参观与上山交通分开核对；缆车需另外购票，不能把免费参观理解为缆车免费。', officialLinks: [{ label: '函馆山缆车官方购票说明', shortLabel: '缆车票务', url: 'https://334.co.jp/en/en-advance-ticket/' }, { label: '缆车营业时间与票价', shortLabel: '票价与营业', url: 'https://334.co.jp/en/en-price/' }] },
  { city: '函館', names: ['函館山', '函馆山', 'Mount Hakodate', 'Mt. Hakodate'], path: 'hakodate/mount-hakodate-94334', freeEntry: true, visitNote: '山体参观不等于缆车免费，请另行核对上山交通和季节限制。', officialLinks: [{ label: '函馆山缆车官方购票说明', shortLabel: '缆车票务', url: 'https://334.co.jp/en/en-advance-ticket/' }] },
  { city: '札幌', names: ['さっぽろテレビ塔', '札幌テレビ塔', '札幌电视塔', '札幌電視塔', 'Sapporo TV Tower'], path: 'sapporo/sapporo-tv-tower-94200', visitNote: '此页有电视塔门票选项，需继续选择使用日期、票种和人数；不是已预订的订单。' },
  { city: '東京', names: ['東京スカイツリー', '东京晴空塔', '東京晴空塔', 'Tokyo Skytree'], path: 'tokyo/tokyo-skytree-91422' },
  { city: '東京', names: ['浅草寺', '淺草寺', 'Senso-ji', 'Sensoji', 'Sensō-ji', 'Senso-ji Temple'], path: 'tokyo/senso-ji-78892', freeEntry: true },
  { city: '東京', names: ['東京タワー', '东京塔', '東京塔', '东京铁塔', 'Tokyo Tower'], path: 'tokyo/tokyo-tower-78880' },
  { city: '京都', names: ['清水寺', 'Kiyomizu-dera', 'Kiyomizu-dera Temple'], path: 'kyoto/kiyomizu-dera-temple-78812' },
  { city: '大阪', names: ['日本环球影城', '日本環球影城', '大阪环球影城', 'ユニバーサル・スタジオ・ジャパン', 'Universal Studios Japan', 'USJ'], path: 'osaka/universal-studios-japan-81012' },
  { city: '札幌', names: ['大通公園', '大通公园', 'Odori Park'], path: 'sapporo/odori-park-78890', freeEntry: true },
  { city: '福岡', names: ['福岡タワー', '福冈塔', '福岡塔', 'Fukuoka Tower'], path: 'fukuoka/fukuoka-tower-92677' },
  { city: '福岡', names: ['中洲屋台街', '中州屋台街', '中洲屋台', '中洲屋台横丁', '福冈中洲屋台街', '福岡中洲屋台街', '中洲美食街', 'Nakasu Food Stalls Street', 'Nakasu Yatai', 'Nakasu Yatai Yokocho'], path: 'fukuoka/nakasu-food-stalls-street-145039597', freeEntry: true },
];

// Official operator admission/rental pages additionally reviewed 2026-11-10. No live stock or prices.
type OfficialPage = { city: string; baseCities?: string[]; requirement?: string; names: string[]; url: string; label: string; note: string };
export const officialAttractionPages: OfficialPage[] = [{ city: '函館', names: ['函館山ロープウェイ', '函馆山缆车', '函館山纜車', 'Mt. Hakodate Ropeway', 'Mount Hakodate Ropeway'], url: 'https://334.co.jp/en/en-advance-ticket/', label: '缆车官方购票说明', note: '官方说明页包含预售票购买方式；请核对票种、使用规则及营业情况。' },
  { city: '東京', names: ['上野動物園', '上野动物园', 'Ueno Zoo', 'Ueno Zoological Gardens'], url: 'https://www.tokyo-zoo.net/ueno/visitor-info/tickets/index.html', label: '动物园官方票务', requirement: '按票种入园', note: '上野动物园有独立入园规则，不包含在上野公园免费散步范围内。' },
  { city: '札幌', names: ['円山動物園', '札幌市円山動物園', '圆山动物园', '札幌圆山动物园', 'Maruyama Zoo', 'Sapporo Maruyama Zoo'], url: 'https://www.city.sapporo.jp/zoo/info/riyo/kaienjikan.html', label: '动物园官方票务', requirement: '按票种入园', note: '円山动物园与免费公园分开入园；票种及减免条件以官网为准。' },
  ...['ハンターマウンテン塩原', '猎人山盐原滑雪场', '猎人山塩原滑雪场', 'Hunter Mountain Shiobara', 'Hunter Mountain Shiobara Ski Resort'].flatMap(name => [
    { city: '那須塩原', baseCities: ['宇都宮'], names: [name, `${name} 雪票 / 缆车票`], url: 'https://www.hunter.co.jp/winter/ticket/', label: '雪场官方雪票', requirement: '雪票单独购买', note: '已定位那须盐原的 Hunter Mountain 雪场票务；需按季节、营业及积雪情况选择雪票。' },
    { city: '那須塩原', baseCities: ['宇都宮'], names: [`${name} 雪具 / 雪服租赁`], url: 'https://www.hunter.co.jp/winter/rental/', label: '雪具官方租赁', requirement: '租赁另付费', note: '已定位同一雪场的雪具与雪服租赁说明，租赁与雪票分开选择。' },
  ]),
];
