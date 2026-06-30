import { setupMatch } from './controller';
import type { MissionDef } from '@space-crew/engine';

const P = ['p0', 'p1', 'p2'];

test('setupMatch auto-binds the commander role (M34-style)', () => {
  const def: MissionDef = {
    id: 34, sourceText: 'commander first & last', logbookPage: 15, taskCount: 0,
    constraints: [{ kind: 'player-exact-tricks', role: 'commander', tricks: 'first-last', exclusive: false, rocketAllowed: true }],
  };
  const m = setupMatch(def, P, { p0: false, p1: true, p2: true }, 4);
  expect(m.game.roles['commander']).toBe(m.game.commander);
});

test('setupMatch auto-binds the pink-9 holder role (M46-style)', () => {
  const def: MissionDef = {
    id: 46, sourceText: 'all pink cards', logbookPage: 19, taskCount: 0,
    constraints: [{ kind: 'pink-left-sweep' }],
  };
  const m = setupMatch(def, P, { p0: false, p1: true, p2: true }, 4);
  const holder = m.game.roles['pink9holder'];
  expect(holder).toBeTruthy();
  expect(m.game.hands[holder!]!.some((c) => c.suit === 'pink' && c.value === 9)).toBe(true);
});

test('missions without role constraints bind no roles', () => {
  const def: MissionDef = { id: 1, sourceText: 'plain', logbookPage: 3, taskCount: 1 };
  const m = setupMatch(def, P, { p0: false, p1: true, p2: true }, 4);
  expect(Object.keys(m.game.roles)).toHaveLength(0);
});
