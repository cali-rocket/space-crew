import { createGame } from './state';
import { restartAttempt, advanceMission } from './loop';

const P = ['p0', 'p1', 'p2'];

test('restartAttempt re-deals the same mission and bumps attemptNumber', () => {
  const s0 = createGame({ players: P, missionId: 3, seed: 1 });
  const s1 = restartAttempt(s0, 2);
  expect(s1.missionId).toBe(3);
  expect(s1.attemptNumber).toBe(2);
  expect(s1.phase).toBe('task-assignment');
  expect(s1.outcome).toBe('in-progress');
  expect(s1.trickHistory).toEqual([]);
});

test('advanceMission starts the next mission at attempt 1', () => {
  const s0 = createGame({ players: P, missionId: 3, seed: 1 });
  const s1 = advanceMission(s0, 9);
  expect(s1.missionId).toBe(4);
  expect(s1.attemptNumber).toBe(1);
  expect(s1.phase).toBe('task-assignment');
});
