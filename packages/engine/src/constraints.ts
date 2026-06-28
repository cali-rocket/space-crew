import { ConstraintDef, GameState } from './state';
import { winningCard } from './trick';
import { sameCard, cardKey } from './cards';

export function evaluateConstraint(def: ConstraintDef, state: GameState): 'pending' | 'satisfied' | 'violated' {
  switch (def.kind) {
    case 'forbid-win-value': {
      const violated = state.trickHistory.some((t) => winningCard(t, t.winner).value === def.value);
      return violated ? 'violated' : 'satisfied';
    }
    case 'win-value-count': {
      const winners = state.trickHistory.map((t) => winningCard(t, t.winner)).filter((c) => c.value === def.value);
      const n = def.distinct ? new Set(winners.map(cardKey)).size : winners.length;
      return n >= def.count ? 'satisfied' : 'pending';
    }
    case 'win-cards': {
      const winSeq = state.trickHistory.map((t) => winningCard(t, t.winner));
      const wonOf = (card: typeof def.cards[number]) => winSeq.findIndex((w) => sameCard(w, card));
      const idxs = def.cards.map(wonOf);
      if (def.ordered) {
        const present = idxs.filter((i) => i >= 0);
        for (let i = 1; i < present.length; i++) if (present[i]! < present[i - 1]!) return 'violated';
        // also: a later card won while an earlier one hasn't → out of order
        for (let i = 0; i < def.cards.length; i++) {
          if (idxs[i]! >= 0) {
            for (let j = 0; j < i; j++) if (idxs[j]! < 0) return 'violated';
          }
        }
      }
      return idxs.every((i) => i >= 0) ? 'satisfied' : 'pending';
    }
    case 'player-trick-count': {
      const target = state.roles[def.role];
      if (target === undefined) return 'pending';
      const won = state.trickHistory.filter((t) => t.winner === target);
      if (!def.rocketAllowed && won.some((t) => winningCard(t, t.winner).suit === 'rocket')) return 'violated';
      if (won.length > def.count) return 'violated';
      return won.length === def.count ? 'satisfied' : 'pending';
    }
    case 'player-exact-tricks': {
      const target = state.roles[def.role];
      if (target === undefined) return 'pending';
      const TOTAL = 13;
      const required = def.tricks === 'first-last' ? [0, TOTAL - 1] : def.tricks;
      const reqSet = new Set(required);
      for (let i = 0; i < state.trickHistory.length; i++) {
        const t = state.trickHistory[i]!;
        const wonByTarget = t.winner === target;
        if (reqSet.has(i) && !wonByTarget) return 'violated';
        if (def.exclusive && !reqSet.has(i) && wonByTarget) return 'violated';
        if (wonByTarget && !def.rocketAllowed && winningCard(t, t.winner).suit === 'rocket') return 'violated';
      }
      const allRequiredDone = required.every((i) => i < state.trickHistory.length);
      return allRequiredDone ? 'satisfied' : 'pending';
    }
    case 'balance': {
      const wins: Record<string, number> = Object.fromEntries(state.players.map((p) => [p, 0]));
      for (const t of state.trickHistory) wins[t.winner] = (wins[t.winner] ?? 0) + 1;
      const vals = state.players.map((p) => wins[p] ?? 0);
      if (Math.max(...vals) - Math.min(...vals) > def.maxDiff) return 'violated';
      return state.trickHistory.length >= 13 ? 'satisfied' : 'pending';
    }
    case 'task-in-last-trick': {
      const idx = state.trickHistory.findIndex((t) => t.plays.some((p) => sameCard(p.card, def.card)));
      if (idx === -1) return 'pending';
      return idx === 12 ? 'satisfied' : 'violated';
    }
    case 'trick-partition': {
      const roleFor = (i: number): string | undefined => {
        const range = i < 4 ? 'first4' : i === 12 ? 'last' : 'middle';
        return def.parts.find((p) => p.range === range)?.role;
      };
      for (let i = 0; i < state.trickHistory.length; i++) {
        const role = roleFor(i);
        const target = role !== undefined ? state.roles[role] : undefined;
        if (target === undefined) return 'pending';
        if (state.trickHistory[i]!.winner !== target) return 'violated';
      }
      return state.trickHistory.length >= 13 ? 'satisfied' : 'pending';
    }
    default:
      return 'pending'; // 후속 태스크에서 구현
  }
}

export function constraintsViolated(state: GameState): boolean {
  return state.constraints.some((c) => evaluateConstraint(c, state) === 'violated');
}

export function constraintsAllSatisfied(state: GameState): boolean {
  return state.constraints.every((c) => evaluateConstraint(c, state) === 'satisfied');
}
