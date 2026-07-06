import { describe, it, expect } from 'vitest';
import { Card, Suit } from './cards';
import { PlayerView } from './view';
import { deriveCounting } from './counting';
import { generateQuizzes, gradeQuiz, nextStreak, shouldPromote } from './scaffolding';

const C = (suit: Suit, value: number): Card => ({ suit, value });

function mkView(p: Partial<PlayerView> & { played?: Card[] }): PlayerView {
  const played = p.played ?? [];
  return {
    me: 'me', myHand: p.myHand ?? [],
    seats: [
      { player: 'me', isBot: false, connected: true, handCount: 3, tricksWon: 0, isCommander: true, tasks: [], communication: [] },
      { player: 'bot-1', isBot: true, connected: true, handCount: 3, tricksWon: 0, isCommander: false, tasks: [], communication: [] },
      { player: 'bot-2', isBot: true, connected: true, handCount: 3, tricksWon: 0, isCommander: false, tasks: [], communication: [] },
    ],
    missionId: 1, attemptNumber: 1, phase: 'trick-in-progress',
    currentTrick: p.currentTrick ?? { leader: 'bot-1', plays: [] },
    trickHistory: p.trickHistory ?? (played.length
      ? [{ leader: 'me', winner: 'me', plays: played.map((card, i) => ({ player: ['me', 'bot-1', 'bot-2'][i % 3]!, card })) }]
      : undefined),
    objectives: [], communicationPolicy: 'normal', distressActive: false, outcome: 'in-progress',
  };
}

describe('generateQuizzes', () => {
  it('always asks the rocket count with the derived answer', () => {
    const view = mkView({ myHand: [C('rocket', 1)] });
    const cs = deriveCounting(view);
    const qs = generateQuizzes(cs, view);
    const rocket = qs.find((q) => q.concept === 'rockets');
    expect(rocket).toBeDefined();
    expect(rocket!.kind).toBe('count');
    expect(rocket!.correct).toEqual([String(cs.rockets.remaining)]); // 3
  });

  it('asks which held cards are masters (multiselect over my hand)', () => {
    const played = [C('green', 8), C('green', 9), ...[1, 2, 3, 4].map((v) => C('rocket', v))];
    const view = mkView({ myHand: [C('green', 7), C('blue', 2)], played });
    const cs = deriveCounting(view);
    const q = generateQuizzes(cs, view).find((x) => x.concept === 'masters')!;
    expect(q.options).toContain('green-7');
    expect(q.correct).toEqual(['green-7']);
  });

  it('asks opponent voids only after a trick has been played', () => {
    const fresh = generateQuizzes(deriveCounting(mkView({ myHand: [C('blue', 1)] })), mkView({ myHand: [C('blue', 1)] }));
    expect(fresh.some((q) => q.concept.startsWith('voids'))).toBe(false);

    const view = mkView({
      trickHistory: [{ leader: 'bot-1', winner: 'me', plays: [
        { player: 'bot-1', card: C('blue', 5) },
        { player: 'bot-2', card: C('green', 3) }, // bot-2 void in blue
        { player: 'me', card: C('blue', 9) },
      ] }],
    });
    const q = generateQuizzes(deriveCounting(view), view).find((x) => x.concept === 'voids:bot-2')!;
    expect(q.correct).toEqual(['blue']);
  });
});

describe('gradeQuiz', () => {
  it('grades multiselect order-independently', () => {
    const q = { id: 'x', concept: 'voids:bot-1', kind: 'multiselect' as const, prompt: '', options: [], correct: ['blue', 'green'] };
    expect(gradeQuiz(q, ['green', 'blue']).correct).toBe(true);
    expect(gradeQuiz(q, ['blue']).correct).toBe(false);
  });
  it('grades a count answer', () => {
    const q = { id: 'r', concept: 'rockets', kind: 'count' as const, prompt: '', correct: ['2'] };
    expect(gradeQuiz(q, ['2']).correct).toBe(true);
    expect(gradeQuiz(q, ['3']).correct).toBe(false);
  });
});

describe('fade', () => {
  it('streaks on correct, resets on wrong, promotes at threshold', () => {
    expect(nextStreak(1, true)).toBe(2);
    expect(nextStreak(3, false)).toBe(0);
    expect(shouldPromote(2, 2)).toBe(true);
    expect(shouldPromote(1, 2)).toBe(false);
  });
});
