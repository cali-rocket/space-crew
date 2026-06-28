import { createGame, GameState, CompletedTrick } from './state';
import { evaluateConstraint } from './constraints';
import { Card } from './cards';
const P = ['p0', 'p1', 'p2'];
const tk = (winner: string): CompletedTrick => ({ leader: 'p0', winner, plays: [{ player: winner, card: { suit: 'blue', value: 5 } as Card }] });
const st = (history: CompletedTrick[]): GameState => ({ ...createGame({ players: P, missionId: 1, seed: 1 }), trickHistory: history });

test('balance maxDiff 1: violated when someone leads by 2', () => {
  expect(evaluateConstraint({ kind: 'balance', maxDiff: 1 }, st([tk('p0'), tk('p0')]))).toBe('violated'); // p0:2 p1:0
});
test('balance maxDiff 1: ok when spread within 1', () => {
  expect(evaluateConstraint({ kind: 'balance', maxDiff: 1 }, st([tk('p0'), tk('p1')]))).toBe('pending'); // 1,1,0
});
