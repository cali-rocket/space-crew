import { describe, it, expect } from 'vitest';
import {
  MISSIONS, PlayerId, createGame, setAppointedNoCommPlayer, beginTricks, communicate, commClassification, Card,
} from '@space-crew/engine';
import { setupMatch, advance, applyHumanAction, viewFor } from './controller';

const P: PlayerId[] = ['P1', 'P2', 'P3'];
const m11 = MISSIONS.find((m) => m.id === 11)!;

describe('M11 — appointed crew member cannot communicate', () => {
  it('bot commander appoints another crew member; tasks are still distributed normally', () => {
    const m = advance(setupMatch(m11, P, { P1: true, P2: true, P3: true }, 3));
    expect(m.game.appointedNoCommPlayer).toBeDefined();
    expect(m.game.appointedNoCommPlayer).not.toBe(m.game.commander); // "another" crew member
    // 4 tasks spread across players (NOT all dumped on one player)
    expect(m.game.tasks.length).toBe(4);
    expect(new Set(m.game.tasks.map((t) => t.owner)).size).toBeGreaterThan(1);
  });

  it('human commander gets an appoint-no-comm decision', () => {
    const m = advance(setupMatch(m11, P, { P1: false, P2: false, P3: false }, 3));
    const view = viewFor(m, m.game.commander);
    expect(view.decision?.kind).toBe('appoint-no-comm');
    const appointee = view.decision!.candidates[0]!;
    const after = applyHumanAction(m, m.game.commander, { type: 'commander-assign', assignee: appointee });
    expect(after.game.appointedNoCommPlayer).toBe(appointee);
  });

  it('the appointed player is actually blocked from communicating (engine)', () => {
    let g = createGame({ players: P, missionId: 11, seed: 1, communicationPolicy: { oneMemberNoComm: true } });
    g = setAppointedNoCommPlayer(g, 'P2');
    g = beginTricks(g);
    const validCard = (p: PlayerId): Card => (g.hands[p] ?? []).find((c) => commClassification(g.hands[p]!, c) !== null)!;
    const c2 = validCard('P2');
    expect(() => communicate(g, 'P2', c2, commClassification(g.hands['P2']!, c2))).toThrow(/appointed/);
    const c1 = validCard('P1');
    expect(() => communicate(g, 'P1', c1, commClassification(g.hands['P1']!, c1))).not.toThrow();
  });
});
