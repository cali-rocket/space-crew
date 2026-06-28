import { Card, Suit } from './cards';

export interface Play {
  player: string;
  card: Card;
}

export interface Trick {
  leader: string;
  plays: Play[];
}

export function leadSuit(trick: Trick): Suit | undefined {
  return trick.plays[0]?.card.suit;
}

export function legalMoves(hand: readonly Card[], trick: Trick): Card[] {
  const lead = leadSuit(trick);
  if (lead === undefined) return [...hand];
  const sameSuit = hand.filter((card) => card.suit === lead);
  return sameSuit.length > 0 ? sameSuit : [...hand];
}

export function trickWinner(trick: Trick): string {
  const lead = leadSuit(trick);
  if (lead === undefined) throw new Error('cannot resolve an empty trick');
  const rockets = trick.plays.filter((p) => p.card.suit === 'rocket');
  const contenders = rockets.length > 0
    ? rockets
    : trick.plays.filter((p) => p.card.suit === lead);
  return contenders.reduce((best, p) => (p.card.value > best.card.value ? p : best)).player;
}

export function winningCard(trick: { plays: Play[] }, winner: string): Card {
  const play = trick.plays.find((p) => p.player === winner);
  if (!play) throw new Error('winner has no card in this trick');
  return play.card;
}
