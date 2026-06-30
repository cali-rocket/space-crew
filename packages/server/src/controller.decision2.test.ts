import { setupMatch, advance, applyHumanAction, viewFor } from './controller';
import { MISSIONS } from '@space-crew/engine';
import type { MissionDef } from '@space-crew/engine';

const P = ['p0', 'p1', 'p2'];
const allBots = { p0: true, p1: true, p2: true };

const defAllTasks: MissionDef = {
  id: 20, sourceText: 'one takes all', logbookPage: 11, taskCount: 2, assignment: 'commander-decision',
};
const defM50: MissionDef = {
  id: 50, sourceText: 'partition', logbookPage: 21, taskCount: 0,
  constraints: [{ kind: 'trick-partition', parts: [{ role: 'first4', range: 'first4' }, { role: 'last', range: 'last' }, { role: 'middle', range: 'middle' }] }],
};

function humanCommander(def: MissionDef, seed: number) {
  const probe = setupMatch(def, P, allBots, seed);
  const cmd = probe.game.commander;
  const isBot = Object.fromEntries(P.map((p) => [p, p !== cmd])) as Record<string, boolean>;
  return { cmd, match: advance(setupMatch(def, P, isBot, seed)) };
}

test('M5 is encoded as open-pick (not commander-decision)', () => {
  expect(MISSIONS.find((m) => m.id === 5)!.assignment).toBe('open-pick');
});

test('all-tasks: bot commander gives every task card to one non-commander', () => {
  const m = advance(setupMatch(defAllTasks, P, allBots, 3));
  const owners = new Set(m.game.tasks.map((t) => t.owner));
  expect(m.game.tasks.length).toBe(2);
  expect(owners.size).toBe(1);
  expect([...owners][0]).not.toBe(m.game.commander);
});

test('all-tasks: human commander gets an all-tasks decision; commander-assign assigns all', () => {
  const { cmd, match } = humanCommander(defAllTasks, 3);
  const v = viewFor(match, cmd);
  expect(v.decision?.kind).toBe('all-tasks');
  const assignee = v.decision!.candidates[0]!;
  const m2 = applyHumanAction(match, cmd, { type: 'commander-assign', assignee });
  expect(m2.taskPool.length).toBe(0);
  expect(m2.game.tasks.length).toBe(2);
  expect(m2.game.tasks.every((t) => t.owner === assignee)).toBe(true);
});

test('m50-roles: bot commander binds all three partition roles', () => {
  const m = advance(setupMatch(defM50, P, allBots, 5));
  for (const r of ['first4', 'last', 'middle']) expect(m.game.roles[r]).toBeTruthy();
  expect(new Set(['first4', 'last', 'middle'].map((r) => m.game.roles[r])).size).toBe(3);
});

test('m50-roles: human commander gets m50 decision; commander-assign-roles binds them', () => {
  const { cmd, match } = humanCommander(defM50, 5);
  const v = viewFor(match, cmd);
  expect(v.decision?.kind).toBe('m50-roles');
  const m2 = applyHumanAction(match, cmd, { type: 'commander-assign-roles', assignments: { first4: 'p0', last: 'p1', middle: 'p2' } });
  expect(m2.game.roles['first4']).toBe('p0');
  expect(m2.game.roles['last']).toBe('p1');
  expect(m2.game.roles['middle']).toBe('p2');
});

test('commander-assign-roles rejects duplicate assignees', () => {
  const { cmd, match } = humanCommander(defM50, 5);
  expect(() => applyHumanAction(match, cmd, { type: 'commander-assign-roles', assignments: { first4: 'p0', last: 'p0', middle: 'p1' } })).toThrow(/distinct/i);
});
