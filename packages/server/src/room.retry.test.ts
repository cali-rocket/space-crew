import { describe, it, expect } from 'vitest';
import { MISSIONS } from '@space-crew/engine';
import { createRoom, startRoom, restartRoom } from './room';

const m2 = MISSIONS.find((m) => m.id === 2)!;
const m3 = MISSIONS.find((m) => m.id === 3)!;

describe('retry / next-mission', () => {
  it('retry re-deals the same mission as a fresh attempt', () => {
    const started = startRoom(createRoom('AAAA', 'host', 2, 0), m2, 5);
    expect(started.match!.game.attemptNumber).toBe(1);

    const retried = restartRoom(started, m2, 999, 2);
    expect(retried.match!.game.missionId).toBe(2);
    expect(retried.match!.game.attemptNumber).toBe(2);
    expect(retried.started).toBe(true);
    expect(retried.outcomeRecorded).toBe(false);
    // a genuinely new deal
    expect(JSON.stringify(retried.match!.game.hands)).not.toBe(JSON.stringify(started.match!.game.hands));
  });

  it('next-mission advances to the next mission at attempt 1', () => {
    const started = startRoom(createRoom('BBBB', 'host', 2, 0), m2, 5);
    const next = restartRoom(started, m3, 123, 1);
    expect(next.missionId).toBe(3);
    expect(next.match!.game.missionId).toBe(3);
    expect(next.match!.game.attemptNumber).toBe(1);
    expect(next.outcomeRecorded).toBe(false);
  });
});
