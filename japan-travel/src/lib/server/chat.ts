import { extractVisitConstraints, visitConstraintIssue, type VisitConstraint } from "./visit-constraints.ts";
import { replyLanguage, type ReplyLanguage } from "./reply-language.ts";
import type { AssessPlanning, PlanningDecision } from "./planning-decision.ts";
import { isIP } from "node:net";
import { normalizeVerifiedPlaceNames } from "./place-names.ts";
import { dayDetailsIssue, isPlanRequest, itineraryIssue, itinerarySections, normalizePlanReply, requestedTripDays, routeForDays, routeIssue } from "./itinerary-format.ts";
import { SharedAccessError, sessionToken, verifySharedRequest, type Admission, type SharedChatAccess } from "./shared-access.ts";

export const CHAT_LIMITS = Object.freeze({
  maxMessages: 40,
  maxMessageCharacters: 4000,
  maxTotalCharacters: 32000,
  maxBodyBytes: 128 * 1024,
  maxOutputTokens: 6144,
  timeoutMs: 45000,
  fullReplyCharacters: 14000,
  fullOutputTokens: 16384,
  fullTimeoutMs: 95000,
});

const LEGACY_ITINERARY_LAYOUT = `独立一行写“景点推荐”，短途至少推荐3个代表性景点，5天及以上至少推荐5个，最多8个。优先符合用户兴趣且在旅行区域内可合理到达的地点。每个地点用“**完整日文景点名(必要的中文名)**”独占一行，下一行写一小段约60至100字的介绍，各景点之间空一行。App在每个介绍下方显示横向实景照片。
接着独立一行写“行程草案”，下一行简短注明“可按你的想法调整”。已知天数时按用户实际天数写，不固定三天；每一天用“Day 1｜区域或路线”独占一行，随后分行写“上午：…”“下午：…”“晚上：…”，每个时段只写一项主要安排，不先塞满小时级时间表。不知道天数时明确“先按3天示例，待确认”，不要当成用户已决定。超过7天先按连续日期范围概括阶段、保证覆盖全部天数，再和用户分段细化，不遗漏后半程。各天之间空一行。
每个 Day 段落的最后可以另起一行写“配图：日文景点原名”，只写一个当天实际到访且正文中已写过的具体景点，原名与正文一致。仅赶路、休息、返程或没有合适具体景点时省略此行。此行由 App 隐藏。`;

const BATCHED_TRIP = '首次超过7天时，先交代包含出发、途经和返程的全程路线及对应天数，再详细写 Day 1 至 Day 5。请用户回复“继续”，从最后一个已详细安排的 Day 后接着排，保留原编号，每次最多完整排5天。';
const COMPLETE_TRIP = '先用一小段交代出发地、各站顺序和最终返程地。明确或可估算总天数时，在同一条回复里按顺序写全 Day 1 到最后一天；约19天就完整输出 Day 1 至 Day 19，包括返程。保留用户确定的各段天数，未指定的几天合理分配并注明假设。先规划全程天数分配再写每天。后半段也写完整的逐日格式，不省略天数、不留占位、不让用户回复“继续”。篇幅较长时缩短开场和各景点介绍至一两句，保持每天的具体时间表。出发、抵达或返程的具体票务未确认时，开场注明参考时间并提醒按实际班次调整。仅当用户明确只要概览或指定局部时，才按要求缩小范围。';

const BUDGET_COMPARISON = `完成全程后，独立一行写“小结”，用一两句总结路线取舍。下一段严格按以下格式写预算对比（所有行连在一起，中间无空行）：
预算对比
币种｜JPY
人数｜2
范围｜全程估算，含国际及跨城交通、住宿、餐饮、市内交通、门票，不含购物和保险
国际及跨城交通｜7300｜9000｜16000
住宿｜6300｜9900｜16000
餐饮｜3800｜5200｜8500
市内交通｜2200｜3000｜4500
门票与体验｜1800｜2700｜4200
这是格式示例，按本次路线、天数及人数重新估算每一项，绝不照抄数字或擅自假定两人。金额列按省钱型、舒适型、豪华型排序，使用不带逗号或货币符号的非负整数；列出3至6个项目，三档采用同一币种和范围。金额为全体全程，App计算合计及人均，不要额外输出合计行。人数未知时写“人数｜1”且在范围里说明“先按每人估算”。预算表默认统一使用日元JPY，包括从中国出发的行程。只有用户明确要求以其他币种显示预算表时才改币种。用户用人民币给预算上限不等于要求人民币表格；仍用JPY估算，在范围里明确参考换算假设，不能声称是实时汇率。说明包含和不包含哪些费用，数字只作规划估算。预算段后空一行写“继续调整”，另起一行自然问一个有助于细化的问题。局部修改无需重发预算对比。`;

type PlanRange = { first: number; last: number };

const PLAN_QUALITY = `每天围绕可实际体验的事来安排，例如看什么、在哪散步、吃什么，以及相邻地点如何衔接。车站、机场、换乘通道和酒店只用于交通或住宿，不列为推荐景点，也不要用这些地点凑满一天。轻松日也至少介绍一个具体游览点，并在当日活动中原样复用其日文名称；加用餐和留白。只有用户明确要求全天休息，才排纯休息日。连续多天不要反复逛同一个地方，跨城留足路上和入住时间。
有札幌停留日可把円山公園和北海道神宮串成半天，或走大通公園、二条市場一带，已有这些安排就选另一片区域。鹿儿岛城山展望台用“城山展望台（鹿儿岛）”以区别同名地点。攻略写清能看到什么、怎么顺路；不知道开放、班次、直飞、季节和价格时，不当作已核实。不要冒称查过攻略或补造具体信息。`;

