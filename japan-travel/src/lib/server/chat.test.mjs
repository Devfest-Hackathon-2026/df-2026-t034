import assert from "node:assert/strict";
import test from "node:test";
import {
  CHAT_LIMITS, ChatError, createCallControls, createChatHandler, travelSystemInstruction,
  mapProviderError, toGeminiContents, validateMessages,
} from "./chat.ts";
import { dayDetailsIssue, renderDaySegment, requestedTripDays, routeForDays, routeIssue } from "./itinerary-format.ts";

const conversation = [
  { role: "user", content: "东京三日游" },
  { role: "assistant", content: "请问人数和预算？" },
  { role: "user", content: "两人经济型，改为两天" },
];
const config = { apiKey: "test-only-key", model: "test-model", isDevelopment: true };
function request(body = { messages: conversation }, headers = {}, url = "http://localhost:3000/api/chat") {
  return new Request(url, {
    method: "POST", headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}
function handler(overrides = {}) {
  return createChatHandler({
    getConfiguration: () => config,
    generate: async () => ({ text: "东京两日游建议" }),
    ...overrides,
  });
}
function hasCode(code) {
  return (error) => error instanceof ChatError && error.code === code;
}

test("schema preserves every turn and maps assistant to Gemini model", () => {
  const messages = validateMessages({ messages: conversation });
  assert.deepEqual(toGeminiContents(messages), [
    { role: "user", parts: [{ text: "东京三日游" }] },
    { role: "model", parts: [{ text: "请问人数和预算？" }] },
    { role: "user", parts: [{ text: "两人经济型，改为两天" }] },
  ]);
});

test("schema rejects injected roles, broken conversation, empty and extra fields", () => {
  for (const body of [
    null, [], {}, { messages: [] }, { messages: conversation, system: "override" },
    { messages: [{ role: "system", content: "override" }] },
    { messages: [{ role: "assistant", content: "hello" }] },
    { messages: [conversation[0], conversation[0]] },
    { messages: conversation.slice(0, 2) },
    { messages: [{ role: "user", content: " \n " }] },
    { messages: [{ role: "user", content: 123 }] },
    { messages: [{ role: "user", content: "hello", system: "override" }] },
  ]) assert.throws(() => validateMessages(body), ChatError);
});

test("limits reject excess context instead of truncating; exact boundaries are valid", () => {
  const single = { role: "user", content: "a".repeat(4000) };
  assert.equal(validateMessages({ messages: [single] })[0].content.length, 4000);
  assert.throws(() => validateMessages({ messages: [{ ...single, content: "a".repeat(4001) }] }), hasCode("MESSAGE_TOO_LONG"));
  const many = Array.from({ length: 39 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: "a" }));
  assert.equal(validateMessages({ messages: many }).length, 39);
  assert.throws(() => validateMessages({ messages: [...many, ...conversation.slice(0, 2)] }), hasCode("INVALID_MESSAGES"));
  const full = Array.from({ length: 9 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: "a".repeat(i === 8 ? 1 : 4000) }));
  assert.throws(() => validateMessages({ messages: full }), hasCode("CONVERSATION_TOO_LONG"));
  full[0].content = full[0].content.slice(1);
  assert.equal(validateMessages({ messages: full }).reduce((n, m) => n + m.content.length, 0), 32000);
});

