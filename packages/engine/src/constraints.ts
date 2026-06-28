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
