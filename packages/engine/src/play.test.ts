import { createGame, GameState } from './state';
import { assignTask, beginTricks } from './assign';
import { applyPlay, currentPlayer } from './play';
import { Card } from './cards';

const P = ['p0', 'p1', 'p2'];

// 손패를 고정해 결정적으로 트릭을 구성하기 위한 헬퍼
function withHands(base: GameState, hands: Record<string, Card[]>): GameState {
  return { ...base, hands: { ...hands } };
}

function setup(): GameState {
  const g = createGame({ players: P, missionId: 1, seed: 1 });
  // 커맨더를 p0로 고정하고 손패를 직접 지정
  const s: GameState = {
    ...g,
    commander: 'p0',
    currentTrick: { leader: 'p0', plays: [] },
    hands: {
      p0: [{ suit: 'pink', value: 9 }],
      p1: [{ suit: 'pink', value: 5 }],
      p2: [{ suit: 'pink', value: 1 }],
    },
  };
  return s;
}

test('currentPlayer follows seat order from the leader', () => {
  const s = beginTricks(assignTask(setup(), 'p0', { suit: 'pink', value: 1 }));
  expect(currentPlayer(s)).toBe('p0');
});

test('a full trick resolves to the highest follower and starts the next trick from the winner', () => {
  let s = beginTricks(assignTask(setup(), 'p0', { suit: 'pink', value: 1 }));
  s = applyPlay(s, 'p0', { suit: 'pink', value: 9 });
  s = applyPlay(s, 'p1', { suit: 'pink', value: 5 });
  s = applyPlay(s, 'p2', { suit: 'pink', value: 1 });
  expect(s.trickHistory).toHaveLength(1);
  expect(s.trickHistory[0]!.winner).toBe('p0');
  expect(s.currentTrick.leader).toBe('p0');
  expect(s.currentTrick.plays).toEqual([]);
});

test('owner winning their task card marks it fulfilled (and wins if it was the last task)', () => {
  // 1 task, no constraints: fulfilling it completes the mission immediately —
  // remaining cards are not played out.
  const g = createGame({ players: P, missionId: 1, seed: 1 });
  let s: GameState = {
    ...g,
    commander: 'p0',
    currentTrick: { leader: 'p0', plays: [] },
    hands: {
      p0: [{ suit: 'pink', value: 9 }, { suit: 'green', value: 1 }, { suit: 'blue', value: 1 }],
      p1: [{ suit: 'pink', value: 5 }, { suit: 'green', value: 2 }, { suit: 'blue', value: 2 }],
      p2: [{ suit: 'pink', value: 1 }, { suit: 'green', value: 3 }, { suit: 'blue', value: 3 }],
    },
  };
  s = beginTricks(assignTask(s, 'p0', { suit: 'pink', value: 1 }));
  s = applyPlay(s, 'p0', { suit: 'pink', value: 9 });
  s = applyPlay(s, 'p1', { suit: 'pink', value: 5 });
  s = applyPlay(s, 'p2', { suit: 'pink', value: 1 });
  expect(s.tasks[0]!.fulfilled).toBe(true);
  expect(s.outcome).toBe('won');
});

test('a non-owner winning a task card loses immediately', () => {
  // 태스크 pink1을 p1에게 줬는데 p0가 그 트릭을 따면 패배
  let s = beginTricks(assignTask(setup(), 'p1', { suit: 'pink', value: 1 }));
  s = applyPlay(s, 'p0', { suit: 'pink', value: 9 });
  s = applyPlay(s, 'p1', { suit: 'pink', value: 5 });
  s = applyPlay(s, 'p2', { suit: 'pink', value: 1 });
  expect(s.outcome).toBe('lost');
});

test('applyPlay rejects an out-of-turn play', () => {
  const s = beginTricks(assignTask(setup(), 'p0', { suit: 'pink', value: 1 }));
  expect(() => applyPlay(s, 'p1', { suit: 'pink', value: 5 })).toThrow(/not .* turn/i);
});

test('applyPlay rejects an illegal (non-following) card', () => {
  let s = beginTricks(assignTask(setup(), 'p0', { suit: 'pink', value: 1 }));
  s = { ...s, hands: { ...s.hands, p1: [{ suit: 'green', value: 2 }, { suit: 'pink', value: 5 }] } };
  s = applyPlay(s, 'p0', { suit: 'pink', value: 9 });
  expect(() => applyPlay(s, 'p1', { suit: 'green', value: 2 })).toThrow(/must follow|illegal/i);
});
