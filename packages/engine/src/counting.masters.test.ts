import { describe, it, expect } from 'vitest';
import { Card, Suit, makeDeck, cardKey } from './cards';
import { PlayerView } from './view';
import { deriveCounting, reconstructThirdHand } from './counting';

const C = (suit: Suit, value: number): Card => ({ suit, value });

function seats(handCounts: { me: number; b1: number; b2: number }) {
  return [
    { player: 'me', isBot: false, connected: true, handCount: handCounts.me, tricksWon: 0, isCommander: true, tasks: [], communication: [] },
    { player: 'bot-1', isBot: true, connected: true, handCount: handCounts.b1, tricksWon: 0, isCommander: false, tasks: [], communication: [] },
    { player: 'bot-2', isBot: true, connected: true, handCount: handCounts.b2, tricksWon: 0, isCommander: false, tasks: [], communication: [] },
  ];
}

/** Dump `played` cards into one flat pseudo-trick so playedCards() sees them. */
function mkView(p: Partial<PlayerView> & { played?: Card[] }): PlayerView {
  const played = p.played ?? [];
  return {
    me: 'me', myHand: p.myHand ?? [],
    seats: p.seats ?? seats({ me: 0, b1: 0, b2: 0 }),
    missionId: 1, attemptNumber: 1, phase: 'trick-in-progress',
    currentTrick: p.currentTrick ?? { leader: 'me', plays: [] },
    trickHistory: p.trickHistory ?? (played.length
      ? [{ leader: 'me', winner: 'me', plays: played.map((card, i) => ({ player: ['me', 'bot-1', 'bot-2'][i % 3]!, card })) }]
      : undefined),
    objectives: [], communicationPolicy: 'normal', distressActive: false, outcome: 'in-progress',
  };
}

describe('masters (conservative under-claim)', () => {
  it('a colour card is a master when no higher is out AND no rockets remain', () => {
    // I hold green-7 and rocket-4; green 8/9 and rockets 1/2/3 are played → 0 rockets out.
    const view = mkView({
      myHand: [C('green', 7), C('rocket', 4)],
      played: [C('green', 8), C('green', 9), C('rocket', 1), C('rocket', 2), C('rocket', 3)],
    });
    const cs = deriveCounting(view);
    expect(cs.masters).toContainEqual(C('green', 7));
    expect(cs.masters).toContainEqual(C('rocket', 4)); // rocket-4 always a master
  });

  it('does NOT claim a colour master while rockets are still out and voids unproven', () => {
    const view = mkView({ myHand: [C('green', 7)], played: [C('green', 8), C('green', 9)] });
    const cs = deriveCounting(view);
    expect(cs.masters).not.toContainEqual(C('green', 7)); // a live rocket could trump it
  });
});

describe('reconstructThirdHand (anchored on exact hand counts)', () => {
  it('forces cards by void + hand-size elimination and reaches perfect info', () => {
    // Endgame: I hold blue-1; bot-1 holds 2 cards, bot-2 holds 1.
    const oppCards = [C('green', 2), C('yellow', 3), C('pink', 4)]; // the 3 unseen cards
    const myHand = [C('blue', 1)];
    const held = new Set([...oppCards, ...myHand].map(cardKey));
    const played = makeDeck().filter((c) => !held.has(cardKey(c)));
    const view = mkView({ myHand, played, seats: seats({ me: 1, b1: 2, b2: 1 }) });

    // bot-2 is void in green and yellow → green-2, yellow-3 must be bot-1's;
    // that fills bot-1 (2 cards) → pink-4 must be bot-2's.
    const voids = { me: [], 'bot-1': [] as Suit[], 'bot-2': ['green', 'yellow'] as Suit[] };
    const r = reconstructThirdHand(view, voids);
    expect(r['bot-1']).toContainEqual(C('green', 2));
    expect(r['bot-1']).toContainEqual(C('yellow', 3));
    expect(r['bot-2']).toContainEqual(C('pink', 4));
    expect(r['bot-1']!.length).toBe(2);
    expect(r['bot-2']!.length).toBe(1);
  });

  it('emits nothing forceable when no voids are known', () => {
    const oppCards = [C('green', 2), C('yellow', 3)];
    const myHand = [C('blue', 1)];
    const held = new Set([...oppCards, ...myHand].map(cardKey));
    const played = makeDeck().filter((c) => !held.has(cardKey(c)));
    const view = mkView({ myHand, played, seats: seats({ me: 1, b1: 1, b2: 1 }) });
    const r = reconstructThirdHand(view, { me: [], 'bot-1': [], 'bot-2': [] });
    expect(Object.keys(r).length).toBe(0); // nothing provably forced
  });
});
