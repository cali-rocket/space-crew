import { dealHands, findCommander } from './deal';
import { cardKey } from './cards';

test('deals 14/13/13 and uses all 40 cards', () => {
  const hands = dealHands(99);
  expect(hands.map((h) => h.length)).toEqual([14, 13, 13]);
  const all = hands.flat().map(cardKey);
  expect(new Set(all).size).toBe(40);
});

test('deal is deterministic for the same seed', () => {
  expect(dealHands(5)).toEqual(dealHands(5));
});

test('findCommander returns the seat holding rocket 4', () => {
  const hands = dealHands(5);
  const seat = findCommander(hands);
  expect(hands[seat]!.some((c) => c.suit === 'rocket' && c.value === 4)).toBe(true);
});
