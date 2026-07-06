import { Card, Color, COLORS, Suit, makeDeck, cardKey } from './cards';
import { PlayerId } from './state';
import { PlayerView } from './view';

/**
 * Everything a disciplined card-counter can derive from PUBLIC information only
 * (played cards, tasks, communication, own hand, hand counts). Never reads hidden
 * hands — that is the reveal path (reveal.ts), kept separate on purpose.
 */
export interface CountingState {
  /** Per colour, the values 1–9 not yet seen and not in my own hand. */
  remaining: Record<Color, number[]>;
  /** Trump tracking. `remaining` = rockets outstanding among opponents (4 − played − mine). */
  rockets: { played: number[]; remaining: number };
  /** Suits each player is provably void in (failed to follow). */
  voids: Record<PlayerId, Suit[]>;
  /** Cards in MY hand that are guaranteed winners (conservative under-claim). Filled in Task 3. */
  masters: Card[];
  /** Opponent cards forced by elimination. Filled in Task 3. */
  reconstructed: Record<PlayerId, Card[]>;
  /** True once every hidden hand is fully reconstructed. Filled in Task 3. */
  perfectInfo: boolean;
}

function allPlays(view: PlayerView): { player: PlayerId; card: Card }[] {
  const hist = (view.trickHistory ?? []).flatMap((t) => t.plays);
  return [...hist, ...view.currentTrick.plays];
}

/** Every card that has hit the table so far (completed tricks + current trick). */
export function playedCards(view: PlayerView): Card[] {
  return allPlays(view).map((p) => p.card);
}

export function remainingByColor(view: PlayerView): Record<Color, number[]> {
  const played = playedCards(view);
  const out = {} as Record<Color, number[]>;
  for (const color of COLORS) {
    const gone = new Set<number>();
    for (const c of played) if (c.suit === color) gone.add(c.value);
    for (const c of view.myHand) if (c.suit === color) gone.add(c.value);
    const vals: number[] = [];
    for (let v = 1; v <= 9; v++) if (!gone.has(v)) vals.push(v);
    out[color] = vals;
  }
  return out;
}

export function rocketState(view: PlayerView): { played: number[]; remaining: number } {
  const played = playedCards(view)
    .filter((c) => c.suit === 'rocket')
    .map((c) => c.value)
    .sort((a, b) => a - b);
  const mine = view.myHand.filter((c) => c.suit === 'rocket').length;
  return { played, remaining: Math.max(0, 4 - played.length - mine) };
}

export function detectVoids(view: PlayerView): Record<PlayerId, Suit[]> {
  const voids: Record<PlayerId, Set<Suit>> = {};
  for (const s of view.seats) voids[s.player] = new Set();

  const scan = (plays: { player: PlayerId; card: Card }[]) => {
    if (plays.length === 0) return;
    const lead = plays[0]!.card.suit;
    for (const p of plays) {
      if (p.card.suit !== lead) voids[p.player]?.add(lead);
    }
  };
  for (const t of view.trickHistory ?? []) scan(t.plays);
  scan(view.currentTrick.plays);

  const out: Record<PlayerId, Suit[]> = {};
  for (const player of Object.keys(voids)) out[player] = [...voids[player]!];
  return out;
}

/** Cards not yet seen (not played, not in my hand) — i.e. held by the two opponents. */
export function unseenCards(view: PlayerView): Card[] {
  const seen = new Set<string>();
  for (const c of playedCards(view)) seen.add(cardKey(c));
  for (const c of view.myHand) seen.add(cardKey(c));
  return makeDeck().filter((c) => !seen.has(cardKey(c)));
}

/**
 * Force opponent cards by void + hand-size elimination (standard 3-player: exactly two
 * opponents). Only emits cards that are PROVABLY in a given hand — never a guess. Anchored
 * on exact remaining hand counts so a full hand pushes the rest to the other opponent.
 */
export function reconstructThirdHand(view: PlayerView, voids: Record<PlayerId, Suit[]>): Record<PlayerId, Card[]> {
  const opps = view.seats.filter((s) => s.player !== view.me);
  if (opps.length !== 2) return {};
  const [a, b] = opps as [(typeof opps)[number], (typeof opps)[number]];
  const voidA = new Set(voids[a.player] ?? []);
  const voidB = new Set(voids[b.player] ?? []);

  const forced: Record<PlayerId, Card[]> = { [a.player]: [], [b.player]: [] };
  const unknown: Card[] = [];
  for (const c of unseenCards(view)) {
    const aCan = !voidA.has(c.suit);
    const bCan = !voidB.has(c.suit);
    if (aCan && !bCan) forced[a.player]!.push(c);
    else if (bCan && !aCan) forced[b.player]!.push(c);
    else unknown.push(c); // both possible (or both void → inconsistent) → leave unresolved
  }
  // Hand-size forcing: a full hand pushes the remaining unknowns to the other opponent.
  if (forced[a.player]!.length === a.handCount && unknown.length) {
    forced[b.player]!.push(...unknown);
    unknown.length = 0;
  } else if (forced[b.player]!.length === b.handCount && unknown.length) {
    forced[a.player]!.push(...unknown);
    unknown.length = 0;
  }

  const out: Record<PlayerId, Card[]> = {};
  if (forced[a.player]!.length) out[a.player] = forced[a.player]!;
  if (forced[b.player]!.length) out[b.player] = forced[b.player]!;
  return out;
}

/**
 * Cards in MY hand guaranteed to win if I lead them. Conservative under-claim — never
 * falsely claims a master:
 *  - rocket v: master iff no higher rocket is outstanding (rocket beats everything).
 *  - colour c (suit S): master iff no higher S is outstanding AND (no rockets outstanding
 *    OR both opponents are PROVEN to hold S — so they must follow and cannot trump).
 */
export function computeMasters(
  view: PlayerView,
  remaining: Record<Color, number[]>,
  rockets: { remaining: number },
  reconstructed: Record<PlayerId, Card[]>,
): Card[] {
  const myRocketVals = view.myHand.filter((c) => c.suit === 'rocket').map((c) => c.value);
  const outstandingRockets = [1, 2, 3, 4].filter(
    (v) => !rocketPlayed(view).includes(v) && !myRocketVals.includes(v),
  );
  const opps = view.seats.filter((s) => s.player !== view.me);
  const masters: Card[] = [];
  for (const c of view.myHand) {
    if (c.suit === 'rocket') {
      if (!outstandingRockets.some((v) => v > c.value)) masters.push(c);
      continue;
    }
    const color = c.suit as Color;
    if (remaining[color].some((v) => v > c.value)) continue; // a higher one is still out
    const bothHoldSuit = opps.every((o) => (reconstructed[o.player] ?? []).some((rc) => rc.suit === color));
    if (rockets.remaining === 0 || bothHoldSuit) masters.push(c);
  }
  return masters;
}

function rocketPlayed(view: PlayerView): number[] {
  return playedCards(view).filter((c) => c.suit === 'rocket').map((c) => c.value);
}

export function deriveCounting(view: PlayerView): CountingState {
  const remaining = remainingByColor(view);
  const rockets = rocketState(view);
  const voids = detectVoids(view);
  const reconstructed = reconstructThirdHand(view, voids);
  const masters = computeMasters(view, remaining, rockets, reconstructed);
  const opps = view.seats.filter((s) => s.player !== view.me);
  const perfectInfo =
    opps.length === 2 && opps.every((o) => (reconstructed[o.player] ?? []).length === o.handCount);
  return { remaining, rockets, voids, masters, reconstructed, perfectInfo };
}
