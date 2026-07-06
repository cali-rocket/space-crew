import type { Advice, PrincipleId } from '@space-crew/engine';

const TAG: Record<PrincipleId, string> = {
  master: '마스터',
  'trump-counting': '로켓 카운팅',
  void: '보이드',
  'void-reconstruction': '손패 복원',
  'low-task': '저카드 태스크',
  'comm-timing': '통신 타이밍',
  lead: '리드 관리',
  endgame: '완전정보',
};

export interface CoachPanelProps {
  advice: Advice[];
}

export function CoachPanel({ advice }: CoachPanelProps) {
  return (
    <div className="sc-coach" data-testid="coach-panel">
      <div className="sc-hud-h">코치 · 설명형</div>
      <div className="sc-hud-sub">공개정보만 · 항상 ‘왜’</div>
      {advice.length === 0 && <div className="sc-coach-empty">지금은 특별한 조언이 없어요.</div>}
      {advice.map((a, i) => (
        <div key={`${a.principle}-${i}`} className={`sc-advice ${a.severity}`} data-testid={`advice-${a.principle}`}>
          <span className="sc-advice-tag">{TAG[a.principle]}</span>
          <span className="sc-advice-msg">{a.message}</span>
        </div>
      ))}
    </div>
  );
}
