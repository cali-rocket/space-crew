import { createGame } from './state';

const P = ['p0', 'p1', 'p2'];

test('createGame deals hands and sets the commander to the rocket-4 holder', () => {
  const s = createGame({ players: P, missionId: 1, seed: 5 });
  expect(s.players).toEqual(P);
  expect(P).toContain(s.commander);
  const cmdHand = s.hands[s.commander]!;
  expect(cmdHand.some((c) => c.suit === 'rocket' && c.value === 4)).toBe(true);
  expect(Object.values(s.hands).reduce((n, h) => n + h.length, 0)).toBe(40);
});

test('createGame starts in task-assignment with an empty trick led by the commander', () => {
  const s = createGame({ players: P, missionId: 1, seed: 5 });
  expect(s.phase).toBe('task-assignment');
  expect(s.currentTrick.plays).toEqual([]);
  expect(s.currentTrick.leader).toBe(s.commander);
  expect(s.outcome).toBe('in-progress');
  expect(s.attemptNumber).toBe(1);
});

test('createGame is deterministic for the same seed', () => {
  expect(createGame({ players: P, missionId: 1, seed: 7 }))
    .toEqual(createGame({ players: P, missionId: 1, seed: 7 }));
});
