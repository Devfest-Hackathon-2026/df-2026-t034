// Only exact Japanese Wikipedia titles (including explicit aliases), never a
// fuzzy image search or an image URL invented by the model.
import { reviewedPlacePhoto } from './reviewed-place-photos.ts';
export type PlacePhoto = { name: string; image: string; page: string; source: string; credit: string; license: string; quality?: number; capturedYear?: number; urbanAccent?: number; bundled?: 'meiji' | 'shibuya' | 'dotonbori' | 'osakaCastlePark' | 'disneyland' | 'disneySea' | 'disneyResort' | 'universalStudios' | 'ginza' | 'shibaPark' | 'tokyoTower' | 'roppongi' | 'takeshitaStreet' | 'shibuyaSquare' | 'kokusaiDori' | 'makishiMarket' | 'hakataYatai' | 'ohoriPark' | 'hakataRamen' | 'okinawaSoba' | 'dazaifuGate' | 'dazaifuHall' | 'shiroyama' | 'skytree' | 'hokkaidoJingu' | 'dotonboriAlt' | 'maruyamaPark' | 'sapporoBeerMuseum' | 'kiyomizuDera' | 'fushimiInari' | 'sakurajima' | 'shuriGate' | 'shinsaibashiArcade' | 'shinsaibashiNight' | 'ninenzaka' | 'sannenzaka' | 'ujiByodoin' | 'ujiMatcha' | 'ujiBridge'; verifiedOnly?: boolean; alternates?: PlacePhoto[] };
type WikiPage = {
  title?: string; missing?: boolean; pageprops?: { disambiguation?: string; wikibase_item?: string };
  pageimage?: string;
  images?: { title: string }[];
  imageinfo?: { thumburl?: string; thumbwidth?: number; thumbheight?: number; descriptionurl?: string; mime?: string; width?: number; height?: number; extmetadata?: Record<string, { value?: string }> }[];
};
type Entity = { labels?: Record<string, { value: string }>; sitelinks?: { jawiki?: { title: string } }; claims?: Record<string, { rank?: string; mainsnak?: { datavalue?: { value?: unknown } } }[]> };
type WikiResult = { search?: { id: string; match?: { text: string } }[]; entities?: Record<string, Entity>; query?: { pages?: WikiPage[]; categorymembers?: { title: string }[]; normalized?: { from: string; to: string }[]; redirects?: { from: string; to: string }[] } };
const endpoint = 'https://ja.wikipedia.org/w/api.php';
const aliases: Record<string, string> = {
  '心斋桥': '心斎橋筋商店街', '心斎橋': '心斎橋筋商店街', '心齋橋': '心斎橋筋商店街',
  '心斋桥筋商店街': '心斎橋筋商店街', '心齋橋筋商店街': '心斎橋筋商店街', '心斋桥商店街': '心斎橋筋商店街',
  '二寧坂': '二年坂', '二宁坂': '二年坂', '産寧坂': '三年坂', '产宁坂': '三年坂', '三寧坂': '三年坂',
  '宇治市': '宇治', '宇治桥': '宇治橋', '宇治抹茶甜品': '宇治抹茶', '宇治抹茶甜点': '宇治抹茶', '宇治抹茶点心': '宇治抹茶',
  '平等院鳳凰堂': '平等院', '平等院凤凰堂': '平等院',
  '宇治平等院': '平等院', '嵐山竹林': '竹林の小径', '白糸ノ滝': '白糸の滝 (静岡県)',
  '渋谷スクランブル交差点': '渋谷駅前交差点', '涩谷十字路口': '渋谷駅前交差点', '渋谷交差点': '渋谷駅前交差点',
  '明治神宫': '明治神宮', '道顿堀': '道頓堀', '大阪城公园': '大阪城公園',
  '太宰府天满宫': '太宰府天満宮', '太宰府天滿宮': '太宰府天満宮', '大宰府天満宮': '太宰府天満宮',
  '东京晴空塔': '東京スカイツリー', '东京天空树': '東京スカイツリー', '晴空塔': '東京スカイツリー', 'tokyo skytree': '東京スカイツリー',
  '鹿儿岛城山展望台': '鹿児島城山展望台', '鹿児島市城山展望台': '鹿児島城山展望台', '北海道神宫': '北海道神宮',
  '札幌圆山公园': '札幌円山公園', '札幌ビール博物館': 'サッポロビール博物館', '札幌啤酒博物馆': 'サッポロビール博物館',
  '圆山公园': '円山公園', '圓山公園': '円山公園',
  '中岛公园': '中島公園', '丰平馆': '豊平館', '大通公园': '大通公園',
  '札幌市钟楼': '札幌市時計台', '札幌钟楼': '札幌市時計台', '札幌电视塔': 'さっぽろテレビ塔',
  '樱岛': '桜島', '櫻島': '桜島', '首里城公園': '首里城', '首里城公园': '首里城',
  '小樽运河': '小樽運河', '小樽八音盒堂': '小樽オルゴール堂', '小樽音乐盒堂': '小樽オルゴール堂',
  '三轩茶屋': '三軒茶屋',
  '银座': '銀座', '芝公园': '芝公園', '东京塔': '東京タワー', '東京塔': '東京タワー',
  '原宿竹下通': '竹下通り', '原宿竹下通り': '竹下通り', '竹下通': '竹下通り',
  '涩谷スクランブル交差点': '渋谷駅前交差点', '涩谷站前十字路口': '渋谷駅前交差点',
  'shibuya scramble square': '渋谷スクランブルスクエア', '涩谷scramble square': '渋谷スクランブルスクエア',
  '涩谷十字广场': '渋谷スクランブルスクエア', '伏见稻荷大社': '伏見稲荷大社',
  'shibuya crossing': '渋谷駅前交差点', 'takeshita street': '竹下通り', 'tokyo tower': '東京タワー',
  'shiba park': '芝公園', 'ginza': '銀座', 'roppongi': '六本木', 'meiji jingu': '明治神宮',
  '国际通': '国際通り', '國際通': '国際通り', '國際通り': '国際通り', '那霸国际通': '国際通り', '那覇国際通り': '国際通り', '那覇の国際通り': '国際通り',
  '牧志公設市場': '第一牧志公設市場', '牧志公设市场': '第一牧志公設市場', '第一牧志公设市场': '第一牧志公設市場',
  '那覇市第一牧志公設市場': '第一牧志公設市場', '那霸市第一牧志公设市场': '第一牧志公設市場',
  '牧志市場': '第一牧志公設市場', '牧志市场': '第一牧志公設市場',
  '博多路边摊': '博多屋台', '中洲屋台': '博多屋台', '中洲屋台街': '博多屋台', '中洲路边摊': '博多屋台',
  '中洲博多屋台': '博多屋台', '中洲の屋台': '博多屋台', '中洲の屋台街': '博多屋台',
  '博多屋台街': '博多屋台', '博多の屋台': '博多屋台', '福岡の屋台': '博多屋台',
  '大濠公园': '大濠公園',
  '博多拉面': '博多ラーメン', '博多拉麵': '博多ラーメン', '冲绳面': '沖縄そば', '冲绳荞麦面': '沖縄そば',
  '冲绳荞麦麵': '沖縄そば', '冲绳面条': '沖縄そば', '沖縄ソバ': '沖縄そば',
  '东京迪士尼乐园': '東京ディズニーランド', '東京迪士尼樂園': '東京ディズニーランド', '迪士尼乐园': '東京ディズニーランド',
  '东京迪士尼海洋': '東京ディズニーシー', '東京迪士尼海洋': '東京ディズニーシー', '迪士尼海洋': '東京ディズニーシー',
  '东京迪士尼海洋乐园': '東京ディズニーシー', '迪士尼海洋乐园': '東京ディズニーシー',
  '东京迪士尼度假区': '東京ディズニーリゾート', '迪士尼度假区': '東京ディズニーリゾート', '迪士尼': '東京ディズニーリゾート',
  '日本环球影城': 'ユニバーサル・スタジオ・ジャパン', '大阪环球影城': 'ユニバーサル・スタジオ・ジャパン',
  '环球影城': 'ユニバーサル・スタジオ・ジャパン', '環球影城': 'ユニバーサル・スタジオ・ジャパン',
  'ユニバーサルスタジオジャパン': 'ユニバーサル・スタジオ・ジャパン',
  'ディズニーランド': '東京ディズニーランド', 'ディズニーシー': '東京ディズニーシー',
};
const specificParks = [
  ['東京ディズニーシー', /ディズニーシー|迪士尼海洋|\b(?:Tokyo )?Disney\s*Sea\b/i],
  ['東京ディズニーランド', /ディズニーランド|(?:东京|東京)迪士尼(?:乐园|樂園)|\b(?:Tokyo )?Disneyland\b/i],
  ['ユニバーサル・スタジオ・ジャパン', /ユニバーサル[・･ ]?スタジオ[・･ ]?ジャパン|环球影城|環球影城|\b(?:USJ|Universal Studios Japan)\b/i],
] as const;

