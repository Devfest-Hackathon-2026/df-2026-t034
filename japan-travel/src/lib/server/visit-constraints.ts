// Derive explicit restrictions from user messages only; assistant suggestions are never facts.
export type VisitConstraint = { kind: 'only' | 'avoid'; names: string[]; day: number };
const placeAliases = [
  ['浅草寺', '淺草寺', 'Senso-ji', 'Sensoji', 'Sensō-ji', 'Senso-ji Temple'],
  ['隅田公園', '隅田公园', 'Sumida Park'], ['隅田川', 'Sumida River'],
  ['東京タワー', '东京塔', '東京塔', '东京铁塔', 'Tokyo Tower'],
  ['高尾山', 'Mount Takao', 'Mt. Takao'], ['高尾山薬王院', '高尾山药王院', '高尾山藥王院', '高尾山薬王院有喜寺', 'Takaosan Yakuoin', 'Takao Yakuoin'],
  ['上野恩賜公園', '上野公园', '上野公園', 'Ueno Park'],
  ['東京スカイツリー', '東京スカイツリータウン', '东京晴空塔', '東京晴空塔', 'Tokyo Skytree', 'Tokyo Skytree Town'],
  ['明治神宮', '明治神宫', 'Meiji Jingu', 'Meiji Shrine'],
  ['代々木公園', '代代木公园', 'Yoyogi Park'], ['清水寺', 'Kiyomizu-dera', 'Kiyomizudera'],
  ['伏見稲荷大社', '伏见稻荷大社', 'Fushimi Inari', 'Fushimi Inari Taisha'],
  ['大通公園', '大通公园', 'Odori Park'], ['北海道神宮', '北海道神宫', 'Hokkaido Jingu'],
  ['五稜郭公園', '五棱郭公园', 'Goryokaku Park'], ['五稜郭タワー', '五棱郭塔', 'Goryokaku Tower'],
  ['大阪城公園', '大阪城公园', 'Osaka Castle Park'], ['道頓堀', '道顿堀', 'Dotonbori'],
  ['日本环球影城', 'ユニバーサル・スタジオ・ジャパン', 'Universal Studios Japan', 'USJ'],
  ['東京ディズニーランド', '东京迪士尼乐园', 'Tokyo Disneyland'],
];
const simple = (value: string) => value.normalize('NFKC').replace(/[\s·・.−–—\-'’]/g, '').toLowerCase();
function canonical(value: string) {
  const name = simple(value.replace(/[（(].*$/, '').replace(/(?:境内|境內|周辺|周边|周邊)$/, ''));
  const aliases = placeAliases.find(group => group.some(alias => simple(alias) === name));
  return aliases ? simple(aliases[0]) : name;
}
const cities = /^(?:东京|東京|京都|大阪|北海道|札幌|函馆|函館|福冈|福岡|名古屋|小樽|奈良|日本|tokyo|kyoto|osaka|hokkaido|sapporo|hakodate|fukuoka|nagoya|otaru|nara|japan)$/i;
function namesIn(value: string): string[] {
  const text = value.replace(/\b(?:for \d|with |on a |budget |please |and no other|without adding).*$/i, '')
    .replace(/(?:其他|其它|别的|別的|其余|其餘|それ以外).*$/, '')
    .replace(/(?:，|,|。|！|!|？|\?|；|;).*$/, '').replace(/(?:这|這)(?:个|個|些)?景点.*$/, '')
    .replace(/(?:を)?(?:観光|見学|参拝|訪問|巡る|訪れる|行く).*$/, '');
  const names = text.split(/、|以及|还有|還有|和|及|\s+and\s+|\s*&\s*|と/).map(name => name.trim().replace(/^[\s「『"']+|[\s」』"']+$/g, '')).filter(Boolean);
  if (!names.length || names.length > 8 || names.some(name => name.length > 70 || /^\d|^[一二三四五六七八九十两]+[天日周个]/.test(name) || /^(?:您|你|这些|這些|一个|一個|景点|景點|the |these |those |attractions|spots|places|them|一つ|ひとつ)/i.test(name))) return [];
  // A city restriction is not an attraction whitelist. The existing route checks handle cities.
  return names.every(name => cities.test(name)) ? [] : names;
}
export function extractVisitConstraints(messages: readonly { role: string; content: string }[]): VisitConstraint[] {
  let rules: VisitConstraint[] = [];
  for (const message of messages) {
    if (message.role !== 'user') continue;
    const text = message.content.normalize('NFKC');
    if (/不限景点|不限景點|取消.{0,6}(?:景点限制|景點限制)|可以(?:增加|添加|安排)其他景点|重新规划|换目的地|new trip|change (?:the )?destination|other sights are fine|feel free to add|ほかの観光地も|他の観光地も|制限なし/i.test(text)) rules = [];
    for (const clause of text.split(/[。；;\n]/)) {
      const patterns: [VisitConstraint['kind'], RegExp][] = [
        ['only', /(?:只|仅|僅)(?:去|参观|參觀|安排|游览|遊覽|保留|想去)\s*([^，。；\n]+)/gi],
        ['only', /\b(?:only (?:want to |wish to )?(?:visit|see|go to)|visit only|go only to)\s+([^.!?;\n]+)/gi],
        ['only', /(?:^|[、，,:：])\s*(?:(?:\d{1,2}日目|今日|今回|明日)は)?([^、，,:：]+?)(?:だけ|のみ)(?:を)?(?:観光|見学|参拝|訪問|巡|訪れ|に|で|$)/g],
        ['avoid', /(?:不要去|别去|別去|不去|不安排|排除)\s*([^，。；\n]+)/gi],
        ['avoid', /\b(?:avoid|exclude|do not visit|don't visit|do not go to)\s+([^.!?;\n]+)/gi],
      ];
      for (const [kind, pattern] of patterns) for (const match of clause.matchAll(pattern)) {
        if (kind === 'only' && /(?:不|不是|并非|not\s+)$/i.test(clause.slice(0, match.index).trimEnd())) continue;
        const names = namesIn(match[1]); if (!names.length) continue;
        const prefix = clause.slice(0, match.index) + match[0].slice(0, match[0].indexOf(match[1]));
        const dayMatch = prefix.match(/(?:第\s*|Day\s*)(\d{1,2})(?:\s*[天日])?/i) ?? prefix.match(/(\d{1,2})日目/);
        const day = dayMatch ? Number(dayMatch[1]) : 0;
        if (day > 31) continue;
        if (kind === 'only') {
          rules = rules.filter(rule => !(rule.kind === 'only' && rule.day === day));
          rules = rules.map(rule => rule.kind === 'avoid' ? { ...rule, names: rule.names.filter(name => !names.some(allowed => canonical(allowed) === canonical(name))) } : rule).filter(rule => rule.names.length);
        }
        rules.push({ kind, names, day });
      }
    }
  }
  return rules.slice(-8);
}
export function visitConstraintInstruction(rules: readonly VisitConstraint[] = []): string {
  if (!rules.length) return '';
  return `\n以下是从用户原话提取的明确景点限制，优先于示例、默认每日2至4景点或常规景点推荐。具体某一天的限制覆盖全程限制。只列1处时就只介绍和安排这一处，不为凑数量增加任何其他景点；可合理安排往返交通、用餐、在该景点内部的休息和活动。这个限制同时适用于sights和activities，不能只让景点标题符合限制，却在活动里增加别处。公园、河岸、观景台也算游览地点，不能以“周边散步”“休息”或“顺路”为由增加名单之外的具名地点。例如只去浅草寺，就不能再安排隅田公园、隅田川、上野公园或晴空塔。餐饮休息安排在该景点内或用不指定另一景点的就近餐馆，宁可短而专注，不填充无关去处。不要把“您决定其他安排”理解为解除明确的景点限制。保持已确认的天数、人数、城市顺序和预算；如条件冲突，说明冲突并追问，不擅自改条件。若不知日文原名，保留用户写法，不冒充另一地点。\n${JSON.stringify(rules)}\nkind=only表示只能游览names中的景点；kind=avoid表示不得游览；day=0表示全程。`;
}
function negativeBefore(text: string, index: number) { return /不去|不要去|不安排|不会去|不會去|除外|行かない|not visit|do not|skip|avoid/i.test(text.slice(Math.max(0, index - 25), index)); }
export function visitConstraintIssue(reply: string, rules: readonly VisitConstraint[], complete = false): string | undefined {
  if (!rules.length) return undefined;
  const headings = [...reply.matchAll(/^Day\s+(\d+)\s*[｜|]\s*.*$/gim)];
  if (!headings.length) return undefined;
  const seen = new Set<string>();
  let usesGlobalOnly = false;
  for (const [index, heading] of headings.entries()) {
    const day = Number(heading[1]);
    const body = reply.slice(heading.index! + heading[0].length, headings[index + 1]?.index ?? reply.length).split(/^小结\s*$/m)[0];
    const specific = rules.filter(rule => rule.kind === 'only' && rule.day === day);
    if (!specific.length) usesGlobalOnly = true;
    const only = specific.length ? specific : rules.filter(rule => rule.kind === 'only' && rule.day === 0);
    const avoid = rules.filter(rule => rule.kind === 'avoid' && (!rule.day || rule.day === day));
    const declared = [...body.matchAll(/^\*\*([^*\n]+)\*\*\s*$/gm)].map(match => match[1]);
    const activities = [...body.matchAll(/^活动｜(.*)$/gm)].map(match => match[1]);
    const named = [...declared];
    for (const row of activities) for (const group of placeAliases) {
      const alias = group.find(name => row.toLowerCase().includes(name.toLowerCase()));
      if (alias && !negativeBefore(row, row.toLowerCase().indexOf(alias.toLowerCase()))) named.push(group[0]);
    }
    if (only.length && named.some(name => !only.some(rule => rule.names.some(allowed => canonical(name) === canonical(allowed))))) return '景点限制未满足：只安排用户限定的景点，不得补充其他景点，也不能用周边热门地点凑数';
    if (avoid.some(rule => named.some(name => rule.names.some(excluded => canonical(name) === canonical(excluded))) || activities.some(row => rule.names.some(name => { const at = simple(row).indexOf(simple(name)); return at >= 0 && !negativeBefore(row, row.indexOf(name)); })))) return '景点限制未满足：移除用户明确排除的景点，并保留其他已确认条件';
    declared.forEach(name => seen.add(canonical(name)));
  }
  if (complete && usesGlobalOnly && rules.filter(rule => rule.kind === 'only' && !rule.day).some(rule => rule.names.some(name => !seen.has(canonical(name))))) return '景点限制未满足：完整安排用户限定名单中的景点，不要漏掉已指定的地点';
  return undefined;
}