export function fullPlanInstruction(expectedDays?: number, repair?: string, range?: PlanRange): string {
  const dailyFormat = `每一天以“Day 1｜札幌初体验”这种短目标开头，标题独占一行。分别介绍当天实际会去的重点景点，一般2个，最多4个，纯交通日按实际情况。景点日文原名用双星号单独一行，下一行简述一两句。中文名不同时可在原名后加括号。景点之间空一行。App会在介绍下方匹配横向照片，不写图片链接。
随后单独一行写“当日安排”，完整游览日写7至8行，抵达、转场和返程按实际列至少2行。每行只写“活动｜内容”，按先后顺序，活动开头不要写钟点或时段。仅在确实有帮助时于活动末尾加“（建议晚上去，适合看夜景）”之类的短建议。普通游览日从早餐开始，到返回住宿休息结束。每一天先完整写完再开始下一天。`;
  const correction = repair ? `重写当前要求的全部内容。上次格式校验未通过：${repair}。` : "";
  if (range && range.first > 1) {
    return `你是务实、亲切的日本旅行搭档，默认用简体中文和“您”。按全程概览返回 Day ${range.first} 至 Day ${range.last} 的逐日安排。每一天的 number 是原行程编号，title 是简短的当日目标，不带 Day 前缀。天数连续，全部写完。
sights 数组通常列2个当天确实会去的景点，最多4个，纯交通或休息日可以为空。name 写完整日文原名，中文名不同时可加括号。description 用一两句解释为什么值得去。不要写图片链接或 Markdown。
activities 按出行顺序列活动，完整游览日7至8项，从早餐开始到回酒店休息结束。抵达、转场、返程也尽量覆盖当天细节，至少2项。每项直接写做什么，不加时间列或钟点前缀。只有时段影响体验时才在末尾加“（建议晚上去，适合看夜景）”这样的建议。每个景点的日文名称也要原样出现在对应活动里。未确认的班次和营业时间只作参考。不要在数据里添加开场、小结或预算。
${PLAN_QUALITY}
${correction}`;
  }
  if (range) {
    return `你是务实、亲切的日本旅行搭档，默认用简体中文和“您”。按用户要求以及此前对话中的出发地、回程地、地区顺序、人数和偏好来规划。全程为 ${expectedDays} 天。
opening 是一段简短路线建议。overview 列全程目的地和对应的连续日期范围，从第1天覆盖到第${expectedDays}天，无重叠或缺天。京都、大阪、福冈、鹿儿岛等不同住宿基地分别列清天数，不合成一行。按用户指定顺序，转场日归入抵达地。days 列 Day 1 至 Day ${range.last} 的详细安排，连续写完，日期和地点与 overview 逐天对应。number 用原行程编号。title 仅写当日目标。sights 写2至4个实际到访的重点景点，各含日文 name 和简短 description，转场或休息日可减少。活动中复用景点名称。activities 依次写7至8项，出发、转场、返程等按实际安排，至少2项。不要加钟点前缀。确实需要建议时，把“（建议晚上去，适合看夜景）”放在对应活动末尾。
summary 概括整趟行程的取舍。budget 按全程和实际人数估算。currency 默认JPY（即使从中国出发），仅用户明确要求其他显示币种才选CNY。用户人民币预算上限须按明确说明的参考换算假设估算日元，不冒称实时汇率；人数未知按1人并在 scope 说明。scope 写明包含和排除项目。用3至6条费用项分别填省钱、舒适、豪华的非负整数金额，三档合计递增；不添加合计项目。不要提及分批或让用户回复继续。文本字段不要写图片链接、Markdown 或换行。
${PLAN_QUALITY}
${correction}`;
  }
  const coverage = `概览和详情必须覆盖完整旅程，从 Day 1 到最后一天，返程也包括在内。${expectedDays ? `本轮必须写完 Day 1 至 Day ${expectedDays}。` : "未知总天数时做合理假设并在开场说明。"} 篇幅紧张时缩短介绍和每条活动，绝不能用“后续类似”或“请回复继续”代替任何一天。`;
  return `你是务实、亲切的日本旅行搭档，默认用简体中文和“您”。旅行规划或修改行程时，沿用对话中已确定的出发地、返程地、人数、兴趣、预算和城市先后顺序。简单事实、问候和明确只问单项费用的问题直接回答。

每次输出行程时，依次写一小段开场、行程规划、行程详情、小结、预算对比。严格使用以下格式。

行程规划
第1–4天：北海道（札幌、小樽）
第5天：返程

行程详情
Day 1｜札幌初体验

**札幌市時計台**
木造钟楼适合停留拍照，和周边街区可以一起逛。

**大通公園**
从公园步行逛街景，天气好时能看到电视塔。

当日安排
活动｜抵达新千歳空港后前往札幌市区
活动｜到酒店寄存行李，附近吃汤咖喱
活动｜参观**札幌市時計台**（建议白天去，方便拍外观）
活动｜沿**大通公園**散步
活动｜在すすきの附近吃晚饭
活动｜返回酒店休息

示例只是格式。概览按区域用“第1–4天：地区”或“第5天：安排”，日期连续无重叠。三周就是21天。明确各段顺序时按原顺序排。修改行程后按相同格式返回新版。
${coverage}
${dailyFormat}
每处介绍过的景点必须在同一天的活动里出现，日文原名保持一致，便于 App 将照片配到对应景点。
${PLAN_QUALITY}

${BUDGET_COMPARISON.split("预算段后", 1)[0]}预算对比必须是回复的最后一部分。需要确认的问题可以写在小结里。

日文名称、移动路线和安排需合理。未确认的交通班次、营业时间和价格只作建议或估算。不要用地图、项目符号或 Markdown 表格。预算范围反映全程。
${correction}`;
}

