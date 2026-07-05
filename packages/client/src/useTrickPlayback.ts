import { useState, useEffect, useRef } from 'react';
import type { PlayerView, Suit, PlayerId, Card } from '@space-crew/engine';

const PLAY_MS = 430;    // gap between each card being revealed
const COLLECT_MS = 950; // how long the winner-collection overlay lingers

type Play = { player: PlayerId; card: Card };
export interface Playback {
  plays: Play[];        // cards currently revealed in the trick being shown
  leadSuit?: Suit;
  collecting: { plays: Play[]; winner: PlayerId } | null;
  caughtUp: boolean;    // playback has reached the true state — the human may act
}

/**
 * The server resolves all bot moves at once and sends one batched view. This hook
 * replays the delta card-by-card (with the winner's collection between tricks) so
 * turns visibly rotate. It only drives *display*; game state is untouched.
 */
export function useTrickPlayback(view: PlayerView): Playback {
  const history = view.trickHistory ?? [];
  const current = view.currentTrick.plays;
  const gameKey = `${view.missionId}-${view.attemptNumber}`;

  // shown.t = completed tricks fully shown & collected; shown.p = plays revealed in the active trick
  const [shown, setShown] = useState<{ t: number; p: number }>(() => ({ t: history.length, p: current.length }));
  const [collectIdx, setCollectIdx] = useState<number | null>(null);
  const prevKey = useRef(gameKey);

  useEffect(() => {
    // New game/attempt (or first mount): snap to the current state, don't replay.
    if (prevKey.current !== gameKey) {
      prevKey.current = gameKey;
      setShown({ t: history.length, p: current.length });
      setCollectIdx(null);
      return;
    }
    if (collectIdx !== null) {
      const id = setTimeout(() => { setShown({ t: collectIdx + 1, p: 0 }); setCollectIdx(null); }, COLLECT_MS);
      return () => clearTimeout(id);
    }
    const activeIsHistory = shown.t < history.length;
    const activePlays = activeIsHistory ? history[shown.t]!.plays : current;
    if (shown.p < activePlays.length) {
      const id = setTimeout(() => setShown((s) => ({ t: s.t, p: s.p + 1 })), PLAY_MS);
      return () => clearTimeout(id);
    }
    if (activeIsHistory) setCollectIdx(shown.t); // trick fully shown → collect it
    // else: caught up to the live trick — nothing scheduled
  }, [view, shown, collectIdx, gameKey, history.length, current.length]);

  const collecting = collectIdx !== null && collectIdx < history.length
    ? { plays: history[collectIdx]!.plays, winner: history[collectIdx]!.winner }
    : null;
  const activeIsHistory = shown.t < history.length;
  const activePlays = activeIsHistory ? (history[shown.t]?.plays ?? []) : current;
  const plays = collecting ? [] : activePlays.slice(0, shown.p);
  const caughtUp = collectIdx === null && shown.t >= history.length && shown.p >= current.length;

  return { plays, leadSuit: plays[0]?.card.suit, collecting, caughtUp };
}
