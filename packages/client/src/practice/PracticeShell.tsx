import { useState } from 'react';
import { GameTable, type GameTableProps } from '../GameTable';
import { usePracticeState } from './usePracticeState';
import { CountingHUD } from './CountingHUD';
import { CoachPanel } from './CoachPanel';
import { RevealDrawer } from './RevealDrawer';
import { ScaffoldControls } from './ScaffoldControls';
import { DrillControls } from './DrillControls';
import { QuizPanel } from './QuizPanel';
import { MasteryMeter } from './MasteryMeter';
import { getMastery, recordMastery, type Mastery } from './mastery';
import { gateFor, type ScaffoldLevel } from './scaffold';
import { nextStreak, shouldPromote } from '@space-crew/engine';
import type { PracticeConn } from './LocalDriver';
import './practice.css';

export interface PracticeShellProps extends GameTableProps {
  driver: PracticeConn;
  onExit?(): void;
}

/** Wraps the UNCHANGED GameTable with display-only practice rails + reveal drawer. */
export function PracticeShell({ driver, onExit, ...gt }: PracticeShellProps) {
  const [level, setLevel] = useState<ScaffoldLevel>('full-assist');
  const [mastery, setMastery] = useState<Mastery>(() => getMastery());
  const [streak, setStreak] = useState(0);
  const [quizFeedback, setQuizFeedback] = useState(false);
  const gate = gateFor(level);
  const { counting, advice, quizzes } = usePracticeState(gt.view);

  const onGraded = (concept: string, correct: boolean) => {
    setMastery(recordMastery(concept, correct));
    setStreak((s) => nextStreak(s, correct));
  };
  // Monotonic promotion nudge (anti-crutch): only ever suggest fading further, never dropping.
  const readyToFade = level === 'test' && shouldPromote(streak);

  return (
    <div className="sc-practice" data-testid="practice-shell">
      <aside className="sc-rail sc-rail-left">
        <ScaffoldControls level={level} onLevel={(l) => { setLevel(l); setQuizFeedback(false); setStreak(0); }} />
        {readyToFade && (
          <button className="sc-btn primary" data-testid="fade-nudge" onClick={() => { setLevel('unaided'); setStreak(0); }}>
            ✅ 연속 정답 — L3 무보조로?
          </button>
        )}
        <DrillControls driver={driver} />
        <MasteryMeter mastery={mastery} />
        {onExit && <button className="sc-btn ghost" data-testid="practice-exit" onClick={onExit}>← 훈련소로</button>}
      </aside>

      <div className="sc-practice-center">
        <GameTable {...gt} />
        <RevealDrawer driver={driver} allowed={gate.revealAllowed} />
      </div>

      <aside className="sc-rail sc-rail-right">
        {gate.showQuiz ? (
          <>
            <QuizPanel quizzes={quizzes} onGraded={onGraded} onSubmitted={() => setQuizFeedback(true)} onReset={() => setQuizFeedback(false)} />
            {quizFeedback && <CoachPanel advice={advice} />}
          </>
        ) : gate.showHUD ? (
          <>
            <CountingHUD counting={counting} showMasters={gate.showMasters} showVoids={gate.showVoids} />
            {gate.showCoach && <CoachPanel advice={advice} />}
          </>
        ) : (
          <div className="sc-hud sc-hud-off">무보조 · 스스로 세는 중</div>
        )}
      </aside>
    </div>
  );
}