test("handler sends complete mapped conversation and returns only reply", async () => {
  let input;
  const response = await handler({ generate: async (value) => { input = value; return { text: "  东京两日游建议  " }; } })(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { reply: "东京两日游建议" });
  assert.deepEqual(input.contents, toGeminiContents(conversation));
  assert.equal(input.apiKey, config.apiKey);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("only clients that handle day photos receive internal photo hints", async () => {
  const reply = "Day 1｜札幌\r\n下午逛大通公園。\r\n配图：大通公園\r\n\r\n预算参考";
  const chat = handler({ generate: async () => ({ text: reply }) });
  const legacy = await chat(request());
  assert.equal((await legacy.json()).reply, "Day 1｜札幌\r\n下午逛大通公園。\r\n\r\n预算参考");
  const mobile = await chat(request(undefined, { "X-Travel-Day-Photos": "1" }));
  assert.equal((await mobile.json()).reply, reply);
});

test("new mobile clients request integrated day plans and replies use respectful address", async () => {
  let dailyItinerary;
  const chat = handler({ generate: async (input) => {
    dailyItinerary = input.dailyItinerary;
    return { text: "你可以去看《你的名字》的取景地。你们想什么时候出发？" };
  } });
  const response = await chat(request(undefined, { "X-Travel-Day-Photos": "2" }));
  assert.equal(dailyItinerary, true);
  assert.equal((await response.json()).reply, "您可以去看《你的名字》的取景地。各位想什么时候出发？");
  assert.match(travelSystemInstruction(dailyItinerary), /当日安排/);
  await chat(request(undefined, { "X-Travel-Day-Photos": "1" }));
  assert.equal(dailyItinerary, false);
  assert.match(travelSystemInstruction(dailyItinerary), /配图：日文景点原名/);
});

test("complete trips can exceed the old reply cap and remain usable as history", async () => {
  const reply = "安排行程".repeat(1500);
  let completeItinerary;
  const chat = handler({ generate: async (input) => {
    completeItinerary = input.completeItinerary;
    return { text: reply };
  } });
  const headers = { "X-Travel-Day-Photos": "3" };
  const response = await chat(request(undefined, headers));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).reply, reply);
  assert.equal(completeItinerary, true);
  assert.match(travelSystemInstruction(true, true), /Day 1 至 Day 19/);
  assert.match(travelSystemInstruction(true, true), /末尾依次为小结、预算对比、继续调整/);
  assert.doesNotMatch(travelSystemInstruction(true, true), /详细写 Day 1 至 Day 5/);
  assert.equal((await chat(request({ messages: [conversation[0], { role: "assistant", content: reply }, conversation[2]] }, headers))).status, 200);
  assert.equal((await chat(request({ messages: [{ role: "user", content: reply }] }, headers))).status, 400);
  assert.equal((await chat(request(undefined, { "X-Travel-Day-Photos": "2" }))).status, 502);
});

test("a three-week plan fills missing days in one reply and puts the whole-trip budget last", async () => {
  const section = (day) => `Day ${day}｜东京游览\n\n**浅草寺**\n参观寺院。\n\n当日安排\n活动｜在酒店附近吃早餐\n活动｜搭乘地铁去浅草\n活动｜参观浅草寺（建议白天去）\n活动｜在附近吃晚饭\n活动｜返回酒店休息`;
  const reply = (days) => [
    "这趟旅行先从东京开始。", "行程规划\n第1–21天：东京及周边",
    "行程详情", ...Array.from({ length: days }, (_, index) => section(index + 1)),
    "小结\n建议留出休息时间。", "预算对比\n币种｜JPY\n人数｜2\n范围｜21天全程估算\n交通｜100｜200｜300\n住宿｜100｜200｜300\n餐饮｜100｜200｜300",
  ].join("\n\n");
  const calls = [];
  const body = { messages: [{ role: "user", content: "两个人去日本，3周时间，北海道先玩5天，第5天在札幌休整，安排一下" }] };
  const headers = { "X-Travel-Day-Photos": "4" };
  const chat = handler({ generate: async (input) => {
    calls.push(input.planFormat);
    const { first, last } = input.planFormat.range;
    if (first === 1) return { text: reply(calls.length === 1 ? 3 : last) };
    assert.match(input.contents.at(-2).parts[0].text, /第1–21天：东京及周边/);
    assert.match(input.contents.at(-1).parts[0].text, new RegExp(`Day ${first}｜东京及周边`));
    return { text: renderDaySegment(JSON.stringify({ days: Array.from({ length: last - first + 1 }, (_, index) => ({
      number: first + index,
      title: "东京游览",
      sights: [{ name: "浅草寺", description: "参观寺院。" }],
      activities: ["在酒店附近吃早餐", "搭乘地铁去浅草", "参观浅草寺（建议白天去）", "在附近吃晚饭", "返回酒店休息"],
    })) })) };
  } });
  const result = await chat(request(body, headers));
  assert.equal(result.status, 200);
  assert.equal((await result.json()).reply, reply(21));
  assert.equal(calls[0].expectedDays, 21);
  assert.match(calls[1].repair, /Day 7/);
  assert.deepEqual(calls.slice(1).map(({ range }) => [range.first, range.last]), [[1, 7], [8, 14], [15, 21]]);
  const incomplete = await handler({ generate: async () => ({ text: reply(3) }) })(request(body, headers));
  assert.equal((await incomplete.json()).error.code, "INCOMPLETE_ITINERARY");
});

