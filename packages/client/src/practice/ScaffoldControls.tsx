import { LEVELS, type ScaffoldLevel } from './scaffold';

export interface ScaffoldControlsProps {
  level: ScaffoldLevel;
  onLevel(l: ScaffoldLevel): void;
}

export function ScaffoldControls({ level, onLevel }: ScaffoldControlsProps) {
  return (
    <div className="sc-scaffold" data-testid="scaffold-controls">
      <div className="sc-hud-h">스캐폴딩 레벨</div>
      <div className="sc-hud-sub">보조 → 테스트 → 무보조</div>
      {LEVELS.map((L) => (
        <button
          key={L.id}
          data-testid={`level-${L.id}`}
          className={`sc-level ${level === L.id ? 'active' : ''}`}
          disabled={!L.ready}
          onClick={() => L.ready && onLevel(L.id)}
        >
          <b>{L.label}</b>
          <span>{L.hint}</span>
        </button>
      ))}
    </div>
  );
}
