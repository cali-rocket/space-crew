import { useEffect, useState } from 'react';
import { connect, type Conn } from './conn';
import { Lobby, type RoomState } from './Lobby';
import { GameTable } from './GameTable';
import type { PlayerView, Card } from '@space-crew/engine';
import { commClassification } from '@space-crew/engine';
import type { ServerToClient } from '@space-crew/shared';
import './theme.css';

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

  const handleCreate = (missionId: number) => {
    conn?.send({ t: 'create', missionId });
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

  const handleJoin = (code: string) => {
    conn?.send({ t: 'join', code });
  };

  const handleCommunicate = (card: Card) => {
    // Calculate the token automatically using commClassification
    if (!view) return;
    const token = commClassification(view.myHand, card);
    conn?.send({ t: 'communicate', card, token });
  };

  const handleCommanderAssign = (assignee: string) => {
    conn?.send({ t: 'commander-assign', assignee });
  };

  // Routing logic
  // If we have a view and the game is in progress, show the game table
  const showGameTable = view && (view.phase === 'trick-in-progress' || view.phase === 'task-assignment' || view.outcome !== 'in-progress');

  return (
    <div className="sc-app">
      {error && (
        <div className="sc-main" style={{ paddingBottom: 0 }}>
          <div className="sc-banner obj"><span className="sc-dot" />{error}</div>
        </div>
      )}

      {showGameTable && view ? (
        <GameTable view={view} onPlayCard={handlePlayCard} onPickTask={handlePickTask} onCommunicate={handleCommunicate} onCommanderAssign={handleCommanderAssign} />
      ) : (
        <Lobby room={room} onCreate={handleCreate} onStart={handleStart} onJoin={handleJoin} />
      )}
    </div>
  );
}
