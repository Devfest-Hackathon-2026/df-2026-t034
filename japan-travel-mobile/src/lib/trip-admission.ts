import { canonicalPlaceCity, normalizePlaceName } from './trip-place-identity.ts';

/** Admission evidence is separate from a reseller's catalog. No model-generated URLs or prices. */
export type AdmissionEvidence = {
  city: string; names: readonly string[];
  status: 'free' | 'paid' | 'reservation';
  label: string; scope: string; note: string;
  sources: readonly { label: string; url: string }[];
  checkedAt: string;
};
const kyotoFaq = { label: '京都市观光协会 · 免费游览地点', url: 'https://global.kyoto.travel/tw/faq/detail.php?faq_id=1002' };
// Paraphrases only. Checked against the linked official pages, not inferred from missing Trip.com stock.
export const reviewedAdmissions: readonly AdmissionEvidence[] = [
  {
    "city": "東京",
    "names": [
      "上野恩賜公園",
      "上野公园",
      "上野公園",
      "Ueno Park",
      "Ueno Onshi Park"
    ],
    "status": "free",
    "label": "公园散步免费",
    "scope": "上野公园公共园路与普通散步区域",
    "note": "公园入园免费；上野动物园、博物馆、美术馆及游船等独立设施另计。",
    "sources": [
      {
        "label": "台东区 · 上野公园参观信息",
        "url": "https://www.culture.city.taito.lg.jp/zh-tw/facilities/00001c0000000000000200000054007f"
      }
    ],
    "checkedAt": "2026-11-10"
  },
  {
    "city": "東京",
    "names": [
      "代々木公園",
      "代代木公园",
      "代代木公園",
      "Yoyogi Park"
    ],
    "status": "free",
    "label": "公园散步免费",
    "scope": "代々木公园普通入园",
    "note": "公园入园免费；部分设施和特别活动另计。",
    "sources": [
      {
        "label": "东京都公园协会 · 代々木公园",
        "url": "https://www.tokyo-park.or.jp/park/yoyogi/index.html"
      }
    ],
    "checkedAt": "2026-11-10"
  },
  {
    "city": "函館",
    "names": [
      "五稜郭公園",
      "五棱郭公园",
      "五稜郭公园",
      "Goryokaku Park",
      "Goryōkaku Park"
    ],
    "status": "free",
    "label": "公园散步免费",
    "scope": "五稜郭公园的普通入园",
    "note": "公园入园免费；五稜郭塔登塔及箱馆奉行所入馆分别收费。",
    "sources": [
      {
        "label": "函馆官方旅游 · 五稜郭公园",
        "url": "https://www.hakobura.jp/spots/555"
      }
    ],
    "checkedAt": "2026-11-10"
  },
  {
    "city": "福岡",
    "names": [
      "大濠公園",
      "大濠公园",
      "Ohori Park",
      "Ōhori Park"
    ],
    "status": "free",
    "label": "公园散步免费",
    "scope": "大濠公园环湖园路、岛屿与桥梁的普通散步",
    "note": "普通散步无需门票；日本庭园、游船、餐饮等项目不包含在内。",
    "sources": [
      {
        "label": "福冈县 · 县营公园设施",
        "url": "https://www.pref.fukuoka.lg.jp/contents/kenkoen3.html"
      }
    ],
    "checkedAt": "2026-11-10"
  },
  {
    "city": "大阪",
    "names": [
      "大阪城公園",
      "大阪城公园",
      "Osaka Castle Park"
    ],
    "status": "free",
    "label": "公园散步免费",
    "scope": "大阪城公园普通公共区域",
    "note": "公园入园免费；天守阁、西之丸庭园及其他收费设施另计。",
    "sources": [
      {
        "label": "大阪观光局 · 大阪城公园",
        "url": "https://osaka-info.jp/spot/osaka-castle-park/"
      }
    ],
    "checkedAt": "2026-11-10"
  },
  {
    "city": "札幌",
    "names": [
      "円山公園",
      "圆山公园",
      "圓山公園",
      "Maruyama Park"
    ],
    "status": "free",
    "label": "公园散步免费",
    "scope": "札幌円山公园的普通入园",
    "note": "公园入园免费；円山动物园及其他独立收费设施不包含在内。",
    "sources": [
      {
        "label": "北海道政府 · 札幌円山公园",
        "url": "https://www.pref.hokkaido.lg.jp/kn/tkn/hana/place/c040.html"
      }
    ],
    "checkedAt": "2026-11-10"
  },
  {
    "city": "京都",
    "names": [
      "伏見稲荷大社",
      "伏见稻荷大社",
      "伏見稻荷大社",
      "Fushimi Inari",
      "Fushimi Inari Taisha"
    ],
    "status": "free",
    "label": "境内参拜免费",
    "scope": "伏见稻荷大社境内普通参拜",
    "note": "境内参拜无需门票；御守、祈祷、餐饮及导览等消费另计。",
    "sources": [
      {
        "label": "京都府观光联盟 · 伏见稻荷大社",
        "url": "https://www.kyoto-kankou.or.jp/info_search/323"
      }
    ],
    "checkedAt": "2026-11-10"
  },
  {
    city: '京都', names: ['鴨川', '鸭川', '京都鴨川', '京都鸭川', '鴨川公園', '鸭川公园', '鴨川デルタ', '鴨川三角洲', '鸭川三角洲', 'Kamo River', 'Kamogawa River', 'Kamogawa Delta'],
    status: 'free', label: '河岸散步免费', scope: '公共河岸、散步道与鴨川三角洲的普通散步参观',
    note: '无需购买入场门票。河畔餐饮、川床套餐、导览和特别活动不包含在此结论内。',
    sources: [kyotoFaq, { label: '京都府 · 鴨川公园', url: 'https://www.pref.kyoto.jp/koen-annai/kamo.html' }], checkedAt: '2026-11-09',
  },
  {
    city: '京都', names: ['哲学の道', '哲学之道', '哲學之道', "Philosopher's Path", "Philosopher’s Path", "Philosopher's Walk"],
    status: 'free', label: '步道散步免费', scope: '哲学之道公共步道', note: '无需购买步道门票；沿途寺院、庭园及体验项目有各自的收费规则。',
    sources: [kyotoFaq], checkedAt: '2026-11-09',
  },
  {
    city: '京都', names: ['岡崎公園', '冈崎公园', '岡崎公园', 'Okazaki Park'], status: 'free', label: '公园散步免费',
    scope: '岡崎公园公共空间', note: '无需购买公园入场门票；周边美术馆、动物园和特别活动另计。', sources: [kyotoFaq], checkedAt: '2026-11-09',
  },
  {
    city: '京都', names: ['京都御苑', 'Kyoto Gyoen', 'Kyoto Gyoen National Garden', 'Kyoto Imperial Park'], status: 'free', label: '入苑免费',
    scope: '京都御苑的普通入苑', note: '御苑全天免费开放；拾翠亭等苑内独立设施有各自收费和开放日，不把整个御苑当作收费景点。',
    sources: [{ label: '环境省 · 京都御苑常见问题', url: 'https://www.env.go.jp/garden/kyotogyoen/2_guide/qa.html' }], checkedAt: '2026-11-09',
  },
  {
    city: '京都', names: ['京都御所', 'Kyoto Imperial Palace'], status: 'free', label: '免费参观 · 无需预约',
    scope: '京都御所通常开放日的一般参观', note: '不需要提前申请。通常周一及年末年初休止，临时关闭和开放日以官方日历为准；不适用于京都仙洞御所等其他设施。',
    sources: [{ label: '宫内厅 · 京都御所参观指南', url: 'https://kyoto-gosho.kunaicho.go.jp/en/visit' }], checkedAt: '2026-11-09',
  },
  {
    city: '京都', names: ['京都仙洞御所', '仙洞御所', 'Kyoto Sento Imperial Palace'], status: 'reservation', label: '免费参观 · 需登记跟团',
    scope: '京都仙洞御所一般参观', note: '需要参加官方导览团，限18岁及以上。可提前申请或按官方规则办理当日登记；免费不代表可以直接自由进入。',
    sources: [{ label: '宫内厅 · 仙洞御所参观与登记', url: 'https://sankan.kunaicho.go.jp/multilingual/lang/en/information.html' }], checkedAt: '2026-11-09',
  },
  {
    city: '京都', names: ['桂離宮', '桂离宫', '桂離宫', 'Katsura Imperial Villa'], status: 'reservation', label: '收费参观 · 需登记跟团',
    scope: '桂离宫一般参观', note: '需参加官方导览团并登记。成人收费，未成年人及特定减免对象规则不同；人数、年龄条件及可申请日期以官方页面为准。',
    sources: [{ label: '宫内厅 · 桂离宫参观与登记', url: 'https://sankan.kunaicho.go.jp/multilingual/lang/en/information.html' }], checkedAt: '2026-11-09',
  },

];
const specialProduct = /缆车|纜車|雪票|套票|套餐|租赁|租賃|川床|納涼床|餐饮|餐飲|餐厅|餐廳|游船|遊船|夜间|夜間|特别|特別|导览|導覽|体验|體驗|体験|ropeway|rental|cruise|tour|dining|package/i;
export function admissionForPlace(city: string, name: string): AdmissionEvidence | undefined {
  if (specialProduct.test(name)) return undefined;
  // Only equivalent translations in parentheses are allowed. A mixed attraction/product must not inherit free admission.
  const parts = [name.replace(/[（(][^）)]*[）)]/g, ''), ...[...name.matchAll(/[（(]([^）)]+)[）)]/g)].map(m => m[1])]
    .map(part => normalizePlaceName(part.replace(/(?:门票|門票|入场券|入場券|参观信息|參觀資訊)$/, '').trim())).filter(Boolean);
  const matches = reviewedAdmissions.filter(entry => canonicalPlaceCity(city) === entry.city && parts.length && parts.every(part => entry.names.some(alias => normalizePlaceName(alias) === part)));
  return matches.length === 1 ? matches[0] : undefined;
}
