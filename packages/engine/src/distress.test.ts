import { createGame, GameState } from './state';
import { setDistress, submitDistressCard } from './distress';
import { Card } from './cards';

const P = ['p0', 'p1', 'p2'];
const c = (suit: Card['suit'], v: number): Card => ({ suit, value: v });

function base(): GameState {
  const g = createGame({ players: P, missionId: 1, seed: 1 });
  return {
    ...g,
    hands: { p0: [c('pink', 1), c('pink', 2)], p1: [c('blue', 1), c('blue', 2)], p2: [c('green', 1), c('green', 2)] },
  };
}

test('setDistress activates with a direction', () => {
  const s = setDistress(base(), true, 'right');
  expect(s.distressActive).toBe(true);
  expect(s.distressDirection).toBe('right');
});

test('rocket cannot be submitted for distress', () => {
  const s = setDistress({ ...base(), hands: { ...base().hands, p0: [c('rocket', 1)] } }, true, 'right');
  expect(() => submitDistressCard(s, 'p0', c('rocket', 1))).toThrow(/rocket/i);
});

test('cards are passed only after all three submit (right = next seat)', () => {
  let s = setDistress(base(), true, 'right');
  s = submitDistressCard(s, 'p0', c('pink', 1));
  s = submitDistressCard(s, 'p1', c('blue', 1));
  expect(s.distressCommits && Object.keys(s.distressCommits).length).toBe(2);
  s = submitDistressCard(s, 'p2', c('green', 1));
  // right: p0→p1, p1→p2, p2→p0
  expect(s.hands.p1).toContainEqual(c('pink', 1));
  expect(s.hands.p2).toContainEqual(c('blue', 1));
  expect(s.hands.p0).toContainEqual(c('green', 1));
  // givers no longer hold the passed card
  expect(s.hands.p0).not.toContainEqual(c('pink', 1));
  expect(s.distressCommits).toBeUndefined();
});