export function themeParkPhotoName(title: string, schedule = ''): string | undefined {
  const inTitle = specificParks.filter(([, pattern]) => pattern.test(title));
  if (inTitle.length === 1) return inTitle[0][0];
  if (inTitle.length > 1) return undefined;
  const inSchedule = specificParks.filter(([, pattern]) => pattern.test(schedule));
  if (inSchedule.length === 1) return inSchedule[0][0];
  return /迪士尼|ディズニー|\bDisney Resort\b/i.test(title) ? '東京ディズニーリゾート' : undefined;
}
const fileAliases: Record<string, string[]> = {
  '秋葉原ラジオ会館': ['Radio Kaikan', 'rajio kaikan'],
  '日本平': ['Nihondaira'], '熱海温泉': ['Atami Onsen', 'Atami hot spring'],
  '白糸の滝 (静岡県)': ['Shiraito Falls', 'Shiraito no Taki'],
  '明治神宮': ['Meiji Shrine', 'Meiji Jingu'], '道頓堀': ['Dotonbori', 'Dōtonbori'],
  '渋谷駅前交差点': ['Shibuya Crossing', 'Shibuya Scramble'],
  '小樽運河': ['Otaru Canal'], '小樽オルゴール堂': ['Otaru Music Box Museum', 'Otaru Orgel Doh'],
  '浅草寺': ['Senso-ji', 'Sensō-ji'], '東京スカイツリー': ['Tokyo Skytree'],
  '三軒茶屋': ['Sangenjaya', 'Sangen-jaya'],
  '姫路城': ['Himeji Castle'], '清洲城': ['Kiyosu Castle'], '犬山城': ['Inuyama Castle'], '名古屋城': ['Nagoya Castle'],
};
const representativeFiles: Record<string, string[]> = {
  '渋谷駅前交差点': ['File:2025 Shibuya Crossing.jpg', 'File:2025 Shibuya Crossing at night.jpg'],
  '三軒茶屋': [
    'File:Carrot Tower and an alley in Sangenjaya, Setagaya, Tokyo.jpg',
    'File:茶沢通り 2024年11月8日の東京 202411081133 IMG 8088.jpg',
    'File:Suzuran dori in Sangenjaya.jpg',
    'File:Kreuzung in Sangenjaya.jpg',
  ],
};
const cache = new Map<string, { expires: number; pools: Promise<PlacePhoto[]>[] }>();
const recentPhotos = new Map<string, string[]>();
const rejectedPhotos = new Set<string>();
const backoffUntil = new Map<string, number>();
const filename = (value: string) => value.replace(/^(?:ファイル|File):/, '').replace(/_/g, ' ');
const compact = (value: string) => value.toLowerCase().replace(/[\s_\-(),.]/g, '');
const nonScene = /logo|icon|\bmap\b|flag|diagram|stadium|digital tower|painting|drawing|woodblock|ukiyo|nishiki.?e|hiroshige|engraving|illustration|postcard|portrait|yabusame|horse|equestrian|archer|archery|festival|ceremony|wedding|artifact|museum object|sake barrel|wine barrel|prayer box|votive|goshuin|omamori|tree roots|pixelat|mosaic|blurred|censored|low[ -]resolution|film[ -]set|replica|ロゴ|地図|図面|浮世絵|絵画|錦絵|版画|絵葉書|肖像|流鏑馬|神馬|乗馬|祭礼|結婚式|御朱印|御守|絵馬|モザイク|ぼかし|低解像度|撮影用セット|马赛克|馬賽克|像素化/i;
const nonRepresentative: Record<string, RegExp> = {
  '渋谷駅前交差点': /billboard|ハロウィン|halloween|cropped|scramble square|スクランブルスクエア|shibuya sky/i,
  '渋谷スクランブルスクエア': /shibuya crossing|駅前交差点|スクランブル交差点/i,
  '東京スカイツリー': /interior|glass floor|looking .+ from|view from|haneda|airport|aircraft|runway|羽田|空港|展示/i,
  '道頓堀': /close.?up|lightstick|penlight|acrylic stand|ペンライト|アクスタ|特写/i,
  '浅草寺': /apsara|incense burner|fortune slip|おみくじ/i,
  '三軒茶屋': /tiger.?gym|タイガー.?ジム|credit union|bank|vending machine|自販機|信用金庫|銀行/i,
};
const burialSite = /cemetery|graveyard|gravestone|tombstone|mausoleum|墓地|霊園|灵园|墓石|墓所|墓园/i;
const otherGinza = /(?:戸越|户越|谷中|砂町|十条|武蔵小山|武藏小山|板橋|板桥|東|东|西|北|新|[ァ-ヶ]+)[銀银]座|[銀银]座(?:線|线)|\b(?:Togoshi|Yanaka|Sunamachi|Higashi|Nishi) Ginza\b/gi;
const scene = /main.?hall|main.?gate|sanctuary|entrance|facade|panorama|overview|canal|crossing|street|skyline|landscape|bridge|torii|鳥居|拝殿|本殿|参道|正面|入口|外観|全景|本堂|街並|交差点|運河|夜景|景観/i;
const urbanScene = /night view|at night|nightscape|neon|illuminat|arcade|manga shop|anime shop|夜景|ネオン|商店街|ゲームセンター|アニメショップ/i;
const streetscape = /\bstreet\b|\balley\b|\bcrossing\b|kreuzung|街並|路地|交差点|茶沢通り/i;
const imageProperties = 'url|extmetadata|mime|size';
const imageMetadata = 'Artist|LicenseShortName|DateTimeOriginal|DateTime|ImageDescription|Categories|ObjectName';
const thumbnailWidth = '1280';
const maxPhotoChoices = 5;

