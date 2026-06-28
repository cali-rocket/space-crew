import { createGame, GameState, CommunicationPolicy } from './state';
import { beginTricks } from './assign';
import { communicate } from './comm';
import { applyPlay } from './play';
import { Card } from './cards';

const P = ['p0', 'p1', 'p2'];
const c = (suit: Card['suit'], v: number): Card => ({ suit, value: v });

function preTrick(policy: CommunicationPolicy = 'normal', extra: Partial<GameState> = {}): GameState {
  const g = createGame({ players: P, missionId: 1, seed: 1, communicationPolicy: policy });
  return {
    ...g,
    commander: 'p0',
    phase: 'trick-in-progress',
    currentTrick: { leader: 'p0', plays: [] },
    hands: { p0: [c('pink', 9), c('pink', 4)], p1: [c('blue', 2)], p2: [c('green', 3)] },
    ...extra,
  };
}

test('normal: truthful highest is accepted and marks commUsed', () => {
  const s = communicate(preTrick(), 'p0', c('pink', 9), 'highest');
  expect(s.communication).toEqual([{ player: 'p0', card: c('pink', 9), token: 'highest' }]);
  expect(s.commUsed.p0).toBe(true);
});

test('normal: a false token is rejected', () => {
  expect(() => communicate(preTrick(), 'p0', c('pink', 9), 'lowest')).toThrow(/truth|classif|invalid/i);
});

test('rocket cannot be communicated', () => {
  const s = preTrick('normal', { hands: { p0: [c('rocket', 2)], p1: [c('blue', 2)], p2: [c('green', 3)] } });
  expect(() => communicate(s, 'p0', c('rocket', 2), null)).toThrow(/rocket/i);
});

test('cannot communicate twice in one attempt', () => {
  let s = communicate(preTrick(), 'p0', c('pink', 9), 'highest');
  expect(() => communicate(s, 'p0', c('pink', 4), 'lowest')).toThrow(/already|once/i);
});

test('cannot communicate mid-trick (a card already played)', () => {
  let s = preTrick();
  s = applyPlay(s, 'p0', c('pink', 9));
  expect(() => communicate(s, 'p1', c('blue', 2), 'only')).toThrow(/before a trick|mid-trick|not allowed/i);
});

test('dead-zone: token must be null but card must still be classifiable', () => {
  const s = preTrick('dead-zone');
  expect(communicate(s, 'p0', c('pink', 9), null).communication[0]!.token).toBeNull();
  expect(() => communicate(s, 'p0', c('pink', 9), 'highest')).toThrow(/dead.?zone|intuition|null/i);
});

test('disruption: blocked until the nth trick', () => {
  const s = preTrick({ noCommUntilTrick: 2 }); // trickHistory.length === 0 → blocked
  expect(() => communicate(s, 'p0', c('pink', 9), 'highest')).toThrow(/disrupt|blocked|trick/i);
  const s2 = { ...s, trickHistory: [{ leader: 'p0', plays: [], winner: 'p0' }] }; // length 1 → allowed
  expect(communicate(s2, 'p0', c('pink', 9), 'highest').commUsed.p0).toBe(true);
});

test('oneMemberNoComm: the appointed player cannot communicate', () => {
  const s = preTrick({ oneMemberNoComm: true }, { appointedNoCommPlayer: 'p0' });
  expect(() => communicate(s, 'p0', c('pink', 9), 'highest')).toThrow(/not allowed|appointed|cannot/i);
  expect(communicate(s, 'p1', c('blue', 2), 'only').commUsed.p1).toBe(true);
});
