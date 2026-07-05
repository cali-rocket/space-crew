import { Card, Suit } from './cards';
import { GameState, PlayerId, Phase, TaskAssignment, CommState, ConstraintDef, CommunicationPolicy } from './state';
import { legalMoves as engineLegal, leadSuit, Trick } from './trick';
import { currentPlayer } from './play';

export interface SeatView { player: PlayerId; isBot: boolean; connected: boolean; handCount: number; tricksWon: number; isCommander: boolean; tasks: TaskAssignment[]; communication: CommState[]; }
export interface PlayerView {
  me: PlayerId; myHand: Card[]; seats: SeatView[]; missionId: number; attemptNumber: number; phase: Phase;
  currentTrick: { leader: PlayerId; plays: { player: PlayerId; card: Card }[]; leadSuit?: Suit };
  objectives: ConstraintDef[]; communicationPolicy: CommunicationPolicy; distressActive: boolean; outcome: GameState['outcome']; legalMoves?: Card[]; taskPool?: Card[];
  /** Commander-decision prompt (only present for the commander while a decision is pending). */
  decision?:
    | { kind: 'role'; role: string; candidates: PlayerId[] }
    | { kind: 'all-tasks'; candidates: PlayerId[] }
    | { kind: 'distribute'; candidates: PlayerId[] }
    | { kind: 'appoint-no-comm'; candidates: PlayerId[] }
    | { kind: 'm50-roles'; roles: string[]; candidates: PlayerId[] };
  /** Distress card-pass prompt (only present for a player who must still submit a card). */
  distressPass?: { mustSubmit: boolean };
}

export function toPlayerView(state: GameState, viewer: PlayerId, opts?: { isBot?: Record<PlayerId, boolean>; connected?: Record<PlayerId, boolean> }): PlayerView {
  const tricksWon: Record<PlayerId, number> = Object.fromEntries(state.players.map((p) => [p, 0]));
  for (const t of state.trickHistory) tricksWon[t.winner] = (tricksWon[t.winner] ?? 0) + 1;
  const seats: SeatView[] = state.players.map((p) => ({
    player: p, isBot: opts?.isBot?.[p] ?? false, connected: opts?.connected?.[p] ?? true,
    handCount: (state.hands[p] ?? []).length, tricksWon: tricksWon[p] ?? 0, isCommander: p === state.commander,
    tasks: state.tasks.filter((t) => t.owner === p), communication: state.communication.filter((c) => c.player === p),
  }));
  const view: PlayerView = {
    me: viewer, myHand: [...(state.hands[viewer] ?? [])], seats,
    missionId: state.missionId, attemptNumber: state.attemptNumber, phase: state.phase,
    currentTrick: { leader: state.currentTrick.leader, plays: state.currentTrick.plays.map((p) => ({ ...p })), leadSuit: leadSuit(state.currentTrick as Trick) },
    objectives: state.constraints, communicationPolicy: state.communicationPolicy, distressActive: state.distressActive, outcome: state.outcome,
  };
  if (state.phase === 'trick-in-progress' && state.outcome === 'in-progress' && currentPlayer(state) === viewer) {
    view.legalMoves = engineLegal(state.hands[viewer] ?? [], state.currentTrick);
  }
  return view;
}

export function legalMovesFromView(view: PlayerView): Card[] {
  const lead = view.currentTrick.leadSuit;
  if (lead === undefined) return [...view.myHand];
  const same = view.myHand.filter((c) => c.suit === lead);
  return same.length > 0 ? same : [...view.myHand];
}
