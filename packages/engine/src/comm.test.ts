import { commClassification } from './comm';
import { Card } from './cards';

const c = (suit: Card['suit'], v: number): Card => ({ suit, value: v });

test('only card of its color → only', () => {
  const hand = [c('pink', 4), c('blue', 2)];
  expect(commClassification(hand, c('pink', 4))).toBe('only');
});

test('highest of its color → highest', () => {
  const hand = [c('pink', 4), c('pink', 9)];
  expect(commClassification(hand, c('pink', 9))).toBe('highest');
});

test('lowest of its color → lowest', () => {
  const hand = [c('pink', 4), c('pink', 9)];
  expect(commClassification(hand, c('pink', 4))).toBe('lowest');
});

test('middle card → null', () => {
  const hand = [c('pink', 2), c('pink', 6), c('pink', 9)];
  expect(commClassification(hand, c('pink', 6))).toBeNull();
});

test('rocket → null', () => {
  const hand = [c('rocket', 2), c('pink', 9)];
  expect(commClassification(hand, c('rocket', 2))).toBeNull();
});

test('card not in hand → null', () => {
  const hand = [c('pink', 9)];
  expect(commClassification(hand, c('pink', 3))).toBeNull();
});
