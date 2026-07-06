import { describe, it, expect } from 'vitest';
import { Card, Suit } from './cards';
import { PlayerView } from './view';
import { deriveCounting, remainingByColor, rocketState, detectVoids } from './counting';

const C = (suit: Suit, value: number): Card => ({ suit, value });

function mkView(p: Partial<PlayerView>): PlayerView {
  return {
    me: 'me',
    myHand: [],
    seats: [
      { player: 'me', isBot: false, connected: true, handCount: 0, tricksWon: 0, isCommander: true, tasks: [], communication: [] },
      { player: 'bot-1', isBot: true, connected: true, handCount: 0, tricksWon: 0, isCommander: false, tasks: [], communication: [] },
      { player: 'bot-2', isBot: true, connected: true, handCount: 0, tricksWon: 0, isCommander: false, tasks: [], communication: [] },
    ],
    missionId: 1,
    attemptNumber: 1,
    phase: 'trick-in-progress',
    currentTrick: { leader: 'bot-1', plays: [] },
    objectives: [],
    communicationPolicy: 'normal',
    distressActive: false,
    outcome: 'in-progress',
    ...p,
  };
}

describe('remainingByColor', () => {
  it('excludes played cards and my own hand', () => {
    const view = mkView({
      myHand: [C('pink', 7)],
      trickHistory: [
        { leader: 'bot-1', winner: 'bot-1', plays: [
          { player: 'bot-1', card: C('pink', 9) },
          { player: 'bot-2', card: C('pink', 8) },
          { player: 'me', card: C('blue', 2) },
        ] },
      ],
    });
    const r = remainingByColor(view);
    expect(r.pink).toEqual([1, 2, 3, 4, 5, 6]); // 7 mine, 8/9 played
    expect(r.blue).toEqual([1, 3, 4, 5, 6, 7, 8, 9]); // 2 played
    expect(r.green).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(r.yellow).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

describe('rocketState', () => {
  it('counts played rockets; remaining excludes played and my own rockets', () => {
    const view = mkView({
      myHand: [C('rocket', 1)],
      trickHistory: [
        { leader: 'bot-1', winner: 'bot-1', plays: [
          { player: 'bot-1', card: C('rocket', 2) },
          { player: 'bot-2', card: C('green', 3) },
          { player: 'me', card: C('green', 1) },
        ] },
      ],
    });
    const rk = rocketState(view);
    expect(rk.played).toEqual([2]);
    expect(rk.remaining).toBe(2); // 4 - 1 played - 1 mine = 2 outstanding among opponents
  });
});

describe('detectVoids', () => {
  it('marks a player void in the lead suit when they cannot follow', () => {
    const view = mkView({
      trickHistory: [
        { leader: 'bot-1', winner: 'me', plays: [
          { player: 'bot-1', card: C('blue', 5) }, // lead = blue
          { player: 'bot-2', card: C('green', 3) }, // off-suit → void in blue
          { player: 'me', card: C('blue', 9) },
        ] },
      ],
    });
    const v = detectVoids(view);
    expect(v['bot-2']).toContain('blue');
    expect(v['bot-1'] ?? []).not.toContain('blue'); // the leader defines the suit
    expect(v['me'] ?? []).not.toContain('blue'); // followed suit
  });

  it('treats a trump (rocket) played off the lead colour as a void too', () => {
    const view = mkView({
      currentTrick: { leader: 'bot-1', plays: [
        { player: 'bot-1', card: C('green', 4) }, // lead = green
        { player: 'bot-2', card: C('rocket', 1) }, // trumped → void in green
      ] },
    });
    const v = detectVoids(view);
    expect(v['bot-2']).toContain('green');
  });
});

describe('deriveCounting', () => {
  it('assembles remaining, rockets and voids', () => {
    const view = mkView({ myHand: [C('pink', 7)] });
    const cs = deriveCounting(view);
    expect(cs.remaining.pink).toContain(1);
    expect(cs.rockets.remaining).toBe(4);
    expect(cs.voids['me']).toBeDefined();
  });
});