export function hasPhotoResolution(width: number, height: number): boolean {
  return width >= 900 && height >= 480;
}

export function sceneQuality(title: string, description = '', capturedDate = ''): { score: number; year?: number } | null {
  const text = `${filename(title)} ${plain(description)}`;
  if (nonScene.test(text)) return null;
  if (/archival|historic(?:al)? (?:photograph|photo|image)|black[ -]and[ -]white|\b(?:show window|shop window|mannequins?)\b|古写真|歴史写真|白黒写真|橱窗/i.test(text)) return null;
  const currentYear = new Date().getUTCFullYear();
  const dateYear = capturedDate.match(/\b(18\d{2}|19\d{2}|20\d{2})\b/);
  const filenameYear = filename(title).match(/(?:^|[^\d])(19\d{2}|20\d{2})(?=[^\d]|\d{4}(?:[^\d]|$)|$)/);
  if (filenameYear && Number(filenameYear[1]) < 2000) return null;
  const year = Number(dateYear?.[1] ?? filenameYear?.[1]) || undefined;
  if (year && (year < 2000 || year > currentYear)) return null;
  const recency = year ? Math.max(-24, 28 - (currentYear - year) * 4) : 0;
  return { score: (scene.test(text) || streetscape.test(text) ? 30 : 0) + recency, ...(year ? { year } : {}) };
}

