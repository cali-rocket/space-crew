import { createRoot } from 'react-dom/client';
import { GameTable } from './GameTable';
import type { PlayerView } from '@space-crew/engine';
import './theme.css';

const C = (suit: 'pink' | 'blue' | 'green' | 'yellow' | 'rocket', value: number) => ({ suit, value });

const view: PlayerView = {
  me: 'p0',
  myHand: [C('blue', 7), C('blue', 3), C('pink', 9), C('green', 8), C('green', 2), C('yellow', 5), C('rocket', 2)],
  seats: [
    { player: 'p0', isBot: false, connected: true, handCount: 7, tricksWon: 1, isCommander: true,
      tasks: [{ card: C('yellow', 4), owner: 'p0', fulfilled: false }], communication: [] },
    { player: 'p1', isBot: true, connected: true, handCount: 6, tricksWon: 2, isCommander: false,
      tasks: [{ card: C('blue', 7), owner: 'p1', fulfilled: false, order: { kind: 'absolute', position: 1 } }],
      communication: [{ player: 'p1', card: C('pink', 9), token: 'highest' }] },
    { player: 'p2', isBot: true, connected: true, handCount: 6, tricksWon: 1, isCommander: false,
      tasks: [{ card: C('green', 5), owner: 'p2', fulfilled: true }],
      communication: [{ player: 'p2', card: C('green', 8), token: null }] },
  ],
  missionId: 16, attemptNumber: 2, phase: 'trick-in-progress',
  currentTrick: { leader: 'p1', plays: [{ player: 'p1', card: C('blue', 2) }, { player: 'p2', card: C('blue', 8) }], leadSuit: 'blue' },
  objectives: [{ kind: 'forbid-win-value', value: 9 }],
  communicationPolicy: { noCommUntilTrick: 3 },
  distressActive: true, outcome: 'in-progress',
  legalMoves: [C('blue', 7), C('blue', 3)],
};

createRoot(document.getElementById('root')!).render(
  <div className="sc-app"><GameTable view={view} onPlayCard={() => {}} onPickTask={() => {}} onCommunicate={() => {}} /></div>,
);
