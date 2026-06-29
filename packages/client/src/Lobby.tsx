export interface RoomState {
  code: string;
  seats: { player: string; isBot: boolean; connected: boolean }[];
  started: boolean;
}

export interface LobbyProps {
  room?: RoomState;
  onCreate(): void;
  onStart(): void;
}

export function Lobby({ room, onCreate, onStart }: LobbyProps) {
  if (!room) {
    return (
      <div style={{ padding: '24px', fontFamily: 'system-ui' }}>
        <h1>Space Crew Lobby</h1>
        <p>No room yet. Create one to start playing!</p>
        <button onClick={onCreate} style={{ padding: '8px 16px', fontSize: '16px', cursor: 'pointer' }}>
          방 만들기
        </button>
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
