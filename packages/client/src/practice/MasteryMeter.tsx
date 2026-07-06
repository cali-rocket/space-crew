import { conceptGroup, type Mastery } from './mastery';

const GROUP_LABEL: Record<string, string> = { rockets: '로켓 카운팅', masters: '마스터 인식', voids: '보이드 추론' };

export interface MasteryMeterProps {
  mastery: Mastery;
}

/** Rolls concept ids up into display groups and shows an accuracy bar per group. */
export function MasteryMeter({ mastery }: MasteryMeterProps) {
  const groups: Record<string, { correct: number; total: number }> = {};
  for (const [concept, stat] of Object.entries(mastery)) {
    const g = conceptGroup(concept);
    const acc = groups[g] ?? { correct: 0, total: 0 };
    groups[g] = { correct: acc.correct + stat.correct, total: acc.total + stat.total };
  }
  const entries = Object.entries(groups);

  return (
    <div className="sc-mastery" data-testid="mastery-meter">
      <div className="sc-hud-h">개념 숙련도</div>
      {entries.length === 0 && <div className="sc-hud-sub">L2 테스트로 숙련도를 쌓아요</div>}
      {entries.map(([g, s]) => {
        const pct = s.total ? Math.round((s.correct / s.total) * 100) : 0;
        return (
          <div key={g} className="sc-mastery-row" data-testid={`mastery-${g}`}>
            <span className="sc-mastery-label">{GROUP_LABEL[g] ?? g}</span>
            <span className="sc-mastery-bar"><span style={{ width: `${pct}%` }} /></span>
            <span className="sc-mastery-pct">{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}
