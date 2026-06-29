import { createGame, GameState } from './state';
import { toPlayerView, legalMovesFromView } from './view';
import { Card } from './cards';

const P = ['p0', 'p1', 'p2'];
const C = (s: Card['suit'], v: number): Card => ({ suit: s, value: v });
function game(): GameState {
  return { ...createGame({ players: P, missionId: 1, seed: 3 }), commander: 'p0',
    hands: { p0: [C('pink', 9), C('blue', 2)], p1: [C('green', 1)], p2: [C('yellow', 5)] } };
}

test('toPlayerView exposes only the viewer hand; others are counts; no rngSeed', () => {
  const v = toPlayerView(game(), 'p0');
  expect(v.myHand).toEqual([C('pink', 9), C('blue', 2)]);
  const p1 = v.seats.find((s) => s.player === 'p1')!;
  expect(p1.handCount).toBe(1);
  expect((p1 as unknown as Record<string, unknown>).hand).toBeUndefined();
  expect(JSON.stringify(v)).not.toContain('rngSeed');
});

test('legalMovesFromView follows the lead suit', () => {
  const s: GameState = { ...game(), phase: 'trick-in-progress',
    currentTrick: { leader: 'p1', plays: [{ player: 'p1', card: C('blue', 7) }] } };
  // viewer p0 has blue 2 → must follow blue
  const v = toPlayerView(s, 'p0');
  expect(legalMovesFromView(v)).toEqual([C('blue', 2)]);
});

test('toPlayerView includes legalMoves when it is the viewer turn', () => {
  const s: GameState = { ...game(), phase: 'trick-in-progress', currentTrick: { leader: 'p0', plays: [] } };
  const v = toPlayerView(s, 'p0');
  expect(v.legalMoves).toEqual([C('pink', 9), C('blue', 2)]); // empty trick → any
});
