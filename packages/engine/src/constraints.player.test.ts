import { createGame, GameState, CompletedTrick } from './state';
import { evaluateConstraint } from './constraints';
import { Card } from './cards';

const P = ['p0', 'p1', 'p2'];
const C = (s: Card['suit'], v: number): Card => ({ suit: s, value: v });
const tk = (winner: string, winCard: Card = C('blue', 5)): CompletedTrick => ({ leader: 'p0', winner, plays: [{ player: winner, card: winCard }] });
const st = (history: CompletedTrick[], roles: Record<string, string> = {}): GameState => ({ ...createGame({ players: P, missionId: 1, seed: 1, roles }), trickHistory: history });

test('player-trick-count 0: violated as soon as the role wins a trick', () => {
  const def = { kind: 'player-trick-count', role: 'sick', count: 0, rocketAllowed: true } as const;
  expect(evaluateConstraint(def, st([], { sick: 'p1' }))).toBe('satisfied');
  expect(evaluateConstraint(def, st([tk('p1')], { sick: 'p1' }))).toBe('violated');
});

test('player-trick-count exactly 1, no rocket', () => {
  const def = { kind: 'player-trick-count', role: 'chosen', count: 1, rocketAllowed: false } as const;
  expect(evaluateConstraint(def, st([tk('p2')], { chosen: 'p2' }))).toBe('satisfied');
  expect(evaluateConstraint(def, st([tk('p2'), tk('p2')], { chosen: 'p2' }))).toBe('violated');
  expect(evaluateConstraint(def, st([tk('p2', C('rocket', 1))], { chosen: 'p2' }))).toBe('violated');
});

test('player-exact-tricks first-last not exclusive', () => {
  const def = { kind: 'player-exact-tricks', role: 'cmd', tricks: 'first-last', exclusive: false, rocketAllowed: true } as const;
  const hist = Array.from({ length: 13 }, (_, i) => tk(i === 0 || i === 12 ? 'p0' : 'p1'));
  expect(evaluateConstraint(def, st(hist, { cmd: 'p0' }))).toBe('satisfied');
  const wrong = [...hist]; wrong[0] = tk('p1');
  expect(evaluateConstraint(def, st(wrong, { cmd: 'p0' }))).toBe('violated');
});

test('player-exact-tricks exclusive: winning a non-required trick violates', () => {
  const def = { kind: 'player-exact-tricks', role: 'cmd', tricks: 'first-last', exclusive: true, rocketAllowed: true } as const;
  const hist = [tk('p0'), tk('p0')]; // trick 1 (index1) by p0 but not required & exclusive
  expect(evaluateConstraint(def, st(hist, { cmd: 'p0' }))).toBe('violated');
});
