import { createGame, GameState, CompletedTrick } from './state';
import { evaluateConstraint, constraintsViolated, constraintsAllSatisfied } from './constraints';
import { Card } from './cards';
import { describe, test, expect } from 'vitest';

const P = ['p0', 'p1', 'p2'];
const C = (s: Card['suit'], v: number): Card => ({ suit: s, value: v });
const trick = (winner: string, cards: [string, Card][]): CompletedTrick => ({
  leader: cards[0]![0],
  winner,
  plays: cards.map(([player, card]) => ({ player, card })),
});

function withHistory(history: CompletedTrick[], constraints: GameState['constraints'] = []): GameState {
  return { ...createGame({ players: P, missionId: 1, seed: 1, constraints }), trickHistory: history };
}

describe('constraints', () => {
  test('forbid-win-value: violated when a trick is won by that value', () => {
    const s = withHistory([trick('p0', [['p0', C('pink', 9)], ['p1', C('pink', 2)], ['p2', C('blue', 1)]])]);
    expect(evaluateConstraint({ kind: 'forbid-win-value', value: 9 }, s)).toBe('violated');
  });

  test('forbid-win-value: satisfied when no trick won by that value (even if present off-suit)', () => {
    // pink lead, p2 dumps green 9 but p0 wins with pink 5 → 9 is in trick but not the winning card
    const s = withHistory([trick('p0', [['p0', C('pink', 5)], ['p1', C('pink', 2)], ['p2', C('green', 9)]])]);
    expect(evaluateConstraint({ kind: 'forbid-win-value', value: 9 }, s)).toBe('satisfied');
  });

  test('constraintsViolated / allSatisfied aggregate over state.constraints', () => {
    const bad = withHistory(
      [trick('p0', [['p0', C('pink', 9)], ['p1', C('pink', 2)], ['p2', C('blue', 1)]])],
      [{ kind: 'forbid-win-value', value: 9 }],
    );
    expect(constraintsViolated(bad)).toBe(true);
    const ok = withHistory([], [{ kind: 'forbid-win-value', value: 9 }]);
    expect(constraintsViolated(ok)).toBe(false);
    expect(constraintsAllSatisfied(ok)).toBe(true); // prohibition with no violation = satisfied
  });
});
