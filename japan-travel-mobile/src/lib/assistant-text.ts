import { featuredFoodPhotos, photoNameAppears, photoTitle, scheduledLandmarks, themeParkPhotoName } from './place-photos.ts';

// Display-only cleanup: keep the original reply intact in conversation history.
export function formatAssistantText(content: string): string {
  const cleaned = content
    .replace(/\r\n?/g, '\n')
    .replace(/^\s*```[^\n]*$/gm, '')
    .replace(/^ {0,3}#{1,6}[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/gm, '$1')
    .replace(/^\s*(?:\*\s*){3,}$/gm, '')
    .replace(/^\s*(?:-{3,}|_{3,})\s*$/gm, '')
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '$1 ($2)')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1 ($2)')
    .replace(/\*{2,}|_{2,}/g, '')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/^[ \t]*[•●▪][ \t]*/gm, '\n\n')
    .replace(/^[ \t]*[-*+][ \t]+/gm, '\n\n')
    .replace(/^ {0,3}>\s?/gm, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Numbered guides already carry deliberate section/line breaks.
  if (/^\s*\d+[.)、][ \t]*(?!\d)\S/m.test(cleaned) || cleaned.split('\n').some((line) => sectionTitles.test(line) || getDayHeading(line))) return cleaned;

  // Keep recommendations and the following question visually separate, even
  // when an older model reply put both into the same paragraph.
  return cleaned
    .replace(/([。！？][”’」』"]?)[ \t]*(?=[^\s。！？、，；：）\]】])/g, '$1\n\n')
    .replace(/\n{3,}/g, '\n\n');
}

export type AssistantBlock = { heading?: string; body: string };
const scheduleHeading = '当日安排';
const sectionTitles = /^(?:景点推荐|行程规划|行程详情|行程草案|简版行程|当日安排|预算参考|预算推荐|预算对比|小结|总结|继续调整)$/;

export type PhotoReplyBlock = AssistantBlock & { attraction?: string; dayPhotos?: string[]; photo?: string; photoOnly?: boolean; scheduleDay?: number };
export type ReplyPhotoStop = { index: number; end: number };

export function replyRevealProgress(stops: ReplyPhotoStop[], settled: { has: (index: number) => boolean }, visible: number, total: number) {
  const stop = stops.find((item) => !settled.has(item.index));
  const limit = stop?.end ?? total;
  const shown = Math.min(visible, limit);
  return { limit, shown, waitingIndex: shown === limit ? stop?.index : undefined };
}
const photoHint = /^\s*(?:配图|配圖)[：:]\s*(.*)$/;
const isSightHeading = (name: string) => name.length <= 100 && !sectionTitles.test(name) && !/提示|总结|建议|预算|交通|^[\d]+[：:]|[。！？：，；]/.test(name);

export function getPhotoReplyBlocks(content: string): PhotoReplyBlock[] {
  const highlights = getAssistantHighlights(content, Infinity);
  const markedPlacesByRow = new Map<string, string[]>();
  for (const line of content.split(/\r?\n/)) {
    const row = getScheduleRows(line.replace(/\*\*/g, ''))?.[0];
    if (!row) continue;
    const places = getAssistantHighlights(line, Infinity).filter((name) =>
      name.length >= 2 && name.length <= 60 && isSightHeading(name) &&
      new Set(scheduledLandmarks(name)).size < 2 &&
      !/酒店|饭店附近|住宿|机场|空港|车站|^(?:观景台|展望台|夜景|步行街)$/.test(name));
    if (places.length) markedPlacesByRow.set(`${row.label}|${row.value}`, places);
  }
  let sightSection = false;
  const separated = content.replace(/\r\n?/g, '\n')
    .replace(/\n(?=[ \t]*(?:\*\*[^*\n]+\*\*[ \t]*$|(?:当日安排|预算对比|继续调整|小结)[：:]?[ \t]*$|(?:Day|D)\s*\d{1,2}\s*[｜|：:]))/gim, '\n\n')
    .replace(/^([ \t]*当日安排)[：:][ \t]*$/gm, '$1')
    .replace(/\n{2,}(?=[ \t]*(?:配图|配圖)[：:])/g, '\n');
  const blocks = getAssistantBlocks(separated)
    .flatMap((block) => {
      if (!getScheduleRows(block.body)) return [block];
      const schedule = { heading: scheduleHeading, body: block.body };
      if (getDayHeading(block.heading ?? '')) return [{ heading: block.heading, body: '' }, schedule];
      return [block.heading ? block : schedule];
    });
  const hasSightSection = blocks.some((block) => block.heading === '景点推荐');
  const dailySchedules = new Map<number, number>();
  let dayIndex: number | undefined;
  blocks.forEach((block, index) => {
    const heading = block.heading ?? '';
    if (getDayHeading(heading)) dayIndex = index;
    else if (heading === scheduleHeading && dayIndex !== undefined) dailySchedules.set(dayIndex, index);
    else if (sectionTitles.test(heading)) dayIndex = undefined;
  });
  const dailySights = new Map<number, string>();
  const scheduleDays = new Map<number, number>();
  const dayParks = new Map<number, string>();
  for (const [start, end] of dailySchedules) {
    const schedule = blocks[end].body;
    const day = getDayHeading(blocks[start].heading ?? '');
    if (day) scheduleDays.set(end, day.number);
    for (let index = start + 1; index < end; index++) {
      const name = blocks[index].heading;
      if (!name || !isSightHeading(name) || !blocks[index].body) continue;
      const visited = photoNameAppears(name, schedule);
      if (!visited && !highlights.includes(name)) continue;
      const context = `${day?.title ?? ''}\n${blocks[index].body}\n${schedule}`;
      let photoName = photoTitle(name) === '宇治' && /抹茶/.test(blocks[index].body) ? '宇治抹茶（美食示例）' : name;
      if (photoTitle(name) === '城山展望台' && /鹿[児兒]島|鹿儿岛|桜島|樱岛|櫻島/.test(context)) photoName = '鹿児島城山展望台';
      if (/^[円圓圆]山公[園园]$/.test(photoTitle(name)) && /札幌|北海道神[宮宫]/.test(context) && !/京都/.test(name)) photoName = '札幌円山公園';
      dailySights.set(index, visited ? photoName : '');
    }
    const park = themeParkPhotoName(blocks[start].heading ?? '', schedule);
    if (park && !blocks.slice(start + 1, end).some((_, offset) => {
      const sight = dailySights.get(start + offset + 1);
      return sight && photoTitle(sight) === park;
    })) dayParks.set(start, park);
  }
  const shownSights = new Set<string>();
  const dayFoods = new Set<string>();
  const hasDailyItinerary = dailySchedules.size > 0;
  let standaloneFoodShown = false;
  return blocks.flatMap((block, index) => {
    const heading = block.heading;
    if (heading && photoHint.test(heading)) return block.body ? [{ body: block.body }] : [];
    const day = getDayHeading(heading ?? '');
    if (day) dayFoods.clear();
    if (day || heading === '景点推荐') shownSights.clear();
    if (heading === '景点推荐') sightSection = true;
    else if (day || sectionTitles.test(heading ?? '')) sightSection = false;
    const lines = block.body.split('\n');
    const hints = lines.flatMap((line) => line.match(photoHint)?.[1].trim() || []);
    const body = lines.filter((line) => !photoHint.test(line)).join('\n').trim();
    const name = heading?.replace(/^\d+[.)、]\s*/, '');
    const isPlaceHeading = name && isSightHeading(name);
    const dailySight = dailySights.get(index);
    if (dailySight === '') return [];
    const foodInBlock = featuredFoodPhotos(`${heading ?? ''}\n${body}`);
    for (const food of foodInBlock) dayFoods.add(food);
    const attraction = dailySight ?? (!day && body && isPlaceHeading && (sightSection || (!hasSightSection && highlights.includes(name))) ? name : undefined);
    if (attraction) {
      const title = photoTitle(attraction);
      if (shownSights.size >= 4 || shownSights.has(title)) return [];
      shownSights.add(title);
    }
    const dayText = `${heading ?? ''}\n${body}`;
    const isVisit = (place: string) => photoNameAppears(place, dayText);
    const park = dayParks.get(index) ?? (day && !dailySchedules.has(index) ? themeParkPhotoName(dayText) : undefined);
    const dayPhotos = park ? [park] : day && !dailySchedules.has(index) ?
      [...new Set([...hints.filter((hint) => hint.length >= 2 && hint.length <= 80 && !/[。！？、，；\/]/.test(hint)), ...highlights].filter(isVisit))] : undefined;
    if (park) shownSights.add(photoTitle(park));
    const scheduleDay = scheduleDays.get(index);
    const photos: PhotoReplyBlock[] = [];
    if (scheduleDay) {
      for (const food of featuredFoodPhotos(body)) dayFoods.add(food);
      const food = [...dayFoods].find((name) => !shownSights.has(photoTitle(name)));
      const needsFoodPhoto = food && ![...dayFoods].some((name) => shownSights.has(photoTitle(name)));
      for (const row of getScheduleRows(body) ?? []) {
        const places = [...scheduledLandmarks(row.value), ...(markedPlacesByRow.get(`${row.label}|${row.value}`) ?? [])];
        for (const place of places) {
          const title = photoTitle(place);
          if (shownSights.size >= 4 || shownSights.has(title) || featuredFoodPhotos(title).length ||
              (shownSights.has('二年坂・三年坂') && (title === '二年坂' || title === '三年坂'))) continue;
          shownSights.add(title);
          photos.push({ heading: place, body: '', attraction: place, photoOnly: true });
        }
      }
      if (shownSights.size < 4 && needsFoodPhoto) {
        photos.push({ heading: food, body: '', attraction: food, photoOnly: true });
      }
    }
    const result = { heading, body, ...(attraction ? { attraction } : {}), ...(dayPhotos?.length ? { dayPhotos } : {}), ...(scheduleDay ? { scheduleDay } : {}) };
    const food = foodInBlock[0];
    if (!hasDailyItinerary && !standaloneFoodShown && !hasSightSection && !day && !dayPhotos?.length &&
        food && !sectionTitles.test(heading ?? '') && !getBudgetRows(body)) {
      standaloneFoodShown = true;
      if (!attraction || photoTitle(food) !== photoTitle(attraction)) {
        return [result, { heading: food, body: '', attraction: food, photoOnly: true }];
      }
    }
    return heading || body ? [...photos, result] : [];
  });
}

export function getScheduleRows(text: string): { label: string; value: string }[] | null {
  const lines = text.split('\n').filter((line) => line.trim());
  if (!lines.length || lines.length > 12) return null;
  const rows = lines.map((line) => {
    const match = line.trim().match(/^((?:[01]?\d|2[0-3])[:：][0-5]\d|活动|清晨|早上|上午|中午|午后|下午|傍晚|晚上|夜间|全天)[ \t]*[｜|][ \t]*([^｜|]+)$/);
    return match?.[2].trim() ? { label: match[1].replace('：', ':'), value: match[2].trim() } : null;
  });
  return rows.every((row) => row !== null) ? rows : null;
}

export function resolvePhotoReply(blocks: PhotoReplyBlock[], available: ReadonlySet<string>, keepPhotoSlots = false): PhotoReplyBlock[] {
  const hasSights = blocks.some((block) => block.attraction && available.has(block.attraction));
  const usedDays = new Set<string>();
  return blocks.flatMap((block) => {
    if (block.heading === '景点推荐' && !hasSights && !keepPhotoSlots) return [];
    if (block.attraction) {
      if (available.has(block.attraction)) return [{ ...block, photo: block.attraction }];
      return keepPhotoSlots ? [block] : [];
    }
    const choices = block.dayPhotos?.filter((name) => available.has(name)) ?? [];
    const photo = choices.find((name) => !usedDays.has(name)) ?? choices[0];
    if (photo) usedDays.add(photo);
    return [{ ...block, ...(photo ? { photo } : {}) }];
  });
}

export function getBudgetRows(text: string): { label: string; value: string }[] | null {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2 || lines.length > 8) return null;
  const rows = lines.map((line) => {
    const match = line.match(/^([^｜|]{1,24})[｜|]([^｜|]{1,80})$/);
    return match && /餐饮|饮食|交通|门票|景点|体验|住宿|酒店|购物|甜品|饮料|杂项|合计|总计|经济|舒适|高端|其他/.test(match[1])
      ? { label: match[1].trim(), value: match[2].trim() } : null;
  });
  return rows.every((row) => row !== null) ? rows : null;
}

export type BudgetEstimate = {
  currency: 'CNY' | 'JPY';
  travelers: number;
  scope: string;
  items: { label: string; amounts: [number, number, number] }[];
};

export function getBudgetEstimate(text: string): BudgetEstimate | null {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const [currencyLine, travelersLine, scopeLine, ...costs] = lines;
  const currency = currencyLine?.match(/^币种\s*[｜|]\s*(CNY|JPY)$/)?.[1];
  const travelers = Number(travelersLine?.match(/^人数\s*[｜|]\s*([1-9]\d{0,2})$/)?.[1]);
  const scope = scopeLine?.match(/^范围\s*[｜|]\s*([^｜|]{1,180})$/)?.[1];
  if ((currency !== 'CNY' && currency !== 'JPY') || !travelers || !scope || costs.length < 3 || costs.length > 6) return null;

  const items: BudgetEstimate['items'] = [];
  for (const cost of costs) {
    const row = cost.match(/^([^｜|]{1,28})[｜|]\s*(\d{1,9})\s*[｜|]\s*(\d{1,9})\s*[｜|]\s*(\d{1,9})$/);
    if (!row) return null;
    const label = row[1].trim();
    if (!label || /合计|总计/.test(label) || items.some((item) => item.label === label)) return null;
    items.push({ label, amounts: [Number(row[2]), Number(row[3]), Number(row[4])] });
  }
  const totals = [0, 1, 2].map((index) => items.reduce((sum, item) => sum + item.amounts[index], 0));
  if (totals[0] <= 0 || totals[0] >= totals[1] || totals[1] >= totals[2]) return null;
  return { currency, travelers, scope, items };
}

// Split a dense recommendation section at the next highlighted place, so its
// photo belongs to its description rather than an unrelated footer gallery.
export function getIllustratedBlocks(content: string): (AssistantBlock & { places: string[] })[] {
  const names = getAssistantHighlights(content);
  const assigned = new Set<string>();
  return getAssistantBlocks(content).flatMap((block) => {
    const text = block.body;
    if (!text) return [{ ...block, places: [] }];
    const cuts = new Set<number>([0, text.length]);
    for (const name of names) {
      const position = text.indexOf(name);
      if (position < 0) continue;
      const lineStart = text.lastIndexOf('\n', position) + 1;
      const sentenceStart = Math.max(text.lastIndexOf('。', position), text.lastIndexOf('！', position), text.lastIndexOf('？', position)) + 1;
      const start = Math.max(lineStart, sentenceStart);
      // Keep introductory sentences together; only split when an earlier
      // recommendation would otherwise share this same text block.
      if (names.some((other) => other !== name && text.slice(0, start).includes(other))) cuts.add(start);
    }
    const boundaries = [...cuts].sort((a, b) => a - b);
    return boundaries.slice(0, -1).map((start, index) => {
      const body = text.slice(start, boundaries[index + 1]).trim();
      const heading = index === 0 ? block.heading : undefined;
      const places = names.filter((name) => {
        if (assigned.has(name) || !((heading ?? '') + body).includes(name)) return false;
        assigned.add(name); return true;
      });
      return { ...(heading ? { heading } : {}), body, places };
    });
  });
}

export function getDayHeading(heading: string): { number: number; title: string } | null {
  const match = heading.match(/^(?:第\s*(\d{1,2})\s*天|Day\s*(\d{1,2})|D\s*(\d{1,2}))(?:\s*[：:|｜、.\-—]\s*|\s+)?(.*)$/i);
  if (!match) return null;
  const number = Number(match[1] ?? match[2] ?? match[3]);
  return number > 0 && number <= 99 ? { number, title: match[4].trim() || `第${number}天` } : null;
}

export function getAssistantHighlights(content: string, limit = 8): string[] {
  const names = [...content.matchAll(/\*\*([^*\n]{1,120})\*\*/g)]
    .map((match) => formatAssistantText(match[1]))
    .filter((name) => name && !/^\d+[.)、]/.test(name));
  return [...new Set(names)].slice(0, limit);
}

export function getHighlightedSegments(text: string, highlights: string[]): { text: string; bold: boolean }[] {
  const names = highlights.filter(Boolean).sort((a, b) => b.length - a.length);
  if (!names.length) return [{ text, bold: false }];
  const pattern = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const highlighted = new Set(names);
  return text.split(new RegExp(`(${pattern})`, 'g')).filter(Boolean)
    .map((segment) => ({ text: segment, bold: highlighted.has(segment) }));
}

export function getAssistantBlocks(content: string): AssistantBlock[] {
  const paragraphs = formatAssistantText(content).split(/\n\s*\n/).filter(Boolean);
  const blocks: AssistantBlock[] = [];
  for (let index = 0; index < paragraphs.length; index++) {
    const paragraph = paragraphs[index];
    const [first, ...remaining] = paragraph.split('\n');
    const heading = first.trim().replace(/^(预算对比|继续调整|小结)[：:]$/, '$1');
    const body = remaining.join('\n').trim();
    if (getBudgetRows(paragraph) || getScheduleRows(paragraph)) { blocks.push({ body: paragraph }); continue; }
    const day = getDayHeading(heading);
    if (day && (day.title.length > 28 || /[。！？；]/.test(day.title))) {
      // Older overviews sometimes put the itinerary on the same line as the Day label.
      const [route] = day.title.split(/[，。！？；]/, 1);
      const title = route.length <= 24 ? route : '';
      const details = title ? day.title.slice(title.length).replace(/^[，。！？；\s]+/, '') : day.title;
      blocks.push({
        heading: title ? `Day ${day.number}｜${title}` : `Day ${day.number}`,
        body: [details, body].filter(Boolean).join('\n'),
      });
      continue;
    }
    const numberedHeading = /^\d+[.)、][ \t]*(?!\d)\S.{0,79}$/.test(heading) && !/[。！？]/.test(heading);
    const namedSection = sectionTitles.test(heading);
    if ((numberedHeading || day || namedSection) && !body) {
      const next = paragraphs[index + 1];
      const nextHeading = next?.split('\n')[0].trim();
      const isPlace = nextHeading && (getAssistantHighlights(content, Infinity).includes(nextHeading) ||
        (day && isSightHeading(nextHeading) && next?.includes('\n') && !getScheduleRows(next)));
      if (next && !/^\d+[.)、][ \t]*(?!\d)\S/.test(next) && !getDayHeading(nextHeading ?? '') && !sectionTitles.test(nextHeading ?? '') && !isPlace) {
        blocks.push({ heading, body: next });
        index++;
        continue;
      }
      blocks.push({ heading, body: '' });
      continue;
    }
    // The reply contract puts a place name on its own line above its details.
    // Plain paragraphs and lists remain body text.
    if (body && heading.length <= 100 && (day || (!/[。！？：，；,;]/.test(heading) && !/^\s*(?:•|\d+[.)])/m.test(body)))) {
      blocks.push({ heading, body });
    } else {
      blocks.push({ body: paragraph });
    }
  }
  return blocks;
}
