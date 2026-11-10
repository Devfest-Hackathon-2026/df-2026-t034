const aliases: Record<string, string> = { '那须盐原': '那須塩原', '那須塩原市': '那須塩原', nasushiobara: '那須塩原', '函馆': '函館', hakodate: '函館', otaru: '小樽', '小樽市': '小樽', shanghai: '上海', '上海市': '上海', '函館市': '函館', '函馆市': '函館', '札幌市': '札幌', '福冈': '福岡', fukuoka: '福岡', '宇都宫': '宇都宮', utsunomiya: '宇都宮', '东京': '東京', '東京都': '東京', tokyo: '東京', sapporo: '札幌', '京都市': '京都', kyoto: '京都', osaka: '大阪', nagoya: '名古屋' };
export const normalizePlaceName = (value: string) => value.normalize('NFKC').replace(/[\s·・.−–—-]/g, '').toLowerCase();
export const canonicalPlaceCity = (city: string) => {
  const value = city.trim();
  return Object.hasOwn(aliases, value.toLowerCase()) ? aliases[value.toLowerCase()] : value;
};
const productSpecific = /缆车|纜車|雪票|套票|租赁|租賃|ropeway|cable|rental/i;
export function placeNameVariants(value: string): string[] {
  const unwrapped = value.replace(/\(([^)]*)\)|（([^）]*)）/g, '');
  const names = productSpecific.test(value) ? [value] : [value, unwrapped, ...[...value.matchAll(/[（(]([^）)]+)[）)]/g)].map(match => match[1])];
  return names.flatMap(name => [name, name.replace(/(?:门票|門票|入场券|入場券|参观信息|參觀資訊)$/, '')]).map(normalizePlaceName).filter(Boolean);
}
export const matchesPlaceName = (name: string, names: readonly string[]) => {
  if (productSpecific.test(name)) return names.some(alias => normalizePlaceName(alias) === normalizePlaceName(name));
  // Parentheses may contain a translation, but never a different facility or paid product.
  const parts = [name.replace(/[（(][^）)]*[）)]/g, ''), ...[...name.matchAll(/[（(]([^）)]+)[）)]/g)].map(match => match[1])].filter(part => part.trim());
  return parts.length > 0 && parts.every(part => placeNameVariants(part).some(variant => names.some(alias => normalizePlaceName(alias) === variant)));
};
