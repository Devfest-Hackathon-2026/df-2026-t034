import type { PlacePhotoQuery } from './google-place-photos.ts';
import type { PlacePhoto } from './place-photos.ts';
import { photoTitle } from './place-photos.ts';
import { reviewedPlacePhoto } from './reviewed-place-photos.ts';

export type DiscoveryCover = { asset: string; photo: PlacePhoto; licenseUrl: string };
// Explicit municipality boundaries prevent substituting another city's
// same-named park or shrine. Unknown sights have no automatic remote fallback.
const cities: Record<string, string> = {
  '宇治橋': '宇治', '宇治': '宇治', '平等院': '宇治', '宇治抹茶': '宇治',
  '二年坂': '京都', '三年坂': '京都', '二年坂・三年坂': '京都', '清水寺': '京都', '伏見稲荷大社': '京都',
  '心斎橋筋商店街': '大阪', '道頓堀': '大阪', '大阪城公園': '大阪', 'ユニバーサル・スタジオ・ジャパン': '大阪',
  '札幌円山公園': '札幌', 'サッポロビール博物館': '札幌', '北海道神宮': '札幌',
  '銀座': '東京', '芝公園': '東京', '東京タワー': '東京', '六本木': '東京', '竹下通り': '東京',
  '渋谷スクランブルスクエア': '東京', '明治神宮': '東京', '渋谷駅前交差点': '東京', '東京スカイツリー': '東京',
  '太宰府天満宮': '太宰府', '桜島': '鹿児島', '鹿児島城山展望台': '鹿児島', '首里城': '那覇', '国際通り': '那覇', '第一牧志公設市場': '那覇',
  '博多屋台': '福岡', '大濠公園': '福岡', '博多ラーメン': '福岡', '沖縄そば': '那覇',
};
const additions: Record<string, { city: string; asset: string; photo: PlacePhoto }> = {
  '大通公園': { city: '札幌', asset: 'discoveryOdori', photo: {
    name: '大通公園', image: 'https://upload.wikimedia.org/wikipedia/commons/e/ec/Sapporo_Odori_Park_%28140717753%29.jpeg', page: 'https://ja.wikipedia.org/wiki/大通公園',
    source: 'https://commons.wikimedia.org/wiki/File:Sapporo_Odori_Park_(140717753).jpeg',
    credit: 'Ganden', license: 'CC BY 3.0', capturedYear: 2016,
  } },
  '小樽運河': { city: '小樽', asset: 'discoveryOtaru', photo: {
    name: '小樽運河', image: 'https://upload.wikimedia.org/wikipedia/commons/b/bb/Otaru_Canal.jpg', page: 'https://ja.wikipedia.org/wiki/小樽運河',
    source: 'https://commons.wikimedia.org/wiki/File:Otaru_Canal.jpg',
    credit: 'Hyougushi / Hideyuki KAMON', license: 'CC BY-SA 2.0', capturedYear: 2005,
  } },
  '浅草寺': { city: '東京', asset: 'discoverySensoji', photo: {
    name: '浅草寺・雷門', image: 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Senso-ji.jpg', page: 'https://ja.wikipedia.org/wiki/浅草寺',
    source: 'https://commons.wikimedia.org/wiki/File:Senso-ji.jpg',
    credit: 'Felix Filnkössl', license: 'CC BY-SA 3.0', capturedYear: 2010,
  } },
};
export function discoveryLicenseUrl(license: string, source: string) {
  const cc = /^CC (BY(?:-SA)?) (\d\.\d)$/.exec(license);
  return cc ? `https://creativecommons.org/licenses/${cc[1].toLowerCase()}/${cc[2]}/`
    : license === 'CC0' ? 'https://creativecommons.org/publicdomain/zero/1.0/' : source;
}
export function discoveryCover(query: PlacePhotoQuery): DiscoveryCover | null {
  let title = photoTitle(query.name);
  if (query.city === '札幌' && title === '円山公園') title = '札幌円山公園';
  const added = additions[title];
  if (added) return added.city === query.city ? { asset: added.asset, photo: added.photo, licenseUrl: discoveryLicenseUrl(added.photo.license, added.photo.source) } : null;
  if (cities[title] !== query.city) return null;
  const photo = reviewedPlacePhoto(title, title);
  return photo?.bundled ? { asset: photo.bundled, photo, licenseUrl: discoveryLicenseUrl(photo.license, photo.source) } : null;
}
