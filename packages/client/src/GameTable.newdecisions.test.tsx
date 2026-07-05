import { render, screen, fireEvent } from '@testing-library/react';
import { GameTable } from './GameTable';
import type { PlayerView } from '@space-crew/engine';

const seats = (): PlayerView['seats'] =>
  ['p0', 'p1', 'p2'].map((p) => ({ player: p, isBot: p !== 'p0', connected: true, handCount: 1, tricksWon: 0, isCommander: p === 'p0', tasks: [], communication: [] }));

const base = (over: Partial<PlayerView>): PlayerView => ({
  me: 'p0', myHand: [{ suit: 'blue', value: 7 }], seats: seats(),
  missionId: 1, attemptNumber: 1, phase: 'task-assignment', currentTrick: { leader: 'p0', plays: [] },
  objectives: [], communicationPolicy: 'normal', distressActive: false, outcome: 'in-progress', ...over,
});

test('appoint-no-comm decision: clicking a candidate fires onCommanderAssign', () => {
  const onAssign = vi.fn();
  render(<GameTable view={base({ decision: { kind: 'appoint-no-comm', candidates: ['p1', 'p2'] } })} onPlayCard={() => {}} onPickTask={() => {}} onCommanderAssign={onAssign} />);
  expect(screen.getByText(/통신 불가/)).toBeInTheDocument();
  fireEvent.click(screen.getByTestId('decide-p2'));
  expect(onAssign).toHaveBeenCalledWith('p2');
});

test('distribute decision: confirm disabled until every order is evenly assigned, then fires onCommanderDistribute', () => {
  const onDistribute = vi.fn();
  const taskPool = [
    { suit: 'pink' as const, value: 1 },
    { suit: 'blue' as const, value: 2 },
    { suit: 'green' as const, value: 3 },
  ];
  render(
    <GameTable
      view={base({ decision: { kind: 'distribute', candidates: ['p0', 'p1', 'p2'] }, taskPool })}
      onPlayCard={() => {}} onPickTask={() => {}} onCommanderDistribute={onDistribute}
    />,
  );
  const confirm = screen.getByTestId('distribute-confirm') as HTMLButtonElement;
  expect(confirm.disabled).toBe(true);
  // assign one order to each player → even split
  fireEvent.change(screen.getByTestId('distribute-select-pink-1'), { target: { value: 'p0' } });
  fireEvent.change(screen.getByTestId('distribute-select-blue-2'), { target: { value: 'p1' } });
  fireEvent.change(screen.getByTestId('distribute-select-green-3'), { target: { value: 'p2' } });
  expect(confirm.disabled).toBe(false);
  fireEvent.click(confirm);
  expect(onDistribute).toHaveBeenCalledTimes(1);
  const arg = onDistribute.mock.calls[0]![0];
  expect(arg).toHaveLength(3);
  expect(arg.map((a: { owner: string }) => a.owner).sort()).toEqual(['p0', 'p1', 'p2']);
});

test('distribute confirm stays disabled for an uneven split (all to one player)', () => {
  const taskPool = [
    { suit: 'pink' as const, value: 1 },
    { suit: 'blue' as const, value: 2 },
    { suit: 'green' as const, value: 3 },
  ];
  render(
    <GameTable
      view={base({ decision: { kind: 'distribute', candidates: ['p0', 'p1', 'p2'] }, taskPool })}
      onPlayCard={() => {}} onPickTask={() => {}} onCommanderDistribute={() => {}}
    />,
  );
  fireEvent.change(screen.getByTestId('distribute-select-pink-1'), { target: { value: 'p0' } });
  fireEvent.change(screen.getByTestId('distribute-select-blue-2'), { target: { value: 'p0' } });
  fireEvent.change(screen.getByTestId('distribute-select-green-3'), { target: { value: 'p0' } });
  expect((screen.getByTestId('distribute-confirm') as HTMLButtonElement).disabled).toBe(true);
});
