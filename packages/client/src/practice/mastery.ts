/** Per-concept mastery, persisted in localStorage so the crutch (or progress) is visible. */
export interface ConceptStat {
  correct: number;
  total: number;
}
export type Mastery = Record<string, ConceptStat>;

const KEY = 'sc-practice-mastery';

export function getMastery(): Mastery {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Mastery;
  } catch {
    return {};
  }
}

export function recordMastery(concept: string, correct: boolean): Mastery {
  const m = getMastery();
  const s = m[concept] ?? { correct: 0, total: 0 };
  m[concept] = { correct: s.correct + (correct ? 1 : 0), total: s.total + 1 };
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* storage unavailable — mastery is best-effort */
  }
  return m;
}

/** Bucket concept ids like "voids:bot-1" into a display group "voids". */
export function conceptGroup(concept: string): string {
  return concept.split(':')[0]!;
}