export function candidateFiles(page: WikiPage): string[] {
  const lead = page.pageimage ? `File:${page.pageimage}` : undefined;
  const matches = [page.title ?? '', ...(fileAliases[page.title ?? ''] ?? [])].filter(Boolean).map(compact);
  const files = [lead, ...(page.images ?? []).map((item) => item.title)]
    .filter((title): title is string => Boolean(title))
    .filter((title) => /\.(?:jpe?g|png|webp)$/i.test(title) && sceneQuality(title) !== null)
    .filter((title) => !nonRepresentative[page.title ?? '']?.test(filename(title)))
    .filter((title) => title === lead || matches.some((name) => compact(filename(title)).includes(name)))
    .filter((title) => page.title !== '秋葉原ラジオ会館' || title === lead || /(?:new|2nd generation|202\d|shopping building)/i.test(title));
  return [...new Map(files.map((title) => [filename(title), title])).values()]
    .sort((a, b) => (sceneQuality(b)?.score ?? -100) + (b === lead ? 10 : 0) - (sceneQuality(a)?.score ?? -100) - (a === lead ? 10 : 0)).slice(0, 6);
}

function photoChoices(pool: PlacePhoto[], animeTrip = false): PlacePhoto[] {
  const byFile = new Map<string, PlacePhoto>();
  for (const photo of pool) {
    const file = photo.source.replace(/%2C/gi, ',').replace(/%20| /g, '_');
    if (!byFile.has(file)) byFile.set(file, photo);
  }
  const unique = [...byFile.values()];
  const score = (photo: PlacePhoto) => Math.min(58, photo.quality ?? 0) + (animeTrip ? photo.urbanAccent ?? 0 : 0);
  unique.sort((a, b) => score(b) - score(a));
  return unique.filter((photo) => score(photo) >= score(unique[0]) - 32).slice(0, maxPhotoChoices);
}

export function choosePlacePhoto(pool: PlacePhoto[], previous?: string | string[], random = Math.random, animeTrip = false): PlacePhoto | null {
  const relevant = photoChoices(pool, animeTrip);
  const recentUrban = animeTrip ? relevant.filter((photo) =>
    (photo.urbanAccent ?? 0) > 0 && (photo.capturedYear ?? 0) >= new Date().getUTCFullYear() - 8) : [];
  const preferred = recentUrban.length ? recentUrban : relevant;
  const history = typeof previous === 'string' ? [previous] : previous ?? [];
  const unused = preferred.filter((photo) => !history.includes(photo.source));
  const choices = unused.length ? unused : preferred.filter((photo) => photo.source !== history[0]);
  if (!choices.length) return preferred[0] ?? null;
  const themed = animeTrip ? choices.filter((photo) => (photo.urbanAccent ?? 0) > 0) : [];
  const shortlist = themed.length ? themed : choices;
  return shortlist[Math.min(shortlist.length - 1, Math.floor(Math.max(0, random()) * shortlist.length))];
}

export function rememberPlacePhoto(photo: PlacePhoto) {
  const title = photoTitle(photo.name);
  const previous = recentPhotos.get(title) ?? [];
  if (!recentPhotos.has(title) && recentPhotos.size >= 128) recentPhotos.delete(recentPhotos.keys().next().value!);
  recentPhotos.set(title, [photo.source, ...previous.filter((source) => source !== photo.source)].slice(0, maxPhotoChoices - 1));
}

