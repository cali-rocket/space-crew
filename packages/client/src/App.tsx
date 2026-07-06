import { useEffect, useState } from 'react';
import { connect, type Conn } from './conn';
import { Lobby, type RoomState } from './Lobby';
import { GameTable } from './GameTable';
import { PracticeShell } from './practice/PracticeShell';
import { PracticeSelector } from './practice/PracticeSelector';
import { createLocalDriver, type PracticeConn } from './practice/LocalDriver';
import type { PlayerView, Card } from '@space-crew/engine';
import { commClassification } from '@space-crew/engine';
import type { ServerToClient } from '@space-crew/shared';
import './theme.css';

interface AppProps {
  serverUrl: string;
}

type Mode = 'online' | 'practice';

export function App({ serverUrl }: AppProps) {
  const [conn, setConn] = useState<Conn | null>(null);
  const [room, setRoom] = useState<RoomState | undefined>(undefined);
  const [view, setView] = useState<PlayerView | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<Mode>('online');
  const [practiceConn, setPracticeConn] = useState<PracticeConn | null>(null);

  // Connect to server on mount (online mode).
  useEffect(() => {
    const connection = connect(serverUrl, {
      onMessage(msg: ServerToClient) {
        if (msg.t === 'room') {
          setRoom({ code: msg.code, seats: msg.seats, started: msg.started });
          setError(undefined);
        } else if (msg.t === 'view') {
          setView(msg.view);
          setError(undefined);
        } else if (msg.t === 'nack') {
          setError(msg.reason);
        }
      },
    });
    setConn(connection);
    return () => connection.close();
  }, [serverUrl]);

  // Route actions to the active transport (practice = local driver, online = ws).
  const active = mode === 'practice' ? practiceConn : conn;

  const handlePlayCard = (card: Card) => active?.send({ t: 'play-card', card });
  const handlePickTask = (card: Card) => active?.send({ t: 'pick-task', card });
  const handleCommunicate = (card: Card) => {
    if (!view) return;
    active?.send({ t: 'communicate', card, token: commClassification(view.myHand, card) });
  };
  const handleCommanderAssign = (assignee: string) => active?.send({ t: 'commander-assign', assignee });
  const handleCommanderAssignRoles = (assignments: Record<string, string>) => active?.send({ t: 'commander-assign-roles', assignments });
  const handleCommanderDistribute = (assignments: { card: Card; owner: string }[]) => active?.send({ t: 'commander-distribute', assignments });
  const handleSubmitDistress = (card: Card) => active?.send({ t: 'submit-distress', card });
  const handleRetry = () => active?.send({ t: 'retry' });
  const handleNextMission = () => active?.send({ t: 'next-mission' });

  // Online-only lobby handlers.
  const handleCreate = (missionId: number, distress?: { active: boolean; direction: 'left' | 'right' }) =>
    conn?.send({ t: 'create', missionId, distress });
  const handleStart = () => conn?.send({ t: 'start' });
  const handleJoin = (code: string) => conn?.send({ t: 'join', code });

  // Practice lifecycle.
  const enterPractice = () => {
    setMode('practice');
    setView(undefined);
    setRoom(undefined);
  };
  const startPractice = (cfg: { missionId: number; seed: number }) => {
    const drv = createLocalDriver(cfg, {
      onMessage(msg: ServerToClient) {
        if (msg.t === 'view') { setView(msg.view); setError(undefined); }
        else if (msg.t === 'nack') setError(msg.reason);
      },
    });
    setPracticeConn(drv);
    drv.send({ t: 'start' });
  };
  const exitPractice = () => {
    practiceConn?.close();
    setPracticeConn(null);
    setView(undefined);
  };
  const backToLobby = () => {
    exitPractice();
    setMode('online');
  };

  const gameTableCallbacks = {
    onPlayCard: handlePlayCard,
    onPickTask: handlePickTask,
    onCommunicate: handleCommunicate,
    onCommanderAssign: handleCommanderAssign,
    onCommanderAssignRoles: handleCommanderAssignRoles,
    onCommanderDistribute: handleCommanderDistribute,
    onSubmitDistress: handleSubmitDistress,
    onRetry: handleRetry,
    onNextMission: handleNextMission,
  };

  const inGame = view && (view.phase === 'trick-in-progress' || view.phase === 'task-assignment' || view.outcome !== 'in-progress');

  let body: JSX.Element;
  if (mode === 'practice') {
    body = practiceConn && inGame && view
      ? <PracticeShell view={view} driver={practiceConn} onExit={exitPractice} {...gameTableCallbacks} />
      : <PracticeSelector onStart={startPractice} onBack={backToLobby} />;
  } else {
    body = inGame && view
      ? <GameTable view={view} {...gameTableCallbacks} />
      : <Lobby room={room} onCreate={handleCreate} onStart={handleStart} onJoin={handleJoin} onPractice={enterPractice} />;
  }

  return (
    <div className="sc-app">
      {error && (
        <div className="sc-main" style={{ paddingBottom: 0 }}>
          <div className="sc-banner obj"><span className="sc-dot" />{error}</div>
        </div>
      )}
      {body}
    </div>
  );
}
