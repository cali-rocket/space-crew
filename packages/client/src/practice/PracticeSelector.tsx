import { useState } from 'react';
import { MISSIONS } from '@space-crew/engine';
import type { MissionDef } from '@space-crew/engine';

/** Phase 1 supports simple missions only (open-pick, no special policies). */
export function isSupported(m: MissionDef): boolean {
  return (
    (m.assignment ?? 'open-pick') === 'open-pick' &&
    !(m.constraints && m.constraints.length) &&
    !(m.orderTokens && m.orderTokens.length) &&
    (m.communication ?? 'normal') === 'normal' &&
    !m.exchangeAfterTrick1
  );
}

export interface PracticeSelectorProps {
  onStart(cfg: { missionId: number; seed: number }): void;
  onBack(): void;
}

export function PracticeSelector({ onStart, onBack }: PracticeSelectorProps) {
  const [seed, setSeed] = useState(7);
  const missions = MISSIONS.filter(isSupported);

  return (
    <div className="sc-main" data-testid="practice-selector">
      <div className="sc-title">
        <h1>훈련소 / Practice</h1>
        <span className="sub">봇 상대 솔로 · 카드 카운팅·전략 연습</span>
      </div>

      <div className="sc-panel">
        <div className="sc-h">자유 연습 · 미션 선택</div>
        <div className="sc-row" style={{ marginBottom: 10 }}>
          <span className="sc-meta">시드 <b>{seed}</b></span>
          <button className="sc-btn ghost" data-testid="new-seed" onClick={() => setSeed(Math.floor(Math.random() * 100000))}>
            새 시드 ⟳
          </button>
        </div>
        <div className="sc-row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {missions.map((m) => (
            <button
              key={m.id}
              className="sc-btn"
              data-testid={`practice-mission-${m.id}`}
              onClick={() => onStart({ missionId: m.id, seed })}
            >
              미션 {m.id} · 태스크 {m.taskCount}
            </button>
          ))}
        </div>
        <div className="sc-meta" style={{ marginTop: 8 }}>
          가이드 레슨(개념별 훈련)은 다음 업데이트에서 추가돼요.
        </div>
      </div>

      <button className="sc-btn ghost" data-testid="practice-back" onClick={onBack}>← 로비로</button>
    </div>
  );
}
