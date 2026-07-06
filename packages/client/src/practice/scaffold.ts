export type ScaffoldLevel = 'full-assist' | 'assist' | 'test' | 'unaided';

export interface ScaffoldGate {
  showHUD: boolean;
  showMasters: boolean;
  showVoids: boolean;
  showReconstruction: boolean;
  showCoach: boolean;
  showQuiz: boolean;
  revealAllowed: boolean;
}

/** Pure display filter over the always-fully-computed counting state. */
export function gateFor(level: ScaffoldLevel): ScaffoldGate {
  switch (level) {
    case 'full-assist':
      return { showHUD: true, showMasters: true, showVoids: true, showReconstruction: true, showCoach: true, showQuiz: false, revealAllowed: true };
    case 'assist':
      return { showHUD: true, showMasters: false, showVoids: true, showReconstruction: false, showCoach: true, showQuiz: false, revealAllowed: true };
    case 'test': // HUD hidden; the learner is quizzed and the coach fires only after answering.
      return { showHUD: false, showMasters: false, showVoids: false, showReconstruction: false, showCoach: false, showQuiz: true, revealAllowed: true };
    case 'unaided':
      return { showHUD: false, showMasters: false, showVoids: false, showReconstruction: false, showCoach: false, showQuiz: false, revealAllowed: false };
  }
}

export const LEVELS: { id: ScaffoldLevel; label: string; hint: string; ready: boolean }[] = [
  { id: 'full-assist', label: 'L0 풀보조', hint: '전부 표시', ready: true },
  { id: 'assist', label: 'L1 보조', hint: '집계만·결론 숨김', ready: true },
  { id: 'test', label: 'L2 테스트', hint: '퀴즈로 자가확인', ready: true },
  { id: 'unaided', label: 'L3 무보조', hint: '전부 off', ready: true },
];
