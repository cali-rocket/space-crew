import { describe, it, expect } from 'vitest';
import { createGame } from './state';
import { toPlayerView } from './view';
import { toRevealView } from './reveal';
import { deriveCounting } from './counting';

describe('toRevealView (practice-only ground truth)', () => {
  it('exposes actual opponent hands and marks perfect-info truth', () => {
    const g = createGame({ players: ['me', 'bot-1', 'bot-2'], missionId: 1, seed: 7 });
    const rv = toRevealView(g, 'me');

    expect(rv.__practiceOnly).toBe(true);
    expect(rv.opponentHands['bot-1']).toEqual(g.hands['bot-1']);
    expect(rv.opponentHands['bot-2']).toEqual(g.hands['bot-2']);
    expect(rv.opponentHands['me']).toBeUndefined();
    expect(rv.truth.perfectInfo).toBe(true);
  });

  it('diffs = every opponent card not yet deducible from public info', () => {
    const g = createGame({ players: ['me', 'bot-1', 'bot-2'], missionId: 1, seed: 7 });
    const rv = toRevealView(g, 'me');
    // At game start nothing has been played → public reconstruction is empty →
    // every opponent card is a diff.
    const total = g.hands['bot-1']!.length + g.hands['bot-2']!.length;
    expect(rv.diffs.length).toBe(total);
  });

  it('myDerived equals the public-only counting state', () => {
    const g = createGame({ players: ['me', 'bot-1', 'bot-2'], missionId: 1, seed: 7 });
    const rv = toRevealView(g, 'me');
    const publicCs = deriveCounting(toPlayerView(g, 'me'));
    expect(rv.myDerived.remaining).toEqual(publicCs.remaining);
    expect(rv.myDerived.rockets).toEqual(publicCs.rockets);
  });
});
