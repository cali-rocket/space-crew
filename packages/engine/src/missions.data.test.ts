import { MISSIONS } from './missions.data';
import { COLORS, Card } from './cards';
import { createMission } from './mission';
import { CompletedTrick } from './state';
import { evaluateConstraint } from './constraints';

test('there are exactly 50 missions, ids 1..50 unique and ordered', () => {
  expect(MISSIONS).toHaveLength(50);
  expect(MISSIONS.map((m) => m.id)).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
});

test('every mission has sourceText, a valid page, and a non-negative taskCount', () => {
  for (const m of MISSIONS) {
    expect(m.sourceText.length).toBeGreaterThan(0);
    expect(m.logbookPage).toBeGreaterThanOrEqual(1);
    expect(m.taskCount).toBeGreaterThanOrEqual(0);
  }
});

test('order tokens, when present, count matches and are well-formed', () => {
  for (const m of MISSIONS) {
    for (const ot of m.orderTokens ?? []) {
      if (ot.kind === 'absolute') expect(ot.position).toBeGreaterThanOrEqual(1);
      if (ot.kind === 'relative') expect(ot.chevrons).toBeGreaterThanOrEqual(1);
    }
  }
});

test('constraint cards reference real suits/values', () => {
  const valid = (c: { suit: string; value: number }) =>
    c.suit === 'rocket'
      ? c.value >= 1 && c.value <= 4
      : (COLORS as readonly string[]).includes(c.suit) && c.value >= 1 && c.value <= 9;
  for (const m of MISSIONS) {
    for (const con of m.constraints ?? []) {
      if (con.kind === 'win-cards') con.cards.forEach((c) => expect(valid(c)).toBe(true));
      if (con.kind === 'task-in-last-trick') expect(valid(con.card)).toBe(true);
    }
  }
});

test('known anchors: M16 forbids winning with 9, M44 is ordered rockets, M50 is a partition', () => {
  const m16 = MISSIONS.find((m) => m.id === 16)!;
  expect(m16.constraints).toContainEqual({ kind: 'forbid-win-value', value: 9 });
  const m44 = MISSIONS.find((m) => m.id === 44)!;
  expect(m44.constraints?.some((c) => c.kind === 'win-cards' && c.ordered)).toBe(true);
  const m50 = MISSIONS.find((m) => m.id === 50)!;
  expect(m50.constraints?.some((c) => c.kind === 'trick-partition')).toBe(true);
});

// --- Scenario tests ---

const P = ['p0', 'p1', 'p2'] as const;
const C = (s: Card['suit'], v: number): Card => ({ suit: s, value: v });
const trick = (winner: string, winCard: Card, others: Card[] = [C('blue', 1), C('green', 1)]): CompletedTrick => ({
  leader: P[0],
  winner,
  plays: [
    { player: winner, card: winCard },
    { player: P[1], card: others[0] ?? C('blue', 1) },
    { player: P[2], card: others[1] ?? C('green', 1) },
  ],
});

test('M1 plain mission: createMission returns a valid initial state', () => {
  const m1 = MISSIONS.find((m) => m.id === 1)!;
  const s = createMission(m1, { players: [...P], seed: 1 });
  expect(s.missionId).toBe(1);
  expect(s.constraints).toEqual([]);
  expect(s.phase).toBe('task-assignment');
  expect(m1.taskCount).toBe(1);
});

test('M16 forbid-9: wins with 9-value card lose, wins without 9 are fine', () => {
  const m16 = MISSIONS.find((m) => m.id === 16)!;
  const def = m16.constraints![0]!;

  const s = createMission(m16, { players: [...P], seed: 2 });
  // Winning with a 9-value card → violated
  const bad = { ...s, trickHistory: [trick('p0', C('pink', 9))] };
  expect(evaluateConstraint(def, bad)).toBe('violated');
  // Winning with a non-9 card → satisfied (constraint is a prohibition)
  const ok = { ...s, trickHistory: [trick('p0', C('pink', 5))] };
  expect(evaluateConstraint(def, ok)).toBe('satisfied');
});
