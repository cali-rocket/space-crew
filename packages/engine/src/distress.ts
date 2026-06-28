import { Card, sameCard } from './cards';
import { GameState, PlayerId } from './state';

export function setDistress(
  state: GameState,
  active: boolean,
  direction?: 'left' | 'right',
): GameState {
  if (state.phase !== 'task-assignment') throw new Error('distress can only be set during setup');
  return { ...state, distressActive: active, distressDirection: active ? direction : undefined };
}

export function submitDistressCard(state: GameState, player: PlayerId, card: Card): GameState {
  if (!state.distressActive) throw new Error('distress is not active');
  if (card.suit === 'rocket') throw new Error('rocket cards cannot be passed');
  const hand = state.hands[player] ?? [];
  if (!hand.some((h) => sameCard(h, card))) throw new Error('card not in hand');
  const commits = { ...(state.distressCommits ?? {}), [player]: card };

  if (Object.keys(commits).length < state.players.length) {
    return { ...state, distressCommits: commits };
  }

  // all submitted → reveal and pass
  const dir = state.distressDirection;
  if (dir === undefined) throw new Error('distress direction not set');
  const n = state.players.length;
  const hands: Record<PlayerId, Card[]> = {};
  // remove each giver's submitted card first
  state.players.forEach((p) => {
    hands[p] = (state.hands[p] ?? []).filter((h) => !sameCard(h, commits[p]!));
  });
  // deliver to neighbor
  state.players.forEach((p, i) => {
    const recipientIdx = dir === 'right' ? (i + 1) % n : (i - 1 + n) % n;
    const recipient = state.players[recipientIdx]!;
    hands[recipient] = [...hands[recipient]!, commits[p]!];
  });

  const next = { ...state, hands };
  delete (next as { distressCommits?: unknown }).distressCommits;
  return next;
}