test("the Kyoto starter uses a structured three-day draft and states the assumption", async () => {
  const chat = handler({ generate: async (input) => {
    assert.equal(input.planFormat.expectedDays, 3);
    assert.deepEqual(input.planFormat.range, { first: 1, last: 3 });
    assert.match(input.contents[0].parts[0].text, /两人.*天数为暂定/);
    return { text: renderDaySegment(JSON.stringify({
      opening: "先按三天两晚暂定。", overview: [{ first: 1, last: 3, area: "京都" }], summary: "可以按您的日期再调整。",
      days: ["清水寺", "平等院", "二年坂"].map((name, index) => ({
        number: index + 1, title: name, sights: [{ name, description: "适合慢慢逛。" }],
        activities: ["吃早餐", `参观${name}`, "吃午饭", "附近喝茶", "回酒店"],
      })),
      budget: { currency: "JPY", travelers: 2, scope: "三天全程", items: ["交通", "住宿", "餐饮"].map((label) => ({ label, economy: 100, comfort: 200, luxury: 300 })) },
    }), true) };
  } });
  const result = await chat(request({ messages: [{ role: "user", content: "两个人的京都，慢慢逛" }] }, { "X-Travel-Day-Photos": "4" }));
  assert.equal(result.status, 200);
  assert.match((await result.json()).reply, /Day 3｜二年坂/);
});

test("itinerary length prefers the overall duration and ignores individual day numbers", () => {
  assert.equal(requestedTripDays("3周时间，北海道先玩5天，第5天在札幌休整"), 21);
  assert.equal(requestedTripDays("共19天，东京玩5天，京都玩3天"), 19);
  assert.equal(requestedTripDays("把第5天换成札幌"), undefined);
  assert.equal(requestedTripDays("东京玩5天，京都玩3天"), undefined);
});

test("later segments use the destinations assigned to their specific days", () => {
  const overview = "第1–5天：北海道\n第6–9天：东京\n第10–13天：京都与大阪\n第14–17天：福冈与鹿儿岛\n第18–21天：冲绳";
  assert.equal(routeForDays(overview, 8, 11), "Day 8｜东京\nDay 9｜东京\nDay 10｜京都与大阪\nDay 11｜京都与大阪");
  assert.match(routeIssue("Day 8｜浅草\nDay 9｜古都京都的静谧与优雅", overview, 8, 14), /Day 9/);
  assert.match(routeIssue("Day 13｜冲绳的碧海蓝天初印象", overview, 8, 14), /Day 13/);
  assert.equal(routeIssue("Day 8｜横滨一日游\nDay 9｜浅草漫步\nDay 10｜京都老街", overview, 8, 14), undefined);
});

test("a sightseeing day cannot promote a train station as its attraction", () => {
  const json = JSON.stringify({
    opening: "札幌轻松游。", overview: [{ first: 1, last: 1, area: "札幌" }], summary: "留些时间慢慢逛。",
    days: [{ number: 1, title: "札幌休整", sights: [{ name: "札幌駅", description: "交通枢纽。" }],
      activities: ["吃早餐", "搭地铁到札幌駅", "逛车站", "吃晚饭", "回酒店"] }],
    budget: { currency: "JPY", travelers: 2, scope: "全程估算", items: [{ label: "交通", economy: 100, comfort: 200, luxury: 300 }] },
  });
  assert.match(dayDetailsIssue(renderDaySegment(json), 1, 1), /车站、机场和酒店/);
  assert.match(renderDaySegment(json, true), /预算对比\n币种｜JPY\n人数｜2\n范围｜全程估算\n交通｜100｜200｜300$/);
  assert.equal(dayDetailsIssue(renderDaySegment(json.replaceAll("札幌駅", "北海道神宮")), 1, 1), undefined);
  const emptySights = renderDaySegment(json).replace("**札幌駅**\n交通枢纽。\n\n", "");
  assert.match(dayDetailsIssue(emptySights, 1, 1), /至少安排一个/);
});

test("Vertex uses only server identity settings, without a key or client-controlled provider", async () => {
  let seen;
  let calls = 0;
  const vertex = { ...config, provider: "vertex", apiKey: undefined, projectId: "team-cloud-project", location: "global" };
  const chat = handler({ getConfiguration: () => vertex, generate: async (input) => { calls++; seen = input; return { text: "东京两日游" }; } });
  assert.equal((await chat(request())).status, 200);
  assert.equal(seen.provider, "vertex");
  assert.equal(seen.projectId, vertex.projectId);
  assert.equal(seen.location, "global");
  assert.ok(!("apiKey" in seen));
  assert.deepEqual(seen.contents, toGeminiContents(conversation));
  assert.equal((await chat(request({ messages: conversation, provider: "developer", apiKey: "client-supplied-key" }))).status, 400);
  assert.equal(calls, 1);
  for (const invalid of [{ ...vertex, projectId: "" }, { ...vertex, location: "https://untrusted.example" }, { ...vertex, provider: "unknown" }]) {
    const response = await handler({ getConfiguration: () => invalid, generate: async () => { throw new Error("must not generate"); } })(request());
    assert.equal(response.status, 503);
    assert.match((await response.json()).error.code, /MISSING_VERTEX_CONFIG|INVALID_GEMINI_PROVIDER/);
  }
});

