import { createGame, GameState } from './state';
import { assignTask, beginTricks } from './assign';
import { applyPlay } from './play';
import { evaluateOutcome } from './outcome';
import { Card } from './cards';

const P = ['p0', 'p1', 'p2'];

// 1트릭짜리 미니 미션: 각자 카드 1장, p0의 태스크 pink1
function oneTrickGame(): GameState {
  const g = createGame({ players: P, missionId: 1, seed: 1 });
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
  return beginTricks(assignTask(s, 'p0', { suit: 'pink', value: 1 }));
}

test('mission is won when every task is fulfilled and all hands are empty', () => {
  let s = oneTrickGame();
  s = applyPlay(s, 'p0', { suit: 'pink', value: 9 });
  s = applyPlay(s, 'p1', { suit: 'pink', value: 5 });
  s = applyPlay(s, 'p2', { suit: 'pink', value: 1 });
  s = evaluateOutcome(s);
  expect(s.outcome).toBe('won');
  expect(s.phase).toBe('mission-result');
});

test('evaluateOutcome leaves an in-progress mission untouched', () => {
  const s = oneTrickGame();
  expect(evaluateOutcome(s).outcome).toBe('in-progress');
  expect(evaluateOutcome(s).phase).toBe('trick-in-progress');
});
