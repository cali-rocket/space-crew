// The match controller now lives in the pure engine (packages/engine/src/match.ts)
// so the WebSocket server and the client-local practice driver share ONE driving
// path (no drift). This module re-exports it for existing server imports.
export {
  setupMatch,
  advance,
  applyHumanAction,
  viewFor,
  pendingDecision,
} from '@space-crew/engine';
export type { Match, Decision } from '@space-crew/engine';
