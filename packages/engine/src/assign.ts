import { Card, sameCard } from './cards';
import { GameState, PlayerId } from './state';

export function assignTask(state: GameState, owner: PlayerId, card: Card): GameState {
  if (state.phase !== 'task-assignment') throw new Error('not in task-assignment phase');
  if (!state.players.includes(owner)) throw new Error(`unknown player ${owner}`);
  if (state.tasks.some((t) => sameCard(t.card, card))) {
    throw new Error(`card ${card.suit}-${card.value} is already a task`);
  }
  return {
    ...state,
    tasks: [...state.tasks, { card, owner, fulfilled: false }],
  };
}

export function beginTricks(state: GameState): GameState {
  if (state.phase !== 'task-assignment') throw new Error('not in task-assignment phase');
  return {
    ...state,
    phase: 'trick-in-progress',
    currentTrick: { leader: state.commander, plays: [] },
  };
}
