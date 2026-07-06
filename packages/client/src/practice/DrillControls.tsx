import type { PracticeConn } from './LocalDriver';

export interface DrillControlsProps {
  driver: PracticeConn;
}

/** Step-back drill: undo to the previous human-visible position to replay a decision. */
export function DrillControls({ driver }: DrillControlsProps) {
  const depth = driver.snapshotDepth();
  return (
    <div className="sc-drill" data-testid="drill-controls">
      <div className="sc-hud-h">드릴</div>
      <div className="sc-drill-row">
        <button
          className="sc-btn"
          data-testid="drill-stepback"
          disabled={depth <= 1}
          title="이전 결정으로 되감기"
          onClick={() => driver.stepBack()}
        >
          ◀ 되감기
        </button>
        <span className="sc-hud-sub">스냅샷 {depth}</span>
      </div>
    </div>
  );
}
