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

/**
 * Bind a mission's order tokens onto the assigned tasks by assignment order
 * (token[i] → tasks[i]). Call right before beginTricks so orderViolated engages.
 * The random task draw means WHICH card carries each token varies by seed, but
 * the ordering relationship it imposes is faithful to the mission.
 */
export function applyOrderTokens(state: GameState, tokens: readonly OrderToken[]): GameState {
  if (state.phase !== 'task-assignment') throw new Error('order tokens must be bound before tricks begin');
  const tasks = state.tasks.map((t, i) => (i < tokens.length ? { ...t, order: tokens[i] } : t));
  return { ...state, tasks };
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

export function handoverTask(state: GameState, from: PlayerId, to: PlayerId, card: Card): GameState {
  if (state.phase !== 'task-assignment') throw new Error('handover only before tricks begin');
  if (!state.players.includes(to)) throw new Error(`unknown player ${to}`);
  const idx = state.tasks.findIndex((t) => sameCard(t.card, card) && t.owner === from);
  if (idx === -1) throw new Error('no such task owned by `from`');
  const tasks = state.tasks.map((t, i) => (i === idx ? { ...t, owner: to } : t));
  return { ...state, tasks };
}

export function assignRole(state: GameState, key: string, player: PlayerId): GameState {
  if (!state.players.includes(player)) throw new Error(`unknown player ${player}`);
  return { ...state, roles: { ...state.roles, [key]: player } };
}

/** Bind the crew member the commander appointed as unable to communicate (M11). */
export function setAppointedNoCommPlayer(state: GameState, player: PlayerId): GameState {
  if (!state.players.includes(player)) throw new Error(`unknown player ${player}`);
  return { ...state, appointedNoCommPlayer: player };
}

export function derivePink9Holder(state: GameState): PlayerId {
  for (const p of state.players) {
    if ((state.hands[p] ?? []).some((c) => c.suit === 'pink' && c.value === 9)) return p;
  }
  throw new Error('pink 9 not held by anyone');
}
