import type { Card, CommToken, PlayerId, PlayerView } from '@space-crew/engine';

export type ClientToServer =
  | { t: 'join'; code: string; name?: string }
  | { t: 'create'; missionId: number; distress?: { active: boolean; direction: 'left' | 'right' } }
  | { t: 'pick-task'; card: Card }
  | { t: 'play-card'; card: Card }
  | { t: 'communicate'; card: Card; token: CommToken | null }
  | { t: 'commander-assign'; assignee: PlayerId }
  | { t: 'commander-assign-roles'; assignments: Record<string, PlayerId> }
  | { t: 'submit-distress'; card: Card }
  | { t: 'start' };

export type ServerToClient =
  | { t: 'view'; view: PlayerView }
  | { t: 'nack'; reason: string }
  | { t: 'room'; code: string; seats: { player: PlayerId; isBot: boolean; connected: boolean }[]; started: boolean };

// Re-export types from @space-crew/engine for convenience
export type { Card, CommToken, PlayerId, PlayerView } from '@space-crew/engine';
