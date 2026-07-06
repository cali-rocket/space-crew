import { Card, cardKey } from './cards';
import { GameState, PlayerId } from './state';
import { toPlayerView } from './view';
import { CountingState, deriveCounting } from './counting';

/**
 * PRACTICE-ONLY ground-truth projection. This is the ONLY function that reads hidden
 * opponent hands out of the authoritative GameState. It is imported solely by the
 * client-local practice driver and MUST NOT be referenced anywhere under packages/server
 * (enforced by safety.test.ts). Real multiplayer games never construct this — the leak
 * is impossible by absence of the code path, not by a runtime flag. The `__practiceOnly`
 * brand also lets the type system reject a reveal object on a real-game render path.
 */
export interface RevealView {
  __practiceOnly: true;
  /** The actual hidden hands of every non-viewer. */
  opponentHands: Record<PlayerId, Card[]>;
  /** Counting state as it REALLY is (reconstruction = actual hands). */
  truth: CountingState;
  /** Counting state the learner could deduce from PUBLIC info only. */
  myDerived: CountingState;
  /** Opponent cards the public-only reconstruction did not pin down (what reveal adds). */
  diffs: { player: PlayerId; card: Card }[];
}

export function toRevealView(state: GameState, viewer: PlayerId): RevealView {
  const opponentHands: Record<PlayerId, Card[]> = {};
  for (const p of state.players) {
    if (p !== viewer) opponentHands[p] = [...(state.hands[p] ?? [])];
  }
  const myDerived = deriveCounting(toPlayerView(state, viewer));
  const truth: CountingState = { ...myDerived, reconstructed: opponentHands, perfectInfo: true };

  const diffs: { player: PlayerId; card: Card }[] = [];
  for (const p of Object.keys(opponentHands)) {
    const known = new Set((myDerived.reconstructed[p] ?? []).map(cardKey));
    for (const c of opponentHands[p]!) {
      if (!known.has(cardKey(c))) diffs.push({ player: p, card: c });
    }
  }
  return { __practiceOnly: true, opponentHands, truth, myDerived, diffs };
}
