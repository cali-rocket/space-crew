import { setupMatch, advance, applyHumanAction, viewFor, Match } from './controller';
import type { MissionDef, Card, PlayerId } from '@space-crew/engine';

const P = ['p0', 'p1', 'p2'];
const plain: MissionDef = { id: 8, sourceText: 'plain', logbookPage: 6, taskCount: 0 };

const sameCard = (a: Card, b: Card) => a.suit === b.suit && a.value === b.value;
const firstNonRocket = (m: Match, p: PlayerId): Card => (m.game.hands[p] ?? []).find((c) => c.suit !== 'rocket')!;

test('all-bot distress: bots auto-submit, pass completes, game reaches a terminal outcome', () => {
  const m = advance(setupMatch(plain, P, { p0: true, p1: true, p2: true }, 5, { active: true, direction: 'right' }));
  expect(m.distressDone).toBe(true);
  expect(['won', 'lost']).toContain(m.game.outcome);
});

test('all-bot distress is deterministic', () => {
  const a = advance(setupMatch(plain, P, { p0: true, p1: true, p2: true }, 5, { active: true, direction: 'left' }));
  const b = advance(setupMatch(plain, P, { p0: true, p1: true, p2: true }, 5, { active: true, direction: 'left' }));
  expect(a.game.outcome).toBe(b.game.outcome);
});

test('human distress: each player is prompted and submit-distress passes the card to the right neighbor', () => {
  const isBot = { p0: false, p1: false, p2: false };
  let m = advance(setupMatch(plain, P, isBot, 5, { active: true, direction: 'right' }));

  // p0 prompted first
  expect(viewFor(m, 'p0').distressPass?.mustSubmit).toBe(true);
  const c0 = firstNonRocket(m, 'p0');
  m = applyHumanAction(m, 'p0', { type: 'submit-distress', card: c0 });

  expect(viewFor(m, 'p1').distressPass?.mustSubmit).toBe(true);
  const c1 = firstNonRocket(m, 'p1');
  m = applyHumanAction(m, 'p1', { type: 'submit-distress', card: c1 });

  const c2 = firstNonRocket(m, 'p2');
  m = applyHumanAction(m, 'p2', { type: 'submit-distress', card: c2 });

  // all submitted → pass complete. right: p0→p1, p1→p2, p2→p0
  expect(m.distressDone).toBe(true);
  expect((m.game.hands['p1'] ?? []).some((c) => sameCard(c, c0))).toBe(true);
  expect((m.game.hands['p2'] ?? []).some((c) => sameCard(c, c1))).toBe(true);
  expect((m.game.hands['p0'] ?? []).some((c) => sameCard(c, c2))).toBe(true);
  expect((m.game.hands['p0'] ?? []).some((c) => sameCard(c, c0))).toBe(false); // gave it away
});

test('submit-distress is rejected after distress already completed', () => {
  const isBot = { p0: false, p1: true, p2: true };
  let m = advance(setupMatch(plain, P, isBot, 5, { active: true, direction: 'right' }));
  // p0 (only human) submits → bots already auto-submitted, so this completes the pass
  const c0 = firstNonRocket(m, 'p0');
  m = applyHumanAction(m, 'p0', { type: 'submit-distress', card: c0 });
  expect(m.distressDone).toBe(true);
  expect(() => applyHumanAction(m, 'p0', { type: 'submit-distress', card: firstNonRocket(m, 'p0') })).toThrow(/already/i);
});
