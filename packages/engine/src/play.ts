import { Card, sameCard } from './cards';
import { legalMoves, trickWinner } from './trick';
import { CompletedTrick, GameState, PlayerId } from './state';
import { evaluateOutcome } from './outcome';
import { orderViolated } from './order';

export function currentPlayer(state: GameState): PlayerId {
  const leaderIdx = state.players.indexOf(state.currentTrick.leader);
  const offset = state.currentTrick.plays.length;
  return state.players[(leaderIdx + offset) % state.players.length]!;
}

export function applyPlay(state: GameState, player: PlayerId, card: Card): GameState {
  if (state.phase !== 'trick-in-progress') throw new Error('not in trick phase');
  if (state.outcome !== 'in-progress') throw new Error('mission already ended');
  if (player !== currentPlayer(state)) throw new Error(`not ${player}'s turn`);

  const hand = state.hands[player]!;
  if (!hand.some((c) => sameCard(c, card))) throw new Error('card not in hand');
  if (!legalMoves(hand, state.currentTrick).some((c) => sameCard(c, card))) {
    throw new Error('illegal: must follow the lead suit');
  }

  const hands = { ...state.hands, [player]: hand.filter((c) => !sameCard(c, card)) };
  const plays = [...state.currentTrick.plays, { player, card }];

  // 트릭이 아직 완성되지 않았으면 카드만 추가
  if (plays.length < state.players.length) {
    return { ...state, hands, currentTrick: { ...state.currentTrick, plays } };
  }

  // 트릭 완성 → 승자 확정
  const completed: CompletedTrick = {
    leader: state.currentTrick.leader,
    plays,
    winner: trickWinner({ leader: state.currentTrick.leader, plays }),
  };

  // 태스크 갱신: 이 트릭에 포함된 태스크 카드를 승자가 가져갔는지 검사
  let outcome: 'in-progress' | 'won' | 'lost' = state.outcome;
  const tasks = state.tasks.map((t) => {
    const inTrick = plays.some((p) => sameCard(p.card, t.card));
    if (!inTrick) return t;
    if (completed.winner === t.owner) return { ...t, fulfilled: true };
    // 비소유자가 태스크 카드를 획득 → 즉시 패배
    outcome = 'lost';
    return t;
  });

  if (outcome === 'in-progress' && orderViolated(tasks)) {
    outcome = 'lost';
  }

  const next: GameState = {
    ...state,
    hands,
    tasks,
    outcome,
    trickHistory: [...state.trickHistory, completed],
    currentTrick: { leader: completed.winner, plays: [] },
  };
  return evaluateOutcome(next);
}
