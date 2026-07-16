import { Card, Color, COLORS } from './cards';
import { PlayerView } from './view';
import { CountingState } from './counting';

export type PrincipleId =
  | 'master'
  | 'trump-counting'
  | 'void'
  | 'void-reconstruction'
  | 'low-task'
  | 'comm-timing'
  | 'lead'
  | 'endgame';
export type Severity = 'info' | 'warn' | 'danger';

export interface Advice {
  principle: PrincipleId;
  severity: Severity;
  message: string;
}

export interface TaskReach {
  card: Card;
  owner: string;
  winnable: boolean;
  missing: string[];
  higherOutstanding: number;
}

const SUIT_K: Record<string, string> = { pink: '분홍', blue: '파랑', green: '초록', yellow: '노랑', rocket: '로켓' };
const k = (c: Card) => `${SUIT_K[c.suit]}${c.value}`;
const isColor = (c: Card) => c.suit !== 'rocket';

/**
 * The hard "win a LOW target card" test. A low colour task only wins a trick when ALL
 * THREE hold (red-team correctness fix — the naive "strip highers" advice loses otherwise):
 *   1. every higher card of that suit is gone,
 *   2. no rocket can trump it (rockets exhausted OR both opponents proven to hold the suit),
 *   3. you can force/hold the lead in that suit (hold a master, or the card is itself top).
 */
export function lowTaskNowWinnable(
  cs: CountingState,
  view: PlayerView,
  task: Card,
): { winnable: boolean; missing: string[]; higherOutstanding: number } {
  if (task.suit === 'rocket') return { winnable: true, missing: [], higherOutstanding: 0 };
  const S = task.suit as Color;
  const missing: string[] = [];

  const higherOutstanding = cs.remaining[S].filter((v) => v > task.value).length;
  if (higherOutstanding > 0) missing.push(`위 ${SUIT_K[S]} 소진 (${higherOutstanding}장 남음)`);

  const opps = view.seats.filter((s) => s.player !== view.me);
  const bothHoldSuit = opps.length === 2 && opps.every((o) => (cs.reconstructed[o.player] ?? []).some((rc) => rc.suit === S));
  const trumpSafe = cs.rockets.remaining === 0 || bothHoldSuit;
  if (!trumpSafe) missing.push(`트럼프 봉쇄 (로켓 ${cs.rockets.remaining}장 밖)`);

  const haveLeadTool = cs.masters.length > 0 || higherOutstanding === 0;
  if (!haveLeadTool) missing.push('리드 확보 수단');

  return { winnable: missing.length === 0, missing, higherOutstanding };
}

export function taskReachability(cs: CountingState, view: PlayerView): TaskReach[] {
  const open = view.seats.flatMap((s) => s.tasks.filter((t) => !t.fulfilled));
  return open.map((t) => ({ card: t.card, owner: t.owner, ...lowTaskNowWinnable(cs, view, t.card) }));
}

/** Explainable coaching from PUBLIC counting state only — every advice carries a "why". */
export function evaluateCoach(cs: CountingState, view: PlayerView): Advice[] {
  const out: Advice[] = [];
  const me = view.me;
  const myMasters = cs.masters;
  const myOpen = (view.seats.find((s) => s.player === me)?.tasks ?? []).filter((t) => !t.fulfilled);

  // 1) LOW-task trap (danger) — my task with higher cards still out and not yet winnable.
  for (const t of myOpen) {
    if (!isColor(t.card)) continue;
    const r = lowTaskNowWinnable(cs, view, t.card);
    if (!r.winnable && r.higherOutstanding > 0) {
      out.push({
        principle: 'low-task',
        severity: 'danger',
        message: `네 태스크 ${k(t.card)}는 (위 카드 소진 ∧ 트럼프 봉쇄 ∧ 리드 확보) 시에만 승리해요. 지금 빠진 조건: ${r.missing.join(', ')}`,
      });
    }
  }

  // 2) Masters (info).
  for (const m of myMasters) {
    out.push({ principle: 'master', severity: 'info', message: `${k(m)}는 마스터 — 리드로 주도권을 잡을 수 있어요.` });
  }

  // 3) Trump-counting (warn) — my HIGHEST card in a colour is a would-be winner but a
  //    rocket could still trump it. One warning per colour (about my top card only).
  if (cs.rockets.remaining > 0) {
    for (const color of COLORS) {
      const mine = view.myHand.filter((c) => c.suit === color);
      if (mine.length === 0) continue;
      const top = mine.reduce((a, b) => (b.value > a.value ? b : a));
      const higherOut = cs.remaining[color].some((v) => v > top.value);
      const isMaster = myMasters.some((m) => m.suit === color && m.value === top.value);
      if (!higherOut && !isMaster) {
        out.push({
          principle: 'trump-counting',
          severity: 'warn',
          message: `${k(top)}는 그 색 최고지만 로켓 ${cs.rockets.remaining}장이 밖 — 트럼프당할 수 있어요. 로켓을 빼내거나 잔여 0까지 기다리세요.`,
        });
      }
    }
  }

  // 4) Voids + reconstruction (info).
  for (const [p, suits] of Object.entries(cs.voids)) {
    if (p === me || suits.length === 0) continue;
    const s = suits.map((x) => SUIT_K[x] ?? x).join(',');
    out.push({ principle: 'void', severity: 'info', message: `${p}는 ${s}에 보이드 — 미확인 ${s}은 나머지 손에. 소거 단서예요.` });
  }
  for (const [p, cards] of Object.entries(cs.reconstructed)) {
    const seat = view.seats.find((s) => s.player === p);
    if (seat && cards.length > 0 && cards.length === seat.handCount) {
      out.push({ principle: 'void-reconstruction', severity: 'info', message: `${p} 손패를 소거법으로 전부 읽을 수 있어요 — 앞면 깐 셈 치고 플레이하세요.` });
    }
  }

  // 5) Lead management + communication timing (only when I actually hold the lead).
  const myLead = view.phase === 'trick-in-progress' && view.currentTrick.plays.length === 0 && view.currentTrick.leader === me;
  if (myLead && myMasters.length > 0) {
    out.push({ principle: 'lead', severity: 'info', message: '지금 리드 — 마스터로 주도권을 유지하고 태스크를 세팅하세요.' });
  }
  if (myLead) {
    out.push({ principle: 'comm-timing', severity: 'info', message: '통신 토큰(3개)은 카운팅으로 못 아는 정보(싱글턴/진짜 최저)에 아껴요.' });
  }

  // 6) Endgame perfect information (info).
  if (cs.perfectInfo) {
    out.push({ principle: 'endgame', severity: 'info', message: '완전정보 — 남은 카드가 모두 위치 확정. 정확한 승리 라인을 계획하세요.' });
  }

  const rank: Record<Severity, number> = { danger: 0, warn: 1, info: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
