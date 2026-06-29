import { drawTaskCards } from './taskdeck';

test('draws `count` distinct color task cards deterministically', () => {
  const a = drawTaskCards(7, 3);
  const b = drawTaskCards(7, 3);
  expect(a).toEqual(b);
  expect(a).toHaveLength(3);
  expect(a.every((c) => c.suit !== 'rocket')).toBe(true);
  expect(new Set(a.map((c) => `${c.suit}-${c.value}`)).size).toBe(3);
});

test('count 0 → empty', () => {
  expect(drawTaskCards(1, 0)).toEqual([]);
});
