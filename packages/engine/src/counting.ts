import { Card, Color, COLORS, Suit } from './cards';
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

export function deriveCounting(view: PlayerView): CountingState {
  return {
    remaining: remainingByColor(view),
    rockets: rocketState(view),
    voids: detectVoids(view),
    masters: [],
    reconstructed: {},
    perfectInfo: false,
  };
}
