import { describe, it, expect } from 'vitest';
import { MISSIONS, PlayerId } from '@space-crew/engine';
import { setupMatch, advance, applyHumanAction, viewFor } from './controller';

const P: PlayerId[] = ['P1', 'P2', 'P3'];
const m36 = MISSIONS.find((m) => m.id === 36)!;
const m24 = MISSIONS.find((m) => m.id === 24)!;

describe('commander-distribution', () => {
  it('M36 is no longer a no-op: 7 orders get distributed evenly by a bot commander', () => {
    const allBots = { P1: true, P2: true, P3: true };
    const m = advance(setupMatch(m36, P, allBots, 7));
    // all 7 tasks assigned
    expect(m.game.tasks.length).toBe(7);
    // evenly split (max-min ≤ 1)
    const counts = P.map((p) => m.game.tasks.filter((t) => t.owner === p).length);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    // game actually progressed past task-assignment (not an instant auto-win with 0 tasks)
    expect(['trick-in-progress', 'mission-result']).toContain(m.game.phase);
  });

  it('a human commander sees a distribute decision and can hand out every order', () => {
    const allHumans = { P1: false, P2: false, P3: false };
    const m = advance(setupMatch(m24, P, allHumans, 3));
    // stopped for the human commander to distribute
    expect(m.game.phase).toBe('task-assignment');
    const view = viewFor(m, m.game.commander);
    expect(view.decision?.kind).toBe('distribute');
    // hand out the 6 orders round-robin
    const pool = m.taskPool;
    expect(pool.length).toBe(6);
    const assignments = pool.map((card, i) => ({ card, owner: P[i % 3]! }));
    const after = applyHumanAction(m, m.game.commander, { type: 'commander-distribute', assignments });
    expect(after.game.tasks.length).toBe(6);
    const counts = P.map((p) => after.game.tasks.filter((t) => t.owner === p).length);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it('rejects an uneven distribution', () => {
    const allHumans = { P1: false, P2: false, P3: false };
    const m = advance(setupMatch(m24, P, allHumans, 3));
    const pool = m.taskPool;
    // dump all 6 on one player → violates max-min ≤ 1
    const assignments = pool.map((card) => ({ card, owner: P[0]! }));
    expect(() => applyHumanAction(m, m.game.commander, { type: 'commander-distribute', assignments })).toThrow();
  });
});