const DAILY_ITINERARY_LAYOUT = (completeItinerary: boolean) => `开场后写“行程草案”，简短注明安排和时间均可调整。不要另设“景点推荐”或重复输出一份总景点列表。已知天数按实际天数写，未知时明确“先按3天示例，待确认”。
${completeItinerary ? COMPLETE_TRIP : BATCHED_TRIP}
按 Day 顺序逐天完整写完再进入下一天。每一天依次写：
第一段独立一行“Day 1｜区域或路线”，用短标题，例如“Day 1｜抵达东京”“Day 5｜京都北部”，不在标题写逗号分隔的活动、完整句子或时间表，标题后空一行。
接着分别介绍当天实际会去、值得展开的不同重点景点，数量随路线调整，每天最多4个。当天有多个代表性景点时至少选2个；若确有3至4个地点各有特色且都符合用户兴趣，可分别介绍，不固定只给1至2个。动漫或游戏主题时优先写与作品或兴趣真正相关的街区、展馆和店铺，说清关联，不编造原型或官方联动。每个景点用“**完整日文景点名(必要的中文名)**”独占一行，下一行写一小段介绍，再空一行。App会把对应横向实景照放在介绍下方。不要写“配图：”、图片说明或网址。纯交通、休息日或用户只想去一个景点时，按实际安排介绍，不强行凑数。跨城或抵达日如果会逛大阪城公園和道頓堀，就分别介绍这两处。
最后单独写“当日安排”，下一行起通常连续写8至9行“时间｜行程”，每个完整游览日至少7行，每行只用一个全角分隔符。用具体的24小时钟点按先后排序。普通游览日的第一条写起床后在哪里或吃什么早餐，最后一条写返回当天住宿休息。换乘、用餐、观光和休息各占相应时间，一行只写一个主要环节。抵达、退房返程等特殊日按真实行程开头或收尾。下面是住札幌去小樽的一天：
07:30｜起床，在札幌站附近吃日式早餐
09:00｜从札幌站搭电车前往小樽
10:30｜沿小樽運河散步拍照
12:30｜在运河附近吃海鲜盖饭
14:30｜参观小樽オルゴール堂
16:00｜在堺町通附近吃甜点、休息
18:00｜搭电车返回札幌
19:15｜在札幌站附近吃味噌拉面
20:30｜返回酒店休息
这是格式示例，具体安排根据用户情况重写。若抵达或出发时间未知，在开场说明参考假设，时刻可按实际票务调整。表里的时间是建议安排，不编造具体航班、车次或实时营业时间。安排里必须写出刚介绍的景点原名，字形完全一致，括号里的中文名可省略。不输出列标题、Markdown表格或项目符号。
${completeItinerary ? '每天在时间表内，用双星号标注最多4个当天明确要去、值得配实景照的地点。比如“15:00｜前往**芝公園**散步，顺路观赏**東京タワー**”。只标注完整准确的日文地点名称，不标注早餐、普通车站、机场、酒店、城市名或无名展望台。已有独立介绍的地点仍在时间表标注原名，其余重要地点也要标注，以便 App 找到各自的照片。不同地点不能用邻近地标代替，东京的銀座、戸越銀座、渋谷駅前交差点与渋谷スクランブルスクエア要严格区分。' : ''}
当日安排的最后一行后空一行，再开始下一个 Day。需要单独修改某一天或某个时段时，用相同的时间行格式，只输出受影响的安排，景点介绍只在确有新增重点时写。`;

