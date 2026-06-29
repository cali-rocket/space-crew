import { PlayerId, MissionDef } from '@space-crew/engine';
import { Match, setupMatch, advance } from './controller';

export interface Room {
  code: string;
  hostPlayerId: PlayerId;
  /** Index captured at room creation; used to derive an independent per-room seed. */
  roomIndex: number;
  players: PlayerId[];
  isBot: Record<PlayerId, boolean>;
  connected: Record<PlayerId, boolean>;
  missionId: number;
  match?: Match;
  started: boolean;
}

export function createRoom(code: string, hostId: PlayerId, missionId: number, roomIndex: number): Room {
  return {
    code,
    hostPlayerId: hostId,
    roomIndex,
    players: [hostId, 'bot-1', 'bot-2'],
    isBot: { [hostId]: false, 'bot-1': true, 'bot-2': true },
    connected: { [hostId]: true, 'bot-1': true, 'bot-2': true },
    missionId,
    started: false,
  };
}

export function joinRoom(room: Room, playerId: PlayerId): Room {
  // Replace one bot seat with the human player (only if not started)
  if (room.started) return room;

  const players = [...room.players];
  const botIndex = players.findIndex((p) => room.isBot[p as PlayerId]);
  if (botIndex === -1) return room; // No bot seat available

  players[botIndex] = playerId;
  return {
    ...room,
    players,
    isBot: { ...room.isBot, [playerId]: false },
    connected: { ...room.connected, [playerId]: true },
  };
}

export function startRoom(room: Room, def: MissionDef, seed: number): Room {
  const match = advance(setupMatch(def, room.players as PlayerId[], room.isBot, seed));
  return {
    ...room,
    match,
    started: true,
  };
}
