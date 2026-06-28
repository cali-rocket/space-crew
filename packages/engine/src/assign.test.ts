import { createGame } from './state';
import { assignTask, beginTricks } from './assign';

const P = ['p0', 'p1', 'p2'];

test('assignTask records owner + card and keeps phase in assignment until begun', () => {
  const s0 = createGame({ players: P, missionId: 1, seed: 5 });
  const s1 = assignTask(s0, 'p1', { suit: 'pink', value: 1 });
  expect(s1.tasks).toEqual([{ card: { suit: 'pink', value: 1 }, owner: 'p1', fulfilled: false }]);
  expect(s1.phase).toBe('task-assignment');
});

test('beginTricks moves to trick-in-progress', () => {
  const s0 = createGame({ players: P, missionId: 1, seed: 5 });
  const s1 = assignTask(s0, 'p1', { suit: 'pink', value: 1 });
  const s2 = beginTricks(s1);
  expect(s2.phase).toBe('trick-in-progress');
  expect(s2.currentTrick.leader).toBe(s2.commander);
});

test('assignTask rejects a duplicate task card', () => {
  const s0 = createGame({ players: P, missionId: 1, seed: 5 });
  const s1 = assignTask(s0, 'p1', { suit: 'pink', value: 1 });
  expect(() => assignTask(s1, 'p2', { suit: 'pink', value: 1 })).toThrow(/already a task/);
});

test('assignTask does not mutate the input state', () => {
  const s0 = createGame({ players: P, missionId: 1, seed: 5 });
  assignTask(s0, 'p1', { suit: 'pink', value: 1 });
  expect(s0.tasks).toEqual([]);
});
