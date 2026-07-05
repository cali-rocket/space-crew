import { describe, it, expect } from 'vitest';
import { evaluateOutcome } from './outcome';
import { createGame, GameState } from './state';
import { Card } from './cards';

const base = (): GameState => createGame({ players: ['P1', 'P2', 'P3'], missionId: 1, seed: 1 });
const trick = (winner: string) => ({ leader: 'P1', plays: [{ player: winner, card: { suit: 'blue', value: 5 } as Card }], winner });
// hands with cards still left → NOT "all tricks played"
const midHands = { P1: [{ suit: 'green', value: 1 } as Card, { suit: 'green', value: 2 } as Card], P2: [{ suit: 'pink', value: 1 } as Card], P3: [{ suit: 'pink', value: 2 } as Card] };

describe('early win — mission ends when the objective is met', () => {
  it('a pure-task mission is won the instant all tasks are fulfilled (cards still in hand)', () => {
    const g = evaluateOutcome({
      ...base(),
      phase: 'trick-in-progress',
      tasks: [{ card: { suit: 'blue', value: 5 }, owner: 'P1', fulfilled: true }],
      constraints: [],
      trickHistory: [trick('P1')],
      hands: midHands, // maxHand = 2 > 1, so not exhausted
    });
    expect(g.outcome).toBe('won');
    expect(g.phase).toBe('mission-result');
  });

  it('does NOT win while a task is still unfulfilled', () => {
    const g = evaluateOutcome({
      ...base(),
      phase: 'trick-in-progress',
      tasks: [{ card: { suit: 'blue', value: 5 }, owner: 'P1', fulfilled: false }],
      constraints: [],
      trickHistory: [trick('P1')],
      hands: midHands,
    });
    expect(g.outcome).toBe('in-progress');
  });

  it('a mission with a whole-game constraint (balance) does NOT win early', () => {
    const g = evaluateOutcome({
      ...base(),
      phase: 'trick-in-progress',
      tasks: [{ card: { suit: 'blue', value: 5 }, owner: 'P1', fulfilled: true }],
      constraints: [{ kind: 'balance', maxDiff: 1 }], // 'pending' until trick 13
      trickHistory: [trick('P1'), trick('P2'), trick('P3')],
      hands: midHands,
    });
    expect(g.outcome).toBe('in-progress');
  });
});
