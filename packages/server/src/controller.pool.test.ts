import { setupMatch, viewFor } from './controller';
import type { MissionDef } from '@space-crew/engine';

const P = ['p0', 'p1', 'p2'];
const m: MissionDef = { id: 9, sourceText: 'x', logbookPage: 4, taskCount: 2 };

test('viewFor exposes the public task pool during task-assignment', () => {
  const match = setupMatch(m, P, { p0: false, p1: true, p2: true }, 3);
  const v = viewFor(match, 'p0');
  if (match.game.phase === 'task-assignment') {
    expect(Array.isArray(v.taskPool)).toBe(true);
    expect(v.taskPool!.length).toBe(match.taskPool.length);
  }
});
