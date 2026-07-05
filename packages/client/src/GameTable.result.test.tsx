import { render, screen, fireEvent } from '@testing-library/react';
import { GameTable } from './GameTable';
import type { PlayerView } from '@space-crew/engine';

const seats = (): PlayerView['seats'] =>
  ['p0', 'p1', 'p2'].map((p) => ({ player: p, isBot: p !== 'p0', connected: true, handCount: 0, tricksWon: 0, isCommander: p === 'p0', tasks: [], communication: [] }));

const endView = (over: Partial<PlayerView>): PlayerView => ({
  me: 'p0', myHand: [], seats: seats(),
  missionId: 4, attemptNumber: 2, phase: 'mission-result',
  currentTrick: { leader: 'p0', plays: [] }, trickHistory: [],
  objectives: [], communicationPolicy: 'normal', distressActive: false, outcome: 'lost', ...over,
});

test('a lost mission offers a retry button that fires onRetry', () => {
  const onRetry = vi.fn();
  render(<GameTable view={endView({ outcome: 'lost' })} onPlayCard={() => {}} onPickTask={() => {}} onRetry={onRetry} />);
  expect(screen.getByText(/미션 실패/)).toBeInTheDocument();
  fireEvent.click(screen.getByTestId('retry'));
  expect(onRetry).toHaveBeenCalledTimes(1);
});

test('a won mission offers next-mission; a lost one does not', () => {
  const onNext = vi.fn();
  const { rerender } = render(<GameTable view={endView({ outcome: 'won' })} onPlayCard={() => {}} onPickTask={() => {}} onRetry={() => {}} onNextMission={onNext} />);
  fireEvent.click(screen.getByTestId('next-mission'));
  expect(onNext).toHaveBeenCalledTimes(1);

  rerender(<GameTable view={endView({ outcome: 'lost' })} onPlayCard={() => {}} onPickTask={() => {}} onRetry={() => {}} onNextMission={onNext} />);
  expect(screen.queryByTestId('next-mission')).not.toBeInTheDocument();
});
