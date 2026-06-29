import { Card, sameCard } from './cards';
import { PlayerView } from './view';

export interface BotStrategy {
  chooseTask(view: PlayerView, pool: Card[]): Card;
  playCard(view: PlayerView, legalMoves: Card[]): Card;
  decideCommunication(view: PlayerView): null;
  answerCommander(view: PlayerView, kind: 'yes-no' | 'good-bad'): 'yes' | 'no' | 'good' | 'bad';
}

export const BasicBot: BotStrategy = {
  chooseTask(_view, pool) {
    if (pool.length === 0) throw new Error('empty task pool');
    return pool[0]!;
  },
  playCard(view, legalMoves) {
    if (legalMoves.length === 0) throw new Error('no legal moves');
    const myTasks = view.seats.find((s) => s.player === view.me)?.tasks ?? [];
    const taskHit = legalMoves.find((m) => myTasks.some((t) => !t.fulfilled && sameCard(t.card, m)));
    if (taskHit) return taskHit;
    return legalMoves.reduce((lo, m) => (m.value < lo.value ? m : lo));
  },
  decideCommunication() { return null; },
  answerCommander(_view, kind) { return kind === 'good-bad' ? 'good' : 'yes'; },
};
