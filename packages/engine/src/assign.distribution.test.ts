import { createGame, GameState } from './state';
import { assignByDistribution } from './assign';
import { Card } from './cards';

const P = ['p0', 'p1', 'p2'];
const C = (s: Card['suit'], v: number): Card => ({ suit: s, value: v });
const g = (): GameState => ({ ...createGame({ players: P, missionId: 24, seed: 1 }), commander: 'p0' });

test('distributes tasks to chosen owners including commander', () => {
  const s = assignByDistribution(g(), [
    { spec: { card: C('pink', 1) }, owner: 'p0' },
    { spec: { card: C('blue', 2) }, owner: 'p1' },
    { spec: { card: C('green', 3) }, owner: 'p2' },
  ]);
  expect(s.tasks.map((t) => t.owner).sort()).toEqual(['p0', 'p1', 'p2']);
});

test('rejects uneven distribution (someone has 2+ more than another)', () => {
  expect(() =>
    assignByDistribution(g(), [
      { spec: { card: C('pink', 1) }, owner: 'p0' },
      { spec: { card: C('blue', 2) }, owner: 'p0' },
    ]),
  ).toThrow(/even|균등|distribut/i);
});

test('rejects duplicate task cards', () => {
  expect(() =>
    assignByDistribution(g(), [
      { spec: { card: C('pink', 1) }, owner: 'p0' },
      { spec: { card: C('pink', 1) }, owner: 'p1' },
    ]),
  ).toThrow(/duplicate|already/i);
});
