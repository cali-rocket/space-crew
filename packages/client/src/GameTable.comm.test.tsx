import { render, screen, fireEvent } from '@testing-library/react';
import { GameTable } from './GameTable';
import type { PlayerView } from '@space-crew/engine';
import { describe, test, expect, vi } from 'vitest';

/** Base view: pre-trick window, viewer is the leader */
const preTrickView: PlayerView = {
  me: 'p0',
  myHand: [
    { suit: 'blue', value: 7 },
    { suit: 'green', value: 3 },
    { suit: 'rocket', value: 2 }, // rockets must NOT appear in communicate list
  ],
  seats: [
    {
      player: 'p0',
      isBot: false,
      connected: true,
      handCount: 3,
      tricksWon: 0,
      isCommander: true,
      tasks: [],
      communication: [],
    },
    {
      player: 'p1',
      isBot: true,
      connected: true,
      handCount: 3,
      tricksWon: 0,
      isCommander: false,
      tasks: [],
      communication: [],
    },
  ],
  missionId: 1,
  attemptNumber: 1,
  phase: 'trick-in-progress',
  currentTrick: { leader: 'p0', plays: [], leadSuit: undefined },
  objectives: [],
  communicationPolicy: 'normal',
  distressActive: false,
  outcome: 'in-progress',
  legalMoves: [{ suit: 'blue', value: 7 }, { suit: 'green', value: 3 }, { suit: 'rocket', value: 2 }],
};

describe('GameTable communicate UI', () => {
  test('communicate button appears in the pre-trick window when viewer is the leader', () => {
    render(<GameTable view={preTrickView} onPlayCard={() => {}} onPickTask={() => {}} onCommunicate={() => {}} />);
    expect(screen.getByRole('button', { name: /communicate/i })).toBeInTheDocument();
  });

  test('clicking Communicate then a card calls onCommunicate with that card', () => {
    const onCommunicate = vi.fn();
    render(<GameTable view={preTrickView} onPlayCard={() => {}} onPickTask={() => {}} onCommunicate={onCommunicate} />);

    fireEvent.click(screen.getByRole('button', { name: /^communicate$/i }));

    // comm-card elements should now be visible
    expect(screen.getByTestId('comm-card-blue-7')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('comm-card-blue-7'));
    expect(onCommunicate).toHaveBeenCalledTimes(1);
    expect(onCommunicate).toHaveBeenCalledWith({ suit: 'blue', value: 7 });
  });

  test('rocket cards do NOT appear in the communicate card list', () => {
    render(<GameTable view={preTrickView} onPlayCard={() => {}} onPickTask={() => {}} onCommunicate={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /^communicate$/i }));

    // blue and green appear, rocket does not
    expect(screen.getByTestId('comm-card-blue-7')).toBeInTheDocument();
    expect(screen.getByTestId('comm-card-green-3')).toBeInTheDocument();
    expect(screen.queryByTestId('comm-card-rocket-2')).not.toBeInTheDocument();
  });

  test('communicate button is NOT shown mid-trick (plays.length > 0)', () => {
    const midTrickView: PlayerView = {
      ...preTrickView,
      currentTrick: {
        leader: 'p0',
        plays: [{ player: 'p0', card: { suit: 'blue', value: 7 } }],
        leadSuit: 'blue',
      },
    };
    render(<GameTable view={midTrickView} onPlayCard={() => {}} onPickTask={() => {}} onCommunicate={() => {}} />);
    expect(screen.queryByRole('button', { name: /communicate/i })).not.toBeInTheDocument();
  });

  test('communicate button is NOT shown when viewer is not the trick leader', () => {
    const notLeaderView: PlayerView = {
      ...preTrickView,
      currentTrick: { leader: 'p1', plays: [], leadSuit: undefined },
    };
    render(<GameTable view={notLeaderView} onPlayCard={() => {}} onPickTask={() => {}} onCommunicate={() => {}} />);
    expect(screen.queryByRole('button', { name: /communicate/i })).not.toBeInTheDocument();
  });

  test('communicate button is NOT shown during task-assignment phase', () => {
    const taskPhaseView: PlayerView = {
      ...preTrickView,
      phase: 'task-assignment',
      taskPool: [{ suit: 'pink', value: 2 }],
    };
    render(<GameTable view={taskPhaseView} onPlayCard={() => {}} onPickTask={() => {}} onCommunicate={() => {}} />);
    expect(screen.queryByRole('button', { name: /communicate/i })).not.toBeInTheDocument();
  });

  test('Cancel button dismisses the card selection without calling onCommunicate', () => {
    const onCommunicate = vi.fn();
    render(<GameTable view={preTrickView} onPlayCard={() => {}} onPickTask={() => {}} onCommunicate={onCommunicate} />);

    fireEvent.click(screen.getByRole('button', { name: /^communicate$/i }));
    expect(screen.getByTestId('comm-card-blue-7')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByTestId('comm-card-blue-7')).not.toBeInTheDocument();
    expect(onCommunicate).toHaveBeenCalledTimes(0);
  });
});
