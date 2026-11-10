const numberWords = "零一二三四五六七八九";

export function requestedTripDays(message: string): number | undefined {
  const text = message.normalize("NFKC");
  const durations = [...text.matchAll(/(?:(总共|共计|合计|全程|共|总计|大约|大概|约)\s*)?(\d{1,3}|[一二两三四五六七八九十]{1,3})\s*(?:个\s*)?(天|日游|周|星期|礼拜)(\s*时间|\s*左右)?/g)]
    .filter((match) => !/第\s*$/.test(text.slice(0, match.index)));
  const totals = durations.filter((match) => match[4]?.trim() === "时间");
  const selected = durations.findLast((match) => match[1]) ??
    (totals.length === 1 ? totals[0] : durations.length === 1 ? durations[0] : undefined);
  if (!selected) return undefined;
  const [, , raw, unit] = selected;
  const value = raw.replace("两", "二");
  const [tens, ones] = value.split("十");
  const count = /^\d+$/.test(value) ? Number(value) : value.includes("十")
    ? (tens ? numberWords.indexOf(tens) : 1) * 10 + (ones ? numberWords.indexOf(ones) : 0)
    : numberWords.indexOf(value);
  const days = unit === "天" || unit === "日游" ? count : count * 7;
  return days > 0 ? days : undefined;
}

export function isPlanRequest(message: string): boolean {
  return /行程|规划|安排|路线|攻略|怎么玩/.test(message) &&
    !/只(?:要|看|问|给).{0,6}(?:预算|交通|住宿|概要|概览)|不要.{0,4}(?:行程|规划)/.test(message);
}

export function renderDaySegment(response: string | undefined, withOverview = false): string | undefined {
  if (!response) return undefined;
  try {
    const { days, opening, overview, summary, budget } = JSON.parse(response) as {
      days: { number: number; title: string; sights: { name: string; description: string }[]; activities: string[] }[];
      opening: string; overview: { first: number; last: number; area: string }[]; summary: string;
      budget: { currency: string; travelers: number; scope: string; items: { label: string; economy: number; comfort: number; luxury: number }[] };
    };
    const oneLine = (value: string) => value.replace(/\s+/g, " ").trim();
    const details = days.map(({ number, title, sights, activities }) => [
      `Day ${number}｜${oneLine(title)}`,
      ...sights.map(({ name, description }) => `**${oneLine(name)}**\n${oneLine(description)}`),
      ["当日安排", ...activities.map((activity) => `活动｜${oneLine(activity)}`)].join("\n"),
    ].join("\n\n")).join("\n\n");
    if (!withOverview) return details;
    const routes = overview.map(({ first, last, area }) => `第${first}${last === first ? "" : `–${last}`}天：${oneLine(area)}`);
    const items = budget.items.map(({ label, economy, comfort, luxury }) => `${oneLine(label)}｜${economy}｜${comfort}｜${luxury}`);
    return [
      oneLine(opening), ["行程规划", ...routes].join("\n"), "行程详情", details,
      `小结\n${oneLine(summary)}`, ["预算对比", `币种｜${budget.currency}`, `人数｜${budget.travelers}`, `范围｜${oneLine(budget.scope)}`, ...items].join("\n"),
    ].join("\n\n");
  } catch {
    return undefined;
  }
}

