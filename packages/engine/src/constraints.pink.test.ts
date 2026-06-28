import { createGame, GameState, CompletedTrick } from './state';
import { evaluateConstraint } from './constraints';
import { assignRole, derivePink9Holder } from './assign';
import { Card } from './cards';

const P = ['p0', 'p1', 'p2'];
const C = (s: Card['suit'], v: number): Card => ({ suit: s, value: v });
const tk = (winner: string, cards: Card[]): CompletedTrick => ({ leader: 'p0', winner, plays: cards.map((c, i) => ({ player: P[i % 3]!, card: c })) });

test('derivePink9Holder finds the seat holding pink 9', () => {
  const g = { ...createGame({ players: P, missionId: 46, seed: 1 }), hands: { p0: [], p1: [C('pink', 9)], p2: [] } } as GameState;
  expect(derivePink9Holder(g)).toBe('p1');
});

test('pink-left-sweep: target = left of holder must win all pink', () => {
  // holder p1 → left (prev seat) is p0. p0 must win every trick containing pink.
  const base = { ...createGame({ players: P, missionId: 46, seed: 1 }) } as GameState;
  const s = assignRole(base, 'pink9holder', 'p1');
  const okHist = [tk('p0', [C('pink', 3), C('blue', 2), C('green', 1)])];
  expect(evaluateConstraint({ kind: 'pink-left-sweep' }, { ...s, trickHistory: okHist })).toBe('pending');
  const badHist = [tk('p2', [C('pink', 3), C('blue', 2), C('green', 1)])]; // pink won by p2 ≠ p0
  expect(evaluateConstraint({ kind: 'pink-left-sweep' }, { ...s, trickHistory: badHist })).toBe('violated');
});
