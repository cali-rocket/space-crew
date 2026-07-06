import { useMemo } from 'react';
import { deriveCounting, evaluateCoach } from '@space-crew/engine';
import type { PlayerView, CountingState, Advice } from '@space-crew/engine';

const ck = (c: { suit: string; value: number }) => `${c.suit}${c.value}`;

/** Content hash so counting re-derives on actual card changes, not just trick-count. */
export function hashView(view: PlayerView): string {
  const hist = (view.trickHistory ?? []).map((t) => t.plays.map((p) => ck(p.card)).join('')).join('|');
  const trick = view.currentTrick.plays.map((p) => ck(p.card)).join(',');
  const hand = view.myHand.map(ck).join(',');
  const counts = view.seats.map((s) => `${s.player}:${s.handCount}`).join(',');
  return `${hist}#${trick}#${hand}#${counts}`;
}

/** Derives the (public-info) counting state + coach advice for the overlays, memoized. */
export function usePracticeState(view: PlayerView): { counting: CountingState; advice: Advice[] } {
  const key = hashView(view);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const counting = useMemo(() => deriveCounting(view), [key]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const advice = useMemo(() => evaluateCoach(counting, view), [key]);
  return { counting, advice };
}
