import { describe, it, expect } from 'vitest';
import { Card, Suit } from './cards';
import { PlayerView } from './view';
import { deriveCounting } from './counting';
import { evaluateCoach, lowTaskNowWinnable } from './coach';

const C = (suit: Suit, value: number): Card => ({ suit, value });

function mkView(p: Partial<PlayerView> & { myTasks?: Card[]; played?: Card[] }): PlayerView {
  const played = p.played ?? [];
  return {
    me: 'me', myHand: p.myHand ?? [],
    seats: [
      { player: 'me', isBot: false, connected: true, handCount: 5, tricksWon: 0, isCommander: true,
        tasks: (p.myTasks ?? []).map((card) => ({ card, owner: 'me', fulfilled: false })), communication: [] },
      { player: 'bot-1', isBot: true, connected: true, handCount: 5, tricksWon: 0, isCommander: false, tasks: [], communication: [] },
      { player: 'bot-2', isBot: true, connected: true, handCount: 5, tricksWon: 0, isCommander: false, tasks: [], communication: [] },
    ],
    missionId: 1, attemptNumber: 1, phase: 'trick-in-progress',
    currentTrick: p.currentTrick ?? { leader: 'bot-1', plays: [] },
    trickHistory: played.length
      ? [{ leader: 'me', winner: 'me', plays: played.map((card, i) => ({ player: ['me', 'bot-1', 'bot-2'][i % 3]!, card })) }]
      : undefined,
    objectives: [], communicationPolicy: 'normal', distressActive: false, outcome: 'in-progress',
  };
}

describe('lowTaskNowWinnable (3-clause)', () => {
  it('flags every missing clause for a low task', () => {
    // task yellow-2, yellow 5..9 still out, rockets live, no masters.
    const view = mkView({ myHand: [C('yellow', 2)], myTasks: [C('yellow', 2)] });
    const cs = deriveCounting(view);
    const r = lowTaskNowWinnable(cs, view, C('yellow', 2));
    expect(r.winnable).toBe(false);
    expect(r.missing.some((m) => m.includes('위 노랑'))).toBe(true);
    expect(r.missing.some((m) => m.includes('트럼프'))).toBe(true);
  });

  it('is winnable once highers are gone and no rockets remain', () => {
    // yellow 3..9 played, all 4 rockets played → yellow-2 is the top and untrumpable.
    const played = [3, 4, 5, 6, 7, 8, 9].map((v) => C('yellow', v)).concat([1, 2, 3, 4].map((v) => C('rocket', v)));
    const view = mkView({ myHand: [C('yellow', 2)], myTasks: [C('yellow', 2)], played });
    const cs = deriveCounting(view);
    const r = lowTaskNowWinnable(cs, view, C('yellow', 2));
    expect(r.winnable).toBe(true);
    expect(r.missing).toEqual([]);
  });
});

describe('evaluateCoach', () => {
  it('emits a danger low-task advice with the missing clause', () => {
    const view = mkView({ myHand: [C('yellow', 2)], myTasks: [C('yellow', 2)] });
    const advice = evaluateCoach(deriveCounting(view), view);
    const low = advice.find((a) => a.principle === 'low-task');
    expect(low).toBeDefined();
    expect(low!.severity).toBe('danger');
    expect(low!.message).toContain('빠진 조건');
  });

  it('recognises a master and puts danger before info', () => {
    // green-7 held; green 8/9 gone; all rockets gone → green-7 is a master.
    const played = [C('green', 8), C('green', 9), ...[1, 2, 3, 4].map((v) => C('rocket', v))];
    const view = mkView({ myHand: [C('green', 7)], played });
    const advice = evaluateCoach(deriveCounting(view), view);
    expect(advice.some((a) => a.principle === 'master')).toBe(true);
    // ordering: any danger sorts before any info.
    const firstInfo = advice.findIndex((a) => a.severity === 'info');
    const lastDanger = advice.map((a) => a.severity).lastIndexOf('danger');
    if (firstInfo !== -1 && lastDanger !== -1) expect(lastDanger).toBeLessThan(firstInfo);
  });
});
