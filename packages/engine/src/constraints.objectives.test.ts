import { createGame, GameState, CompletedTrick } from './state';
import { evaluateConstraint } from './constraints';
import { Card } from './cards';

const P = ['p0', 'p1', 'p2'];
const C = (s: Card['suit'], v: number): Card => ({ suit: s, value: v });
const trick = (winner: string, winCard: Card): CompletedTrick => ({
  leader: 'p0', winner, plays: [{ player: winner, card: winCard }, { player: 'x', card: C('blue', 1) }, { player: 'y', card: C('green', 1) }],
});
const st = (history: CompletedTrick[]): GameState => ({ ...createGame({ players: P, missionId: 1, seed: 1 }), trickHistory: history });

test('win-value-count: pending then satisfied', () => {
  expect(evaluateConstraint({ kind: 'win-value-count', value: 1, count: 1 }, st([]))).toBe('pending');
  expect(evaluateConstraint({ kind: 'win-value-count', value: 1, count: 1 }, st([trick('p0', C('pink', 1))]))).toBe('satisfied');
});

test('win-value-count distinct: two different 1s', () => {
  const one = st([trick('p0', C('pink', 1))]);
  expect(evaluateConstraint({ kind: 'win-value-count', value: 1, count: 2, distinct: true }, one)).toBe('pending');
  const two = st([trick('p0', C('pink', 1)), trick('p1', C('blue', 1))]);
  expect(evaluateConstraint({ kind: 'win-value-count', value: 1, count: 2, distinct: true }, two)).toBe('satisfied');
});

test('win-cards unordered: all rockets must win', () => {
  const rockets = [C('rocket', 1), C('rocket', 2), C('rocket', 3), C('rocket', 4)];
  const partial = st(rockets.slice(0, 3).map((c, i) => trick(P[i % 3]!, c)));
  expect(evaluateConstraint({ kind: 'win-cards', cards: rockets, ordered: false }, partial)).toBe('pending');
  const all = st(rockets.map((c, i) => trick(P[i % 3]!, c)));
  expect(evaluateConstraint({ kind: 'win-cards', cards: rockets, ordered: false }, all)).toBe('satisfied');
});

test('win-cards ordered: out-of-order is violated', () => {
  const rockets = [C('rocket', 1), C('rocket', 2), C('rocket', 3), C('rocket', 4)];
  const bad = st([trick('p0', C('rocket', 2)), trick('p1', C('rocket', 1))]); // 2 before 1
  expect(evaluateConstraint({ kind: 'win-cards', cards: rockets, ordered: true }, bad)).toBe('violated');
  const good = st([trick('p0', C('rocket', 1)), trick('p1', C('rocket', 2))]);
  expect(evaluateConstraint({ kind: 'win-cards', cards: rockets, ordered: true }, good)).toBe('pending');
});