export function rejectPlacePhoto(photo: PlacePhoto) {
  if (rejectedPhotos.size >= 128) rejectedPhotos.delete(rejectedPhotos.values().next().value!);
  rejectedPhotos.add(photo.source);
}

export function photoTitle(name: string) {
  if (/[円圓圆]山公[園园]/.test(name) && /札幌/.test(name)) return '札幌円山公園';
  if (/城山展望台/.test(name) && /鹿[児兒儿]島|鹿儿岛/.test(name)) return '鹿児島城山展望台';
  const title = name.replace(/\([^)]*\)|（[^）]*）/g, '').replace(/\*|[\n\r|]/g, '').trim();
  if (/^(?:京都(?:の|[・ ])?)?(?=.*二[年寧宁]坂)(?=.*(?:三[年寧宁]|[産产][寧宁])坂)[二三年寧宁産产坂\s・·、／/と和＆&＋+及]+$/.test(title)) return '二年坂・三年坂';
  return aliases[title] ?? aliases[title.toLowerCase()] ?? (/^(?:Tokyo )?Disney(?:\s*Sea|land| Resort)$|^(?:Universal Studios Japan|USJ)$/i.test(title)
    ? themeParkPhotoName(title) ?? title : title);
}
const scheduledTitles = [
  '銀座', '芝公園', '東京タワー', '六本木', '竹下通り', '渋谷スクランブルスクエア',
  '渋谷駅前交差点', '明治神宮', '浅草寺', '東京スカイツリー', '伏見稲荷大社',
  '道頓堀', '大阪城公園', '小樽運河', '小樽オルゴール堂', '秋葉原ラジオ会館',
  '国際通り', '第一牧志公設市場', '博多屋台', '大濠公園',
  '心斎橋筋商店街', '二年坂', '三年坂', '平等院',
];
const scheduledNames = new RegExp([
  ...scheduledTitles,
  ...Object.keys(aliases).filter((name) => scheduledTitles.includes(aliases[name])),
].sort((a, b) => b.length - a.length).map((name) => /^[a-z ]+$/i.test(name) ? `\\b${name}\\b` : name).join('|'), 'gi');

export function scheduledLandmarks(text: string): string[] {
  return Array.from(text.replace(otherGinza, '').matchAll(scheduledNames), ([name]) => photoTitle(name));
}

const foodNames: Record<string, string> = {
  '博多ラーメン': '博多ラーメン(博多拉面)',
  '沖縄そば': '沖縄そば(冲绳面)',
  '宇治抹茶': '宇治抹茶（美食示例）',
};
const foodPattern = new RegExp([
  ...Object.keys(foodNames),
  ...Object.keys(aliases).filter((name) => foodNames[aliases[name]]),
].sort((a, b) => b.length - a.length).join('|'), 'g');

export function featuredFoodPhotos(text: string): string[] {
  const foods = Array.from(text.matchAll(foodPattern), ([name]) => foodNames[photoTitle(name)]);
  if (/宇治/.test(text) && /抹茶/.test(text) && !foods.includes(foodNames['宇治抹茶'])) foods.push(foodNames['宇治抹茶']);
  return foods;
}

export function photoNameAppears(name: string, text: string): boolean {
  const canonical = photoTitle(name);
  if (canonical === '二年坂・三年坂') {
    const places = scheduledLandmarks(text);
    return places.includes('二年坂') && places.includes('三年坂');
  }
  if (scheduledTitles.includes(canonical)) return scheduledLandmarks(text).includes(canonical);
  const forms = [canonical, ...name.split(/[()（）]/), ...Object.keys(aliases).filter((alias) => aliases[alias] === canonical)];
  return forms.some((form) => form.trim().length >= 2 && text.includes(form.trim()));
}
function plain(value = '') {
  return value.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&[^;]+;/g, '').replace(/\s+/g, ' ').trim();
}
function allowedUrl(value: string | undefined, image = false): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (image
      ? ['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(url.hostname)
      : ['commons.wikimedia.org', 'ja.wikipedia.org'].includes(url.hostname));
  } catch { return false; }
}
async function query(params: Record<string, string>, signal: AbortSignal, api = endpoint): Promise<WikiResult> {
  const url = new URL(api);
  if (Date.now() < (backoffUntil.get(url.hostname) ?? 0)) throw new Error('PHOTO_BACKOFF');
  Object.entries({ action: 'query', format: 'json', formatversion: '2', origin: '*', ...params }).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url.toString(), { signal, headers: { 'Api-User-Agent': 'JapanTravelHack26/1.0 (https://github.com/Rean0623/japan-travel-ai)' } });
  if (response.status === 429) backoffUntil.set(url.hostname, Date.now() + Math.max(60, Number(response.headers.get('Retry-After')) || 60) * 1000);
  if (!response.ok) throw new Error('PHOTO_UNAVAILABLE');
  return response.json();
}

