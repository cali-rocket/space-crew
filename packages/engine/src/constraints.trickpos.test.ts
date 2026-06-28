import { createGame, GameState, CompletedTrick } from './state';
import { evaluateConstraint } from './constraints';
import { Card } from './cards';

const P = ['p0', 'p1', 'p2'];
const C = (s: Card['suit'], v: number): Card => ({ suit: s, value: v });
const tkCards = (winner: string, cards: Card[]): CompletedTrick => ({
  leader: 'p0',
  winner,
  plays: cards.map((c, i) => ({ player: P[i % 3]!, card: c })),
});
const st = (history: CompletedTrick[], roles: Record<string, string> = {}): GameState => ({
  ...createGame({ players: P, missionId: 1, seed: 1, roles }),
  trickHistory: history,
});

test('task-in-last-trick: violated if won before the last trick', () => {
  const hist = [tkCards('p0', [C('pink', 3)])];
  expect(evaluateConstraint({ kind: 'task-in-last-trick', card: C('pink', 3) }, st(hist))).toBe('violated');
});

test('task-in-last-trick: satisfied if won in trick index 12', () => {
  const hist = Array.from({ length: 13 }, (_, i) =>
    tkCards('p0', [i === 12 ? C('pink', 3) : C('blue', 5)]),
  );
  expect(evaluateConstraint({ kind: 'task-in-last-trick', card: C('pink', 3) }, st(hist))).toBe('satisfied');
});

test('trick-partition: each range won by its role player', () => {
  const def = {
    kind: 'trick-partition',
    parts: [
      { role: 'a', range: 'first4' },
      { role: 'b', range: 'last' },
      { role: 'c', range: 'middle' },
    ],
  } as const;
  const roles = { a: 'p0', b: 'p1', c: 'p2' };
  const hist = Array.from({ length: 13 }, (_, i) =>
    tkCards(i < 4 ? 'p0' : i === 12 ? 'p1' : 'p2', [C('blue', 5)]),
  );
  expect(evaluateConstraint(def, st(hist, roles))).toBe('satisfied');
  const wrong = [...hist];
  wrong[0] = tkCards('p2', [C('blue', 5)]);
  expect(evaluateConstraint(def, st(wrong, roles))).toBe('violated');
});
