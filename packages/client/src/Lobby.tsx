import { useState } from 'react';

export interface RoomState {
  code: string;
  seats: { player: string; isBot: boolean; connected: boolean }[];
  started: boolean;
}

export interface LobbyProps {
  room?: RoomState;
  onCreate(missionId: number, distress?: { active: boolean; direction: 'left' | 'right' }): void;
  onStart(): void;
  onJoin?(code: string): void;
}

export function Lobby({ room, onCreate, onStart, onJoin }: LobbyProps) {
  const [selectedMission, setSelectedMission] = useState(1);
  const [joinCode, setJoinCode] = useState('');
  const [distress, setDistress] = useState(false);
  const [direction, setDirection] = useState<'left' | 'right'>('right');

  const create = () => (distress ? onCreate(selectedMission, { active: true, direction }) : onCreate(selectedMission));

  if (!room) {
    return (
      <div className="sc-main">
        <div className="sc-title">
          <h1>SPACE CREW</h1>
          <span className="sub">행성 나인을 향한 협력 우주 항해</span>
        </div>

        <div className="sc-panel">
          <div className="sc-h">새 항해 준비</div>
          <div className="sc-row">
            <label htmlFor="mission-select" className="sc-meta">미션</label>
            <select id="mission-select" data-testid="mission-select" className="sc-select"
              value={selectedMission} onChange={(e) => setSelectedMission(Number(e.target.value))}>
              {Array.from({ length: 50 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>미션 {m}</option>
              ))}
            </select>
            <button className="sc-btn primary" onClick={create}>🚀 방 만들기</button>
          </div>
          <div className="sc-row" style={{ marginTop: 10 }}>
            <label className="sc-meta" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" data-testid="distress-toggle" checked={distress} onChange={(e) => setDistress(e.target.checked)} />
              조난신호 사용 (난이도 ↓)
            </label>
            {distress && (
              <select className="sc-select" data-testid="distress-direction" value={direction} onChange={(e) => setDirection(e.target.value as 'left' | 'right')}>
                <option value="right">오른쪽으로 전달</option>
                <option value="left">왼쪽으로 전달</option>
              </select>
            )}
          </div>
          <div className="sc-meta" style={{ marginTop: 8 }}>나 + 봇 2명으로 출발합니다. 친구는 방 코드로 들어올 수 있어요.</div>
        </div>

        <div className="sc-panel">
          <div className="sc-h">방 참가</div>
          <div className="sc-row">
            <input id="join-code" data-testid="join-code-input" className="sc-input" type="text"
              value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="방 코드 입력" />
            <button className="sc-btn" onClick={() => onJoin?.(joinCode)} disabled={!joinCode.trim()}>합류</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sc-main">
      <div className="sc-title">
        <h1>SPACE CREW</h1>
        <span className="sub">대기실</span>
      </div>

      <div className="sc-panel">
        <div className="sc-h">방 코드</div>
        <div className="sc-row">
          <span className="sc-code" data-testid="room-code">{room.code}</span>
          <span className="sc-meta">친구에게 이 코드를 공유하세요</span>
        </div>
      </div>

      <div className="sc-panel">
        <div className="sc-h">크루 ({room.seats.length}/3)</div>
        <div className="sc-seats">
          {room.seats.map((seat) => (
            <div key={seat.player} className="sc-seat">
              <div className="sc-seat-top">
                <span className="sc-ava">{seat.isBot ? '🤖' : '🧑‍🚀'}</span>
                <span className="sc-name">{seat.player}</span>
                {seat.isBot ? <span className="sc-badge bot">봇</span> : <span className="sc-badge cmd">사람</span>}
                {!seat.connected && <span className="sc-badge off">끊김</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="sc-panel">
        {room.started
          ? <div className="sc-meta" style={{ color: 'var(--good)' }}>게임이 시작되었습니다!</div>
          : <button className="sc-btn primary" onClick={onStart}>▶ 시작</button>}
      </div>
    </div>
  );
}