export function placePhotoUrls(photo: PlacePhoto): string[] {
  if (!allowedUrl(photo.image, true)) return [];
  const url = new URL(photo.image);
  if (url.hostname !== 'thumb.wikimedia.org' || !url.pathname.startsWith('/wikipedia/commons/thumb/')) return [photo.image];
  // Both hosts serve the same Commons file. Try the standard upload host if the thumbnail CDN fails.
  return [photo.image, `https://upload.wikimedia.org${url.pathname}`];
}

export function photoFromPage(name: string, pageTitle: string, page: WikiPage): PlacePhoto | null {
  const canonical = photoTitle(name);
  const file = filename(page.title ?? '');
  const subject = `${file} ${plain(page.imageinfo?.[0]?.extmetadata?.ImageDescription?.value)}`;
  if ((canonical === '銀座' && !/^Ginza Wako 20241021\.jpg$/i.test(file)) ||
      (burialSite.test(subject) && !burialSite.test(canonical)) || nonRepresentative[canonical]?.test(subject)) return null;
  const info = page.imageinfo?.[0];
  const meta = info?.extmetadata;
  const shortLicense = plain(meta?.LicenseShortName?.value);
  const license = /^(?:パブリック・ドメイン|公共领域|公共領域|公有领域|公有領域)$/i.test(shortLicense) ? 'Public domain' : shortLicense;
  const credit = plain(meta?.Artist?.value) || (/^(?:CC0(?: 1\.0)?|Public domain)$/i.test(license) ? '作者信息见原始来源页' : '');
  const quality = sceneQuality(page.title ?? '', [meta?.ImageDescription?.value, meta?.Categories?.value, meta?.ObjectName?.value].filter(Boolean).join(' '), meta?.DateTimeOriginal?.value || meta?.DateTime?.value);
  // Keep attribution and a source page; do not display non-free or unknown files.
  if (!info || !quality || nonRepresentative[photoTitle(name)]?.test(filename(page.title ?? '')) ||
      (info.mime && !/^image\/(?:jpeg|png|webp)$/.test(info.mime)) ||
      !hasPhotoResolution(info.thumbwidth ?? info.width ?? 900, info.thumbheight ?? info.height ?? 480) ||
      !allowedUrl(info.thumburl, true) || !allowedUrl(info.descriptionurl) || !credit ||
      !/^(?:CC BY(?:-SA)? (?:1\.0|2\.0|2\.1|2\.5|3\.0|4\.0)(?: [A-Z]{2})?|CC0(?: 1\.0)?|Public domain)$/i.test(license)) return null;
  const urbanAccent = urbanScene.test(subject) ? 34 : streetscape.test(subject) ? 22 : 0;
  return { name, image: info.thumburl, page: `https://ja.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`, source: info.descriptionurl, credit, license, quality: quality.score, urbanAccent, ...(quality.year ? { capturedYear: quality.year } : {}) };
}

async function lookup(names: string[]): Promise<{ photos: PlacePhoto[]; entityId?: string; ambiguous?: boolean }[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const titles = names.map(photoTitle);
    const result = await query({ prop: 'pageimages|pageprops|images', imlimit: '500', piprop: 'name', pilicense: 'free', redirects: '1', titles: titles.join('|') }, controller.signal);
    const redirects = [...(result.query?.normalized ?? []), ...(result.query?.redirects ?? [])];
    const pages = titles.map((title) => {
      let resolved = title;
      for (let i = 0; i < 8; i++) {
        const next = redirects.find((item) => item.from === resolved)?.to;
        if (!next || next === resolved) break;
        resolved = next;
      }
      return result.query?.pages?.find((page) => page.title === resolved && !page.missing);
    });
    // This exact category was verified against the current building's lead
    // image. Filter out the old first building and unrelated Akihabara scenes.
    const radio = pages.find((page) => page?.title === '秋葉原ラジオ会館');
    if (radio) {
      try {
        const extra = await query({ list: 'categorymembers', cmtype: 'file', cmlimit: '40', cmtitle: 'Category:Akihabara Radio Kaikan' }, controller.signal, 'https://commons.wikimedia.org/w/api.php');
        radio.images = [...(radio.images ?? []), ...(extra.query?.categorymembers ?? [])];
      } catch { /* The article's own photographs remain usable. */ }
    }
    const candidates = pages.map((page, index) => {
      if (!page || page.pageprops?.disambiguation !== undefined) return [];
      const files = candidateFiles(page);
      return [...new Set([...(representativeFiles[titles[index]] ?? []), ...files])].slice(0, 6);
    });
    const files = [...new Set(candidates.flat())];
    const images = files.length ? await query({ prop: 'imageinfo', iiprop: imageProperties, iiurlwidth: thumbnailWidth, iiextmetadatafilter: imageMetadata, titles: files.join('|') }, controller.signal) : null;
    return pages.map((page, index) => {
      const photos = candidates[index].flatMap((title) => {
        const file = images?.query?.pages?.find((item) => item.title && filename(item.title) === filename(title));
        const photo = page?.title && file ? photoFromPage(names[index], page.title, file) : null;
        return photo ? [photo] : [];
      });
      return { photos, entityId: page?.pageprops?.wikibase_item, ambiguous: page?.pageprops?.disambiguation !== undefined };
    });
  } catch { return names.map(() => ({ photos: [] })); }
  finally { clearTimeout(timer); }
}

