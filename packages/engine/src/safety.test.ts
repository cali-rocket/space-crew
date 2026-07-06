import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { createGame } from './state';
import { toPlayerView } from './view';

describe('info-model safety — reveal cannot leak into real games', () => {
  it('toPlayerView never exposes another player hand', () => {
    const g = createGame({ players: ['me', 'bot-1', 'bot-2'], missionId: 1, seed: 3 });
    const view = toPlayerView(g, 'me');
    expect(view.myHand).toEqual(g.hands['me']);
    // Seats carry only a handCount, never the cards.
    for (const s of view.seats) {
      expect((s as unknown as { hand?: unknown }).hand).toBeUndefined();
      expect((s as unknown as { cards?: unknown }).cards).toBeUndefined();
    }
    // No top-level `hands` map on the view at all.
    expect((view as unknown as { hands?: unknown }).hands).toBeUndefined();
  });

  it('no server source references the reveal path', () => {
    const serverSrc = fileURLToPath(new URL('../../server/src/', import.meta.url));
    if (!existsSync(serverSrc)) throw new Error('server src not found: ' + serverSrc);
    const files = readdirSync(serverSrc).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const txt = readFileSync(serverSrc + f, 'utf8');
      expect(txt, `${f} must not touch reveal`).not.toMatch(/toRevealView|RevealView|opponentHands|['"]\.\/reveal['"]/);
    }
  });

  it('the wire protocol carries no reveal field', () => {
    const protocol = fileURLToPath(new URL('../../shared/src/protocol.ts', import.meta.url));
    const txt = readFileSync(protocol, 'utf8');
    expect(txt).not.toMatch(/reveal|opponentHands/i);
  });
});
