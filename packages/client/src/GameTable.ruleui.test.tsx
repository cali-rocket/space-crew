import { render, screen, fireEvent } from '@testing-library/react';
import { GameTable } from './GameTable';
import type { PlayerView } from '@space-crew/engine';

const seats = (commander: string): PlayerView['seats'] =>
  ['p0', 'p1', 'p2'].map((p) => ({ player: p, isBot: p !== 'p0', connected: true, handCount: 1, tricksWon: 0, isCommander: p === commander, tasks: [], communication: [] }));

const base = (over: Partial<PlayerView>): PlayerView => ({
  me: 'p0', myHand: [{ suit: 'blue', value: 7 }], seats: seats('p0'),
  missionId: 1, attemptNumber: 1, phase: 'task-assignment', currentTrick: { leader: 'p0', plays: [] },
  objectives: [], communicationPolicy: 'normal', distressActive: false, outcome: 'in-progress', ...over,
});

test('all-tasks decision: heading mentions all tasks; clicking a candidate fires onCommanderAssign', () => {
  const onAssign = vi.fn();
  render(<GameTable view={base({ decision: { kind: 'all-tasks', candidates: ['p1', 'p2'] } })} onPlayCard={() => {}} onPickTask={() => {}} onCommanderAssign={onAssign} />);
  expect(screen.getByText(/모든 태스크/)).toBeInTheDocument();
  fireEvent.click(screen.getByTestId('decide-p1'));
  expect(onAssign).toHaveBeenCalledWith('p1');
});

test('role decision for sick shows good/bad label', () => {
  render(<GameTable view={base({ decision: { kind: 'role', role: 'sick', candidates: ['p1', 'p2'] } })} onPlayCard={() => {}} onPickTask={() => {}} onCommanderAssign={() => {}} />);
  expect(screen.getByText(/good\/bad/)).toBeInTheDocument();
});

test('m50-roles: confirm is disabled until 3 distinct players are chosen, then fires onCommanderAssignRoles', () => {
  const onRoles = vi.fn();
  const view = base({ decision: { kind: 'm50-roles', roles: ['first4', 'last', 'middle'], candidates: ['p0', 'p1', 'p2'] } });
  render(<GameTable view={view} onPlayCard={() => {}} onPickTask={() => {}} onCommanderAssignRoles={onRoles} />);
  const confirm = screen.getByTestId('assign-roles');
  expect(confirm).toBeDisabled();
  fireEvent.change(screen.getByTestId('role-select-first4'), { target: { value: 'p0' } });
  fireEvent.change(screen.getByTestId('role-select-last'), { target: { value: 'p1' } });
  fireEvent.change(screen.getByTestId('role-select-middle'), { target: { value: 'p2' } });
  expect(confirm).not.toBeDisabled();
  fireEvent.click(confirm);
  expect(onRoles).toHaveBeenCalledWith({ first4: 'p0', last: 'p1', middle: 'p2' });
});

test('m50-roles: confirm stays disabled if a player is used twice', () => {
  const view = base({ decision: { kind: 'm50-roles', roles: ['first4', 'last', 'middle'], candidates: ['p0', 'p1', 'p2'] } });
  render(<GameTable view={view} onPlayCard={() => {}} onPickTask={() => {}} onCommanderAssignRoles={() => {}} />);
  fireEvent.change(screen.getByTestId('role-select-first4'), { target: { value: 'p0' } });
  fireEvent.change(screen.getByTestId('role-select-last'), { target: { value: 'p0' } });
  fireEvent.change(screen.getByTestId('role-select-middle'), { target: { value: 'p1' } });
  expect(screen.getByTestId('assign-roles')).toBeDisabled();
});

test('distress submit: rocket excluded; clicking a card fires onSubmitDistress', () => {
  const onSubmit = vi.fn();
  const view = base({ myHand: [{ suit: 'blue', value: 7 }, { suit: 'rocket', value: 2 }], distressPass: { mustSubmit: true } });
  render(<GameTable view={view} onPlayCard={() => {}} onPickTask={() => {}} onSubmitDistress={onSubmit} />);
  expect(screen.queryByTestId('distress-card-rocket-2')).not.toBeInTheDocument();
  fireEvent.click(screen.getByTestId('distress-card-blue-7'));
  expect(onSubmit).toHaveBeenCalledWith({ suit: 'blue', value: 7 });
});
