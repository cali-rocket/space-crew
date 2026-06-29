import { BasicBot } from './bot';
import { PlayerView } from './view';
import { Card } from './cards';
const C = (s: Card['suit'], v: number): Card => ({ suit: s, value: v });
const baseView = (over: Partial<PlayerView>): PlayerView => ({
  me: 'p0', myHand: [], seats: [], missionId: 1, attemptNumber: 1, phase: 'trick-in-progress',
  currentTrick: { leader: 'p0', plays: [] }, objectives: [], communicationPolicy: 'normal', distressActive: false, outcome: 'in-progress', ...over,
});

test('chooseTask picks the first pool card deterministically', () => {
  expect(BasicBot.chooseTask(baseView({}), [C('pink', 3), C('blue', 1)])).toEqual(C('pink', 3));
});
test('playCard plays a legal card that matches my own task if possible', () => {
  const v = baseView({ me: 'p0', seats: [{ player: 'p0', isBot: true, connected: true, handCount: 2, tricksWon: 0, isCommander: false, tasks: [{ card: C('blue', 5), owner: 'p0', fulfilled: false }], communication: [] }] });
  const legal = [C('green', 2), C('blue', 5)];
  expect(BasicBot.playCard(v, legal)).toEqual(C('blue', 5));
});
test('playCard otherwise plays the lowest-value legal card', () => {
  const v = baseView({ seats: [{ player: 'p0', isBot: true, connected: true, handCount: 2, tricksWon: 0, isCommander: false, tasks: [], communication: [] }] });
  expect(BasicBot.playCard(v, [C('green', 8), C('blue', 2)])).toEqual(C('blue', 2));
});
test('decideCommunication is always null', () => { expect(BasicBot.decideCommunication(baseView({}))).toBeNull(); });
