import { leadSuit, legalMoves, trickWinner, Trick } from './trick';
import { Card } from './cards';

const c = (suit: Card['suit'], value: number): Card => ({ suit, value });

test('leadSuit is the suit of the first card played', () => {
  const t: Trick = { leader: 'A', plays: [{ player: 'A', card: c('blue', 2) }] };
  expect(leadSuit(t)).toBe('blue');
  expect(leadSuit({ leader: 'A', plays: [] })).toBeUndefined();
});

test('must follow lead suit when able', () => {
  const hand: Card[] = [c('blue', 5), c('green', 9), c('rocket', 2)];
  const t: Trick = { leader: 'A', plays: [{ player: 'A', card: c('blue', 2) }] };
  expect(legalMoves(hand, t)).toEqual([c('blue', 5)]);
});

test('any card is legal when void in lead suit', () => {
  const hand: Card[] = [c('green', 9), c('rocket', 2)];
  const t: Trick = { leader: 'A', plays: [{ player: 'A', card: c('blue', 2) }] };
  expect(legalMoves(hand, t)).toEqual(hand);
});

test('leader (empty trick) may play anything', () => {
  const hand: Card[] = [c('green', 9), c('rocket', 2)];
  expect(legalMoves(hand, { leader: 'A', plays: [] })).toEqual(hand);
});

test('rocket is its own suit: must follow rocket lead when able', () => {
  const hand: Card[] = [c('rocket', 1), c('blue', 9)];
  const t: Trick = { leader: 'A', plays: [{ player: 'A', card: c('rocket', 3) }] };
  expect(legalMoves(hand, t)).toEqual([c('rocket', 1)]);
});

test('highest card of lead suit wins', () => {
  const t: Trick = {
    leader: 'A',
    plays: [
      { player: 'A', card: c('yellow', 2) },
      { player: 'B', card: c('yellow', 8) },
      { player: 'C', card: c('green', 9) },
    ],
  };
  expect(trickWinner(t)).toBe('B');
});

test('rocket beats any color; highest rocket wins', () => {
  const t: Trick = {
    leader: 'A',
    plays: [
      { player: 'A', card: c('blue', 9) },
      { player: 'B', card: c('rocket', 1) },
      { player: 'C', card: c('rocket', 4) },
    ],
  };
  expect(trickWinner(t)).toBe('C');
});