export function travelSystemInstruction(dailyItinerary: boolean, completeItinerary = false) {
  return `你是一位亲切、务实的日本旅行搭档，默认使用简体中文，用户明确要求其他语言时遵从。中文回复始终用“您”称呼用户，包括追问、标题和总结。称呼多人可用“各位”。保留地名、作品名等正式名称原样。

对话方式：
像一位有经验、会替用户省心的旅行朋友，先把建议讲清楚，再自然聊下一步。不要把每轮对话都做成“给两个选项、问一个问题”的固定流程，也不要一上来盘问或发送整套信息问卷。
首次给某个目的地做整体玩法或行程建议时，先给可讨论的有用草案。短途通常写1000至1500个中文字符，5天至一周通常写1600至2400字。${completeItinerary ? '长途按天数合理增加篇幅，优先保留全部天数和每天的时间表。' : '整轮最多3000字符。'} 后续讨论只更新相关内容。简单事实、确认或局部修改直接简短回答。
首次整体规划的排版约定：
开头先用一小段说明推荐方向、路线取舍；不写开场标题，不提前罗列全部景点名。
${dailyItinerary ? DAILY_ITINERARY_LAYOUT(completeItinerary) : LEGACY_ITINERARY_LAYOUT}
${completeItinerary ? BUDGET_COMPARISON : '接着写“预算参考”，说明按人均还是全体、按每天还是全程、包含哪些费用。用连续3至5行“项目｜约X～Y日元”的形式估算。最后写“小结”，用一两句总结取舍，温和邀请用户补充最影响路线的一两项信息。'}
用户补充日期、人数、预算、喜欢的景点、住宿位置或节奏之后，沿用已经讨论的草案修改相应的天数或时段，并明确本次改动。用户要求详细化时，再增加时间段、交通衔接、吃饭和休息安排；不要每次重发景点介绍和预算，不把草案称为已保存的正式计划。不输出地图。
建议要有理由、取舍和容易执行的做法，语气自然、有生活感，像“累了就回酒店歇一会儿”“不必每个地方都打卡”。按用户需要灵活讲住宿、路线、交通、吃饭、避人潮或留白，不必每条都介绍景点，更不要每次都套同一套景点卡片。
写出实际走起来是什么感觉。参考中文旅行笔记的实用角度，给一两个能用上的细节，例如在哪一带吃饭、哪一段顺路散步、下雨时可换什么。再用行程攻略的方式把住宿出发点、景点顺序、移动方式和吃饭衔接起来。避免“感受独特魅力”“打卡网红地标”等空话。推荐具体餐馆时应确定名字和区域；不确定时写餐饮类型与街区。
先检查相邻两站的关系，再写交通。能沿同一街区顺路步行时就排成一段；距离或路线不确定时，给大致方向并标明待核对，不凭空写线路、车站出口或分钟数。已核对的东京例子：浅草寺 → 沿浅草一侧西岸步行到台東区立隅田公園 → 从西岸走すみだリバーウォーク过河一次 → 经東京ミズマチ到東京スカイツリータウン。这条路线在隅田公園前仍留在西岸，不要先走吾妻橋过河，也不要安排两次过河。塔下的東京ソラマチ是商场，登塔是独立的观景活动。只有与用户的路线相符时才引用这些例子。
每天只在真正结束行程时写一次返回酒店。买零食、晚餐或散步安排在回酒店之前，优先在已安排的区域顺路解决。达到时间行数靠有用的环节和真实的休息空档。
可以把有关联的地点放在同一节，但不要挤成很长的一句；地点较多时分行写。篇幅增加时靠小标题和短段保持清晰，不输出一整墙文字。
${completeItinerary ? '只对独立介绍和时间表内需要配图的重点景点名称使用成对双星号，App会识别这些地点。' : '只有单独介绍的重点景点名称使用成对双星号。'} 其他文字不用此标记。不把所有地方都宣称人人必去，也不在用户只追问住宿、交通或预算时硬塞新景点。
结尾单独一小段，温和邀请用户继续，例如“如果你愿意说说玩几天、比较喜欢什么，我可以接着帮你把路线排顺。”根据已知条件只提仍需要的信息，不重复询问。可以一次自然邀请补充两三项，也可以只问一项；不用每轮必须反问，不强迫二选一，不把示例邀请当成固定结尾。

规划过程：
根据完整对话保留同一趟旅行的出发地、返程地、城市先后顺序、日期或天数、人数、预算、兴趣和节奏。用户用“先……然后……最后……”给出路线时，按这个顺序排；若另一个顺序可能更顺，只在说明里提出建议，直到用户同意才调整。用户修改某项时只调整相关部分，其他条件继续保留。
逐步补齐会影响安排的未知条件；可以提出建议，但不能把未确认的人数、预算、出行季节或节奏当成用户的决定。预算应分清人均或总额、覆盖范围。
优先回答用户当下的问题。问“怎么玩轻松”，就先给有用的小指南；明确给出天数并请求行程时，给覆盖这些天数的编号安排或按天分组草案，讲清区域、体验和交通取舍。不要只罗列城市，也不强迫用户先完成问卷。
缺少日期或交通方式时，标明草案待确认。不要把距离很远的地区写成轻松一日往返；路线尽量集中，给休息留白。详细程度按用户要求调整，遵循上面的篇幅和逐日格式。
不知道出行月份时，用“如果是秋季”“冬天出行的话”等条件表述，不能仅因为当前日期或示例写了十一月，就认定用户旅行时是红叶季。营业时间、门票、交通支付覆盖和拥挤程度未核实时不作绝对承诺。

地点名称：
中文回复中介绍景点、餐厅等具体地点时，先写准确的日文原名，保留日文汉字、假名、々和店家原有写法，不要先转换成简体中文或用罗马字替代。
若有可靠、常用且不同的中文名称，在日文原名后用半角括号补充中文名，格式为“日文原名(中文名)”，例如“代々木公園(代代木公园)”。
括号内必须是中文名称，绝不能用英文、罗马字或拼音充当中文翻译。例如只写“札幌”“小樽”“函館”，不写“札幌(Sapporo)”“小樽(Otaru)”“函館(Hakodate)”。原名是日文时也不要用“Animate池袋总店”这种英汉混写充当中文名。
若中日名称本来相同，或只有简繁体、常见字形差异，就只写日文原名，不重复加中文括号。例如只写“明治神宮”，不要写“明治神宮(明治神宫)”或“明治神宮(明治神宮)”。
原名含平假名、片假名时照原样保留；没有可靠中文译名时只保留日文，不硬译、不编造店名或伪装成官方中文名。同一条回复重复提及同一地点时无需反复加括号。
已核对的名称示例：“秋葉原ラジオ会館(秋叶原无线电会馆)”。错误写法“Radio会館(Radio会馆)”把片假名改成英文并重复中文，必须避免；即使历史回复用了错误写法，新回复也要纠正。另一个原名是“アニメイト池袋本店”，不要写成“アニメイト 池袋本店”再用英文充当中文译名。不确定译名时只用准确原名。

排版与真实性：
使用纯文本小标题和自然换行；整体规划的主标题使用上面约定的标题，局部详细建议可使用“1. 标题”编号格式。标题独立一行，正文另起行，章节之间空一行。不要使用“•”“●”“▪”等圆点，也不要使用破折号或星号作项目符号。不输出HTML实体或行尾反斜杠等转义字符。
除上述重点景点名称的双星号标记外，不使用Markdown标题、其他星号强调、下划线、反引号、代码块或表格，不输出###。不要堆砌表情或长免责声明。
你只负责文字建议；景点图片由App联网匹配，不要编造图片URL或声称自己已搜索、核实图片。没有保存、预订、支付或实时商家查询功能，不声称已经完成这些操作。
未核实的票价、交通费、营业时间和网址不能当成已确认事实。金额注明币种和估算；涉及此类信息时简短提醒核对官方来源，不编造链接。
旅行笔记的体验可以作为安排灵感，营业、预约、票价和通行信息优先以景点或交通运营方的官方资料为准。没有查询到当日资料时明确待确认，不声称读过某篇笔记或刚核实了某家店。

最后检查本轮用户的真正要求（优先于首次规划模板）：
已经有草案之后，如果用户只改某一天、某个时段或某项条件，只回复简短确认和这部分调整，通常100至300字；不输出其他未改的天数，不重复“景点推荐”“预算参考”“小结”。用户说“其他天不改，预算先不调整”，则其他天和所有预算行都必须省略，只说“其余安排和预算沿用上一版”。例如只改第二天下午时，可以显示Day 2的上午/下午/晚上，并明确下午的变动；不能重发Day 1或Day 3。只有用户明确要求完整最新版时才重发全表。用户改总天数时可以覆盖新的全部天数，不等于必须重发景点和预算。
预算表不能出现“项目｜…”这种占位行，不得挪动旧表项目与金额的对应关系。范围说明只列实际纳入估算的项目，没列购物预算就不能声称合计包含购物。给未知住宿档次的估算时标明这是建议档次，而不是用户已经选择。
名称检查：括号中不能出现纯英文译名，例如サンシャインシティ后不能补(Sunshine City)，没有可靠中文名时只写サンシャインシティ。
路线检查：先核对出发城市、每一站的先后顺序、返程城市都与用户要求一致，再按实际走向逐站检查，河流、桥梁、车站和购物区写法要与行程表一致，避免跨过同一条河又折返回来。每个必要活动只排一次。
${dailyItinerary ? '发送前逐天检查：Day 标题只是短路线名；有实际游览就先写重点景点，再单独写“当日安排”和具体钟点表；每个完整游览日至少7行，通常8至9行。检查第一条包括起床和早餐，最后一条返回酒店或当天住宿。抵达及返程按实际情况调整首尾。只修改某个时段时仅列出受影响的安排。' : ''}
${completeItinerary ? '完整草案的硬性格式：逐天数“时间｜行程”行。完整游览日写满8行左右，至少7行，含早餐、上午景点、午餐、下午景点、休息或移动、晚餐、返回住宿。早餐与第一站、晚餐与回酒店分别占一行。抵达、跨城及返程日按实际行程列出交通、用餐、入住或退房，只有游览时间明显不足才少于7行。前后各天同样详细。再数一遍 Day 标题，确认从 Day 1 连续排到最后一天，末尾依次为小结、预算对比、继续调整。' : ''}`;
}

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type GeminiContent = { role: "user" | "model"; parts: { text: string }[] };
export type GenerationResult = {
  text?: string;
  blocked?: boolean;
  reachedOutputLimit?: boolean;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};
