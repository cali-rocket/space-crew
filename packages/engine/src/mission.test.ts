import { createMission, MissionDef } from './mission';

const P = ['p0', 'p1', 'p2'];
const def: MissionDef = { id: 16, sourceText: 'You cannot win a trick with a 9-value card.', logbookPage: 5, taskCount: 2, communication: 'normal', constraints: [{ kind: 'forbid-win-value', value: 9 }] };

test('createMission wires mission metadata into the game state', () => {
  const s = createMission(def, { players: P, seed: 5 });
  expect(s.missionId).toBe(16);
  expect(s.constraints).toEqual([{ kind: 'forbid-win-value', value: 9 }]);
  expect(s.communicationPolicy).toBe('normal');
  expect(s.phase).toBe('task-assignment');
});
