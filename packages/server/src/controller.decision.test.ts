import { setupMatch, advance, applyHumanAction, viewFor } from './controller';
import type { MissionDef } from '@space-crew/engine';

const P = ['p0', 'p1', 'p2'];
const def33: MissionDef = {
  id: 33, sourceText: 'exactly 1 trick', logbookPage: 14, taskCount: 0, assignment: 'commander-decision',
  constraints: [{ kind: 'player-trick-count', role: 'chosen', count: 1, rocketAllowed: false }],
};

function humanCommanderMatch(seed: number) {
  const probe = setupMatch(def33, P, { p0: true, p1: true, p2: true }, seed);
  const cmd = probe.game.commander;
  const isBot = Object.fromEntries(P.map((p) => [p, p !== cmd])) as Record<string, boolean>;
  return { cmd, match: advance(setupMatch(def33, P, isBot, seed)) };
}

test('all-bot match auto-decides the role and reaches a terminal outcome', () => {
  const m = advance(setupMatch(def33, P, { p0: true, p1: true, p2: true }, 7));
  expect(m.game.roles['chosen']).toBeTruthy();
  expect(['won', 'lost']).toContain(m.game.outcome);
});

test('human commander gets a decision prompt; commander-assign binds the role', () => {
  const { cmd, match } = humanCommanderMatch(7);
  expect(match.game.phase).toBe('task-assignment');
  expect(match.game.roles['chosen']).toBeUndefined();
  const v = viewFor(match, cmd);
  expect(v.decision?.kind).toBe('role');
  expect(v.decision && 'role' in v.decision ? v.decision.role : undefined).toBe('chosen');
  expect(v.decision?.candidates).not.toContain(cmd);
  const assignee = v.decision!.candidates[0]!;
  const m2 = applyHumanAction(match, cmd, { type: 'commander-assign', assignee });
  expect(m2.game.roles['chosen']).toBe(assignee);
});

test('a non-commander does not get the decision prompt', () => {
  const { cmd, match } = humanCommanderMatch(7);
  const other = P.find((p) => p !== cmd)!;
  expect(viewFor(match, other).decision).toBeUndefined();
});

test('commander cannot assign self', () => {
  const { cmd, match } = humanCommanderMatch(7);
  expect(() => applyHumanAction(match, cmd, { type: 'commander-assign', assignee: cmd })).toThrow(/self/i);
});
