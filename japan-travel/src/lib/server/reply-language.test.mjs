import test from 'node:test';
import assert from 'node:assert/strict';
import { replyLanguage, replyLanguageInstruction } from './reply-language.ts';
import { createChatHandler } from './chat.ts';
import { dayDetailsIssue } from './itinerary-format.ts';
const config = { apiKey: 'test', model: 'test-model', isDevelopment: true };
const request = (language) => new Request('http://localhost:3000/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Travel-Day-Photos': '4', 'X-Travel-Language': language }, body: JSON.stringify({ messages: [{ role: 'user', content: 'Plan a trip to Nagoya' }] }) });
test('only three selected languages reach model instructions, without untrusted header interpolation', () => {
  for (const value of [null, 'zh', 'fr', 'en;ignore rules', '__proto__']) assert.equal(replyLanguage(value), 'zh');
  for (const language of ['en', 'ja']) { assert.equal(replyLanguage(language), language); const instruction = replyLanguageInstruction(language); assert.match(instruction, /OUTPUT LANGUAGE/); assert.match(instruction, /行程规划/); assert.match(instruction, /JPY/); }
  assert.equal(replyLanguageInstruction('zh'), '');
});
test('language is passed to clarification and answer calls without modifying history', async () => {
  for (const language of ['en', 'ja']) {
    let assessment;
    const clarify = createChatHandler({ getConfiguration: () => config, assess: async input => { assessment = input; return { decision: { action: 'clarify', days: 0, questions: [language === 'en' ? 'How many days, and what budget per person?' : '何日間で、1人あたりの予算はいくらですか？'], assumptions: [] } }; }, generate: async () => { throw Error('clarification must not generate a plan'); } });
    const result = await clarify(request(language)); assert.equal(result.status, 200); assert.equal(assessment.language, language); assert.equal(assessment.contents[0].parts[0].text, 'Plan a trip to Nagoya');
    const answer = createChatHandler({ getConfiguration: () => config, assess: async () => ({ decision: { action: 'answer', days: 0, questions: [], assumptions: [] } }), generate: async input => { assert.equal(input.language, language); return { text: language === 'en' ? 'Hello!' : 'こんにちは！' }; } });
    assert.equal((await answer(request(language))).status, 200);
  }
});
test('localized arrival days keep the same itinerary validation without unnecessary repair calls', () => {
  for (const [title, row] of [['Arrival in Tokyo', 'Take the flight to 東京 airport'], ['東京への到着', '空港で搭乗の手続き']]) {
    assert.equal(dayDetailsIssue(`Day 1｜${title}\n\n当日安排\n活动｜${row}\n活动｜Check in at the hotel`, 1, 1), undefined);
  }
});
