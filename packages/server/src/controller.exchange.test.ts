import { describe, it, expect } from 'vitest';
import { MISSIONS, PlayerId, createGame, exchangeWithRightNeighbor } from '@space-crew/engine';
import { setupMatch, advance } from './controller';

const P: PlayerId[] = ['P1', 'P2', 'P3'];
const bots = { P1: true, P2: true, P3: true };
const m12 = MISSIONS.find((m) => m.id === 12)!;

const bag = (hands: Record<string, { suit: string; value: number }[]>) =>
  Object.values(hands).flat().map((c) => `${c.suit}${c.value}`).sort();

describe('M12 hand exchange', () => {
  it('exchange conserves the 40-card deck and keeps hand sizes, deterministically', () => {
    const g = createGame({ players: P, missionId: 12, seed: 4 });
    const before = bag(g.hands);
    const after = exchangeWithRightNeighbor(g, 999);
    // same multiset of 40 cards, redistributed
    expect(bag(after.hands)).toEqual(before);
    expect(new Set(bag(after.hands)).size).toBe(40);
    // hand sizes unchanged
    for (const p of P) expect(after.hands[p]!.length).toBe(g.hands[p]!.length);
    // something actually moved
    expect(JSON.stringify(after.hands)).not.toBe(JSON.stringify(g.hands));
    // deterministic for a given seed
    expect(JSON.stringify(exchangeWithRightNeighbor(g, 999))).toBe(JSON.stringify(after));
  });

  it('M12 performs the exchange once (when the game survives trick 1) and conserves cards', () => {
    // find a seed whose game plays past the 1st trick, so the exchange actually fires
    let m = advance(setupMatch(m12, P, bots, 1));
    for (let s = 1; s <= 40 && !(m.exchangeDone); s++) m = advance(setupMatch(m12, P, bots, s));
    expect(m.exchangeDone).toBe(true); // exchange fired for at least one seed
    // every finished M12 game conserves the 40-card deck (checked across many seeds)
    for (let s = 1; s <= 20; s++) {
      const g = advance(setupMatch(m12, P, bots, s)).game;
      const cards = [
        ...P.flatMap((p) => g.hands[p] ?? []),
        ...g.currentTrick.plays.map((pl) => pl.card),
        ...g.trickHistory.flatMap((t) => t.plays.map((pl) => pl.card)),
      ].map((c) => `${c.suit}${c.value}`);
      expect(cards.length).toBe(40);
      expect(new Set(cards).size).toBe(40);
    }
  });

  it('M12 is deterministic (same seed -> same outcome)', () => {
    const a = advance(setupMatch(m12, P, bots, 11));
    const b = advance(setupMatch(m12, P, bots, 11));
    expect(a.game.outcome).toBe(b.game.outcome);
    expect(a.game.trickHistory.length).toBe(b.game.trickHistory.length);
  });
});