export type ProviderCredentials =
  | { provider?: "developer"; apiKey: string }
  | { provider: "vertex"; projectId: string; location: string };
export type GenerateReply = (input: ProviderCredentials & {
  model: string;
  contents: GeminiContent[];
  dailyItinerary: boolean;
  language?: ReplyLanguage;
  visitConstraints?: VisitConstraint[];
  completeItinerary?: boolean;
  planFormat?: { expectedDays?: number; repair?: string; range?: PlanRange };
  signal: AbortSignal;
}) => Promise<GenerationResult>;

export class ChatError extends Error {
  status: number;
  code: string;
  retryAfter?: number;

  constructor(status: number, code: string, message: string, retryAfter?: number) {
    super(message);
    this.name = "ChatError";
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateMessages(body: unknown, completeItinerary = false): ChatMessage[] {
  if (!isRecord(body) || Object.keys(body).some((key) => key !== "messages")) {
    throw new ChatError(400, "INVALID_REQUEST", "请求只能包含 messages 对话列表。");
  }
  const messages = body.messages;
  if (!Array.isArray(messages) || !messages.length || messages.length > CHAT_LIMITS.maxMessages) {
    throw new ChatError(400, "INVALID_MESSAGES", "对话需要包含 1 至 40 条消息，请开启新对话后重试。");
  }
  let totalCharacters = 0;
  const validated = messages.map((message, index): ChatMessage => {
    if (!isRecord(message) || Object.keys(message).some((key) => key !== "role" && key !== "content")) {
      throw new ChatError(400, "INVALID_MESSAGE", "每条消息只能包含 role 和 content。");
    }
    const expectedRole = index % 2 === 0 ? "user" : "assistant";
    if (message.role !== expectedRole) {
      throw new ChatError(400, "INVALID_CONVERSATION", "对话必须从用户开始，按 user、assistant 交替排列。");
    }
    if (typeof message.content !== "string" || !message.content.trim()) {
      throw new ChatError(400, "INVALID_MESSAGE", "消息内容不能为空。");
    }
    const limit = completeItinerary && expectedRole === "assistant" ? CHAT_LIMITS.fullReplyCharacters : CHAT_LIMITS.maxMessageCharacters;
    if (message.content.length > limit) {
      throw new ChatError(400, "MESSAGE_TOO_LONG", `单条消息不能超过 ${limit} 个字符。`);
    }
    totalCharacters += message.content.length;
    return { role: expectedRole, content: message.content };
  });
  if (validated.at(-1)?.role !== "user") {
    throw new ChatError(400, "INVALID_CONVERSATION", "最后一条消息必须来自用户。");
  }
  if (totalCharacters > CHAT_LIMITS.maxTotalCharacters) {
    throw new ChatError(400, "CONVERSATION_TOO_LONG", "对话总长度不能超过 32000 个字符，请开启新对话。");
  }
  return validated;
}

export function toGeminiContents(messages: ChatMessage[]): GeminiContent[] {
  return messages.map(({ role, content }) => ({
    role: role === "assistant" ? "model" : "user",
    parts: [{ text: content }],
  }));
}

function isLocalAddress(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "::1") return true;
  if (host.startsWith("::ffff:")) return isLocalAddress(host.slice(7));
  if (isIP(host) === 6) return /^(fc|fd|fe[89ab])/.test(host);
  if (isIP(host) !== 4) return false;
  const [a, b, c, d] = host.split(".").map(Number);
  // IANA's IPv4 Service Continuity Prefix is non-global (RFC 7335). Some
  // IPv6-transition networks assign 192.0.0.2 to the local interface. Restrict
  // this exception to /29: 192.0.0.9 and .10 are globally reachable anycast.
  const serviceContinuity = a === 192 && b === 0 && c === 0 && d <= 7;
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 169 && b === 254) || serviceContinuity;
}

export function verifyLocalRequest(request: Request, isDevelopment: boolean) {
  if (!isDevelopment) {
    throw new ChatError(503, "LOCAL_DEVELOPMENT_ONLY", "聊天接口目前仅供本地开发，请使用 npm run dev 启动服务。");
  }
  const url = new URL(request.url);
  const hostHeader = request.headers.get("host");
  // `next dev --hostname 0.0.0.0` can use its bind address in Request.url.
  // Validate the browser/native request's Host separately in that case.
  let effectiveUrl = url;
  if (hostHeader) {
    try {
      effectiveUrl = new URL(`${url.protocol}//${hostHeader}`);
      if (effectiveUrl.host !== hostHeader.toLowerCase()) throw new Error("invalid host");
    } catch {
      throw new ChatError(403, "LOCAL_DEVELOPMENT_ONLY", "请求中的本地服务地址无效。");
    }
  }
  const isBindAddress = hostHeader && ["0.0.0.0", "[::]"].includes(url.hostname);
  if ((!isLocalAddress(url.hostname) && !isBindAddress) || !isLocalAddress(effectiveUrl.hostname)) {
    throw new ChatError(403, "LOCAL_DEVELOPMENT_ONLY", "请通过 localhost 或电脑的局域网地址访问本地聊天服务。");
  }
  const origin = request.headers.get("origin");
  if ((origin && origin !== effectiveUrl.origin) || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new ChatError(403, "ORIGIN_NOT_ALLOWED", "此本地接口不接受其他网站发起的请求。");
  }
}

// Next.js Request does not expose a socket address. Treat forwarded addresses as
// best effort only; the global bucket always applies even if headers are spoofed.
function clientBucket(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const candidate = forwarded && forwarded.length <= 128 ? forwarded.split(",")[0].trim() : "";
  return candidate && isLocalAddress(candidate) ? candidate : "local";
}

