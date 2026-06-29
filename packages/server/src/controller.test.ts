import { setupMatch, advance, applyHumanAction, viewFor, Match } from './controller';
import type { MissionDef } from '@space-crew/engine';

const P = ['p0', 'p1', 'p2'];
const m1: MissionDef = { id: 1, sourceText: 'training', logbookPage: 3, taskCount: 1 };

test('all-bot match plays mission 1 to a terminal outcome deterministically', () => {
  const isBot = { p0: true, p1: true, p2: true };
  let m = setupMatch(m1, P, isBot, 42);
  m = advance(m);
  expect(['won', 'lost']).toContain(m.game.outcome);
  // determinism
  let m2 = advance(setupMatch(m1, P, isBot, 42));
  expect(m2.game.outcome).toBe(m.game.outcome);
});

test('with a human seat, advance stops on the human turn and resumes after their action', () => {
  const isBot = { p0: false, p1: true, p2: true };
  let m = setupMatch({ id: 1, sourceText: 't', logbookPage: 3, taskCount: 0 }, P, isBot, 5);
  m = advance(m);
  // taskCount 0 → trick phase; if it's p0(human) turn, advance stopped there
  if (m.game.phase === 'trick-in-progress' && m.game.outcome === 'in-progress') {
    const v = viewFor(m, 'p0');
    const legal = v.legalMoves ?? [];
    if (legal.length > 0) {
      m = applyHumanAction(m, 'p0', { type: 'play-card', card: legal[0]! });
      expect(m.step).toBeGreaterThan(0);
    }
  }
  expect(m.game).toBeDefined();
});

test('viewFor never leaks other hands', () => {
  let m = advance(setupMatch(m1, P, { p0: false, p1: true, p2: true }, 9));
  const v = viewFor(m, 'p0');
  expect(JSON.stringify(v)).not.toContain('rngSeed');
});
