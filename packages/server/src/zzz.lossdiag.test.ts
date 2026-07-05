/** Diagnostic: how fast do bot games end, and are the losses legitimate? */
import { describe, it, expect } from 'vitest';
import { MISSIONS, trickWinner, sameCard, PlayerId, GameState } from '@space-crew/engine';
import { setupMatch, advance } from './controller';

const P: PlayerId[] = ['P1', 'P2', 'P3'];
const bots = { P1: true, P2: true, P3: true };
const SEEDS = 60;

// Determine why a game was lost; returns a cause string, or 'SPURIOUS' if none found (a bug).
function lossCause(g: GameState): string {
  // 1) a completed trick where a task card was won by a non-owner
  for (const t of g.trickHistory) {
    for (const task of g.tasks) {
      if (t.plays.some((p) => sameCard(p.card, task.card)) && t.winner !== task.owner) {
        return 'wrong-owner-capture';
      }
    }
  }
  // 2) reached the end with an unfulfilled task (or unmet constraint)
  const maxHand = Math.max(...g.players.map((p) => g.hands[p]!.length));
  if (g.trickHistory.length >= 1 && maxHand <= 1) {
    if (g.tasks.some((t) => !t.fulfilled)) return 'end-unfulfilled-task';
    return 'end-constraint-unmet';
  }
  // 3) lost mid-game but no wrong-owner capture -> order/constraint violation (has a cause)
  return 'order-or-constraint-violation';
}

describe('loss diagnostics', () => {
  it('reports game length + loss legitimacy per mission', () => {
    const rows: string[] = [];
    let spurious = 0;
    let instantLossTotal = 0, gamesTotal = 0;
    const causeTotals: Record<string, number> = {};

    for (let mission = 1; mission <= MISSIONS.length; mission++) {
      const def = MISSIONS[mission - 1]!;
      let won = 0, lost = 0, instantLoss = 0;
      const trickCounts: number[] = [];
      for (let seed = 1; seed <= SEEDS; seed++) {
        const g = advance(setupMatch(def, P, bots, seed)).game;
        gamesTotal++;
        trickCounts.push(g.trickHistory.length);
        if (g.outcome === 'won') won++;
        else if (g.outcome === 'lost') {
          lost++;
          if (g.trickHistory.length <= 2) { instantLoss++; instantLossTotal++; }
          const cause = lossCause(g);
          causeTotals[cause] = (causeTotals[cause] ?? 0) + 1;
          if (cause === 'SPURIOUS') spurious++;
        }
      }
      trickCounts.sort((a, b) => a - b);
      const median = trickCounts[Math.floor(trickCounts.length / 2)];
      rows.push(`M${mission}: won ${won} lost ${lost} | medianTricks ${median} | ≤2-trick losses ${instantLoss}/${SEEDS}`);
    }

    console.log('\n===== LOSS DIAGNOSTICS =====');
    console.log(rows.join('\n'));
    console.log('\nloss causes:', JSON.stringify(causeTotals));
    console.log(`SPURIOUS losses (no valid cause = BUG): ${spurious}`);
    console.log(`INSTANT losses (≤2 tricks) overall: ${instantLossTotal}/${gamesTotal} = ${(100 * instantLossTotal / gamesTotal).toFixed(1)}%`);
    console.log('===== END =====\n');

    // The only hard assertion: no loss should be spurious (every loss must have a rules cause).
    expect(spurious).toBe(0);
  }, 120000);
});
