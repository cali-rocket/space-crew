import { COLORS } from '@space-crew/engine';
import type { CountingState, Color } from '@space-crew/engine';

const SUIT_LABEL: Record<Color, string> = { pink: '분홍', blue: '파랑', green: '초록', yellow: '노랑' };

export interface CountingHUDProps {
  counting: CountingState;
  showMasters: boolean;
  showVoids: boolean;
}

export function CountingHUD({ counting, showMasters, showVoids }: CountingHUDProps) {
  const masterSet = new Set(counting.masters.map((c) => `${c.suit}-${c.value}`));
  return (
    <div className="sc-hud" data-testid="counting-hud">
      <div className="sc-hud-h">카운팅 HUD</div>
      <div className="sc-hud-sub">공개정보만 · 표시 필터</div>

      <div className="sc-hud-rockets" data-testid="hud-rockets">
        <span>로켓</span>
        <span className="sc-hud-pips">
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className={`pip ${i <= counting.rockets.remaining ? 'live' : 'gone'}`} />
          ))}
        </span>
        <b>{counting.rockets.remaining}장 밖</b>
      </div>

      {COLORS.map((color) => (
        <div key={color} className="sc-hud-row">
          <span className="sc-hud-suit" style={{ color: `var(--suit-${color})` }}>{SUIT_LABEL[color]}</span>
          <span className="sc-hud-cells">
            {Array.from({ length: 9 }, (_, k) => k + 1).map((v) => {
              const live = counting.remaining[color].includes(v);
              const master = showMasters && masterSet.has(`${color}-${v}`);
              return (
                <span
                  key={v}
                  data-testid={`hud-cell-${color}-${v}`}
                  className={`cell ${live ? 'live' : 'seen'} ${master ? 'master' : ''}`}
                  style={live ? { background: `var(--suit-${color})` } : undefined}
                >
                  {v}
                </span>
              );
            })}
          </span>
        </div>
      ))}

      {showVoids && (
        <div className="sc-hud-voids" data-testid="hud-voids">
          {Object.entries(counting.voids)
            .filter(([, suits]) => suits.length > 0)
            .map(([player, suits]) => (
              <span key={player} className="sc-void-badge">
                {player === 'me' ? '나' : player} · {suits.join(',')} ✕
              </span>
            ))}
        </div>
      )}
    </div>
  );
}
