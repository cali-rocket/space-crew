import { createGame } from './state';

const P = ['p0', 'p1', 'p2'];

test('createGame initializes communication and distress defaults', () => {
  const s = createGame({ players: P, missionId: 1, seed: 5 });
  expect(s.communicationPolicy).toBe('normal');
  expect(s.distressActive).toBe(false);
  expect(s.communication).toEqual([]);
  expect(s.commUsed).toEqual({ p0: false, p1: false, p2: false });
});

test('createGame accepts a communication policy and distress flag', () => {
  const s = createGame({
    players: P,
    missionId: 18,
    seed: 5,
    communicationPolicy: { noCommUntilTrick: 2 },
    distressActive: true,
  });
  expect(s.communicationPolicy).toEqual({ noCommUntilTrick: 2 });
  expect(s.distressActive).toBe(true);
});

test('existing fields are unchanged (regression)', () => {
  const s = createGame({ players: P, missionId: 1, seed: 5 });
  expect(s.phase).toBe('task-assignment');
  expect(s.outcome).toBe('in-progress');
  expect(P).toContain(s.commander);
});
