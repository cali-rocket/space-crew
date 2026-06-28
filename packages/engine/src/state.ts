import { Card } from './cards';
import { Play, Trick } from './trick';
import { dealHands, findCommander } from './deal';

export type PlayerId = string;
export type Phase = 'task-assignment' | 'trick-in-progress' | 'mission-result';

export type CommToken = 'highest' | 'only' | 'lowest';
export interface CommState {
  player: PlayerId;
  card: Card;
  token: CommToken | null;
}
export type CommunicationPolicy =
  | 'normal'
  | 'dead-zone'
  | { noCommUntilTrick: number }
  | { oneMemberNoComm: true };
export type OrderToken =
  | { kind: 'absolute'; position: number }
  | { kind: 'last' }
  | { kind: 'relative'; chevrons: number };

export type ConstraintDef =
  | { kind: 'forbid-win-value'; value: number }
  | { kind: 'win-value-count'; value: number; count: number; distinct?: boolean }
  | { kind: 'win-cards'; cards: Card[]; ordered: boolean }
  | { kind: 'player-trick-count'; role: string; count: number; rocketAllowed: boolean }
  | { kind: 'player-exact-tricks'; role: string; tricks: number[] | 'first-last'; exclusive: boolean; rocketAllowed: boolean }
  | { kind: 'balance'; maxDiff: number }
  | { kind: 'task-in-last-trick'; card: Card }
  | { kind: 'trick-partition'; parts: { role: string; range: 'first4' | 'last' | 'middle' }[] }
  | { kind: 'pink-left-sweep' };

export interface TaskAssignment {
  card: Card;
  owner: PlayerId;
  fulfilled: boolean;
  order?: OrderToken;
}

export interface CompletedTrick {
  leader: PlayerId;
  plays: Play[];
  winner: PlayerId;
}

export interface GameState {
  players: PlayerId[];
  commander: PlayerId;
  hands: Record<PlayerId, Card[]>;
  missionId: number;
  attemptNumber: number;
  phase: Phase;
  currentTrick: Trick;
  trickHistory: CompletedTrick[];
  tasks: TaskAssignment[];
  outcome: 'in-progress' | 'won' | 'lost';
  commUsed: Record<PlayerId, boolean>;
  communication: CommState[];
  communicationPolicy: CommunicationPolicy;
  appointedNoCommPlayer?: PlayerId;
  distressActive: boolean;
  distressDirection?: 'left' | 'right';
  distressCommits?: Record<PlayerId, Card>;
  roles: Record<string, PlayerId>;
  constraints: ConstraintDef[];
}

export function createGame(args: {
  players: PlayerId[];
  missionId: number;
  seed: number;
  attemptNumber?: number;
  communicationPolicy?: CommunicationPolicy;
  distressActive?: boolean;
  constraints?: ConstraintDef[];
  roles?: Record<string, PlayerId>;
}): GameState {
  const {
    players,
    missionId,
    seed,
    attemptNumber = 1,
    communicationPolicy = 'normal',
    distressActive = false,
    constraints = [],
    roles = {},
  } = args;
  if (players.length !== 3) throw new Error('exactly 3 players required');
  const dealt = dealHands(seed);
  const hands: Record<PlayerId, Card[]> = {};
  players.forEach((p, seat) => {
    hands[p] = dealt[seat]!;
  });
  const commander = players[findCommander(dealt)]!;
  return {
    players,
    commander,
    hands,
    missionId,
    attemptNumber,
    phase: 'task-assignment',
    currentTrick: { leader: commander, plays: [] },
    trickHistory: [],
    tasks: [],
    outcome: 'in-progress',
    commUsed: Object.fromEntries(players.map((p) => [p, false])),
    communication: [],
    communicationPolicy,
    distressActive,
    roles,
    constraints,
  };
}
