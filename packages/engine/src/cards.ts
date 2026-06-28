export const COLORS = ['pink', 'blue', 'green', 'yellow'] as const;
export type Color = (typeof COLORS)[number];
export type Suit = Color | 'rocket';

export interface Card {
  suit: Suit;
  value: number;
}

export function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of COLORS) {
    for (let v = 1; v <= 9; v++) deck.push({ suit, value: v });
  }
  for (let v = 1; v <= 4; v++) deck.push({ suit: 'rocket', value: v });
  return deck;
}

export function cardKey(c: Card): string {
  return `${c.suit}-${c.value}`;
}

export function sameCard(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.value === b.value;
}
