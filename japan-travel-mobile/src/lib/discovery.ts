import { getDayHeading, getPhotoReplyBlocks, getScheduleRows } from './assistant-text.ts';
import { googlePhotoQueries, type PlacePhotoQuery } from './google-place-photos.ts';
import type { PlannerConversation } from './planner-history.ts';
import { photoTitle } from './place-photos.ts';
import { discoveryCover } from './discovery-covers.ts';

export type DiscoveryPlace = PlacePhotoQuery & {
  id: string; conversationId: string; description: string; region: string; updatedAt: number;
  origin?: 'chat' | 'collection'; reason?: string;
  schedule?: { day: number; title: string; items: string[] };
};
export function discoveryRegion(city: string) {
  return ['札幌', '小樽', '函館', '旭川', '富良野', '美瑛', '登別', '洞爺湖', '釧路', '帯広', '網走'].includes(city) ? '北海道' : city === '八王子' ? '東京' : city;
}
const key = (query: PlacePhotoQuery) => `${query.city}:${photoTitle(query.name).normalize('NFKC').replace(/\s/g, '')}`;

// Recompute from local user-owned chat text. Never persist Places photos or
// build a second interest index that could outlive deletion of its source chat.
export function discoveryPlaces(conversations: PlannerConversation[]): DiscoveryPlace[] {
  const result: DiscoveryPlace[] = []; const seen = new Set<string>();
  for (const conversation of [...conversations].filter(item => item.messages.some(message => message.role === 'assistant')).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5)) {
    for (const reply of [...conversation.messages].reverse().filter(item => item.role === 'assistant')) {
      const blocks = getPhotoReplyBlocks(reply.content);
      const queries = googlePhotoQueries(reply.content, blocks);
      if (!queries.size) continue;
      let day = 0;
      const blockDays = new Map<number, number>();
      const schedules = new Map<number, { day: number; title: string; items: string[] }>();
      blocks.forEach((block, index) => {
        const heading = getDayHeading(block.heading ?? '');
        if (heading) { day = heading.number; schedules.set(day, { day, title: heading.title, items: [] }); }
        blockDays.set(index, day);
        const rows = getScheduleRows(block.body);
        if (rows && schedules.has(day)) schedules.get(day)!.items.push(...rows.map(row => row.value));
      });
      for (const [index, query] of queries) {
        const id = key(query);
        if (seen.has(id)) continue;
        seen.add(id);
        const description = blocks[index].body.replace(/https?:\/\/\S+|[*#`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 1500);
        const schedule = schedules.get(blockDays.get(index) ?? 0);
        result.push({ ...query, id, conversationId: conversation.id, description, region: discoveryRegion(query.city), updatedAt: conversation.updatedAt,
          origin: 'chat', reason: `来自你最近关于${discoveryRegion(query.city)}的 AI 对话`, ...(schedule?.items.length ? { schedule } : {}) });
      }
      break; // A revised plan replaces the earlier version in this conversation.
    }
  }
  return result.slice(0, 40);
}

// Small editorial collection, clearly distinguished from AI/user history.
// These descriptions are fixed introductory text, never fabricated user posts.
const collection = [
  ['札幌', '大通公園', '从札幌市中心的公园风景，开始认识这座城市。'],
  ['札幌', '北海道神宮', '沿着神社参道，感受札幌的树林与人文风景。'],
  ['小樽', '小樽運河', '看看运河沿岸的建筑与水面，再安排一段小樽散步。'],
  ['札幌', 'サッポロビール博物館', '札幌的一处历史建筑与啤酒文化参观地点。'],
  ['東京', '東京タワー', '从城市地标出发，发现东京的街区与风景。'],
  ['東京', '浅草寺', '从雷门与参道开始，认识浅草的传统街区。'],
  ['東京', '明治神宮', '沿着树林中的参道，认识东京的另一种风景。'],
  ['東京', '渋谷駅前交差点', '从十字路口的街景开始，发现涩谷周边的城市生活。'],
  ['京都', '清水寺', '看看京都东山的寺院风景，再安排周边步行路线。'],
  ['京都', '伏見稲荷大社', '以鸟居参道为起点，规划一次京都散步。'],
  ['京都', '二年坂', '沿着石板坡道，寻找京都东山街区的旅行灵感。'],
  ['大阪', '道頓堀', '从运河街景开始，寻找大阪的美食旅行灵感。'],
  ['大阪', '大阪城公園', '从护城河与公园步道，安排一段大阪城市散步。'],
] as const;

export function discoveryFeed(conversations: PlannerConversation[]) {
  const personal = discoveryPlaces(conversations);
  const regions = new Set(personal.map(place => place.region));
  const seen = new Set(personal.map(place => place.id));
  const selected: DiscoveryPlace[] = collection.map(([city, name, description]) => ({
    city, name, description, id: key({ city, name }), region: discoveryRegion(city), conversationId: '', updatedAt: 0, origin: 'collection',
    reason: regions.has(discoveryRegion(city)) ? `你最近聊过${discoveryRegion(city)}，这是一处同地区的精选资料` : '精选景点资料',
  }));
  const regionOrder = [...regions];
  const rank = (region: string) => regions.has(region) ? regionOrder.indexOf(region) : 1000;
  selected.sort((a, b) => rank(a.region) - rank(b.region));
  // Prioritize exact licensed covers. Uncovered original recommendations remain
  // searchable; do not silently attach another landmark's photo to them.
  return [...personal, ...selected.filter(place => !seen.has(place.id))]
    .sort((a, b) => Number(Boolean(discoveryCover(b))) - Number(Boolean(discoveryCover(a))));
}

export function discoveryMapUrl(place: PlacePhotoQuery) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.city} ${place.name} 日本`)}`;
}

const normalize = (text: string) => text.normalize('NFKC').toLowerCase()
  .replace(/东京/g, '東京').replace(/大阪府/g, '大阪').replace(/函馆/g, '函館')
  .replace(/札幌市/g, '札幌').replace(/药/g, '薬').replace(/圆|圓/g, '円').replace(/园/g, '園');
export function filterDiscoveryPlaces(places: DiscoveryPlace[], search: string, region = '') {
  const terms = normalize(search).replace(/[\d一二三四五六七八九十两]+\s*(?:天|日|晚|人|夜)|[，,。！？!?、]/g, ' ')
    .replace(/帮我|幫我|安排|计划|計劃|行程|旅行|旅游|旅遊|我想|想要|我要|去|玩|看看|推荐|推薦/g, ' ').trim().split(/\s+/).filter(Boolean);
  return places.filter(place => (!region || place.region === region) && terms.every(term =>
    normalize(`${place.name} ${place.city} ${place.region} ${place.description}`).includes(term)));
}
