import { GameState } from './state';
import { constraintsAllSatisfied } from './constraints';

// 실제 3인 미션은 13트릭, 미니 테스트는 더 짧을 수 있으므로
// "모든 손패의 플레이가능 카드 소진"을 종료로 본다(seat 0의 미사용 1장 제외 불가하므로
// 트릭 수가 곧 종료 신호 — 손패에 카드가 1장 이하만 남으면 더 둘 트릭이 없다).
// 단 1장-손패 미니게임은 플레이 전에도 maxHand=1이라 '종료'로 오판되므로, 트릭이 최소 1회 완료된 경우에만 종료로 본다.
function allTricksPlayed(state: GameState): boolean {
  const maxHand = Math.max(...state.players.map((p) => state.hands[p]!.length));
  return state.trickHistory.length >= 1 && maxHand <= 1; // 한 명만 미사용 1장 남고 나머지는 0 → 더 진행 불가
}

export function evaluateOutcome(state: GameState): GameState {
  if (state.outcome === 'lost') {
    return { ...state, phase: 'mission-result' };
  }
  if (state.outcome === 'won') return state;
  const allFulfilled = state.tasks.every((t) => t.fulfilled);
  if (allTricksPlayed(state)) {
    if (allFulfilled && constraintsAllSatisfied(state)) {
      return { ...state, outcome: 'won', phase: 'mission-result' };
    } else {
      return { ...state, outcome: 'lost', phase: 'mission-result' };
    }
  }
  return state;
}
