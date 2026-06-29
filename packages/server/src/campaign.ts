import { readFileSync, writeFileSync } from 'node:fs';

export interface CrewProgress {
  missionStatuses: Record<number, { attempts: number; cleared: boolean }>;
  currentMissionId: number;
}

export function emptyProgress(): CrewProgress {
  return {
    missionStatuses: {},
    currentMissionId: 1,
  };
}

export function recordResult(
  p: CrewProgress,
  missionId: number,
  outcome: 'won' | 'lost',
): CrewProgress {
  const current = p.missionStatuses[missionId] ?? { attempts: 0, cleared: false };
  const updated = { ...p };

  updated.missionStatuses = {
    ...p.missionStatuses,
    [missionId]: {
      attempts: current.attempts + 1,
      cleared: outcome === 'won' ? true : current.cleared,
    },
  };

  if (outcome === 'won') {
    // Advance to next mission
    updated.currentMissionId = missionId + 1;
  } else {
    // Keep current mission ID on loss
    updated.currentMissionId = p.currentMissionId;
  }

  return updated;
}

export function loadProgress(file: string): CrewProgress {
  try {
    const content = readFileSync(file, 'utf-8');
    return JSON.parse(content) as CrewProgress;
  } catch {
    // File doesn't exist or is invalid, return empty progress
    return emptyProgress();
  }
}

export function saveProgress(file: string, p: CrewProgress): void {
  writeFileSync(file, JSON.stringify(p, null, 2), 'utf-8');
}
