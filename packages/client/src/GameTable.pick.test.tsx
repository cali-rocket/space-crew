import { render, screen, fireEvent } from '@testing-library/react';
import { GameTable } from './GameTable';
import type { PlayerView } from '@space-crew/engine';
import { describe, test, expect, vi } from 'vitest';

const base: PlayerView = {
  me: 'p0',
  myHand: [{ suit: 'blue', value: 7 }],
  seats: [
    {
      player: 'p0',
      isBot: false,
      connected: true,
      handCount: 1,
      tricksWon: 0,
      isCommander: true,
      tasks: [],
      communication: [],
    },
    { player: 'p1', isBot: true, connected: true, handCount: 1, tricksWon: 0, isCommander: false, tasks: [], communication: [] },
    { player: 'p2', isBot: true, connected: true, handCount: 1, tricksWon: 0, isCommander: false, tasks: [], communication: [] },
  ],
  missionId: 9,
  attemptNumber: 1,
  phase: 'task-assignment',
  currentTrick: { leader: 'p0', plays: [] },
  objectives: [],
  communicationPolicy: 'normal',
  distressActive: false,
  outcome: 'in-progress',
  taskPool: [
    { suit: 'pink', value: 1 },
    { suit: 'green', value: 3 },
  ],
};

describe('GameTable task-pick', () => {
  test('clicking a pool card fires onPickTask', () => {
    const onPick = vi.fn();
    render(<GameTable view={base} onPlayCard={() => {}} onPickTask={onPick} />);
    fireEvent.click(screen.getByTestId('pool-card-pink-1'));
    expect(onPick).toHaveBeenCalledWith({ suit: 'pink', value: 1 });
  });

  test('hand cards are not clickable during task-assignment', () => {
    const onPlay = vi.fn();
    render(<GameTable view={base} onPlayCard={onPlay} onPickTask={() => {}} />);
    // hand-card should exist but clicking it should not trigger onPlayCard
    const handCard = screen.getByTestId('hand-card-blue-7');
    fireEvent.click(handCard);
    expect(onPlay).not.toHaveBeenCalled();
  });
});
