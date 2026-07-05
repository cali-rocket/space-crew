import { Card, sameCard } from './cards';
import { GameState, PlayerId } from './state';
import { mulberry32 } from './rng';

/**
 * M12: "Immediately after the 1st trick, each of you must draw a random card from
 * the crew member to your right." A simultaneous rotation — each player takes one
 * RANDOM card from the next player in seating order and, in turn, gives one to the
 * previous player. Hand sizes are unchanged and the 40-card deck is conserved.
 * The seed makes the random pick deterministic (replayable).
 */
export function exchangeWithRightNeighbor(state: GameState, seed: number): GameState {
  const players = state.players;
  const n = players.length;
  const rng = mulberry32(seed);
  const rightOf = (i: number): PlayerId => players[(i + 1) % n]!;

  // Each player takes one random card from their right neighbour's ORIGINAL hand.
  const taken: Record<PlayerId, Card> = {};
  for (let i = 0; i < n; i++) {
    const rHand = state.hands[rightOf(i)] ?? [];
    if (rHand.length === 0) throw new Error('right neighbour has no card to give');
    taken[players[i]!] = rHand[Math.floor(rng() * rHand.length)]!;
  }

  // Rebuild hands: each player loses the card their LEFT neighbour took, gains the
  // card they took from their right.
  const hands: Record<PlayerId, Card[]> = {};
  for (let i = 0; i < n; i++) {
    const me = players[i]!;
    const leftNeighbour = players[(i - 1 + n) % n]!;
    const lost = taken[leftNeighbour]!; // the card my left neighbour drew from me
    const kept = (state.hands[me] ?? []).filter((c) => !sameCard(c, lost));
    kept.push(taken[me]!);
    hands[me] = kept;
  }
  return { ...state, hands };
}
