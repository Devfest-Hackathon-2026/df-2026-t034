import assert from 'node:assert/strict';
import test from 'node:test';
import { CHAT_VERTICAL_PADDING, groupChatTurns, minimumTurnHeight, turnScrollOffset } from '../src/lib/chat-turns.ts';

const user = (id) => ({ id, role: 'user', content: '旅行需求' });
const assistant = (id) => ({ id, role: 'assistant', content: '旅行建议' });

test('the pending user turn keeps the same anchor identity when its reply arrives', () => {
  const history = [user('u1'), assistant('a1')];
  const pending = groupChatTurns([...history, user('u2')]);
  const complete = groupChatTurns([...history, user('u2'), assistant('a2')]);
  assert.equal(pending.at(-1).id, complete.at(-1).id);
  assert.equal(pending.at(-1).assistant, undefined);
  assert.equal(complete.at(-1).assistant.id, 'a2');
  assert.deepEqual(history, [user('u1'), assistant('a1')]);
});

test('even an empty pending reply leaves enough scroll range to put its user at the top', () => {
  for (const viewport of [320, 550, 850]) {
    for (const precedingHeight of [0, 200, 1400]) {
      const userY = CHAT_VERTICAL_PADDING + precedingHeight;
      const contentHeight = userY + minimumTurnHeight(viewport) + CHAT_VERTICAL_PADDING;
      assert.ok(contentHeight - viewport >= turnScrollOffset(userY));
      assert.equal(userY - turnScrollOffset(userY), CHAT_VERTICAL_PADDING);
    }
  }
  assert.equal(minimumTurnHeight(0), 0);
  assert.equal(turnScrollOffset(0), 0);
});
