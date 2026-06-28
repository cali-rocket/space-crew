import { Card, makeDeck } from './cards';
import { shuffle } from './rng';

// seat 0 receives the extra (14th) card; seats 1 and 2 receive 13 each.
export function dealHands(seed: number): Card[][] {
  const deck = shuffle(makeDeck(), seed);
  const hands: Card[][] = [[], [], []];
  // round-robin deal of 39 cards, then the 40th goes to seat 0
  for (let i = 0; i < 39; i++) {
    hands[i % 3]!.push(deck[i]!);
  }
  hands[0]!.push(deck[39]!);
  return hands;
}

export function findCommander(hands: readonly Card[][]): number {
  for (let seat = 0; seat < hands.length; seat++) {
    if (hands[seat]!.some((c) => c.suit === 'rocket' && c.value === 4)) return seat;
  }
  throw new Error('no rocket-4 dealt — impossible with a full deck');
}