export function createCallControls(options: {
  perClient?: number; global?: number; maxConcurrent?: number; windowMs?: number;
} = {}) {
  const perClient = options.perClient ?? 10;
  const globalLimit = options.global ?? 30;
  const maxConcurrent = options.maxConcurrent ?? 2;
  const windowMs = options.windowMs ?? 60000;
  const clients = new Map<string, { start: number; count: number }>();
  let globalWindow = { start: 0, count: 0 };
  let active = 0;
  return {
    acquire(key: string, now: number): () => void {
      if (now - globalWindow.start >= windowMs) globalWindow = { start: now, count: 0 };
      for (const [client, bucket] of clients) {
        if (now - bucket.start >= windowMs) clients.delete(client);
      }
      // Bound the map even when requests carry different spoofed addresses.
      const boundedKey = clients.has(key) || clients.size < 256 ? key : "overflow";
      const bucket = clients.get(boundedKey) ?? { start: now, count: 0 };
      if (globalWindow.count >= globalLimit || bucket.count >= perClient) {
        const waitMs = Math.max(
          globalWindow.count >= globalLimit ? windowMs - (now - globalWindow.start) : 0,
          bucket.count >= perClient ? windowMs - (now - bucket.start) : 0,
        );
        const retryAfter = Math.max(1, Math.ceil(waitMs / 1000));
        throw new ChatError(429, "RATE_LIMITED", "请求过于频繁，请稍后再试。", retryAfter);
      }
      if (active >= maxConcurrent) {
        throw new ChatError(503, "SERVER_BUSY", "当前正在处理其他对话，请稍后重试。", 2);
      }
      globalWindow.count++;
      bucket.count++;
      clients.set(boundedKey, bucket);
      active++;
      let released = false;
      return () => {
        if (!released) active--;
        released = true;
      };
    },
  };
}

function abortError(signal: AbortSignal): ChatError {
  return signal.reason instanceof ChatError ? signal.reason :
    new ChatError(408, "REQUEST_CANCELLED", "请求已取消，请重新发送。");
}

function raceWithAbort<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortError(signal));
    if (signal.aborted) return onAbort();
    signal.addEventListener("abort", onAbort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

export async function readJsonBody(request: Request, signal: AbortSignal, maxBytes: number = CHAT_LIMITS.maxBodyBytes): Promise<unknown> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) {
    throw new ChatError(415, "UNSUPPORTED_CONTENT_TYPE", "请使用 application/json 发送对话。");
  }
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maxBytes)) {
    throw new ChatError(413, "BODY_TOO_LARGE", "请求内容超过允许大小。");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new ChatError(400, "INVALID_JSON", "请求需要有效的 JSON 内容。");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    while (true) {
      if (signal.aborted) throw abortError(signal);
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        cancel();
        throw new ChatError(413, "BODY_TOO_LARGE", "请求内容超过允许大小。");
      }
      chunks.push(value);
    }
    if (signal.aborted) throw abortError(signal);
    const buffer = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.byteLength;
    }
    try {
      return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer));
    } catch {
      throw new ChatError(400, "INVALID_JSON", "请求需要有效的 JSON 内容。");
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}

export function mapProviderError(error: unknown): ChatError {
  if (error instanceof ChatError) return error;
  const status = isRecord(error) && typeof error.status === "number" ? error.status : undefined;
  const message = error instanceof Error ? error.message : isRecord(error) && typeof error.message === "string" ? error.message : "";
  if (status === 401 || status === 403 || /API_KEY_INVALID|API key not valid/i.test(message)) {
    return new ChatError(503, "GEMINI_AUTH_ERROR", "Gemini 调用凭证无效或没有权限，请检查服务端密钥或服务身份配置。");
  }
  if (status === 404) return new ChatError(503, "MODEL_UNAVAILABLE", "配置的 Gemini 模型不可用，请检查 GEMINI_MODEL。");
  if (status === 402) return new ChatError(503, "GEMINI_BILLING_REQUIRED", "团队 Gemini API 预付余额不可用，请由服务负责人在 AI Studio 核对计费。测试者不需要充值或填写密钥。");
  if (status === 429) return new ChatError(429, "GEMINI_RATE_LIMITED", "Gemini 调用频率或额度受限，请稍后重试并由负责人核对团队项目额度。", 30);
  if (status === 408 || status === 504 || (error instanceof Error && /AbortError|TimeoutError/.test(error.name))) {
    return new ChatError(504, "GEMINI_TIMEOUT", "Gemini 响应超时，请稍后重试。");
  }
  if (status === 400) return new ChatError(502, "GEMINI_REQUEST_REJECTED", "Gemini 未能接受此次请求，请检查模型配置或换一种方式提问。");
  return new ChatError(502, "GEMINI_UNAVAILABLE", "暂时无法连接 Gemini，请稍后重试。");
}

export type ChatConfiguration = {
  apiKey?: string; model?: string; isDevelopment: boolean;
  accessMode?: string; publicOrigin?: string;
  provider?: string; projectId?: string; location?: string;
};
type ChatLog = Record<string, string | number | undefined>;

function tokenCount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

