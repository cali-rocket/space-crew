import { Card, sameCard } from './cards';
import { CommToken } from './state';

export function commClassification(hand: readonly Card[], card: Card): CommToken | null {
  if (card.suit === 'rocket') return null;
  if (!hand.some((h) => sameCard(h, card))) return null;
  const sameColor = hand.filter((h) => h.suit === card.suit);
  if (sameColor.length === 1) return 'only';
  const values = sameColor.map((h) => h.value);
  if (card.value === Math.max(...values)) return 'highest';
  if (card.value === Math.min(...values)) return 'lowest';
  return null;
}
