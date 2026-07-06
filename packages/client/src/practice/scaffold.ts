export type ScaffoldLevel = 'full-assist' | 'assist' | 'test' | 'unaided';

export interface ScaffoldGate {
  showHUD: boolean;
  showMasters: boolean;
  showVoids: boolean;
  showReconstruction: boolean;
  revealAllowed: boolean;
}

/** Pure display filter over the always-fully-computed counting state (Phase 1 subset). */
export function gateFor(level: ScaffoldLevel): ScaffoldGate {
  switch (level) {
    case 'full-assist':
      return { showHUD: true, showMasters: true, showVoids: true, showReconstruction: true, revealAllowed: true };
    case 'assist':
      return { showHUD: true, showMasters: false, showVoids: true, showReconstruction: false, revealAllowed: true };
    case 'test': // Phase 3 turns this into a quiz; for now it behaves like a light assist.
      return { showHUD: true, showMasters: false, showVoids: false, showReconstruction: false, revealAllowed: true };
    case 'unaided':
      return { showHUD: false, showMasters: false, showVoids: false, showReconstruction: false, revealAllowed: false };
  }
}

export const LEVELS: { id: ScaffoldLevel; label: string; hint: string; ready: boolean }[] = [
  { id: 'full-assist', label: 'L0 풀보조', hint: '전부 표시', ready: true },
  { id: 'assist', label: 'L1 보조', hint: '집계만·결론 숨김', ready: true },
  { id: 'test', label: 'L2 테스트', hint: '퀴즈 (곧)', ready: false },
  { id: 'unaided', label: 'L3 무보조', hint: '전부 off', ready: true },
];
