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
    const me = view.me;
    const trick = view.currentTrick;
    const plays = trick.plays;
    const lead = trick.leadSuit;
    const seatCount = view.seats.length;

    // All task cards are public (face-up on the table). Know friend/foe tasks.
    const openTasks = view.seats.flatMap((s) => s.tasks.filter((t) => !t.fulfilled));
    const isMyTask = (c: Card) => openTasks.some((t) => t.owner === me && sameCard(t.card, c));
    const isOppTask = (c: Card) => openTasks.some((t) => t.owner !== me && sameCard(t.card, c));
    const lowest = (arr: Card[]) => arr.reduce((lo, m) => (m.value < lo.value ? m : lo));

    // Would `c` currently beat every card already played this trick? (leading = trivially yes)
    const winsSoFar = (c: Card): boolean => {
      if (plays.length === 0) return true;
      const rockets = plays.filter((p) => p.card.suit === 'rocket');
      const contenders = rockets.length ? rockets : plays.filter((p) => p.card.suit === lead);
      const best = contenders.reduce((b, p) => (p.card.value > b.card.value ? p : b)).card;
      if (c.suit === 'rocket') return best.suit !== 'rocket' || c.value > best.value;
      if (best.suit === 'rocket') return false;
      if (c.suit !== lead) return false;
      return c.value > best.value;
    };
    // A move that does NOT win-so-far is guaranteed to lose the trick (later cards
    // can't make a currently-losing card win).
    const loses = legalMoves.filter((m) => !winsSoFar(m));
    const amLast = plays.length === seatCount - 1;
    const oppTaskInTrick = plays.some((p) => isOppTask(p.card));

    // 1) An opponent's task card is already in this trick — do NOT win it (that would
    //    capture their task = immediate loss). Dump a low losing card.
    if (oppTaskInTrick) {
      const safe = loses.filter((m) => !isMyTask(m));
      if (safe.length) return lowest(safe);
      if (loses.length) return lowest(loses);
      return lowest(legalMoves); // forced to win it — unavoidable
    }

    // 2) I can guarantee winning my own task right now (last to play and it beats the trick).
    if (amLast) {
      const myTaskWin = legalMoves.filter((m) => isMyTask(m) && winsSoFar(m));
      if (myTaskWin.length) return lowest(myTaskWin);
    }

    // 2.5) Leading with an essentially unbeatable own task (a colour 9 or the rocket 4)
    //      — lead it to win and fulfill it.
    if (plays.length === 0) {
      const sureWin = legalMoves.filter(
        (m) => isMyTask(m) && ((m.suit !== 'rocket' && m.value === 9) || (m.suit === 'rocket' && m.value === 4)),
      );
      if (sureWin.length) return sureWin[0]!;
    }

    // 3) Otherwise play a low card that neither wins nor dumps a task card. Never
    //    voluntarily play my own task card into a trick I won't clearly win.
    const safeLose = loses.filter((m) => !isMyTask(m) && !isOppTask(m));
    if (safeLose.length) return lowest(safeLose);
    const anyLose = loses.filter((m) => !isMyTask(m));
    if (anyLose.length) return lowest(anyLose);
    const nonTask = legalMoves.filter((m) => !isMyTask(m));
    if (nonTask.length) return lowest(nonTask);
    return lowest(legalMoves);
  },
  decideCommunication() { return null; },
  answerCommander(_view, kind) { return kind === 'good-bad' ? 'good' : 'yes'; },
};
