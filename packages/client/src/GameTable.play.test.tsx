import { render, screen, fireEvent } from '@testing-library/react';
import { GameTable } from './GameTable';
import type { PlayerView } from '@space-crew/engine';

const seats = (): PlayerView['seats'] =>
  ['p0', 'p1', 'p2'].map((p) => ({ player: p, isBot: p !== 'p0', connected: true, handCount: 3, tricksWon: 0, isCommander: p === 'p1', tasks: [], communication: [] }));

const trickView = (): PlayerView => ({
  me: 'p0', myHand: [{ suit: 'yellow', value: 8 }], seats: seats(),
  missionId: 1, attemptNumber: 1, phase: 'trick-in-progress',
  currentTrick: { leader: 'p0', plays: [] }, // my turn to lead → card is legal
  objectives: [], communicationPolicy: 'normal', distressActive: false, outcome: 'in-progress',
  legalMoves: [{ suit: 'yellow', value: 8 }],
});

// Regression: the hand card had onClick on BOTH the wrapper span and the inner
// CardChip div, so a click on the card bubbled and fired onPlayCard twice — the
// 2nd play-card nacked "card not in hand". Clicking the actual card element must
// fire onPlayCard exactly once.
test('clicking a hand card fires onPlayCard exactly once (no double-send)', () => {
  const onPlay = vi.fn();
  render(<GameTable view={trickView()} onPlayCard={onPlay} onPickTask={() => {}} />);
  const chip = screen.getByTestId('hand-card-yellow-8').querySelector('.pc');
  fireEvent.click(chip as Element);
  expect(onPlay).toHaveBeenCalledTimes(1);
});

test('an illegal (dim) card does not fire onPlayCard', () => {
  const onPlay = vi.fn();
  const view: PlayerView = {
    ...trickView(),
    myHand: [{ suit: 'yellow', value: 8 }, { suit: 'blue', value: 2 }],
    currentTrick: { leader: 'p1', plays: [{ player: 'p1', card: { suit: 'yellow', value: 3 } }], leadSuit: 'yellow' },
    legalMoves: [{ suit: 'yellow', value: 8 }], // must follow yellow; blue is illegal
  };
  render(<GameTable view={view} onPlayCard={onPlay} onPickTask={() => {}} />);
  const blue = screen.getByTestId('hand-card-blue-2').querySelector('.pc');
  fireEvent.click(blue as Element);
  expect(onPlay).not.toHaveBeenCalled();
});