export function createChatHandler(dependencies: {
  getConfiguration: () => ChatConfiguration;
  generate: GenerateReply;
  assess?: AssessPlanning;
  controls?: ReturnType<typeof createCallControls>;
  timeoutMs?: number;
  now?: () => number;
  log?: (event: ChatLog) => void;
  sharedAccess?: () => SharedChatAccess;
}) {
  const controls = dependencies.controls ?? createCallControls();
  const now = dependencies.now ?? Date.now;
  return async function handleChat(request: Request): Promise<Response> {
    const start = now();
    const metadata: ChatLog = { event: "gemini_chat" };
    const controller = new AbortController();
    const onCancel = () => controller.abort(new ChatError(408, "REQUEST_CANCELLED", "请求已取消，请重新发送。"));
    request.signal.addEventListener("abort", onCancel, { once: true });
    if (request.signal.aborted) onCancel();
    const language = replyLanguage(request.headers.get("X-Travel-Language"));
    const photoFormat = request.headers.get("X-Travel-Day-Photos");
    const strictPlan = photoFormat === "4";
    const completeItinerary = photoFormat === "3" || strictPlan;
    const timeoutMs = completeItinerary ? CHAT_LIMITS.fullTimeoutMs : CHAT_LIMITS.timeoutMs;
    const timer = setTimeout(() => controller.abort(new ChatError(504, "GEMINI_TIMEOUT", "Gemini 响应超时，请稍后重试。")), dependencies.timeoutMs ?? timeoutMs);
    let release: (() => void) | undefined;
    let work: Promise<Response> | undefined;
    try {
      const configuration = dependencies.getConfiguration();
      const mode = configuration.accessMode ?? "local";
      if (mode !== "local" && mode !== "shared") throw new ChatError(503, "SHARED_SERVICE_NOT_CONFIGURED", "旅行助手尚未准备好，请稍后再试。");
      if (mode === "shared") verifySharedRequest(request, configuration.publicOrigin);
      else verifyLocalRequest(request, configuration.isDevelopment);
      const bearer = mode === "shared" ? sessionToken(request) : undefined;
      // This cheap process-local gate also bounds unauthenticated database reads.
      // Persistent admissions below enforce the daily limits across instances.
      release = controls.acquire(mode === "shared" ? "shared" : clientBucket(request), now());
      work = (async () => {
        const messages = validateMessages(await readJsonBody(request, controller.signal), completeItinerary);
        metadata.inputMessages = messages.length;
        metadata.inputCharacters = messages.reduce((sum, message) => sum + message.content.length, 0);
        const provider = configuration.provider ?? "developer";
        let credentials: ProviderCredentials;
        if (provider === "vertex") {
          const projectId = configuration.projectId?.trim();
          const location = configuration.location?.trim();
          if (!projectId || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId) ||
            !location || !/^[a-z][a-z0-9-]{0,62}$/.test(location)) {
            throw new ChatError(503, "MISSING_VERTEX_CONFIG", "服务端的 Vertex 项目或区域尚未配置，请由负责人检查服务配置。");
          }
          credentials = { provider: "vertex", projectId, location };
        } else if (provider === "developer") {
          const apiKey = configuration.apiKey?.trim();
          if (!apiKey) throw new ChatError(503, "MISSING_API_KEY", "服务端尚未配置 GEMINI_API_KEY，请先在 .env.local 中填写密钥并重启服务。");
          credentials = { apiKey };
        } else {
          throw new ChatError(503, "INVALID_GEMINI_PROVIDER", "服务端的 AI 接入方式配置无效，请联系负责人检查。");
        }
        const model = configuration.model?.trim();
        if (!model || !/^[a-zA-Z0-9._:/-]{1,128}$/.test(model)) {
          throw new ChatError(503, "MISSING_MODEL", "请在服务端 .env.local 配置可用的 GEMINI_MODEL，并重启服务。");
        }
        metadata.model = model;
        metadata.provider = provider;
        const access = bearer ? dependencies.sharedAccess?.() : undefined;
        if (bearer && !access) throw new SharedAccessError(503, "SHARED_SERVICE_NOT_CONFIGURED", "共享旅行助手尚未准备好，请稍后再试。");
        let admission: Admission | undefined;
        if (access && bearer) admission = await access.admit(bearer, now());
        if (controller.signal.aborted) throw abortError(controller.signal);
        let status = 200;
        try {
          let result: GenerationResult;
          try {
            const latestRequest = messages.at(-1)!.content;
            const visitConstraints = extractVisitConstraints(messages);
            let decision: PlanningDecision | undefined;
            if (strictPlan && dependencies.assess) {
              metadata.phase = "assessment";
              const assessmentStart = now();
              const assessment = await dependencies.assess({ ...credentials, model, language, contents: toGeminiContents(messages), signal: controller.signal })
                .finally(() => { metadata.assessmentDurationMs = now() - assessmentStart; });
              decision = assessment.decision;
              for (const key of ["inputTokens", "outputTokens", "totalTokens"] as const) {
                const tokens = tokenCount(assessment[key]);
                if (tokens !== undefined) metadata[key] = ((metadata[key] as number | undefined) ?? 0) + tokens;
              }
            }
            const wantsFullPlan = !decision || decision.action === "plan";
            const kyotoStarter = !decision && strictPlan && messages.length === 1 && /^两个人的京都[，,]\s*慢慢逛[。！!]?$/u.test(latestRequest.trim());
            const expectedDays = decision?.action === "plan" ? decision.days : requestedTripDays(latestRequest) ?? (kyotoStarter ? 3 : undefined);
            const generation = { ...credentials, model, language, visitConstraints, contents: toGeminiContents(messages), dailyItinerary: photoFormat === "2" || completeItinerary, completeItinerary: completeItinerary && wantsFullPlan, signal: controller.signal };
            const generate = async (repair?: string, range?: PlanRange, overview?: string) => {
              if (controller.signal.aborted) throw abortError(controller.signal);
              metadata.phase = "generation";
              const contents = overview ? [
                ...generation.contents,
                { role: "model" as const, parts: [{ text: `行程规划\n${overview}` }] },
                { role: "user" as const, parts: [{ text: `写出以下已确定日期的详细活动。每一天只能安排对应目的地及合理周边，保持原顺序，不把后续地区提前，也不把返程提前。\n${range ? routeForDays(overview, range.first, range.last) : ""}` }] },
              ] : kyotoStarter ? [
                { role: "user" as const, parts: [{ text: `${latestRequest}\n请先按三天两晚给两人一份可调整的京都慢游行程，在开场说明天数为暂定。` }] },
              ] : decision?.assumptions.length ? [
                ...generation.contents,
                { role: "user" as const, parts: [{ text: `本轮可使用的参考假设（开场简短说明，不称为已确认）：${decision.assumptions.join("；")}。全程${expectedDays}天。` }] },
              ] : generation.contents;
              metadata.generationCalls = (metadata.generationCalls as number | undefined ?? 0) + 1;
              const response = await dependencies.generate({ ...generation, contents, ...(strictPlan && wantsFullPlan ? { planFormat: { expectedDays, repair, range } } : {}) });
              for (const key of ["inputTokens", "outputTokens", "totalTokens"] as const) {
                const tokens = tokenCount(response[key]);
                if (tokens !== undefined) metadata[key] = ((metadata[key] as number | undefined) ?? 0) + tokens;
              }
              return strictPlan && response.text ? { ...response, text: normalizePlanReply(response.text) } : response;
            };
            const incomplete = () => new ChatError(502, "INCOMPLETE_ITINERARY", "这次行程没有生成完整，请点重试。");
            const generateChecked = async (range?: PlanRange, overview?: string) => {
              const check = (response: GenerationResult) => {
                if (response.blocked) return undefined;
                if (response.reachedOutputLimit || !response.text || response.text.length > CHAT_LIMITS.fullReplyCharacters) {
                  return "缩短开场和介绍，每项活动用一句话，完整写出要求的内容";
                }
                const formatIssue = range && overview
                  ? dayDetailsIssue(response.text, range.first, range.last, latestRequest) ?? routeIssue(response.text, overview, range.first, range.last)
                  : itineraryIssue(response.text, decision?.action === "plan" ? `${latestRequest}\n请生成完整行程` : latestRequest, expectedDays, range?.last);
                return formatIssue ?? visitConstraintIssue(response.text, visitConstraints, !range || range.first === 1 && range.last === expectedDays);
              };
              let response = await generate(undefined, range, overview);
              let issue = check(response);
              if (issue) {
                metadata.itineraryFirstIssue = issue;
                response = await generate(issue, range, overview);
                issue = check(response);
                if (issue) {
                  metadata.itineraryIssue = issue;
                  if (issue.startsWith("景点限制未满足")) throw new ChatError(502, "ITINERARY_CONSTRAINT_VIOLATION", "这次行程未能满足您限定的景点条件，请重试或编辑需求。");
                  throw incomplete();
                }
              }
              return response;
            };
            if (decision?.action === "clarify") {
              result = { text: decision.questions.join("\n\n") };
            } else if (!strictPlan || !wantsFullPlan) {
              result = await generate();
            } else if (expectedDays && expectedDays >= 12 && expectedDays <= 31 && (decision?.action === "plan" || isPlanRequest(latestRequest))) {
              const daysPerSegment = Math.ceil(expectedDays / 3);
              result = await generateChecked({ first: 1, last: daysPerSegment });
              if (!result.blocked) {
                const sections = itinerarySections(result.text ?? "");
                if (!sections) throw incomplete();
                const details = [sections.details];
                const ranges: PlanRange[] = [];
                for (let first = daysPerSegment + 1; first <= expectedDays; first += daysPerSegment) {
                  ranges.push({ first, last: Math.min(first + daysPerSegment - 1, expectedDays) });
                }
                // The overview fixes the route first. Remaining segments can be
                // generated together; the SDK scheduler still allows only two
                // actual provider calls across all concurrent chat requests.
                const segments = await Promise.allSettled(ranges.map((range) => generateChecked(range, sections.overview)));
                for (const segment of segments) {
                  if (segment.status === "rejected") throw segment.reason;
                  if (segment.value.blocked) { result = segment.value; break; }
                  details.push(segment.value.text!);
                }
                if (!result.blocked) {
                  result.text = [
                    sections.opening, `行程规划\n${sections.overview}`, "行程详情", ...details,
                    `小结\n${sections.summary}`, `预算对比\n${sections.budget}`,
                  ].join("\n\n");
                }
              }
            } else {
              result = await generateChecked(expectedDays && expectedDays < 12 && (decision?.action === "plan" || kyotoStarter || isPlanRequest(latestRequest)) ? { first: 1, last: expectedDays } : undefined);
            }
            if (wantsFullPlan && !result.blocked && result.text && visitConstraintIssue(result.text, visitConstraints, true)) throw new ChatError(502, "ITINERARY_CONSTRAINT_VIOLATION", "这次行程未能满足您限定的景点条件，请重试或编辑需求。");
          } catch (error) {
            if (controller.signal.aborted) throw abortError(controller.signal);
            if (error instanceof ChatError) throw error;
            throw mapProviderError(error);
          }
          if (controller.signal.aborted) throw abortError(controller.signal);
          if (result.blocked) throw new ChatError(422, "RESPONSE_BLOCKED", "Gemini 未能生成此内容，请换一种方式描述旅行需求。");
          const rawReply = result.text?.trim();
          let reply = rawReply && normalizeVerifiedPlaceNames(rawReply)
            .replace(/https?:\/\/[^\s<>]+|《[^》\n]*》|\*\*[^*\n]+\*\*|你们|你/g, (match) => match === "你" ? "您" : match === "你们" ? "各位" : match);
          const replyLimit = completeItinerary ? CHAT_LIMITS.fullReplyCharacters : CHAT_LIMITS.maxMessageCharacters;
          if (result.reachedOutputLimit || (reply && reply.length > replyLimit)) {
            throw strictPlan
              ? new ChatError(502, "INCOMPLETE_ITINERARY", "这次行程没有生成完整，请点重试。")
              : new ChatError(502, "RESPONSE_TOO_LONG", "回复超出长度限制，请缩小问题范围或要求先给概要后重试。");
          }
          if (reply && photoFormat !== "1") {
            reply = reply.replace(/^[ \t]*(?:配图|配圖)[：:][^\r\n]*(?:\r?\n|$)/gm, "").trim();
          }
          if (!reply) throw new ChatError(502, "EMPTY_RESPONSE", "Gemini 暂未返回文字，请稍后重试。");
          metadata.outputCharacters = reply.length;
          return Response.json({ reply }, { headers: { "Cache-Control": "no-store" } });
        } catch (error) {
          status = error instanceof ChatError || error instanceof SharedAccessError ? error.status : 500;
          throw error;
        } finally {
          if (access && admission) {
            try {
              await access.recordUsage(admission, {
                status,
                inputTokens: metadata.inputTokens as number | undefined,
                outputTokens: metadata.outputTokens as number | undefined,
                totalTokens: metadata.totalTokens as number | undefined,
              });
            } catch { metadata.usageRecording = "unavailable"; }
          }
        }
      })();
      // A timed-out provider keeps its slot until it settles, so an uncooperative
      // upstream cannot exceed the concurrency bound by ignoring cancellation.
      work.then(() => release?.(), () => release?.());
      const response = await raceWithAbort(work, controller.signal);
      metadata.status = response.status;
      return response;
    } catch (error) {
      const failure = error instanceof ChatError || error instanceof SharedAccessError ? error : new ChatError(500, "INTERNAL_ERROR", "聊天服务暂时不可用，请稍后重试。");
      metadata.status = failure.status;
      metadata.code = failure.code;
      const headers: Record<string, string> = { "Cache-Control": "no-store" };
      if (failure.retryAfter) headers["Retry-After"] = String(failure.retryAfter);
      return Response.json({ error: { code: failure.code, message: failure.message } }, { status: failure.status, headers });
    } finally {
      clearTimeout(timer);
      request.signal.removeEventListener("abort", onCancel);
      if (!work) release?.();
      metadata.durationMs = now() - start;
      try { dependencies.log?.(metadata); } catch { /* Logging must not break chat. */ }
    }
  };
}
