import { render, screen, fireEvent } from '@testing-library/react';
import { GameTable } from './GameTable';
import type { PlayerView } from '@space-crew/engine';

const base: PlayerView = {
  me: 'p0', myHand: [{ suit: 'blue', value: 7 }],
  seats: [
    { player: 'p0', isBot: false, connected: true, handCount: 1, tricksWon: 0, isCommander: true, tasks: [], communication: [] },
    { player: 'p1', isBot: true, connected: true, handCount: 1, tricksWon: 0, isCommander: false, tasks: [], communication: [] },
    { player: 'p2', isBot: true, connected: true, handCount: 1, tricksWon: 0, isCommander: false, tasks: [], communication: [] },
  ],
  missionId: 33, attemptNumber: 1, phase: 'task-assignment',
  currentTrick: { leader: 'p0', plays: [] }, objectives: [], communicationPolicy: 'normal', distressActive: false, outcome: 'in-progress',
  decision: { kind: 'role', role: 'chosen', candidates: ['p1', 'p2'] },
};

test('commander decision panel shows candidates and fires onCommanderAssign', () => {
  const onAssign = vi.fn();
  render(<GameTable view={base} onPlayCard={() => {}} onPickTask={() => {}} onCommanderAssign={onAssign} />);
  expect(screen.getByText(/담당자/)).toBeInTheDocument();
  fireEvent.click(screen.getByTestId('decide-p2'));
  expect(onAssign).toHaveBeenCalledTimes(1);
  expect(onAssign).toHaveBeenCalledWith('p2');
});

test('no decision panel when view.decision is absent', () => {
  const { decision, ...noDecision } = base;
  render(<GameTable view={noDecision} onPlayCard={() => {}} onPickTask={() => {}} onCommanderAssign={() => {}} />);
  expect(screen.queryByText(/담당자/)).not.toBeInTheDocument();
});
