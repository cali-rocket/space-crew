import { emptyProgress, recordResult } from './campaign';

test('recordResult marks cleared and advances on win', () => {
  let p = emptyProgress();
  p = recordResult(p, 3, 'won');
  expect(p.missionStatuses[3]).toEqual({ attempts: 1, cleared: true });
  expect(p.currentMissionId).toBe(4);
});

test('recordResult counts attempts on loss without clearing', () => {
  let p = recordResult(emptyProgress(), 3, 'lost');
  expect(p.missionStatuses[3]).toEqual({ attempts: 1, cleared: false });
  expect(p.currentMissionId).toBe(1);
});