test("returned replies correct the verified facility without changing the original conversation", async () => {
  let sent;
  const chat = handler({ generate: async (input) => {
    sent = input.contents;
    return { text: '秋叶原的 Radio会館(Radio会馆) 适合逛手办。' };
  } });
  const response = await chat(request());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).reply, '秋葉原ラジオ会館(秋叶原无线电会馆) 适合逛手办。');
  assert.deepEqual(sent, toGeminiContents(conversation));
});

test("local native requests work; cross-origin websites and production are denied", async () => {
  for (const url of ["http://localhost:3000/api/chat", "http://127.0.0.1:3000/api/chat", "http://192.168.1.5:3000/api/chat", "http://[::1]:3000/api/chat"]) {
    assert.equal((await handler()(request(undefined, {}, url))).status, 200);
  }
  let calls = 0;
  const local = handler({ generate: async () => { calls++; return { text: "hello" }; } });
  const origin = await local(request(undefined, { Origin: "https://unrelated.example" }));
  assert.equal(origin.status, 403);
  assert.equal((await origin.json()).error.code, "ORIGIN_NOT_ALLOWED");
  assert.equal((await local(request(undefined, {}, "https://public.example/api/chat"))).status, 403);
  assert.equal((await local(request(undefined, { Origin: "http://localhost:3000" }))).status, 200);
  assert.equal((await local(request(undefined, { Host: "192.168.1.5:3000", Origin: "http://192.168.1.5:3000" }, "http://0.0.0.0:3000/api/chat"))).status, 200);
  assert.equal((await local(request(undefined, {}, "http://0.0.0.0:3000/api/chat"))).status, 403);
  assert.equal((await local(request(undefined, { Host: "public.example" }, "http://0.0.0.0:3000/api/chat"))).status, 403);
  assert.equal(calls, 2);
  const production = await handler({ getConfiguration: () => ({ ...config, isDevelopment: false }) })(request());
  assert.equal(production.status, 503);
  assert.equal((await production.json()).error.code, "LOCAL_DEVELOPMENT_ONLY");
});

test("service-continuity interface accepts direct and bind-host access without widening public hosts or origins", async () => {
  let calls = 0;
  const chat = handler({ generate: async () => { calls++; return { text: "ok" }; } });
  const address = "192.0.0.2:3000";
  assert.equal((await chat(request(undefined, {}, `http://${address}/api/chat`))).status, 200);
  assert.equal((await chat(request(undefined, { Host: address, Origin: `http://${address}` }, "http://0.0.0.0:3000/api/chat"))).status, 200);
  assert.equal((await chat(request(undefined, { Host: address, Origin: "https://unrelated.example" }, "http://0.0.0.0:3000/api/chat"))).status, 403);
  for (const denied of ["192.0.0.8", "192.0.0.9", "192.0.0.10", "192.0.0.255", "8.8.8.8"]) {
    assert.equal((await chat(request(undefined, {}, `http://${denied}:3000/api/chat`))).status, 403);
    assert.equal((await chat(request(undefined, { Host: `${denied}:3000` }, "http://0.0.0.0:3000/api/chat"))).status, 403);
  }
  assert.equal(calls, 2);
});

test("JSON, content type and declared or streamed byte limits fail before provider", async () => {
  let calls = 0;
  const chat = handler({ generate: async () => { calls++; return { text: "hello" }; } });
  const malformed = new Request("http://localhost:3000/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
  assert.equal((await chat(malformed)).status, 400);
  assert.equal((await chat(request(undefined, { "Content-Type": "text/plain" }))).status, 415);
  assert.equal((await chat(request(undefined, { "Content-Length": String(CHAT_LIMITS.maxBodyBytes + 1) }))).status, 413);
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(CHAT_LIMITS.maxBodyBytes));
      controller.enqueue(new Uint8Array(1));
      controller.close();
    },
  });
  const streamed = new Request("http://localhost:3000/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: stream, duplex: "half" });
  assert.equal((await chat(streamed)).status, 413);
  assert.equal(calls, 0);
});

test("missing key and model return actionable configuration errors without provider call", async () => {
  for (const [configuration, code] of [[{ ...config, apiKey: "" }, "MISSING_API_KEY"], [{ ...config, model: "" }, "MISSING_MODEL"]]) {
    const response = await handler({ getConfiguration: () => configuration, generate: () => { throw new Error("must not call"); } })(request());
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, code);
  }
});

