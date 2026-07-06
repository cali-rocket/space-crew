import { useState } from 'react';
import { CardChip } from '../Card';
import type { PracticeConn } from './LocalDriver';

export interface RevealDrawerProps {
  driver: PracticeConn;
  allowed: boolean;
}

export function RevealDrawer({ driver, allowed }: RevealDrawerProps) {
  const [open, setOpen] = useState(false);
  if (!allowed) {
    return (
      <div className="sc-reveal closed">
        <button className="sc-btn ghost" disabled title="무보조 레벨에서는 리빌 잠금">🔒 정답 공개 (무보조)</button>
      </div>
    );
  }
  if (!open) {
    return (
      <div className="sc-reveal closed">
        <button className="sc-btn" data-testid="reveal-open" onClick={() => setOpen(true)}>▲ 정답 공개 (연습 전용)</button>
      </div>
    );
  }

  const rv = driver.reveal();
  const diffKeys = new Set(rv.diffs.map((d) => `${d.player}:${d.card.suit}-${d.card.value}`));
  return (
    <div className="sc-reveal open" data-testid="reveal-drawer">
      <div className="sc-reveal-watermark">PRACTICE</div>
      <div className="sc-reveal-head">
        <span>정답 공개 · 상대 손패 (내 추론과 대조)</span>
        <button className="sc-btn ghost" data-testid="reveal-close" onClick={() => setOpen(false)}>닫기 ▼</button>
      </div>
      {Object.entries(rv.opponentHands).map(([player, hand]) => (
        <div key={player} className="sc-reveal-hand">
          <span className="sc-reveal-name">{player}</span>
          {hand.map((c) => (
            <span
              key={`${c.suit}-${c.value}`}
              className={diffKeys.has(`${player}:${c.suit}-${c.value}`) ? 'sc-reveal-diff' : ''}
              title={diffKeys.has(`${player}:${c.suit}-${c.value}`) ? '리빌로 알게 된 카드(공개정보론 미확정)' : ''}
            >
              <CardChip card={c} small />
            </span>
          ))}
        </div>
      ))}
      <div className="sc-reveal-note">테두리 강조 = 공개정보만으론 아직 추론 불가였던 카드</div>
    </div>
  );
}
