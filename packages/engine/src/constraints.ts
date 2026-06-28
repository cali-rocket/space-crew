import { ConstraintDef, GameState } from './state';
import { winningCard } from './trick';

export function evaluateConstraint(def: ConstraintDef, state: GameState): 'pending' | 'satisfied' | 'violated' {
  switch (def.kind) {
    case 'forbid-win-value': {
      const violated = state.trickHistory.some((t) => winningCard(t, t.winner).value === def.value);
      return violated ? 'violated' : 'satisfied';
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
