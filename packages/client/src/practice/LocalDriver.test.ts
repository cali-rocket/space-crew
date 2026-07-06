import { describe, it, expect } from 'vitest';
import type { PlayerView } from '@space-crew/engine';
import type { ServerToClient } from '@space-crew/shared';
import { createLocalDriver } from './LocalDriver';

function harness(missionId: number, seed: number) {
  let latest: PlayerView | undefined;
  const nacks: string[] = [];
  const driver = createLocalDriver({ missionId, seed }, {
    onMessage(msg: ServerToClient) {
      if (msg.t === 'view') latest = msg.view;
      else if (msg.t === 'nack') nacks.push(msg.reason);
    },
  });
  return { driver, get: () => latest, nacks };
}

describe('createLocalDriver', () => {
  it('starts a solo match and emits a view for "me"', () => {
    const h = harness(1, 7);
    h.driver.send({ t: 'start' });
    const v = h.get()!;
    expect(v).toBeDefined();
    expect(v.me).toBe('me');
    expect(v.myHand.length).toBeGreaterThan(0);
    expect(v.seats.map((s) => s.player)).toEqual(['me', 'bot-1', 'bot-2']);
    expect(h.nacks).toEqual([]);
  });

  it('plays a full open-pick mission to a terminal outcome', () => {
    const h = harness(1, 7);
    h.driver.send({ t: 'start' });
    for (let i = 0; i < 200 && h.get()!.outcome === 'in-progress'; i++) {
      const v = h.get()!;
      if (v.phase === 'task-assignment' && v.taskPool && v.taskPool.length) {
        h.driver.send({ t: 'pick-task', card: v.taskPool[0]! });
      } else if (v.phase === 'trick-in-progress' && v.legalMoves && v.legalMoves.length) {
        h.driver.send({ t: 'play-card', card: v.legalMoves[0]! });
      } else {
        break; // nothing actionable for the human → bots should have advanced
      }
    }
    expect(h.get()!.outcome).not.toBe('in-progress');
    expect(h.nacks).toEqual([]);
  });

  it('stepBack() undoes to the previous human-visible state', () => {
    const h = harness(1, 7);
    h.driver.send({ t: 'start' });
    // advance one human action (pick a task or play a card)
    const v0 = h.get()!;
    const depth0 = h.driver.snapshotDepth();
    if (v0.phase === 'task-assignment' && v0.taskPool?.length) h.driver.send({ t: 'pick-task', card: v0.taskPool[0]! });
    else if (v0.legalMoves?.length) h.driver.send({ t: 'play-card', card: v0.legalMoves[0]! });
    const depth1 = h.driver.snapshotDepth();
    expect(depth1).toBeGreaterThan(depth0);
    h.driver.stepBack();
    expect(h.driver.snapshotDepth()).toBe(depth1 - 1);
    expect(h.nacks).toEqual([]);
  });

  it('reveal() exposes both opponent hands', () => {
    const h = harness(1, 7);
    h.driver.send({ t: 'start' });
    const rv = h.driver.reveal();
    expect(rv.__practiceOnly).toBe(true);
    expect(rv.opponentHands['bot-1']!.length).toBeGreaterThan(0);
    expect(rv.opponentHands['bot-2']!.length).toBeGreaterThan(0);
    expect(rv.opponentHands['me']).toBeUndefined();
  });
});