test("upstream errors are classified without leaking raw errors or keys", async () => {
  const cases = [[401, "GEMINI_AUTH_ERROR", 503], [402, "GEMINI_BILLING_REQUIRED", 503], [403, "GEMINI_AUTH_ERROR", 503], [404, "MODEL_UNAVAILABLE", 503], [429, "GEMINI_RATE_LIMITED", 429], [503, "GEMINI_UNAVAILABLE", 502], [504, "GEMINI_TIMEOUT", 504], [400, "GEMINI_REQUEST_REJECTED", 502]];
  for (const [status, code, expectedStatus] of cases) {
    const response = await handler({ generate: async () => { throw Object.assign(new Error("private-prompt SECRET_KEY"), { status }); } })(request());
    assert.equal(response.status, expectedStatus);
    const body = await response.json();
    assert.equal(body.error.code, code);
    assert.doesNotMatch(JSON.stringify(body), /private-prompt|SECRET_KEY/);
    if (status === 429) assert.equal(response.headers.get("retry-after"), "30");
  }
  assert.equal(mapProviderError(Object.assign(new Error("API_KEY_INVALID"), { status: 400 })).code, "GEMINI_AUTH_ERROR");
});

test("blocked, empty, truncated and excessive replies cannot enter client history", async () => {
  for (const [result, code] of [
    [{ text: "" }, "EMPTY_RESPONSE"], [{ text: "   " }, "EMPTY_RESPONSE"],
    [{ blocked: true }, "RESPONSE_BLOCKED"],
    [{ text: "partial", reachedOutputLimit: true }, "RESPONSE_TOO_LONG"],
    [{ text: "a".repeat(4001) }, "RESPONSE_TOO_LONG"],
  ]) {
    const response = await handler({ generate: async () => result })(request());
    assert.equal((await response.json()).error.code, code);
  }
});

test("client and global rate buckets expire and concurrency releases idempotently", () => {
  const controls = createCallControls({ perClient: 1, global: 2, maxConcurrent: 2, windowMs: 1000 });
  const releaseA = controls.acquire("a", 0);
  assert.throws(() => controls.acquire("a", 0), hasCode("RATE_LIMITED"));
  const releaseB = controls.acquire("b", 0);
  assert.throws(() => controls.acquire("c", 0), hasCode("RATE_LIMITED"));
  releaseA(); releaseA(); releaseB();
  const releaseC = controls.acquire("c", 1000);
  releaseC();
  const concurrent = createCallControls({ perClient: 10, global: 10, maxConcurrent: 1 });
  const release = concurrent.acquire("a", 0);
  assert.throws(() => concurrent.acquire("b", 0), hasCode("SERVER_BUSY"));
  release(); release();
  concurrent.acquire("b", 0)();
});

test("handler rate limits return 429 and Retry-After without additional generation", async () => {
  let calls = 0;
  const chat = handler({ controls: createCallControls({ perClient: 1 }), generate: async () => { calls++; return { text: "ok" }; } });
  assert.equal((await chat(request())).status, 200);
  const response = await chat(request());
  assert.equal(response.status, 429);
  assert.ok(Number(response.headers.get("retry-after")) > 0);
  assert.equal(calls, 1);
});

test("deadline aborts provider and timed-out unfinished call retains concurrency slot", async () => {
  let finish;
  let signal;
  const chat = handler({
    timeoutMs: 15, controls: createCallControls({ maxConcurrent: 1 }),
    generate: (input) => { signal = input.signal; return new Promise((resolve) => { finish = resolve; }); },
  });
  const response = await chat(request());
  assert.equal(response.status, 504);
  assert.equal(signal.aborted, true);
  assert.equal((await chat(request())).status, 503);
  finish({ text: "late" });
  await new Promise((resolve) => setImmediate(resolve));
  const third = chat(request());
  await new Promise((resolve) => setImmediate(resolve));
  finish({ text: "fresh" });
  assert.equal((await third).status, 200);
});

test("logs contain metadata only, never messages, key, raw error or model output", async () => {
  const logs = [];
  const chat = handler({ log: (record) => logs.push(record), generate: async () => ({ text: "private model reply", inputTokens: 20, outputTokens: 5, totalTokens: 25 }) });
  assert.equal((await chat(request())).status, 200);
  const serialized = JSON.stringify(logs);
  assert.doesNotMatch(serialized, /test-only-key|东京三日游|private model reply/);
  assert.equal(logs[0].inputTokens, 20);
  assert.equal(logs[0].outputTokens, 5);
  assert.equal(logs[0].inputMessages, 3);
  assert.equal(logs[0].outputCharacters, 19);
});
