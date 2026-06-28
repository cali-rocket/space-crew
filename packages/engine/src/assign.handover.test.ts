import { createGame, GameState } from './state';
import { assignByDecision, handoverTask } from './assign';
import { Card } from './cards';

const P = ['p0', 'p1', 'p2'];
const C = (s: Card['suit'], v: number): Card => ({ suit: s, value: v });
const g = (): GameState => ({ ...createGame({ players: P, missionId: 27, seed: 1 }), commander: 'p0' });

test('handoverTask moves a task from one player to another', () => {
  let s = assignByDecision(g(), 'p1', [{ card: C('pink', 1) }]);
  s = handoverTask(s, 'p1', 'p2', C('pink', 1));
  expect(s.tasks[0]!.owner).toBe('p2');
});

test('handover of a task not owned by `from` is rejected', () => {
  let s = assignByDecision(g(), 'p1', [{ card: C('pink', 1) }]);
  expect(() => handoverTask(s, 'p2', 'p0', C('pink', 1))).toThrow(/not owned|no such task/i);
});
