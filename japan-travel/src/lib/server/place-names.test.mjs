import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeVerifiedPlaceNames } from './place-names.ts';

test('corrects the mixed-script facility and duplicate translation from the screenshot', () => {
  assert.equal(normalizeVerifiedPlaceNames('秋叶原的 Radio会館(Radio会馆) 手办种类很多。'), '秋葉原ラジオ会館(秋叶原无线电会馆) 手办种类很多。');
  assert.equal(normalizeVerifiedPlaceNames('ラジオ会館也值得逛。'), '秋葉原ラジオ会館(秋叶原无线电会馆)也值得逛。');
});

test('normalization is idempotent and does not rewrite unrelated names, shop suffixes or URLs', () => {
  const correct = '秋葉原ラジオ会館(秋叶原无线电会馆)';
  assert.equal(normalizeVerifiedPlaceNames(correct), correct);
  const untouched = '明治神宮、代々木公園(代代木公园)、銀座ライオン 秋葉原ラジオ会館店，参考 https://example.com/Radio会館/。';
  assert.equal(normalizeVerifiedPlaceNames(untouched), untouched);
});

test('removes known duplicate romanizations, without deleting transport notes', () => {
  const reply = '札幌(Sapporo)、小樽(Otaru)、函館(Hakodate)、富良野(Furano)、美瑛(Biei)、アニメイト池袋本店(Animate池袋总店)。交通可考虑铁路(JR Pass)。';
  assert.equal(normalizeVerifiedPlaceNames(reply), '札幌、小樽、函館、富良野、美瑛、アニメイト池袋本店。交通可考虑铁路(JR Pass)。');
});

test('drops identical and simplified duplicate names while keeping the Japanese original', () => {
  const reply = '第1–2天：札幌(札幌)\n游览大通公園(大通公园)，前往函館(函馆)、登別温泉(登别温泉)，参观明治神宮(明治神宫)。';
  assert.equal(normalizeVerifiedPlaceNames(reply), '第1–2天：札幌\n游览大通公園，前往函館、登別温泉，参观明治神宮。');
});

test('keeps different Chinese names and parenthetical travel information', () => {
  const reply = '代々木公園(代代木公园)、スシロー(寿司郎)、中野ブロードウェイ(中野百老汇)。札幌(建议住两晚)，铁路(JR Pass)，预算(约5000日元)。';
  assert.equal(normalizeVerifiedPlaceNames(reply), reply);
});
