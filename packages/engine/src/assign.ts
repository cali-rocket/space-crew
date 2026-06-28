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

export function assignByDistribution(
  state: GameState,
  entries: { spec: TaskSpec; owner: PlayerId }[],
): GameState {
  if (state.phase !== 'task-assignment') throw new Error('not in task-assignment phase');
  const cards = entries.map((e) => e.spec.card);
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      if (sameCard(cards[i]!, cards[j]!)) throw new Error('duplicate task card');
    }
    if (state.tasks.some((t) => sameCard(t.card, cards[i]!))) throw new Error('task card already assigned');
  }
  for (const e of entries) {
    if (!state.players.includes(e.owner)) throw new Error(`unknown player ${e.owner}`);
  }
  const counts: Record<PlayerId, number> = Object.fromEntries(state.players.map((p) => [p, 0]));
  for (const t of state.tasks) counts[t.owner] = (counts[t.owner] ?? 0) + 1;
  for (const e of entries) counts[e.owner] = (counts[e.owner] ?? 0) + 1;
  const values = state.players.map((p) => counts[p] ?? 0);
  if (Math.max(...values) - Math.min(...values) > 1) {
    throw new Error('tasks must be evenly distributed (max-min ≤ 1)');
  }
  return {
    ...state,
    tasks: [
      ...state.tasks,
      ...entries.map((e) => ({ card: e.spec.card, owner: e.owner, fulfilled: false, order: e.spec.order })),
    ],
  };
}
