import { Card } from './cards';
import { Play, Trick } from './trick';
import { dealHands, findCommander } from './deal';

export type PlayerId = string;
export type Phase = 'task-assignment' | 'trick-in-progress' | 'mission-result';

export interface TaskAssignment {
  card: Card;
  owner: PlayerId;
  fulfilled: boolean;
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
}

export function createGame(args: {
  players: PlayerId[];
  missionId: number;
  seed: number;
  attemptNumber?: number;
}): GameState {
  const { players, missionId, seed, attemptNumber = 1 } = args;
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
  };
}
