import { describe, it, expect } from 'vitest';
import { BasicBot } from './bot';
import { PlayerView } from './view';
import { Card } from './cards';

type Task = { card: Card; owner: string; fulfilled: boolean };
function view(me: string, tasks: Task[], trick: PlayerView['currentTrick']): PlayerView {
  const players = ['P1', 'P2', 'P3'];
  return {
    me,
    myHand: [],
    seats: players.map((p) => ({
      player: p, isBot: true, connected: true, handCount: 5, tricksWon: 0, isCommander: p === 'P1',
      tasks: tasks.filter((t) => t.owner === p).map((t) => ({ ...t })),
      communication: [],
    })),
    missionId: 1, attemptNumber: 1, phase: 'trick-in-progress',
    currentTrick: trick, objectives: [], communicationPolicy: 'normal', distressActive: false, outcome: 'in-progress',
  };
}

describe('BasicBot plays safely', () => {
  it("does NOT win a trick containing an opponent's task card", () => {
    const opp: Task = { card: { suit: 'green', value: 5 }, owner: 'P2', fulfilled: false };
    const v = view('P1', [opp], {
      leader: 'P2', leadSuit: 'green',
      plays: [{ player: 'P2', card: { suit: 'green', value: 5 } }], // P2 dumped its own task
    });
    // P1 could win with green-9 or lose with green-2 → must choose the loser
    const move = BasicBot.playCard(v, [{ suit: 'green', value: 9 }, { suit: 'green', value: 2 }]);
    expect(move).toEqual({ suit: 'green', value: 2 });
  });

  it('does NOT dump its own task card into a trick it cannot win', () => {
    const mine: Task = { card: { suit: 'green', value: 5 }, owner: 'P1', fulfilled: false };
    const v = view('P1', [mine], {
      leader: 'P2', leadSuit: 'green',
      plays: [{ player: 'P2', card: { suit: 'green', value: 9 } }], // 9 beats both my greens
    });
    // legal: my task green-5 (loses) or green-3 (loses) → keep the task, play green-3
    const move = BasicBot.playCard(v, [{ suit: 'green', value: 5 }, { suit: 'green', value: 3 }]);
    expect(move).toEqual({ suit: 'green', value: 3 });
  });

  it('wins its own task when last to play and it beats the trick', () => {
    const mine: Task = { card: { suit: 'green', value: 5 }, owner: 'P1', fulfilled: false };
    const v = view('P1', [mine], {
      leader: 'P2', leadSuit: 'green',
      plays: [
        { player: 'P2', card: { suit: 'green', value: 2 } },
        { player: 'P3', card: { suit: 'green', value: 4 } },
      ], // P1 is last; green-5 beats 4
    });
    const move = BasicBot.playCard(v, [{ suit: 'green', value: 5 }, { suit: 'green', value: 1 }]);
    expect(move).toEqual({ suit: 'green', value: 5 });
  });

  it('when leading, does not lead its own task card if a safe low card exists', () => {
    const mine: Task = { card: { suit: 'green', value: 5 }, owner: 'P1', fulfilled: false };
    const v = view('P1', [mine], { leader: 'P1', plays: [] });
    const move = BasicBot.playCard(v, [{ suit: 'green', value: 5 }, { suit: 'blue', value: 2 }]);
    expect(move).toEqual({ suit: 'blue', value: 2 });
  });
});