export function normalizePlanReply(reply: string): string {
  return reply.trim().replace(/\r\n?/g, "\n")
    .replace(/^(?:```[a-z]*[ \t]*\n|\n[ \t]*```[ \t]*$)/gi, "")
    .replace(/^[ \t]*(?:#{1,6}\s*)?(?:\*\*)?(行程规划|行程详情|小结|预算对比|当日安排)(?:[（(][^\n）)]*[）)])?[：:]?(?:\*\*)?[ \t]*$/gm, "$1")
    .replace(/^[ \t]*(?:\*\*)?小结[：:](?:\*\*)?[ \t]*(?=\S)/gm, "小结\n")
    .replace(/^[ \t]*(?:#{1,6}[ \t]*)?(?:\*\*)?Day[ \t]*\d+[ \t]*安排[：:]?(?:\*\*)?[ \t]*$/gim, "当日安排")
    .replace(/^[ \t]*(?:#{1,6}\s*)?(?:\*\*)?Day[ \t]*(\d+)[ \t]*[｜|][ \t]*(.*?)(?:\*\*)?[ \t]*$/gim, "Day $1｜$2")
    .replace(/^([ \t]*活动)[ \t]*[｜|][ \t]*/gm, "活动｜")
    .replace(/(^活动｜[^\n]*)\n(?:[ \t]*\n)+(?=[ \t]*活动｜)/gm, "$1\n");
}

export function itinerarySections(reply: string) {
  const sections = reply.replace(/\r\n?/g, "\n").match(/^([\s\S]+?)\n[ \t]*行程规划[ \t]*\n([\s\S]+?)\n[ \t]*行程详情[ \t]*\n([\s\S]+?)\n[ \t]*小结[ \t]*\n([\s\S]+?)\n[ \t]*预算对比[ \t]*\n([\s\S]+)$/m);
  if (!sections) return undefined;
  const [, opening, overview, details, summary, budget] = sections;
  return { opening: opening.trim(), overview: overview.trim(), details: details.trim(), summary: summary.trim(), budget: budget.trim() };
}

const overviewRange = /^第\s*(\d+)(?:\s*[–—-]\s*(\d+))?\s*天[：:]\s*(\S.*)$/;
const regionNames = [
  /北海道|札幌|小樽|函館|函馆|旭川|登別|登别|富良野|美瑛/,
  /関東|关东|東京|东京|横浜|横滨|鎌倉|镰仓|箱根|日光/,
  /関西|关西|京都|大阪|奈良|神戸|神户|宇治|嵐山|岚山/,
  /九州|福岡|福冈|博多|鹿児島|鹿儿岛|熊本|長崎|长崎|別府|别府|由布院|大分|佐賀|佐贺|宮崎|宫崎|桜島|樱岛/,
  /沖縄|冲绳|那覇|那霸|石垣島|石垣岛|宮古島|宫古岛/,
];

export function routeForDays(overview: string, firstDay: number, lastDay: number): string {
  return overview.split("\n").flatMap((row) => {
    const match = row.trim().match(overviewRange);
    if (!match) return [];
    const [, start, end = start, area] = match;
    const first = Math.max(firstDay, Number(start));
    const last = Math.min(lastDay, Number(end));
    return Array.from({ length: Math.max(0, last - first + 1) }, (_, index) => `Day ${first + index}｜${area}`);
  }).join("\n");
}

export function routeIssue(details: string, overview: string, firstDay: number, lastDay: number): string | undefined {
  const expected = routeForDays(overview, firstDay, lastDay).split("\n");
  for (const [, day, title] of details.matchAll(/^Day\s+(\d+)\s*[｜|]\s*(.+)$/gm)) {
    const area = expected[Number(day) - firstDay]?.split("｜")[1];
    if (!area) continue;
    const allowed = regionNames.filter((region) => region.test(area));
    const named = regionNames.filter((region) => region.test(title));
    if (allowed.length && named.length && !named.some((region) => allowed.includes(region))) {
      return `Day ${day} 跳到了概览之外的地区。逐天遵守已确定的日期和目的地；转场日以抵达地为准`;
    }
  }
  return undefined;
}

export function itineraryIssue(reply: string, latestRequest: string, expectedDays = requestedTripDays(latestRequest), throughDay?: number): string | undefined {
  const text = reply.replace(/\r\n?/g, "\n");
  const dayCount = (text.match(/^Day\s*\d+\s*[｜|]/gim) ?? []).length;
  const looksLikePlan = dayCount > 1 || /^(?:行程规划|行程详情|行程草案)/m.test(text);
  const asksForPlan = expectedDays && isPlanRequest(latestRequest);
  if (!looksLikePlan && !asksForPlan) return undefined;
  const sections = itinerarySections(text);
  if (!sections) return "按顺序写开场、行程规划、行程详情、小结、预算对比，每个标题独立一行";
  const { overview, details, budget } = sections;
  const overviewRows = overview.split(/\n\s*/);
  let lastDay = 0;
  for (const row of overviewRows) {
    const match = row.match(overviewRange);
    if (!match || Number(match[1]) !== lastDay + 1) return "行程规划的每一行使用“第1–4天：北海道”或“第21天：返程”，天数连续且无重叠";
    lastDay = Number(match[2] ?? match[1]);
    if (lastDay < Number(match[1])) return "行程规划的日期范围必须从小到大";
  }
  const totalDays = expectedDays ?? lastDay;
  if (lastDay !== totalDays) return `行程规划必须覆盖第1天至第${totalDays}天`;
  const detailsIssue = dayDetailsIssue(details, 1, throughDay ?? totalDays, latestRequest);
  if (detailsIssue) return detailsIssue;
  const geographyIssue = routeIssue(details, overview, 1, throughDay ?? totalDays);
  if (geographyIssue) return geographyIssue;
  const budgetRows = budget.trim().split("\n").map((line) => line.trim());
  const items = budgetRows.slice(3).map((line) => line.match(/^([^｜|]{1,28})｜(\d{1,9})｜(\d{1,9})｜(\d{1,9})$/));
  const labels = items.map((item) => item?.[1].trim() ?? "");
  const totals = [2, 3, 4].map((column) => items.reduce((sum, item) => sum + Number(item?.[column] ?? 0), 0));
  if (items.length < 3 || items.length > 6 || !/^币种｜(?:CNY|JPY)$/.test(budgetRows[0]) ||
      !/^人数｜[1-9]\d{0,2}$/.test(budgetRows[1]) || !/^范围｜[^｜|]{1,180}$/.test(budgetRows[2]) ||
      new Set(labels).size !== labels.length || labels.some((label) => !label || /合计|总计/.test(label)) ||
      totals[0] <= 0 || totals[0] >= totals[1] || totals[1] >= totals[2]) {
    return "预算对比必须包含币种、人数、范围和三档金额";
  }
  return undefined;
}

export function dayDetailsIssue(details: string, firstDay: number, lastDay: number, request = ""): string | undefined {
  const text = details.trim().replace(/\r\n?/g, "\n");
  const headings = [...text.matchAll(/^Day[ \t]+(\d+)[ \t]*[｜|][ \t]*\S[^\n]*$/gim)];
  if (headings[0]?.index !== 0 || headings.length !== lastDay - firstDay + 1) {
    return `详情必须逐天写完 Day ${firstDay} 至 Day ${lastDay}`;
  }
  for (const [index, heading] of headings.entries()) {
    const day = firstDay + index;
    const body = text.slice(heading.index! + heading[0].length, headings[index + 1]?.index ?? text.length);
    const schedule = body.match(/^当日安排[ \t]*\n([\s\S]+)$/m)?.[1].trim().split(/\n[ \t]*/);
    const travelDay = /初抵|抵达|到达|返程|转场|飞往|启程|回国|返回|离境|出发|换乘|跨城|arriv(?:al|e|ing)|depart(?:ure|ing)?|return|flight|transit|transfer|到着|出発|帰国|帰路|移動|前往.+(?:大阪|东京|札幌|京都|福冈|冲绳)/i.test(heading[0]) &&
      (schedule ?? []).some((row) => /航班|登机|飞抵|新幹線|新干线|跨城|退房|机场|空港|轮渡|渡轮|flight|airport|shinkansen|check.out|ferry|boarding|搭乗|乗り換え|搭乘.+前往/i.test(row));
    const minimum = travelDay ? 2 : 5;
    if (Number(heading[1]) !== day || !schedule || schedule.length < minimum || schedule.length > 12 ||
      schedule.some((row) => !/^活动｜[ \t]*(?![\d０-９]{1,2}[:：][\d０-９]{2})[^｜|\n]+$/.test(row))) {
      return `Day ${day} 缺少独立的“当日安排”和至少 ${minimum} 行“活动｜内容”，活动开头不要写钟点`;
    }
    const sights = [...body.matchAll(/^\*\*([^*\n]+)\*\*[ \t]*$/gm)].map((match) => match[1].replace(/[（(].*$/, "").trim());
    if (sights.some((name) => /(?:空港|机场|機場|駅|车站|車站|巴士总站|バスターミナル|酒店|飯店|宾馆)$/.test(name))) {
      return `Day ${day} 的车站、机场和酒店只放在交通或住宿活动里，景点栏换成值得专程停留的具体地点`;
    }
    const requestedRest = /全天休息|只休息|不安排任何活动|rest.only|no.activities|終日休憩|予定なし/i.test(request) && /休息|rest|休憩/i.test(heading[0]);
    if (!travelDay && !requestedRest && !sights.some((name) => schedule.some((row) => row.includes(name)))) {
      return `Day ${day} 至少安排一个值得游览的具体地点，介绍它，并在当天活动中原样写出这个地点的名称。轻松日也需要这样的地点`;
    }
  }
  return undefined;
}
