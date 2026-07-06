import type { ClientToServer, ServerToClient } from '@space-crew/shared';
import {
  setupMatch,
  advance,
  applyHumanAction,
  viewFor,
  toRevealView,
  MISSIONS,
} from '@space-crew/engine';
import type { Match, RevealView } from '@space-crew/engine';
import type { Conn } from '../conn';

/** The human is always seat identity 'me'; the two bots fill the rest. */
const PLAYERS = ['me', 'bot-1', 'bot-2'];
const IS_BOT: Record<string, boolean> = { me: false, 'bot-1': true, 'bot-2': true };

export interface PracticeConn extends Conn {
  /** Practice-only ground truth (opponent hands + truth counting). */
  reveal(): RevealView;
  /** Number of stored snapshots (for step-back drills). */
  snapshotDepth(): number;
  /** Undo to the previous human-visible state (step-back drill). */
  stepBack(): void;
}

export interface PracticeConfig {
  missionId: number;
  seed: number;
  distress?: { active: boolean; direction: 'left' | 'right' };
}

/**
 * A {@link Conn}-shaped driver that runs a full solo game 100% in the browser over the
 * SAME pure engine driving path as the server (setupMatch/advance/applyHumanAction/viewFor)
 * — no WebSocket, no server. Because the authoritative GameState lives here, ground-truth
 * reveal is a trivial local read and real-multiplayer PlayerView integrity is untouched.
 */
export function createLocalDriver(
  cfg: PracticeConfig,
  handlers: { onMessage(msg: ServerToClient): void },
): PracticeConn {
  let match: Match | null = null;
  let missionId = cfg.missionId;
  let attempt = 1;
  const snapshots: Match[] = [];

  const emit = () => {
    if (match) handlers.onMessage({ t: 'view', view: viewFor(match, 'me') });
  };

  const startMatch = (id: number, att: number) => {
    const def = MISSIONS.find((m) => m.id === id);
    if (!def) {
      handlers.onMessage({ t: 'nack', reason: `unknown mission ${id}` });
      return;
    }
    missionId = id;
    attempt = att;
    // Vary the deal per attempt while staying reproducible for a given (seed, attempt).
    const seed = (cfg.seed + (att - 1) * 0x9e37) >>> 0;
    match = advance(setupMatch(def, [...PLAYERS], { ...IS_BOT }, seed, cfg.distress, att));
    snapshots.length = 0;
    snapshots.push(match);
    emit();
  };

  const act = (fn: () => Match) => {
    match = fn();
    snapshots.push(match);
    emit();
  };

  const send = (msg: ClientToServer) => {
    try {
      switch (msg.t) {
        case 'create':
          startMatch(msg.missionId, 1);
          break;
        case 'start':
          if (!match) startMatch(missionId, 1);
          break;
        case 'pick-task':
          act(() => applyHumanAction(match!, 'me', { type: 'pick-task', card: msg.card }));
          break;
        case 'play-card':
          act(() => applyHumanAction(match!, 'me', { type: 'play-card', card: msg.card }));
          break;
        case 'communicate':
          act(() => applyHumanAction(match!, 'me', { type: 'communicate', card: msg.card, token: msg.token }));
          break;
        case 'commander-assign':
          act(() => applyHumanAction(match!, 'me', { type: 'commander-assign', assignee: msg.assignee }));
          break;
        case 'commander-assign-roles':
          act(() => applyHumanAction(match!, 'me', { type: 'commander-assign-roles', assignments: msg.assignments }));
          break;
        case 'commander-distribute':
          act(() => applyHumanAction(match!, 'me', { type: 'commander-distribute', assignments: msg.assignments }));
          break;
        case 'submit-distress':
          act(() => applyHumanAction(match!, 'me', { type: 'submit-distress', card: msg.card }));
          break;
        case 'retry':
          startMatch(missionId, attempt + 1);
          break;
        case 'next-mission':
          startMatch(missionId + 1, 1);
          break;
        case 'join':
          break; // no-op in practice
      }
    } catch (e) {
      handlers.onMessage({ t: 'nack', reason: (e as Error).message });
    }
  };

  return {
    send,
    close() {
      match = null;
      snapshots.length = 0;
    },
    reveal() {
      if (!match) throw new Error('no active practice match');
      return toRevealView(match.game, 'me');
    },
    snapshotDepth() {
      return snapshots.length;
    },
    stepBack() {
      if (snapshots.length <= 1) return;
      snapshots.pop();
      match = snapshots[snapshots.length - 1]!;
      emit();
    },
  };
}
