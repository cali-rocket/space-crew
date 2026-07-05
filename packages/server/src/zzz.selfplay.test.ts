/**
 * Self-play probe: run 3 bots through every mission across many seeds and
 * assert engine invariants. Not a permanent unit test — a diagnostic harness.
 */
import { describe, it, expect } from 'vitest';
import { MISSIONS, trickWinner, sameCard, PlayerId, GameState } from '@space-crew/engine';
import { setupMatch, advance } from './controller';

const PLAYERS: PlayerId[] = ['P1', 'P2', 'P3'];
const ISBOT = { P1: true, P2: true, P3: true };
const SEEDS = 60;

interface Anomaly { mission: number; seed: number; kind: string; detail: string; }

function invariants(g: GameState, mission: number, seed: number, out: Anomaly[]) {
  // 1) card conservation — 40 unique cards across hands + current trick + history
  const all: string[] = [];
  for (const p of g.players) for (const c of g.hands[p] ?? []) all.push(`${c.suit}${c.value}`);
  for (const pl of g.currentTrick.plays) all.push(`${pl.card.suit}${pl.card.value}`);
  for (const t of g.trickHistory) for (const pl of t.plays) all.push(`${pl.card.suit}${pl.card.value}`);
  if (all.length !== 40) out.push({ mission, seed, kind: 'card-count', detail: `${all.length}≠40` });
  if (new Set(all).size !== all.length) out.push({ mission, seed, kind: 'duplicate-card', detail: `${all.length - new Set(all).size} dup` });

  // 2) recorded trick winner matches recomputed winner
  for (const t of g.trickHistory) {
    const w = trickWinner({ leader: t.leader, plays: t.plays });
    if (w !== t.winner) out.push({ mission, seed, kind: 'winner-mismatch', detail: `rec=${t.winner} calc=${w}` });
    if (t.plays.length !== g.players.length) out.push({ mission, seed, kind: 'short-trick', detail: `${t.plays.length} plays` });
  }

  // 3) terminal sanity
  if (g.phase === 'mission-result') {
    if (g.outcome === 'won') {
      // every task fulfilled AND its card was captured by its owner
      for (const task of g.tasks) {
        if (!task.fulfilled) out.push({ mission, seed, kind: 'won-unfulfilled', detail: `${task.card.suit}${task.card.value}` });
        const trick = g.trickHistory.find((t) => t.plays.some((p) => sameCard(p.card, task.card)));
        if (!trick) out.push({ mission, seed, kind: 'won-task-never-played', detail: `${task.card.suit}${task.card.value}` });
        else if (trick.winner !== task.owner) out.push({ mission, seed, kind: 'won-task-wrong-winner', detail: `${task.card.suit}${task.card.value} by ${trick.winner}≠${task.owner}` });
      }
    }
  }
}

function playOne(mission: number, seed: number, out: Anomaly[], distress?: { active: boolean; direction: 'left' | 'right' }): GameState | null {
  const def = MISSIONS[mission - 1]!;
  try {
    let m = setupMatch(def, PLAYERS, ISBOT, seed, distress);
    m = advance(m);
    // all-bot game must reach a terminal result
    if (m.game.phase !== 'mission-result' && m.game.outcome === 'in-progress') {
      out.push({ mission, seed, kind: 'STUCK', detail: `phase=${m.game.phase} step=${m.step} tricks=${m.game.trickHistory.length}` });
    }
    invariants(m.game, mission, seed, out);
    return m.game;
  } catch (e) {
    out.push({ mission, seed, kind: 'CRASH', detail: (e as Error).message });
    return null;
  }
}

