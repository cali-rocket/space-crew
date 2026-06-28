import { Card, sameCard } from './cards';
import { CommToken, GameState, PlayerId } from './state';

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

export function communicate(
  state: GameState,
  player: PlayerId,
  card: Card,
  declaredToken: CommToken | null,
): GameState {
  if (state.phase !== 'trick-in-progress' || state.currentTrick.plays.length !== 0) {
    throw new Error('communication only allowed before a trick begins');
  }
  if (state.outcome !== 'in-progress') throw new Error('mission already ended');
  if (state.commUsed[player]) throw new Error('already communicated once this attempt');
  const hand = state.hands[player] ?? [];
  if (!hand.some((h) => sameCard(h, card))) throw new Error('card not in hand');
  if (card.suit === 'rocket') throw new Error('rocket cards cannot be communicated');

  const policy = state.communicationPolicy;
  const classification = commClassification(hand, card);

  if (policy === 'dead-zone') {
    if (declaredToken !== null) throw new Error('dead-zone: token must be null (intuition)');
    if (classification === null) throw new Error('card is not highest/only/lowest of its color');
  } else {
    if (typeof policy === 'object' && 'noCommUntilTrick' in policy) {
      if (state.trickHistory.length < policy.noCommUntilTrick - 1) {
        throw new Error('communication disrupted until later trick');
      }
    }
    if (typeof policy === 'object' && 'oneMemberNoComm' in policy) {
      if (player === state.appointedNoCommPlayer) throw new Error('appointed player cannot communicate');
    }
    if (declaredToken === null || declaredToken !== classification) {
      throw new Error('communication token must truthfully match the card');
    }
  }

  return {
    ...state,
    commUsed: { ...state.commUsed, [player]: true },
    communication: [...state.communication, { player, card, token: declaredToken }],
  };
}
