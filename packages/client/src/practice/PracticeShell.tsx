import { useState } from 'react';
import { GameTable, type GameTableProps } from '../GameTable';
import { usePracticeState } from './usePracticeState';
import { CountingHUD } from './CountingHUD';
import { RevealDrawer } from './RevealDrawer';
import { ScaffoldControls } from './ScaffoldControls';
import { gateFor, type ScaffoldLevel } from './scaffold';
import type { PracticeConn } from './LocalDriver';
import './practice.css';

export interface PracticeShellProps extends GameTableProps {
  driver: PracticeConn;
  onExit?(): void;
}

/** Wraps the UNCHANGED GameTable with display-only practice rails + reveal drawer. */
export function PracticeShell({ driver, onExit, ...gt }: PracticeShellProps) {
  const [level, setLevel] = useState<ScaffoldLevel>('full-assist');
  const gate = gateFor(level);
  const { counting } = usePracticeState(gt.view);

  return (
    <div className="sc-practice" data-testid="practice-shell">
      <aside className="sc-rail sc-rail-left">
        <ScaffoldControls level={level} onLevel={setLevel} />
        {onExit && (
          <button className="sc-btn ghost" data-testid="practice-exit" onClick={onExit}>← 훈련소로</button>
        )}
      </aside>

      <div className="sc-practice-center">
        <GameTable {...gt} />
        <RevealDrawer driver={driver} allowed={gate.revealAllowed} />
      </div>

      <aside className="sc-rail sc-rail-right">
        {gate.showHUD ? (
          <CountingHUD counting={counting} showMasters={gate.showMasters} showVoids={gate.showVoids} />
        ) : (
          <div className="sc-hud sc-hud-off">무보조 · 스스로 세는 중</div>
        )}
      </aside>
    </div>
  );
}
