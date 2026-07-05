import { render, screen, waitFor } from '@testing-library/react';
import { GameTable } from './GameTable';
import type { PlayerView } from '@space-crew/engine';

const seats = (): PlayerView['seats'] =>
  ['p0', 'p1', 'p2'].map((p) => ({ player: p, isBot: p !== 'p0', connected: true, handCount: 3, tricksWon: 0, isCommander: p === 'p1', tasks: [], communication: [] }));

const trickView = (over: Partial<PlayerView>): PlayerView => ({
  me: 'p0', myHand: [{ suit: 'blue', value: 4 }], seats: seats(),
  missionId: 3, attemptNumber: 1, phase: 'trick-in-progress',
  currentTrick: { leader: 'p0', plays: [] },
  trickHistory: [], objectives: [], communicationPolicy: 'normal', distressActive: false, outcome: 'in-progress',
  ...over,
});

test('mission briefing shows the goal and mission number', () => {
  render(<GameTable view={trickView({})} onPlayCard={() => {}} onPickTask={() => {}} />);
  expect(screen.getByText(/미션 3/)).toBeInTheDocument();
  expect(screen.getByText(/모두 획득하면 성공/)).toBeInTheDocument();
});

test('shows the trick-collection overlay when a new completed trick appears', async () => {
  const { rerender } = render(<GameTable view={trickView({})} onPlayCard={() => {}} onPickTask={() => {}} />);
  // nothing collected yet
  expect(screen.queryByText(/획득$/)).not.toBeInTheDocument();

  // a trick completes → server view now carries it in trickHistory
  const withTrick = trickView({
    trickHistory: [{
      leader: 'p0', winner: 'p2',
      plays: [
        { player: 'p0', card: { suit: 'green', value: 3 } },
        { player: 'p1', card: { suit: 'green', value: 5 } },
        { player: 'p2', card: { suit: 'green', value: 9 } },
      ],
    }],
    currentTrick: { leader: 'p2', plays: [] },
  });
  rerender(<GameTable view={withTrick} onPlayCard={() => {}} onPickTask={() => {}} />);

  // collection overlay appears (panel heading switches + winner label)
  await waitFor(() => expect(screen.getByText(/트릭 획득/)).toBeInTheDocument());
  expect(screen.getByText(/🏆/)).toBeInTheDocument();
});

test('does NOT animate a trick that was already present on first render', () => {
  // reconnect / mount mid-game: existing history must not trigger a stale animation
  render(<GameTable view={trickView({
    trickHistory: [{ leader: 'p0', winner: 'p1', plays: [{ player: 'p0', card: { suit: 'blue', value: 2 } }] }],
  })} onPlayCard={() => {}} onPickTask={() => {}} />);
  expect(screen.queryByText(/트릭 획득/)).not.toBeInTheDocument();
});
