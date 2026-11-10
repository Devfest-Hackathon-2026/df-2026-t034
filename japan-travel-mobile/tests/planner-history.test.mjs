import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlannerHistory } from '../src/lib/planner-history.ts';
import { createUserTurn } from '../src/lib/chat.ts';

function memory(raw = null) {
  return { raw, writes: 0, fail: false, async read() { return this.raw; }, async write(value) {
    if (this.fail) throw Error('disk unavailable');
    this.raw = value; this.writes++;
  } };
}
function chat(id, updatedAt = 1) {
  return { id, createdAt: 1, updatedAt, messages: [
    { id: `${id}-u`, role: 'user', content: '东京三天' },
    { id: `${id}-a`, role: 'assistant', content: '请问预算？' },
  ], draft: '经济型', pendingMessage: null };
}

test('reopening preserves separate conversations, drafts and interrupted turns, excluding credentials and photos', async () => {
  const storage = memory(); const repository = createPlannerHistory(storage);
  const first = chat('first');
  first.messages[1].photos = [{ url: 'https://photo.example/secret' }];
  first.token = 'private-token';
  await repository.save(first);
  const second = { ...chat('second', 2), pendingMessage: { id: 'pending', role: 'user', content: '改成两天' } };
  await repository.save(second);
  const restored = await createPlannerHistory(storage).load();
  assert.deepEqual(restored.map(item => item.id), ['second', 'first']);
  assert.equal(restored[0].draft, '经济型');
  const retry = createUserTurn(restored[0].messages, restored[0].pendingMessage.content);
  assert.deepEqual(retry.map(item => item.content), ['东京三天', '请问预算？', '改成两天']);
  assert.doesNotMatch(storage.raw, /private-token|photo\.example|photos|token/);
});

test('overlapping saves serialize writes and snapshot values before waiting', async () => {
  const storage = memory(); let active = 0; let peak = 0;
  const write = storage.write.bind(storage);
  storage.write = async value => { active++; peak = Math.max(peak, active); await new Promise(resolve => setTimeout(resolve, 2)); await write(value); active--; };
  const repository = createPlannerHistory(storage); const first = chat('first');
  const pending = repository.save(first); first.messages[0].content = 'mutated after save';
  await Promise.all([pending, repository.save(chat('second', 2))]);
  assert.equal(peak, 1);
  assert.equal((await repository.load()).find(item => item.id === 'first').messages[0].content, '东京三天');
  await Promise.all([repository.save(chat('first', 3)), repository.remove('first')]);
  assert.deepEqual((await createPlannerHistory(storage).load()).map(item => item.id), ['second']);
});

test('a failed write preserves prior data and does not poison subsequent saves', async () => {
  const storage = memory(); const repository = createPlannerHistory(storage);
  await repository.save(chat('first')); const original = storage.raw;
  storage.fail = true;
  await assert.rejects(repository.save(chat('second')), /暂未保存/);
  assert.equal(storage.raw, original);
  storage.fail = false;
  await repository.save(chat('third'));
  assert.deepEqual((await createPlannerHistory(storage).load()).map(item => item.id).sort(), ['first', 'third']);
});

test('corrupt and unsupported history is never silently overwritten', async () => {
  for (const raw of ['{', JSON.stringify({ version: 2, items: [] }), JSON.stringify({ version: 1, items: [{ ...chat('bad'), messages: [chat('bad').messages[1], chat('bad').messages[0]] }] })]) {
    const storage = memory(raw); const repository = createPlannerHistory(storage);
    await assert.rejects(repository.load());
    await assert.rejects(repository.save(chat('new')));
    assert.equal(storage.raw, raw); assert.equal(storage.writes, 0);
  }
});

test('history capacity requires explicit deletion and never silently evicts old conversations', async () => {
  const storage = memory(); const repository = createPlannerHistory(storage);
  for (let i = 0; i < 20; i++) await repository.save(chat(`c${i}`, i));
  const before = storage.raw;
  await assert.rejects(repository.save(chat('extra')), /20段/);
  assert.equal(storage.raw, before);
  await repository.remove('c0'); await repository.save(chat('extra'));
  assert.equal((await repository.load()).length, 20);
});

test('UTF-8 byte budget refuses oversized storage without truncating existing Chinese conversations', async () => {
  const storage = memory(); const repository = createPlannerHistory(storage);
  for (let i = 0; i < 11; i++) {
    const value = chat(`large${i}`, i);
    value.messages = Array.from({ length: 8 }, (_, j) => ({ id: `${i}-${j}`, role: j % 2 ? 'assistant' : 'user', content: '字'.repeat(j % 2 ? 10000 : 1000) }));
    await repository.save(value);
  }
  const before = storage.raw;
  const extra = chat('too-large'); extra.messages = (await repository.load())[0].messages;
  await assert.rejects(repository.save(extra), /空间已满/);
  assert.equal(storage.raw, before); assert.equal((await repository.load()).length, 11);
});

test('clearing the entire draft removes its saved empty conversation', async () => {
  const storage = memory(); const repository = createPlannerHistory(storage);
  const value = { ...chat('draft'), messages: [], draft: '尚未发送' };
  await repository.save(value);
  await repository.save({ ...value, draft: '' });
  assert.deepEqual(await createPlannerHistory(storage).load(), []);
});
