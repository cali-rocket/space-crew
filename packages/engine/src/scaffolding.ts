import { Card, Color, COLORS } from './cards';
import { PlayerView } from './view';
import { CountingState } from './counting';

const SUIT_K: Record<string, string> = { pink: '분홍', blue: '파랑', green: '초록', yellow: '노랑' };
const label = (c: Card) => `${c.suit}-${c.value}`;

/** A single active-recall question for the L2 "test" scaffolding stage. */
export interface Quiz {
  id: string;
  /** Mastery bucket: 'rockets' | 'masters' | 'voids:<player>'. */
  concept: string;
  kind: 'count' | 'multiselect';
  prompt: string;
  /** For multiselect: the selectable tokens. */
  options?: string[];
  /** Canonical correct answer tokens (order-independent for multiselect). */
  correct: string[];
}

/**
 * Event-triggered quizzes derived from the (public) counting state — the answers are the
 * exact values the HUD would otherwise show, so the learner recalls instead of reading.
 */
export function generateQuizzes(cs: CountingState, view: PlayerView): Quiz[] {
  const out: Quiz[] = [];

  out.push({
    id: 'rockets',
    concept: 'rockets',
    kind: 'count',
    prompt: '로켓(트럼프)이 지금 몇 장 밖에 있나요?',
    correct: [String(cs.rockets.remaining)],
  });

  if (view.myHand.length > 0) {
    const masterSet = new Set(cs.masters.map(label));
    out.push({
      id: 'masters',
      concept: 'masters',
      kind: 'multiselect',
      prompt: '지금 내 손에서 마스터(무조건 이기는 카드)는? (없으면 아무것도 선택 안 함)',
      options: view.myHand.map(label),
      correct: view.myHand.map(label).filter((l) => masterSet.has(l)),
    });
  }

  // Void quizzes only once there is a played trick to reason about.
  if ((view.trickHistory ?? []).length >= 1) {
    for (const seat of view.seats) {
      if (seat.player === view.me) continue;
      const voids = (cs.voids[seat.player] ?? []).filter((s): s is Color => (COLORS as readonly string[]).includes(s));
      out.push({
        id: `voids:${seat.player}`,
        concept: `voids:${seat.player}`,
        kind: 'multiselect',
        prompt: `${seat.player}는 어느 색에 보이드인가요? (없으면 '없음')`,
        options: [...COLORS.map((c) => c), '없음'],
        correct: voids.length ? voids.map((c) => c as string) : ['없음'],
      });
    }
  }

  return out;
}

export function gradeQuiz(quiz: Quiz, answer: string[]): { correct: boolean; correctAnswer: string[] } {
  const a = new Set(answer);
  const b = new Set(quiz.correct);
  const correct = a.size === b.size && [...a].every((x) => b.has(x));
  return { correct, correctAnswer: quiz.correct };
}

/** Adaptive-fade helpers (client decides the level transition; these track the signal). */
export function nextStreak(streak: number, correct: boolean): number {
  return correct ? streak + 1 : 0;
}
export function shouldPromote(streak: number, promoteAfter = 2): boolean {
  return streak >= promoteAfter;
}

export function suitLabelK(suit: string): string {
  return SUIT_K[suit] ?? suit;
}
