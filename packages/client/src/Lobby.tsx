import { useState } from 'react';

export interface RoomState {
  code: string;
  seats: { player: string; isBot: boolean; connected: boolean }[];
  started: boolean;
}

export interface LobbyProps {
  room?: RoomState;
  onCreate(missionId: number): void;
  onStart(): void;
  onJoin?(code: string): void;
}

export function Lobby({ room, onCreate, onStart, onJoin }: LobbyProps) {
  const [selectedMission, setSelectedMission] = useState(1);
  const [joinCode, setJoinCode] = useState('');

  const handleCreate = () => {
    onCreate(selectedMission);
  };

  const handleJoin = () => {
    onJoin?.(joinCode);
  };

  if (!room) {
    return (
      <div style={{ padding: '24px', fontFamily: 'system-ui' }}>
        <h1>Space Crew Lobby</h1>
        <p>No room yet. Create one to start playing!</p>

        <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
          <h2>Create New Room</h2>
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="mission-select" style={{ marginRight: '8px' }}>
              Mission:
            </label>
            <select
              id="mission-select"
              data-testid="mission-select"
              value={selectedMission}
              onChange={(e) => setSelectedMission(Number(e.target.value))}
              style={{ padding: '8px', fontSize: '16px' }}
            >
              {Array.from({ length: 50 }, (_, i) => i + 1).map((mission) => (
                <option key={mission} value={mission}>
                  {mission}
                </option>
              ))}
            </select>
          </div>
          <button onClick={handleCreate} style={{ padding: '8px 16px', fontSize: '16px', cursor: 'pointer' }}>
            방 만들기
          </button>
        </div>

        <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
          <h2>Join Existing Room</h2>
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="join-code" style={{ marginRight: '8px' }}>
              Room Code:
            </label>
            <input
              id="join-code"
              data-testid="join-code-input"
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Enter room code"
              style={{ padding: '8px', fontSize: '16px' }}
            />
          </div>
          <button
            onClick={handleJoin}
            disabled={!joinCode.trim()}
            style={{ padding: '8px 16px', fontSize: '16px', cursor: joinCode.trim() ? 'pointer' : 'not-allowed', opacity: joinCode.trim() ? 1 : 0.5 }}
          >
            합류
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', fontFamily: 'system-ui' }}>
      <h1>Space Crew Lobby</h1>
      <p>Room Code: <strong>{room.code}</strong></p>

      <h2>Seats</h2>
      <div style={{ marginBottom: '24px' }}>
        {room.seats.length === 0 ? (
          <p>No seats yet.</p>
        ) : (
          room.seats.map((seat) => (
            <div key={seat.player} style={{ padding: '8px', border: '1px solid #ddd', marginBottom: '8px' }}>
              <strong>{seat.player}</strong> {seat.isBot ? '(Bot)' : '(Human)'} — {seat.connected ? 'Connected' : 'Disconnected'}
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: '24px' }}>
        {room.started ? (
          <p style={{ color: '#2b7', fontWeight: 'bold' }}>Game has started!</p>
        ) : (
          <button onClick={onStart} style={{ padding: '8px 16px', fontSize: '16px', cursor: 'pointer' }}>
            시작
          </button>
        )}
      </div>
    </div>
  );
}
