import { WebSocketServer, WebSocket } from 'ws';
import { createServer, Server as HttpServer } from 'http';
import { MISSIONS, PlayerId } from '@space-crew/engine';
import type { ClientToServer, ServerToClient } from '@space-crew/shared';
import { createRoom, joinRoom, startRoom, Room } from './room';
import { applyHumanAction, viewFor } from './controller';
import { recordResult, loadProgress, saveProgress, CrewProgress } from './campaign';

interface ClientState {
  ws: WebSocket;
  roomCode?: string;
  playerId?: PlayerId;
}

function generateCode(seed: number, index: number): string {
  // Simple deterministic code generation based on seed and index
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  let n = seed + index;
  for (let i = 0; i < 4; i++) {
    code += chars[n % chars.length];
    n = Math.floor(n / chars.length);
  }
  return code;
}

function getSeatInfo(
  players: PlayerId[],
  isBot: Record<PlayerId, boolean>,
  connected: Record<PlayerId, boolean>,
): Array<{ player: PlayerId; isBot: boolean; connected: boolean }> {
  return players.map((p) => ({
    player: p,
    isBot: isBot[p] ?? false,
    connected: connected[p] ?? true,
  }));
}

export interface ServerHandle {
  close(): Promise<void>;
  port: number;
}

export function startServer(
  port: number,
  opts?: { seed?: number; progressFile?: string },
): ServerHandle {
  const seed = opts?.seed ?? Math.floor(Math.random() * 1000000);
  const progressFile = opts?.progressFile;
  let progress: CrewProgress | undefined = progressFile ? loadProgress(progressFile) : undefined;

  const httpServer = createServer();
  const wss = new WebSocketServer({ server: httpServer });

  const rooms = new Map<string, Room>();
  const clients = new Map<WebSocket, ClientState>();
  let nextCodeIndex = 0;

  function recordMissionOutcome(missionId: number, outcome: 'won' | 'lost') {
    if (!progressFile || !progress) return;
    progress = recordResult(progress, missionId, outcome);
    saveProgress(progressFile, progress);
  }

  function broadcastToRoom(code: string, msg: ServerToClient) {
    const room = rooms.get(code);
    if (!room) return;

    for (const [ws, state] of clients.entries()) {
      if (state.roomCode === code) {
        ws.send(JSON.stringify(msg));
      }
    }
  }

  function broadcastViewToRoom(code: string) {
    const room = rooms.get(code);
    if (!room || !room.match) return;

    // Check if mission has ended and record result (only once)
    if (!room.outcomeRecorded && (room.match.game.outcome === 'won' || room.match.game.outcome === 'lost')) {
      recordMissionOutcome(room.missionId, room.match.game.outcome);
      room.outcomeRecorded = true;
      // Update the room in the map
      rooms.set(code, room);
    }

    for (const playerId of room.players) {
      const view = viewFor(room.match, playerId as PlayerId);
      for (const [ws, state] of clients.entries()) {
        if (state.roomCode === code && state.playerId === playerId) {
          ws.send(JSON.stringify({ t: 'view', view } as ServerToClient));
        }
      }
    }
  }

  wss.on('connection', (ws) => {
    const state: ClientState = { ws };
    clients.set(ws, state);

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as ClientToServer;

        if (msg.t === 'create') {
          // Create a new room
          const roomIndex = nextCodeIndex;
          const code = generateCode(seed, nextCodeIndex++);
          const hostId = `host-${nextCodeIndex}` as PlayerId;
          state.playerId = hostId;
          state.roomCode = code;

          const room = createRoom(code, hostId, msg.missionId, roomIndex, msg.distress);
          rooms.set(code, room);

          // Send room message to client
          ws.send(
            JSON.stringify({
              t: 'room',
              code,
              seats: getSeatInfo(room.players, room.isBot, room.connected),
              started: room.started,
            } as ServerToClient),
          );
        } else if (msg.t === 'join') {
          // Join an existing room
          const room = rooms.get(msg.code);
          if (!room) {
            ws.send(JSON.stringify({ t: 'nack', reason: 'room not found' } as ServerToClient));
            return;
          }

          const playerId = `player-${nextCodeIndex++}` as PlayerId;
          state.playerId = playerId;
          state.roomCode = msg.code;

          const updatedRoom = joinRoom(room, playerId);
          rooms.set(msg.code, updatedRoom);

          // Broadcast room update to all in room
          broadcastToRoom(msg.code, {
            t: 'room',
            code: msg.code,
            seats: getSeatInfo(updatedRoom.players, updatedRoom.isBot, updatedRoom.connected),
            started: updatedRoom.started,
          });
        } else if (msg.t === 'start' && state.roomCode) {
          // Start the game — host only
          const room = rooms.get(state.roomCode);
          if (!room || room.started) {
            ws.send(JSON.stringify({ t: 'nack', reason: 'cannot start' } as ServerToClient));
            return;
          }

          if (state.playerId !== room.hostPlayerId) {
            ws.send(JSON.stringify({ t: 'nack', reason: 'only the host can start' } as ServerToClient));
            return;
          }

          const mission = MISSIONS.find((m) => m.id === room.missionId);
          if (!mission) {
            ws.send(JSON.stringify({ t: 'nack', reason: 'mission not found' } as ServerToClient));
            return;
          }

          // Derive an independent seed for this room so concurrent rooms get
          // different card deals even when the server seed is the same.
          // roomIndex is fixed at room creation time, so the seed is deterministic
          // regardless of subsequent join activity.
          const roomSeed = room.roomIndex === 0 ? seed : (seed ^ (room.roomIndex * 2654435761)) >>> 0;
          const startedRoom = startRoom(room, mission, roomSeed);
          rooms.set(state.roomCode, startedRoom);

          // Broadcast updated room and view to all
          broadcastToRoom(state.roomCode, {
            t: 'room',
            code: state.roomCode,
            seats: getSeatInfo(startedRoom.players, startedRoom.isBot, startedRoom.connected),
            started: startedRoom.started,
          });

          broadcastViewToRoom(state.roomCode);
        } else if (msg.t === 'play-card' && state.roomCode && state.playerId) {
          // Apply human action
          const room = rooms.get(state.roomCode);
          if (!room || !room.match) {
            ws.send(JSON.stringify({ t: 'nack', reason: 'no active game' } as ServerToClient));
            return;
          }

          try {
            const updatedMatch = applyHumanAction(room.match, state.playerId as PlayerId, {
              type: 'play-card',
              card: msg.card,
            });
            const updatedRoom = { ...room, match: updatedMatch };
            rooms.set(state.roomCode, updatedRoom);
            broadcastViewToRoom(state.roomCode);
          } catch (err) {
            ws.send(JSON.stringify({ t: 'nack', reason: String(err) } as ServerToClient));
          }
        } else if (msg.t === 'pick-task' && state.roomCode && state.playerId) {
          // Apply human action
          const room = rooms.get(state.roomCode);
          if (!room || !room.match) {
            ws.send(JSON.stringify({ t: 'nack', reason: 'no active game' } as ServerToClient));
            return;
          }

          try {
            const updatedMatch = applyHumanAction(room.match, state.playerId as PlayerId, {
              type: 'pick-task',
              card: msg.card,
            });
            const updatedRoom = { ...room, match: updatedMatch };
            rooms.set(state.roomCode, updatedRoom);
            broadcastViewToRoom(state.roomCode);
          } catch (err) {
            ws.send(JSON.stringify({ t: 'nack', reason: String(err) } as ServerToClient));
          }
        } else if (msg.t === 'communicate' && state.roomCode && state.playerId) {
          // Apply human action
          const room = rooms.get(state.roomCode);
          if (!room || !room.match) {
            ws.send(JSON.stringify({ t: 'nack', reason: 'no active game' } as ServerToClient));
            return;
          }

          try {
            const updatedMatch = applyHumanAction(room.match, state.playerId as PlayerId, {
              type: 'communicate',
              card: msg.card,
              token: msg.token,
            });
            const updatedRoom = { ...room, match: updatedMatch };
            rooms.set(state.roomCode, updatedRoom);
            broadcastViewToRoom(state.roomCode);
          } catch (err) {
            ws.send(JSON.stringify({ t: 'nack', reason: String(err) } as ServerToClient));
          }
        } else if (msg.t === 'commander-assign' && state.roomCode && state.playerId) {
          const room = rooms.get(state.roomCode);
          if (!room || !room.match) {
            ws.send(JSON.stringify({ t: 'nack', reason: 'no active game' } as ServerToClient));
            return;
          }
          try {
            const updatedMatch = applyHumanAction(room.match, state.playerId as PlayerId, {
              type: 'commander-assign',
              assignee: msg.assignee,
            });
            rooms.set(state.roomCode, { ...room, match: updatedMatch });
            broadcastViewToRoom(state.roomCode);
          } catch (err) {
            ws.send(JSON.stringify({ t: 'nack', reason: String(err) } as ServerToClient));
          }
        } else if (msg.t === 'commander-assign-roles' && state.roomCode && state.playerId) {
          const room = rooms.get(state.roomCode);
          if (!room || !room.match) {
            ws.send(JSON.stringify({ t: 'nack', reason: 'no active game' } as ServerToClient));
            return;
          }
          try {
            const updatedMatch = applyHumanAction(room.match, state.playerId as PlayerId, {
              type: 'commander-assign-roles',
              assignments: msg.assignments,
            });
            rooms.set(state.roomCode, { ...room, match: updatedMatch });
            broadcastViewToRoom(state.roomCode);
          } catch (err) {
            ws.send(JSON.stringify({ t: 'nack', reason: String(err) } as ServerToClient));
          }
        } else if (msg.t === 'submit-distress' && state.roomCode && state.playerId) {
          const room = rooms.get(state.roomCode);
          if (!room || !room.match) {
            ws.send(JSON.stringify({ t: 'nack', reason: 'no active game' } as ServerToClient));
            return;
          }
          try {
            const updatedMatch = applyHumanAction(room.match, state.playerId as PlayerId, {
              type: 'submit-distress',
              card: msg.card,
            });
            rooms.set(state.roomCode, { ...room, match: updatedMatch });
            broadcastViewToRoom(state.roomCode);
          } catch (err) {
            ws.send(JSON.stringify({ t: 'nack', reason: String(err) } as ServerToClient));
          }
        }
      } catch (err) {
        ws.send(JSON.stringify({ t: 'nack', reason: 'invalid message' } as ServerToClient));
      }
    });

    ws.on('close', () => {
      const closing = clients.get(ws);
      clients.delete(ws);

      // Mark the player's seat as disconnected and GC the room if it is now empty
      if (closing?.roomCode && closing.playerId) {
        const room = rooms.get(closing.roomCode);
        if (room) {
          // Set connected=false for the departing player's seat
          const updatedConnected = { ...room.connected, [closing.playerId]: false };
          const updatedRoom: Room = { ...room, connected: updatedConnected };
          rooms.set(closing.roomCode, updatedRoom);

          // GC: remove room when no human player has an active connection
          const anyHumanConnected = updatedRoom.players.some(
            (p) => !updatedRoom.isBot[p as PlayerId] && updatedConnected[p as PlayerId],
          );
          if (!anyHumanConnected) {
            rooms.delete(closing.roomCode);
          }
        }
      }
    });
  });

  const handle: ServerHandle = {
    port: 0,
    close: async () => {
      return new Promise<void>((resolve) => {
        wss.close(() => {
          httpServer.close(() => {
            resolve();
          });
        });
      });
    },
  };

  httpServer.listen(port, '127.0.0.1', () => {
    const addr = httpServer.address();
    if (addr && typeof addr === 'object') {
      handle.port = addr.port;
    }
  });

  // For port 0 (automatic assignment), we need to wait or use a different approach
  // This is a synchronous return, so we'll wait a bit or use a deferred port
  if (port === 0) {
    // Will be set when server is listening
    // The test will wait for the port to be available
  }

  return handle;
}
