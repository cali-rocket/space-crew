import { Card, COLORS } from './cards';
import { shuffle } from './rng';

export function drawTaskCards(seed: number, count: number): Card[] {
  const deck: Card[] = [];
  for (const suit of COLORS) for (let v = 1; v <= 9; v++) deck.push({ suit, value: v });
  return shuffle(deck, seed).slice(0, count);
}