const wikidata = 'https://www.wikidata.org/w/api.php';
const commons = 'https://commons.wikimedia.org/w/api.php';
const identity = (value: string) => value.normalize('NFKC').replace(/[\s_]/g, '').toLowerCase();
export function matchesSceneFile(title: string, description: string, name: string): boolean {
  const subject = `${filename(title)} ${plain(description)}`;
  const variants = [name, ...(fileAliases[name] ?? [])];
  const exactName = variants.some((value) => compact(value).length >= 3 && compact(subject).includes(compact(value)));
  if (!exactName || /close[ -]?up|aerial|floor plan|diorama|航空写真|特写/i.test(subject)) return false;
  const castleExterior = /城$/.test(name) && /\b(?:castle|keep towers?)\b|天守/i.test(subject) &&
    !/interior|model|picnic|内部|模型/i.test(subject);
  return scene.test(subject) || streetscape.test(subject) || castleExterior;
}

async function searchCommonsScenes(name: string): Promise<PlacePhoto[]> {
  const title = photoTitle(name);
  if (!/^[\p{L}\p{N} ・'-]{3,60}$/u.test(title)) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const results = await query({
      generator: 'search', gsrnamespace: '6', gsrlimit: '12', gsrsearch: `"${title}" filetype:bitmap`,
      prop: 'imageinfo', iiprop: imageProperties, iiurlwidth: thumbnailWidth, iiextmetadatafilter: imageMetadata,
    }, controller.signal, commons);
    return (results.query?.pages ?? []).flatMap((file) => {
      const description = file.imageinfo?.[0]?.extmetadata?.ImageDescription?.value ?? '';
      if (!file.title || !matchesSceneFile(file.title, description, title)) return [];
      const photo = photoFromPage(name, title, file);
      return photo ? [photo] : [];
    });
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export function exactEntityId(results: WikiResult['search'], name: string): string | null {
  const matches = (results ?? []).filter((item) => /^Q\d+$/.test(item.id) && identity(item.match?.text ?? '') === identity(name));
  const ids = [...new Set(matches.map((item) => item.id))];
  return ids.length === 1 ? ids[0] : null;
}
function claimStrings(entity: Entity, property: string): string[] {
  return (entity.claims?.[property] ?? []).filter((claim) => claim.rank !== 'deprecated')
    .flatMap((claim) => typeof claim.mainsnak?.datavalue?.value === 'string' ? [claim.mainsnak.datavalue.value] : []);
}
async function linkedPhotos(name: string, deadline: number, entityId?: string): Promise<PlacePhoto[]> {
  if (Date.now() >= deadline) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(9000, deadline - Date.now()));
  const photos: PlacePhoto[] = [];
  try {
    const title = photoTitle(name);
    const id = entityId && /^Q\d+$/.test(entityId) ? entityId : exactEntityId(
      (await query({ action: 'wbsearchentities', search: title, language: 'ja', uselang: 'ja', limit: '5' }, controller.signal, wikidata)).search, title,
    );
    if (!id) return [];
    const data = await query({ action: 'wbgetentities', ids: id, props: 'claims|labels|sitelinks', languages: 'ja|en' }, controller.signal, wikidata);
    const entity = data.entities?.[id];
    if (!entity) return [];
    const pageTitle = entity.sitelinks?.jawiki?.title ?? title;
    const files = claimStrings(entity, 'P18').filter((file) => /\.(?:jpe?g|png|webp)$/i.test(file) && !/map|logo|diagram|地図|図面/i.test(file)).slice(0, 3);
    if (files.length) {
      const info = await query({ prop: 'imageinfo', iiprop: imageProperties, iiurlwidth: thumbnailWidth, iiextmetadatafilter: imageMetadata, titles: files.map((file) => `File:${file}`).join('|') }, controller.signal, commons);
      photos.push(...(info.query?.pages ?? []).flatMap((file) => {
        const photo = photoFromPage(name, pageTitle, file); return photo ? [photo] : [];
      }));
    }
    const category = claimStrings(entity, 'P373')[0];
    if (!category || category.length > 200) return photos;
    const result = await query({ generator: 'categorymembers', gcmtitle: `Category:${category}`, gcmtype: 'file', gcmlimit: '24', gcmsort: 'timestamp', gcmdir: 'desc', prop: 'imageinfo', iiprop: imageProperties, iiurlwidth: thumbnailWidth, iiextmetadatafilter: imageMetadata }, controller.signal, commons);
    const labels = [title, category, ...Object.values(entity.labels ?? {}).map((label) => label.value)].map(compact).filter(Boolean);
    photos.push(...(result.query?.pages ?? []).filter((file) => file.title && /\.(?:jpe?g|png|webp)$/i.test(file.title) && !/map|logo|diagram|地図|図面/i.test(file.title) && labels.some((label) => compact(filename(file.title!)).includes(label)))
      .flatMap((file) => { const photo = photoFromPage(name, pageTitle, file); return photo ? [photo] : []; }));
    return photos;
  } catch { return photos; }
  finally { clearTimeout(timer); }
}
function lookupWithFallback(names: string[]): Promise<PlacePhoto[]>[] {
  const reviewed = names.map((name) => reviewedPlacePhoto(name, photoTitle(name)));
  const remote = names.filter((_, index) => !reviewed[index]?.verifiedOnly);
  const discovered = remote.length ? lookup(remote) : Promise.resolve([]);
  const deadline = discovered.then(() => Date.now() + 15000);
  // Let each resolved photo be used while missing subjects search in two lanes.
  const lanes = [Promise.resolve(), Promise.resolve()];
  return names.map((name, index) => {
    const photo = reviewed[index];
    if (photo?.verifiedOnly) return Promise.resolve([photo, ...(photo.alternates ?? [])]);
    const lane = index % lanes.length;
    const previous = lanes[lane];
    const pool = discovered.then(async (pools) => {
      const { photos, entityId, ambiguous } = pools[remote.indexOf(name)];
      if (ambiguous) return [];
      const initial = photo ? [photo, ...photos.filter((candidate) => candidate.source !== photo.source)] : photos;
      if (photoChoices(initial).length >= 3 || (!entityId && initial.length)) return initial;
      await previous;
      const linked = [...initial, ...await linkedPhotos(name, await deadline, entityId)];
      return linked.length ? linked : searchCommonsScenes(name);
    });
    lanes[lane] = Promise.all([previous, pool]).then(() => undefined);
    return pool;
  });
}

