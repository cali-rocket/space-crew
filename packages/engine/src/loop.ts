import { createGame, GameState } from './state';

export function restartAttempt(state: GameState, seed: number): GameState {
  return createGame({
    players: state.players,
    missionId: state.missionId,
    seed,
    attemptNumber: state.attemptNumber + 1,
  });
}

export function advanceMission(state: GameState, seed: number): GameState {
  return createGame({
    players: state.players,
    missionId: state.missionId + 1,
    seed,
    attemptNumber: 1,
  });
}
