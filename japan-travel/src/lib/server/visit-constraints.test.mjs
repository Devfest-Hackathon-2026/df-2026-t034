import test from 'node:test';
import assert from 'node:assert/strict';
import { extractVisitConstraints, visitConstraintIssue, visitConstraintInstruction } from './visit-constraints.ts';
const user = content => ({ role: 'user', content });
const block = (names, day = 1, extra = '') => `Day ${day}｜Temple visit\n\n${names.map(name => `**${name}**\nDescription.`).join('\n\n')}\n\n当日安排\n活动｜Travel to ${names[0]}\n活动｜Visit ${names[0]}\n活动｜Lunch\n活动｜Rest\n活动｜Return to hotel\n${extra}`;
test('clear Chinese, English and Japanese restrictions select the same place without an extra provider call', () => {
  for (const text of ['东京一日游，只参观浅草寺，其他由您安排', 'Only visit Senso-ji, budget 10000 yen.', '浅草寺だけを観光したいです。']) {
    const rules = extractVisitConstraints([user(text)]); assert.equal(rules.length, 1, text);
    assert.equal(visitConstraintIssue(block(['浅草寺']), rules, true), undefined, text);
    assert.match(visitConstraintIssue(block(['浅草寺', '上野恩賜公園']), rules), /景点限制未满足/, text);
    assert.match(visitConstraintIssue(block(['浅草寺'], 1, '活动｜Visit 東京スカイツリータウン for shopping'), rules), /景点限制未满足/, text);
    assert.match(visitConstraintIssue(block(['浅草寺'], 1, '活动｜隅田川沿いの遊歩道（隅田公園）に出て休憩する'), rules), /景点限制未满足/, text);
  }
});
test('assistant suggestions cannot create restrictions, and simple city lists are not attraction lists', () => {
  assert.deepEqual(extractVisitConstraints([{ role: 'assistant', content: '只去浅草寺' }, user('您来决定')]), []);
  for (const value of ['只去东京和京都', '不只去浅草寺', 'Only visit Tokyo and Kyoto']) assert.deepEqual(extractVisitConstraints([user(value)]), [], value);
});
test('restrictions persist across short follow-ups; later explicit additions and relaxation take precedence', () => {
  const first = user('只去浅草寺');
  const rules = extractVisitConstraints([first, { role: 'assistant', content: '介绍上野' }, user('两个人，每人一万日元，其他不变')]);
  assert.match(visitConstraintIssue(block(['上野恩賜公園']), rules), /景点限制/);
  const revised = extractVisitConstraints([first, user('改成只去浅草寺和上野公园')]); assert.equal(visitConstraintIssue(block(['浅草寺', '上野恩賜公園']), revised, true), undefined);
  assert.deepEqual(extractVisitConstraints([first, user('可以增加其他景点，您决定')]), []);
});
test('day-specific lists do not incorrectly restrict all other days', () => {
  for (const text of ['第2天只去浅草寺', 'Day 2 only visit Senso-ji', '2日目は浅草寺だけを観光']) {
    const rules = extractVisitConstraints([user(text)]); assert.equal(rules[0]?.day, 2, text);
    assert.equal(visitConstraintIssue(block(['上野恩賜公園'], 1) + '\n\n' + block(['浅草寺'], 2), rules, true), undefined);
    assert.match(visitConstraintIssue(block(['上野恩賜公園'], 2), rules), /景点限制/);
  }
});
test('excluded sights are checked in actual visits while negative statements are not mistaken for a visit', () => {
  const rules = extractVisitConstraints([user('不要去上野公园')]);
  assert.match(visitConstraintIssue(block(['上野恩賜公園']), rules), /景点限制/);
  assert.equal(visitConstraintIssue(block(['浅草寺'], 1, '活动｜不去上野公园，返回酒店'), rules), undefined);
});
test('a complete plan cannot omit specified places; partial long-trip segments need not include the whole list', () => {
  const rules = extractVisitConstraints([user('只去浅草寺和上野公园')]);
  assert.equal(visitConstraintIssue(block(['浅草寺']), rules), undefined);
  assert.match(visitConstraintIssue(block(['浅草寺']), rules, true), /不要漏掉/);
  assert.match(visitConstraintInstruction(rules), /只列1处/);
});