export async function loadPlacePhotos(names: string[], options: { refresh?: boolean; onPhoto?: (photo: PlacePhoto) => void; onMissing?: (name: string) => void; animeTrip?: boolean } = {}): Promise<(PlacePhoto | null)[]> {
  const bounded = names.filter((name) => photoTitle(name).length > 0 && name.length <= 120).slice(0, 8);
  if (!bounded.length) return [];
  const key = JSON.stringify(bounded);
  if (options.refresh) cache.delete(key);
  let entry = cache.get(key);
  if (!entry || entry.expires <= Date.now()) {
    if (cache.size >= 64) cache.delete(cache.keys().next().value!);
    entry = { expires: Date.now() + 10 * 60_000, pools: lookupWithFallback(bounded) };
    cache.set(key, entry);
    const saved = entry;
    void Promise.all(entry.pools).then((pools) => {
      saved.expires = Date.now() + (pools.every((pool) => pool.length) ? 24 * 60 * 60_000 : 60_000);
    });
  }
  return Promise.all(entry.pools.map(async (pool, index) => {
    const title = photoTitle(bounded[index]);
    const candidates = photoChoices((await pool).filter((photo) => !rejectedPhotos.has(photo.source)), options.animeTrip);
    let photo = choosePlacePhoto(candidates, recentPhotos.get(title), Math.random, options.animeTrip);
    if (photo) {
      const alternates = candidates.filter((candidate) => candidate.source !== photo?.source);
      photo = { ...photo, alternates };
      rememberPlacePhoto(photo);
      options.onPhoto?.(photo);
    } else options.onMissing?.(bounded[index]);
    return photo;
  }));
}

export async function loadReplyPhotos(names: string[], onPhoto: (photo: PlacePhoto) => void, isActive: () => boolean, animeTrip = false, onMissing?: (name: string) => void) {
  const pending = [...new Set(names)].sort((a, b) =>
    Number(Boolean(reviewedPlacePhoto(b, photoTitle(b))?.verifiedOnly)) - Number(Boolean(reviewedPlacePhoto(a, photoTitle(a))?.verifiedOnly)));
  let next = 0;
  // Let either lane start the next batch without waiting for a slow lookup in the other lane.
  async function loadLane() {
    while (next < pending.length && isActive()) {
      const batch = pending.slice(next, next + 8);
      next += 8;
      await loadPlacePhotos(batch, { onPhoto, onMissing, animeTrip }).catch(() => batch.forEach((name) => onMissing?.(name)));
    }
  }
  await Promise.all([loadLane(), loadLane()]);
}
