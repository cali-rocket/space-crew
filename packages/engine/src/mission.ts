import { createGame, GameState, PlayerId, OrderToken, CommunicationPolicy, ConstraintDef } from './state';

export interface MissionDef {
  id: number;
  sourceText: string;
  logbookPage: number;
  taskCount: number;
  orderTokens?: OrderToken[];
  communication?: CommunicationPolicy;
  constraints?: ConstraintDef[];
  assignment?: 'open-pick' | 'commander-decision' | 'commander-distribution';
  optionalHandover?: boolean;
}

export function createMission(
  def: MissionDef,
  args: { players: PlayerId[]; seed: number; attemptNumber?: number },
): GameState {
  return createGame({
    players: args.players,
    missionId: def.id,
    seed: args.seed,
    attemptNumber: args.attemptNumber,
    communicationPolicy: def.communication ?? 'normal',
    constraints: def.constraints ?? [],
  });
}
