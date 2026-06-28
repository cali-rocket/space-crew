import { createGame, GameState } from './state';
import { assignByDecision } from './assign';
import { Card } from './cards';

const P = ['p0', 'p1', 'p2'];
const C = (s: Card['suit'], v: number): Card => ({ suit: s, value: v });

function g(): GameState {
  return { ...createGame({ players: P, missionId: 5, seed: 1 }), commander: 'p0' };
}

test('assignByDecision gives all tasks to one non-commander assignee', () => {
  const s = assignByDecision(g(), 'p1', [{ card: C('pink', 1) }, { card: C('blue', 2) }]);
  expect(s.tasks.map((t) => t.owner)).toEqual(['p1', 'p1']);
  expect(s.tasks.map((t) => t.card)).toEqual([C('pink', 1), C('blue', 2)]);
});

test('commander cannot be the assignee', () => {
  expect(() => assignByDecision(g(), 'p0', [{ card: C('pink', 1) }])).toThrow(/commander|self/i);
});

test('duplicate task cards are rejected', () => {
  expect(() => assignByDecision(g(), 'p1', [{ card: C('pink', 1) }, { card: C('pink', 1) }])).toThrow(
    /duplicate|already/i,
  );
});