describe('self-play probe', () => {
  it('runs 3 bots through all 50 missions', () => {
    const anomalies: Anomaly[] = [];
    const winByMission: Record<number, { won: number; lost: number; total: number }> = {};
    const detFails: Anomaly[] = [];

    for (let mission = 1; mission <= MISSIONS.length; mission++) {
      winByMission[mission] = { won: 0, lost: 0, total: 0 };
      for (let seed = 1; seed <= SEEDS; seed++) {
        const g = playOne(mission, seed, anomalies);
        if (g) {
          winByMission[mission]!.total++;
          if (g.outcome === 'won') winByMission[mission]!.won++;
          else if (g.outcome === 'lost') winByMission[mission]!.lost++;
          // determinism: replay same seed, compare outcome + trick count
          const g2 = playOne(mission, seed, [], undefined);
          if (g2 && (g2.outcome !== g.outcome || g2.trickHistory.length !== g.trickHistory.length)) {
            detFails.push({ mission, seed, kind: 'NON-DETERMINISTIC', detail: `${g.outcome}/${g.trickHistory.length} vs ${g2.outcome}/${g2.trickHistory.length}` });
          }
        }
      }
    }

    // distress code-path crash sweep (lighter): 8 seeds × both directions, all missions
    const distressAnoms: Anomaly[] = [];
    for (let mission = 1; mission <= MISSIONS.length; mission++) {
      for (let seed = 1; seed <= 8; seed++) {
        playOne(mission, 1000 + seed, distressAnoms, { active: true, direction: 'left' });
        playOne(mission, 2000 + seed, distressAnoms, { active: true, direction: 'right' });
      }
    }

    // ---- REPORT ----
    const hard = anomalies.filter((a) => ['CRASH', 'STUCK', 'card-count', 'duplicate-card', 'winner-mismatch', 'short-trick', 'won-unfulfilled', 'won-task-never-played', 'won-task-wrong-winner'].includes(a.kind));
    const byKind: Record<string, number> = {};
    for (const a of [...anomalies, ...distressAnoms]) byKind[a.kind] = (byKind[a.kind] ?? 0) + 1;

    console.log('\n===== SELF-PLAY REPORT =====');
    console.log(`games: ${MISSIONS.length}×${SEEDS} base + distress sweep`);
    console.log('anomaly counts by kind:', JSON.stringify(byKind));
    console.log(`determinism failures: ${detFails.length}`);

    const zeroWin = Object.entries(winByMission).filter(([, v]) => v.total > 0 && v.won === 0).map(([m]) => Number(m));
    console.log(`missions with 0 wins across ${SEEDS} seeds (review — impossible or just hard?): [${zeroWin.join(', ')}]`);

    // win-rate table (compact)
    const line = Object.entries(winByMission).map(([m, v]) => `${m}:${v.won}/${v.total}`).join('  ');
    console.log('win/total per mission:\n' + line);

    if (hard.length) {
      console.log(`\n!!! HARD anomalies: ${hard.length} — first 25:`);
      for (const a of hard.slice(0, 25)) console.log(`  M${a.mission} s${a.seed} [${a.kind}] ${a.detail}`);
    } else {
      console.log('\nNo HARD anomalies (no crashes/stuck/card-loss/winner/won-sanity issues).');
    }
    if (distressAnoms.filter((a) => ['CRASH', 'STUCK'].includes(a.kind)).length) {
      console.log('\n!!! Distress-path crashes/stuck — first 15:');
      for (const a of distressAnoms.filter((a) => ['CRASH', 'STUCK'].includes(a.kind)).slice(0, 15)) console.log(`  M${a.mission} s${a.seed} [${a.kind}] ${a.detail}`);
    }
    if (detFails.length) {
      console.log('\n!!! Determinism failures — first 10:');
      for (const a of detFails.slice(0, 10)) console.log(`  M${a.mission} s${a.seed} ${a.detail}`);
    }
    console.log('===== END REPORT =====\n');

    // Only fail on hard correctness anomalies (losing is allowed — bots are basic).
    expect({ hard: hard.length, distressCrashes: distressAnoms.filter((a) => ['CRASH', 'STUCK'].includes(a.kind)).length, det: detFails.length })
      .toEqual({ hard: 0, distressCrashes: 0, det: 0 });
  }, 120000);
});
