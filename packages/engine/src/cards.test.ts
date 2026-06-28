import { makeDeck, cardKey, sameCard } from './cards';

test('deck has 40 cards: 36 color + 4 rocket', () => {
  const deck = makeDeck();
  expect(deck).toHaveLength(40);
  expect(deck.filter((c) => c.suit === 'rocket')).toHaveLength(4);
  expect(deck.filter((c) => c.suit !== 'rocket')).toHaveLength(36);
});

test('each color has values 1..9 and rockets 1..4', () => {
  const deck = makeDeck();
  for (const color of ['pink', 'blue', 'green', 'yellow']) {
    const vals = deck.filter((c) => c.suit === color).map((c) => c.value).sort((a, b) => a - b);
    expect(vals).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  }
  const rockets = deck.filter((c) => c.suit === 'rocket').map((c) => c.value).sort((a, b) => a - b);
  expect(rockets).toEqual([1, 2, 3, 4]);
});

test('all cards are unique', () => {
  const keys = makeDeck().map(cardKey);
  expect(new Set(keys).size).toBe(40);
});

test('sameCard compares by suit and value', () => {
  expect(sameCard({ suit: 'pink', value: 3 }, { suit: 'pink', value: 3 })).toBe(true);
  expect(sameCard({ suit: 'pink', value: 3 }, { suit: 'blue', value: 3 })).toBe(false);
});
