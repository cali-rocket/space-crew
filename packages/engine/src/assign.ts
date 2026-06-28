import { Card, sameCard } from './cards';
import { GameState, PlayerId, OrderToken } from './state';

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

export interface TaskSpec {
  card: Card;
  order?: OrderToken;
}

export function assignByDecision(state: GameState, assignee: PlayerId, specs: TaskSpec[]): GameState {
  if (state.phase !== 'task-assignment') throw new Error('not in task-assignment phase');
  if (!state.players.includes(assignee)) throw new Error(`unknown player ${assignee}`);
  if (assignee === state.commander) throw new Error('commander cannot choose self (commander-decision)');
  const cards = specs.map((s) => s.card);
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      if (sameCard(cards[i]!, cards[j]!)) throw new Error('duplicate task card');
    }
    if (state.tasks.some((t) => sameCard(t.card, cards[i]!))) throw new Error('task card already assigned');
  }
  return {
    ...state,
    tasks: [
      ...state.tasks,
      ...specs.map((s) => ({ card: s.card, owner: assignee, fulfilled: false, order: s.order })),
    ],
  };
}
