import { useEffect, useState } from 'react';
import { connect, type Conn } from './conn';
import { Lobby, type RoomState } from './Lobby';
import { GameTable } from './GameTable';
import type { PlayerView, Card } from '@space-crew/engine';
import type { ServerToClient } from '@space-crew/shared';

interface AppProps {
  serverUrl: string;
}

export function App({ serverUrl }: AppProps) {
  const [conn, setConn] = useState<Conn | null>(null);
  const [room, setRoom] = useState<RoomState | undefined>(undefined);
  const [view, setView] = useState<PlayerView | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  // Connect to server on mount
  useEffect(() => {
    const connection = connect(serverUrl, {
      onMessage(msg: ServerToClient) {
        if (msg.t === 'room') {
          setRoom({
            code: msg.code,
            seats: msg.seats,
            started: msg.started,
          });
          setError(undefined);
        } else if (msg.t === 'view') {
          setView(msg.view);
          setError(undefined);
        } else if (msg.t === 'nack') {
          setError(msg.reason);
        }
      },
      onOpen() {
        // Optionally auto-create a room on connect
        // connection.send({ t: 'create', missionId: 1 });
      },
    });
    setConn(connection);

    return () => {
      connection.close();
    };
  }, [serverUrl]);

  const handleCreate = () => {
    conn?.send({ t: 'create', missionId: 1 });
  };

  const handleStart = () => {
    conn?.send({ t: 'start' });
  };

  const handlePlayCard = (card: Card) => {
    conn?.send({ t: 'play-card', card });
  };

  const handlePickTask = (card: Card) => {
    conn?.send({ t: 'pick-task', card });
  };

  // Routing logic
  // If we have a view and the game is in progress, show the game table
  const showGameTable = view && (view.phase === 'trick-in-progress' || view.phase === 'task-assignment' || view.outcome !== 'in-progress');

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      {error && (
        <div style={{ padding: '16px', backgroundColor: '#ffcccc', color: '#cc0000', marginBottom: '16px' }}>
          Error: {error}
        </div>
      )}

      {showGameTable && view ? (
        <GameTable view={view} onPlayCard={handlePlayCard} onPickTask={handlePickTask} />
      ) : (
        <Lobby room={room} onCreate={handleCreate} onStart={handleStart} />
      )}
    </div>
  );
}
