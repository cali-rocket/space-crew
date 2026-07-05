import { render, screen, fireEvent } from '@testing-library/react';
import { GameTable } from './GameTable';
import type { PlayerView } from '@space-crew/engine';
import { describe, test, expect, vi } from 'vitest';

const view: PlayerView = {
  me: 'p0', myHand: [{ suit: 'blue', value: 7 }, { suit: 'green', value: 2 }],
  seats: [
    { player: 'p0', isBot: false, connected: true, handCount: 2, tricksWon: 0, isCommander: true, tasks: [], communication: [] },
    { player: 'p1', isBot: true, connected: true, handCount: 2, tricksWon: 1, isCommander: false, tasks: [], communication: [] },
    { player: 'p2', isBot: true, connected: true, handCount: 2, tricksWon: 0, isCommander: false, tasks: [], communication: [] },
  ],
  missionId: 1, attemptNumber: 1, phase: 'trick-in-progress',
  currentTrick: { leader: 'p0', plays: [], leadSuit: undefined },
  objectives: [], communicationPolicy: 'normal', distressActive: false, outcome: 'in-progress',
  legalMoves: [{ suit: 'blue', value: 7 }, { suit: 'green', value: 2 }],
};

describe('GameTable', () => {
  test('renders my hand and fires onPlayCard for a legal card', () => {
    const onPlay = vi.fn();
    render(<GameTable view={view} onPlayCard={onPlay} onPickTask={() => {}} />);
    expect(screen.getByText(/미션 1/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('hand-card-blue-7'));
    expect(onPlay).toHaveBeenCalledWith({ suit: 'blue', value: 7 });
  });

  test('dims illegal cards when it is not a legal move', () => {
    const v2: PlayerView = { ...view, currentTrick: { leader: 'p1', plays: [{ player: 'p1', card: { suit: 'blue', value: 9 } }], leadSuit: 'blue' }, legalMoves: [{ suit: 'blue', value: 7 }] };
    render(<GameTable view={v2} onPlayCard={() => {}} onPickTask={() => {}} />);
    // must follow blue → blue 7 legal, green 2 dimmed
    expect(screen.getByTestId('hand-card-green-2').className).toMatch(/dim/);
  });
});
