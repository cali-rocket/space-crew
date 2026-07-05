import { describe, it, expect } from 'vitest';
import { MISSIONS, PlayerId, OrderToken } from '@space-crew/engine';
import { setupMatch, advance } from './controller';

const P: PlayerId[] = ['P1', 'P2', 'P3'];
const bots = { P1: true, P2: true, P3: true };

function orderKinds(missionId: number, seed: number): (OrderToken['kind'] | undefined)[] {
  const def = MISSIONS.find((m) => m.id === missionId)!;
  const m = advance(setupMatch(def, P, bots, seed));
  // order tokens persist on tasks through the whole game
  return m.game.tasks.map((t) => t.order?.kind);
}

describe('order-token wiring', () => {
  it('M48 binds a "last" order token onto exactly one task', () => {
    const kinds = orderKinds(48, 5);
    expect(kinds.filter((k) => k === 'last').length).toBe(1);
  });

  it('M49 binds three absolute order tokens (1-2-3)', () => {
    const def = MISSIONS.find((m) => m.id === 49)!;
    const m = advance(setupMatch(def, P, bots, 5));
    const abs = m.game.tasks.filter((t) => t.order?.kind === 'absolute');
    expect(abs.length).toBe(3);
    expect(abs.map((t) => (t.order as { position: number }).position).sort()).toEqual([1, 2, 3]);
  });

  it('M40 binds two absolute order tokens', () => {
    const def = MISSIONS.find((m) => m.id === 40)!;
    const m = advance(setupMatch(def, P, bots, 5));
    expect(m.game.tasks.filter((t) => t.order?.kind === 'absolute').length).toBe(2);
  });

  it('missions without order tokens bind none', () => {
    const kinds = orderKinds(2, 5); // plain 2-task mission
    expect(kinds.every((k) => k === undefined)).toBe(true);
  });
});
