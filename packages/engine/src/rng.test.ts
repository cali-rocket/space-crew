import { shuffle, mulberry32 } from './rng';

test('shuffle is deterministic for the same seed', () => {
  const a = shuffle([1, 2, 3, 4, 5, 6, 7, 8], 42);
  const b = shuffle([1, 2, 3, 4, 5, 6, 7, 8], 42);
  expect(a).toEqual(b);
});

test('different seeds usually give different orders', () => {
  const a = shuffle([1, 2, 3, 4, 5, 6, 7, 8], 1);
  const b = shuffle([1, 2, 3, 4, 5, 6, 7, 8], 2);
  expect(a).not.toEqual(b);
});

test('shuffle is a permutation and does not mutate input', () => {
  const input = [1, 2, 3, 4, 5];
  const out = shuffle(input, 7);
  expect([...out].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5]);
  expect(input).toEqual([1, 2, 3, 4, 5]);
});

test('mulberry32 returns values in [0, 1)', () => {
  const rng = mulberry32(123);
  for (let i = 0; i < 100; i++) {
    const v = rng();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  }
});
