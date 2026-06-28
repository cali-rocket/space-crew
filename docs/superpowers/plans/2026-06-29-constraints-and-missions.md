# Plan 3 — Constraint Catalog, MissionDef, and 50-Mission Data

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** 엔진에 특수 제약 평가 프레임워크와 모든 제약 타입을 추가하고, `MissionDef`로 미션을 구성하며, 50개 미션을 로그북 원문에서 데이터로 인코딩한다. 완료 시 50개 미션 전부를 엔진에서 셋업·플레이·승패판정할 수 있다.

**Architecture:** Plan 1·2의 순수 엔진 위에 `ConstraintDef`(데이터)와 `constraints.ts`(평가)를 추가한다. 각 제약은 `(state) → 'pending' | 'satisfied' | 'violated'`로 평가되고, 트릭 완료마다 하나라도 `violated`면 즉시 패배, 13트릭 종료 시 모든 태스크 fulfilled + 모든 제약 satisfied면 승리(아니면 패배). `MissionDef`는 통신정책·배정방식·태스크수·순서토큰·제약·역할을 묶어 `createGame`를 구성한다.

**Tech Stack:** TypeScript strict, npm workspaces, Vitest.

## Global Constraints

- 기존 Plan 1·2 코드와 호환. 기존 71개 테스트는 계속 통과.
- TS `strict` + `noUncheckedIndexedAccess`. 순수 함수. 엔진 런타임 의존성 0. 결정성(시드) 유지.
- 3인 게임은 **13트릭**(인덱스 0..12). 마지막 트릭 = 인덱스 12.
- 트릭의 "승리 카드" = 승자가 그 트릭에 낸 카드.
- 커밋 프리픽스 `feat:`/`test:`. 각 태스크 끝에 커밋.
- 데이터 무결성(T8): 각 미션은 로그북 원문 인용(`sourceText`)·페이지를 동반하고, 리뷰어가 로그북과 1:1 더블엔트리 대조한다.

---

## File Structure

- Modify: `packages/engine/src/state.ts` — `ConstraintDef` 타입, `GameState.roles`/`GameState.constraints` 필드, `createGame` 옵션, `winningCard` 헬퍼는 trick.ts에.
- Modify: `packages/engine/src/trick.ts` — `winningCard(trick)` 헬퍼.
- Create: `packages/engine/src/constraints.ts` — `evaluateConstraint`, `constraintsViolated`, `constraintsAllSatisfied`.
- Modify: `packages/engine/src/play.ts` — 트릭 완료 시 제약 위반 검사.
- Modify: `packages/engine/src/outcome.ts` — 승리 조건에 제약 satisfied 포함, 미충족 종료 시 패배.
- Modify: `packages/engine/src/assign.ts` — `assignRole`, 역할 도출.
- Create: `packages/engine/src/mission.ts` — `MissionDef`, `createMission`.
- Create: `packages/engine/src/missions.data.ts` — 50개 미션 데이터.
- Modify: `packages/engine/src/index.ts` — 배럴.
- 각 옆 `*.test.ts`.

---

## Task 1: 제약 프레임워크 + 첫 제약(forbid-win-value) + 엔진 통합

**Files:**
- Modify: `packages/engine/src/state.ts`, `packages/engine/src/trick.ts`, `packages/engine/src/play.ts`, `packages/engine/src/outcome.ts`
- Create: `packages/engine/src/constraints.ts`
- Test: `packages/engine/src/constraints.test.ts`

**Interfaces:**
- Produces (state.ts): `ConstraintDef` 유니온(아래), `GameState.roles: Record<string, PlayerId>`, `GameState.constraints: ConstraintDef[]`, `createGame` 옵션 `constraints?`, `roles?`.
- Produces (trick.ts): `function winningCard(trick: { plays: Play[]; winner?: string }, winner: string): Card`.
- Produces (constraints.ts): `function evaluateConstraint(def: ConstraintDef, state: GameState): 'pending' | 'satisfied' | 'violated'`; `function constraintsViolated(state): boolean`; `function constraintsAllSatisfied(state): boolean`.

`ConstraintDef` 전체 유니온(이 계획에서 단계적으로 평가 구현; state.ts에 한 번에 선언):
```ts
export type ConstraintDef =
  | { kind: 'forbid-win-value'; value: number }
  | { kind: 'win-value-count'; value: number; count: number; distinct?: boolean }
  | { kind: 'win-cards'; cards: Card[]; ordered: boolean }
  | { kind: 'player-trick-count'; role: string; count: number; rocketAllowed: boolean }
  | { kind: 'player-exact-tricks'; role: string; tricks: number[] | 'first-last'; exclusive: boolean; rocketAllowed: boolean }
  | { kind: 'balance'; maxDiff: number }
  | { kind: 'task-in-last-trick'; card: Card }
  | { kind: 'trick-partition'; parts: { role: string; range: 'first4' | 'last' | 'middle' }[] }
  | { kind: 'pink-left-sweep' };
```

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/engine/src/constraints.test.ts`:
```ts
import { createGame, GameState, CompletedTrick } from './state';
import { evaluateConstraint, constraintsViolated, constraintsAllSatisfied } from './constraints';
import { Card } from './cards';

const P = ['p0', 'p1', 'p2'];
const C = (s: Card['suit'], v: number): Card => ({ suit: s, value: v });
const trick = (winner: string, cards: [string, Card][]): CompletedTrick => ({
  leader: cards[0]![0], winner, plays: cards.map(([player, card]) => ({ player, card })),
});

function withHistory(history: CompletedTrick[], constraints: GameState['constraints'] = []): GameState {
  return { ...createGame({ players: P, missionId: 1, seed: 1, constraints }), trickHistory: history };
}

test('forbid-win-value: violated when a trick is won by that value', () => {
  const s = withHistory([trick('p0', [['p0', C('pink', 9)], ['p1', C('pink', 2)], ['p2', C('blue', 1)]])]);
  expect(evaluateConstraint({ kind: 'forbid-win-value', value: 9 }, s)).toBe('violated');
});

test('forbid-win-value: satisfied when no trick won by that value (even if present off-suit)', () => {
  // pink lead, p2 dumps green 9 but p0 wins with pink 5 → 9 is in trick but not the winning card
  const s = withHistory([trick('p0', [['p0', C('pink', 5)], ['p1', C('pink', 2)], ['p2', C('green', 9)]])]);
  expect(evaluateConstraint({ kind: 'forbid-win-value', value: 9 }, s)).toBe('satisfied');
});

test('constraintsViolated / allSatisfied aggregate over state.constraints', () => {
  const bad = withHistory(
    [trick('p0', [['p0', C('pink', 9)], ['p1', C('pink', 2)], ['p2', C('blue', 1)]])],
    [{ kind: 'forbid-win-value', value: 9 }],
  );
  expect(constraintsViolated(bad)).toBe(true);
  const ok = withHistory([], [{ kind: 'forbid-win-value', value: 9 }]);
  expect(constraintsViolated(ok)).toBe(false);
  expect(constraintsAllSatisfied(ok)).toBe(true); // prohibition with no violation = satisfied
});
```

- [ ] **Step 2: 테스트 실패 확인** — Run: `npm test --workspace @space-crew/engine` → FAIL.

- [ ] **Step 3: state.ts 확장** — `ConstraintDef`(위 전체 유니온) 추가, `GameState`에 `roles: Record<string, PlayerId>;`·`constraints: ConstraintDef[];` 추가, `createGame` 인자에 `constraints?: ConstraintDef[]; roles?: Record<string, PlayerId>;` 추가하고 반환에 `roles: args.roles ?? {}, constraints: args.constraints ?? [],` 포함.

- [ ] **Step 4: trick.ts에 winningCard 추가**
```ts
export function winningCard(trick: { plays: Play[] }, winner: string): Card {
  const play = trick.plays.find((p) => p.player === winner);
  if (!play) throw new Error('winner has no card in this trick');
  return play.card;
}
```

- [ ] **Step 5: constraints.ts 구현 (이 태스크는 forbid-win-value만 평가; 나머지 kind는 후속 태스크에서 채움 — 미구현 kind는 'pending' 반환)**
```ts
import { Card } from './cards';
import { winningCard } from './trick';
import { ConstraintDef, GameState } from './state';

export function evaluateConstraint(def: ConstraintDef, state: GameState): 'pending' | 'satisfied' | 'violated' {
  switch (def.kind) {
    case 'forbid-win-value': {
      const violated = state.trickHistory.some((t) => winningCard(t, t.winner).value === def.value);
      return violated ? 'violated' : 'satisfied';
    }
    default:
      return 'pending'; // 후속 태스크에서 구현
  }
}

export function constraintsViolated(state: GameState): boolean {
  return state.constraints.some((c) => evaluateConstraint(c, state) === 'violated');
}

export function constraintsAllSatisfied(state: GameState): boolean {
  return state.constraints.every((c) => evaluateConstraint(c, state) === 'satisfied');
}
```

- [ ] **Step 6: play.ts 통합** — `import { constraintsViolated } from './constraints';` 추가하고, 순서 위반 검사 다음에:
```ts
  if (outcome === 'in-progress' && constraintsViolated({ ...state, tasks, trickHistory: [...state.trickHistory, completed] })) {
    outcome = 'lost';
  }
```
(주: 제약은 방금 완료된 트릭까지 반영해 평가해야 하므로 `trickHistory`에 `completed`를 포함한 임시 state로 평가한다. `tasks`도 갱신본을 넘긴다.)

- [ ] **Step 7: outcome.ts 통합** — `import { constraintsAllSatisfied } from './constraints';`. `evaluateOutcome`의 승리 판정을 `allTricksPlayed(state) && allFulfilled && constraintsAllSatisfied(state)`로 바꾸고, **추가**: `allTricksPlayed(state)`인데 (모든 태스크 fulfilled가 아니거나 제약 미satisfied)이면 `outcome='lost', phase='mission-result'` 반환(13트릭 끝났는데 목표 미달 = 패배). 기존 lost-우선 유지.

- [ ] **Step 8: 테스트 통과 확인** — Run: `npm test --workspace @space-crew/engine` → PASS(신규 + 기존 71, 단 outcome 변경으로 기존 outcome 테스트가 영향받으면 그 테스트의 손패/태스크 구성을 점검; 기존 미니 미션은 제약 없음·태스크 fulfilled라 won 유지되어야 함).

- [ ] **Step 9: 커밋** — `git add -A && git commit -m "feat: constraint framework + forbid-win-value + win/loss integration"`

---

## Task 2: 승리-카드 목표 (win-value-count, win-cards)

**Files:** Modify `constraints.ts`; Test `packages/engine/src/constraints.objectives.test.ts`

**Interfaces:** `evaluateConstraint`에 `win-value-count`·`win-cards` 구현.
- `win-value-count {value, count, distinct}`: 승리 카드 중 value가 일치하는 트릭 수(distinct면 서로 다른 카드 기준)가 count 이상이면 'satisfied', 아니면 'pending'. (양의 목표 — 위반 없음.)
- `win-cards {cards, ordered}`: 지정 카드들이 각각 어떤 트릭의 승리 카드여야 함. ordered면 그 카드들이 승리한 순서가 배열 순서와 일치해야 하며, 어긋나면 'violated'. 모두 승리(순서 OK)면 'satisfied', 아직이면 'pending'.

- [ ] **Step 1: 실패 테스트 작성**

`constraints.objectives.test.ts`:
```ts
import { createGame, GameState, CompletedTrick } from './state';
import { evaluateConstraint } from './constraints';
import { Card } from './cards';

const P = ['p0', 'p1', 'p2'];
const C = (s: Card['suit'], v: number): Card => ({ suit: s, value: v });
const trick = (winner: string, winCard: Card): CompletedTrick => ({
  leader: 'p0', winner, plays: [{ player: winner, card: winCard }, { player: 'x', card: C('blue', 1) }, { player: 'y', card: C('green', 1) }],
});
const st = (history: CompletedTrick[]): GameState => ({ ...createGame({ players: P, missionId: 1, seed: 1 }), trickHistory: history });

test('win-value-count: pending then satisfied', () => {
  expect(evaluateConstraint({ kind: 'win-value-count', value: 1, count: 1 }, st([]))).toBe('pending');
  expect(evaluateConstraint({ kind: 'win-value-count', value: 1, count: 1 }, st([trick('p0', C('pink', 1))]))).toBe('satisfied');
});

test('win-value-count distinct: two different 1s', () => {
  const one = st([trick('p0', C('pink', 1))]);
  expect(evaluateConstraint({ kind: 'win-value-count', value: 1, count: 2, distinct: true }, one)).toBe('pending');
  const two = st([trick('p0', C('pink', 1)), trick('p1', C('blue', 1))]);
  expect(evaluateConstraint({ kind: 'win-value-count', value: 1, count: 2, distinct: true }, two)).toBe('satisfied');
});

test('win-cards unordered: all rockets must win', () => {
  const rockets = [C('rocket', 1), C('rocket', 2), C('rocket', 3), C('rocket', 4)];
  const partial = st(rockets.slice(0, 3).map((c, i) => trick(P[i % 3]!, c)));
  expect(evaluateConstraint({ kind: 'win-cards', cards: rockets, ordered: false }, partial)).toBe('pending');
  const all = st(rockets.map((c, i) => trick(P[i % 3]!, c)));
  expect(evaluateConstraint({ kind: 'win-cards', cards: rockets, ordered: false }, all)).toBe('satisfied');
});

test('win-cards ordered: out-of-order is violated', () => {
  const rockets = [C('rocket', 1), C('rocket', 2), C('rocket', 3), C('rocket', 4)];
  const bad = st([trick('p0', C('rocket', 2)), trick('p1', C('rocket', 1))]); // 2 before 1
  expect(evaluateConstraint({ kind: 'win-cards', cards: rockets, ordered: true }, bad)).toBe('violated');
  const good = st([trick('p0', C('rocket', 1)), trick('p1', C('rocket', 2))]);
  expect(evaluateConstraint({ kind: 'win-cards', cards: rockets, ordered: true }, good)).toBe('pending');
});
```

- [ ] **Step 2: 실패 확인** — FAIL.

- [ ] **Step 3: 구현 (constraints.ts switch에 추가)**
```ts
import { sameCard, cardKey } from './cards'; // 상단 import 보강

    case 'win-value-count': {
      const winners = state.trickHistory.map((t) => winningCard(t, t.winner)).filter((c) => c.value === def.value);
      const n = def.distinct ? new Set(winners.map(cardKey)).size : winners.length;
      return n >= def.count ? 'satisfied' : 'pending';
    }
    case 'win-cards': {
      const winSeq = state.trickHistory.map((t) => winningCard(t, t.winner));
      const wonOf = (card: Card) => winSeq.findIndex((w) => sameCard(w, card));
      const idxs = def.cards.map(wonOf);
      if (def.ordered) {
        const present = idxs.filter((i) => i >= 0);
        for (let i = 1; i < present.length; i++) if (present[i]! < present[i - 1]!) return 'violated';
        // also: a later card won while an earlier one hasn't → out of order
        for (let i = 0; i < def.cards.length; i++) {
          if (idxs[i]! >= 0) {
            for (let j = 0; j < i; j++) if (idxs[j]! < 0) return 'violated';
          }
        }
      }
      return idxs.every((i) => i >= 0) ? 'satisfied' : 'pending';
    }
```

- [ ] **Step 4: 통과 확인** — PASS.
- [ ] **Step 5: 커밋** — `git commit -am "feat: winning-card objectives (win-value-count, win-cards ordered/unordered)"`

---

## Task 3: 플레이어 트릭 제약 (player-trick-count, player-exact-tricks)

**Files:** Modify `constraints.ts`; Test `packages/engine/src/constraints.player.test.ts`

**Interfaces:** `evaluateConstraint`에 추가. `state.roles[def.role]`로 대상 플레이어를 찾는다(없으면 'pending').
- `player-trick-count {role, count, rocketAllowed}`: 대상이 이긴 트릭 수 w. w>count → 'violated'. !rocketAllowed인데 로켓 승리 카드로 이긴 트릭 있으면 'violated'. w===count → 'satisfied'. 아니면 'pending'.
- `player-exact-tricks {role, tricks, exclusive, rocketAllowed}`: tricks='first-last' → 필수 인덱스 {0,12}. 완료된 각 트릭 i: i∈필수면 승자=대상이어야(아니면 violated), exclusive이고 i∉필수면 승자≠대상이어야(아니면 violated). !rocketAllowed인데 대상이 로켓으로 이긴 트릭 violated. 필수 트릭이 모두 완료·충족되면(그리고 exclusive면 그 외 미승리) 'satisfied', 아니면 'pending'.

- [ ] **Step 1: 실패 테스트** — `constraints.player.test.ts`:
```ts
import { createGame, GameState, CompletedTrick } from './state';
import { evaluateConstraint } from './constraints';
import { Card } from './cards';

const P = ['p0', 'p1', 'p2'];
const C = (s: Card['suit'], v: number): Card => ({ suit: s, value: v });
const tk = (winner: string, winCard: Card = C('blue', 5)): CompletedTrick => ({ leader: 'p0', winner, plays: [{ player: winner, card: winCard }] });
const st = (history: CompletedTrick[], roles: Record<string, string> = {}): GameState => ({ ...createGame({ players: P, missionId: 1, seed: 1, roles }), trickHistory: history });

test('player-trick-count 0: violated as soon as the role wins a trick', () => {
  const def = { kind: 'player-trick-count', role: 'sick', count: 0, rocketAllowed: true } as const;
  expect(evaluateConstraint(def, st([], { sick: 'p1' }))).toBe('satisfied');
  expect(evaluateConstraint(def, st([tk('p1')], { sick: 'p1' }))).toBe('violated');
});

test('player-trick-count exactly 1, no rocket', () => {
  const def = { kind: 'player-trick-count', role: 'chosen', count: 1, rocketAllowed: false } as const;
  expect(evaluateConstraint(def, st([tk('p2')], { chosen: 'p2' }))).toBe('satisfied');
  expect(evaluateConstraint(def, st([tk('p2'), tk('p2')], { chosen: 'p2' }))).toBe('violated');
  expect(evaluateConstraint(def, st([tk('p2', C('rocket', 1))], { chosen: 'p2' }))).toBe('violated');
});

test('player-exact-tricks first-last not exclusive', () => {
  const def = { kind: 'player-exact-tricks', role: 'cmd', tricks: 'first-last', exclusive: false, rocketAllowed: true } as const;
  const hist = Array.from({ length: 13 }, (_, i) => tk(i === 0 || i === 12 ? 'p0' : 'p1'));
  expect(evaluateConstraint(def, st(hist, { cmd: 'p0' }))).toBe('satisfied');
  const wrong = [...hist]; wrong[0] = tk('p1');
  expect(evaluateConstraint(def, st(wrong, { cmd: 'p0' }))).toBe('violated');
});

test('player-exact-tricks exclusive: winning a non-required trick violates', () => {
  const def = { kind: 'player-exact-tricks', role: 'cmd', tricks: 'first-last', exclusive: true, rocketAllowed: true } as const;
  const hist = [tk('p0'), tk('p0')]; // trick 1 (index1) by p0 but not required & exclusive
  expect(evaluateConstraint(def, st(hist, { cmd: 'p0' }))).toBe('violated');
});
```

- [ ] **Step 2: 실패 확인** — FAIL.

- [ ] **Step 3: 구현 (switch에 추가)**
```ts
    case 'player-trick-count': {
      const target = state.roles[def.role];
      if (target === undefined) return 'pending';
      const won = state.trickHistory.filter((t) => t.winner === target);
      if (!def.rocketAllowed && won.some((t) => winningCard(t, t.winner).suit === 'rocket')) return 'violated';
      if (won.length > def.count) return 'violated';
      return won.length === def.count ? 'satisfied' : 'pending';
    }
    case 'player-exact-tricks': {
      const target = state.roles[def.role];
      if (target === undefined) return 'pending';
      const TOTAL = 13;
      const required = def.tricks === 'first-last' ? [0, TOTAL - 1] : def.tricks;
      const reqSet = new Set(required);
      for (let i = 0; i < state.trickHistory.length; i++) {
        const t = state.trickHistory[i]!;
        const wonByTarget = t.winner === target;
        if (reqSet.has(i) && !wonByTarget) return 'violated';
        if (def.exclusive && !reqSet.has(i) && wonByTarget) return 'violated';
        if (wonByTarget && !def.rocketAllowed && winningCard(t, t.winner).suit === 'rocket') return 'violated';
      }
      const allRequiredDone = required.every((i) => i < state.trickHistory.length);
      return allRequiredDone ? 'satisfied' : 'pending';
    }
```

- [ ] **Step 4: 통과 확인** — PASS.
- [ ] **Step 5: 커밋** — `git commit -am "feat: player trick-count and exact-tricks constraints"`

---

## Task 4: 균형 제약 (balance)

**Files:** Modify `constraints.ts`; Test `packages/engine/src/constraints.balance.test.ts`

**Interfaces:** `balance {maxDiff}`: 현재까지 완료 트릭 기준 각 플레이어 승리 수의 (max - min) > maxDiff면 'violated'. 아니면, 13트릭 종료면 'satisfied' else 'pending'.

- [ ] **Step 1: 실패 테스트** — `constraints.balance.test.ts`:
```ts
import { createGame, GameState, CompletedTrick } from './state';
import { evaluateConstraint } from './constraints';
import { Card } from './cards';
const P = ['p0', 'p1', 'p2'];
const tk = (winner: string): CompletedTrick => ({ leader: 'p0', winner, plays: [{ player: winner, card: { suit: 'blue', value: 5 } as Card }] });
const st = (history: CompletedTrick[]): GameState => ({ ...createGame({ players: P, missionId: 1, seed: 1 }), trickHistory: history });

test('balance maxDiff 1: violated when someone leads by 2', () => {
  expect(evaluateConstraint({ kind: 'balance', maxDiff: 1 }, st([tk('p0'), tk('p0')]))).toBe('violated'); // p0:2 p1:0
});
test('balance maxDiff 1: ok when spread within 1', () => {
  expect(evaluateConstraint({ kind: 'balance', maxDiff: 1 }, st([tk('p0'), tk('p1')]))).toBe('pending'); // 1,1,0
});
```

- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현 (switch에 추가)**
```ts
    case 'balance': {
      const wins: Record<string, number> = Object.fromEntries(state.players.map((p) => [p, 0]));
      for (const t of state.trickHistory) wins[t.winner] = (wins[t.winner] ?? 0) + 1;
      const vals = state.players.map((p) => wins[p] ?? 0);
      if (Math.max(...vals) - Math.min(...vals) > def.maxDiff) return 'violated';
      return state.trickHistory.length >= 13 ? 'satisfied' : 'pending';
    }
```
- [ ] **Step 4: 통과 확인** — PASS.
- [ ] **Step 5: 커밋** — `git commit -am "feat: balance constraint (no player leads by more than maxDiff)"`

---

## Task 5: 특정-트릭·분할 제약 (task-in-last-trick, trick-partition)

**Files:** Modify `constraints.ts`; Test `packages/engine/src/constraints.trickpos.test.ts`

**Interfaces:**
- `task-in-last-trick {card}`: card가 승리당한(어떤 트릭의 plays에 포함되고 그 트릭을 누군가 이긴) 트릭 인덱스를 찾는다. 인덱스 < 12면 'violated'(마지막 전에 따짐), ===12면 'satisfied', 미발견이면 'pending'. (소유권은 태스크가 별도 검사.)
- `trick-partition {parts}`: 범위 매핑 first4=인덱스0..3, middle=4..11, last=12. 각 완료 트릭 i의 승자가 해당 범위 역할의 플레이어와 일치해야. 불일치 'violated'. 모든 트릭(13) 완료·일치면 'satisfied' else 'pending'. 역할 미바인딩이면 'pending'.

- [ ] **Step 1: 실패 테스트** — `constraints.trickpos.test.ts`:
```ts
import { createGame, GameState, CompletedTrick } from './state';
import { evaluateConstraint } from './constraints';
import { Card } from './cards';
const P = ['p0', 'p1', 'p2'];
const C = (s: Card['suit'], v: number): Card => ({ suit: s, value: v });
const tkCards = (winner: string, cards: Card[]): CompletedTrick => ({ leader: 'p0', winner, plays: cards.map((c, i) => ({ player: P[i % 3]!, card: c })) });
const st = (history: CompletedTrick[], roles: Record<string, string> = {}): GameState => ({ ...createGame({ players: P, missionId: 1, seed: 1, roles }), trickHistory: history });

test('task-in-last-trick: violated if won before the last trick', () => {
  const hist = [tkCards('p0', [C('pink', 3)])];
  expect(evaluateConstraint({ kind: 'task-in-last-trick', card: C('pink', 3) }, st(hist))).toBe('violated');
});
test('task-in-last-trick: satisfied if won in trick index 12', () => {
  const hist = Array.from({ length: 13 }, (_, i) => tkCards('p0', [i === 12 ? C('pink', 3) : C('blue', 5)]));
  expect(evaluateConstraint({ kind: 'task-in-last-trick', card: C('pink', 3) }, st(hist))).toBe('satisfied');
});
test('trick-partition: each range won by its role player', () => {
  const def = { kind: 'trick-partition', parts: [ { role: 'a', range: 'first4' }, { role: 'b', range: 'last' }, { role: 'c', range: 'middle' } ] } as const;
  const roles = { a: 'p0', b: 'p1', c: 'p2' };
  const hist = Array.from({ length: 13 }, (_, i) => tkCards(i < 4 ? 'p0' : i === 12 ? 'p1' : 'p2', [C('blue', 5)]));
  expect(evaluateConstraint(def, st(hist, roles))).toBe('satisfied');
  const wrong = [...hist]; wrong[0] = tkCards('p2', [C('blue', 5)]);
  expect(evaluateConstraint(def, st(wrong, roles))).toBe('violated');
});
```

- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현 (switch에 추가; 상단 sameCard import 사용)**
```ts
    case 'task-in-last-trick': {
      const idx = state.trickHistory.findIndex((t) => t.plays.some((p) => sameCard(p.card, def.card)));
      if (idx === -1) return 'pending';
      return idx === 12 ? 'satisfied' : 'violated';
    }
    case 'trick-partition': {
      const roleFor = (i: number): string | undefined => {
        const range = i < 4 ? 'first4' : i === 12 ? 'last' : 'middle';
        return def.parts.find((p) => p.range === range)?.role;
      };
      for (let i = 0; i < state.trickHistory.length; i++) {
        const role = roleFor(i);
        const target = role !== undefined ? state.roles[role] : undefined;
        if (target === undefined) return 'pending';
        if (state.trickHistory[i]!.winner !== target) return 'violated';
      }
      return state.trickHistory.length >= 13 ? 'satisfied' : 'pending';
    }
```
- [ ] **Step 4: 통과 확인** — PASS.
- [ ] **Step 5: 커밋** — `git commit -am "feat: task-in-last-trick and trick-partition constraints"`

---

## Task 6: 선언 제약 (pink-left-sweep) + 역할 도출

**Files:** Modify `constraints.ts`, `packages/engine/src/assign.ts`; Test `packages/engine/src/constraints.pink.test.ts`

**Interfaces:**
- assign.ts: `function assignRole(state: GameState, key: string, player: PlayerId): GameState` (roles 갱신); `function derivePink9Holder(state: GameState): PlayerId` (초기 손패에서 pink-9 보유자; 없으면 throw) — 단, 게임 중 손패가 바뀌므로 이 함수는 **딜 직후(트릭 시작 전)** 호출 가정.
- constraints.ts `pink-left-sweep`: 대상 = `roles['pink9holder']`의 **왼쪽(이전 좌석)** 플레이어. 완료된 각 트릭에서 pink 카드가 포함됐다면 그 트릭 승자가 대상이어야. 아니면 'violated'. 13트릭 종료·위반 없으면 'satisfied' else 'pending'. 역할 미바인딩이면 'pending'.

- [ ] **Step 1: 실패 테스트** — `constraints.pink.test.ts`:
```ts
import { createGame, GameState, CompletedTrick } from './state';
import { evaluateConstraint } from './constraints';
import { assignRole, derivePink9Holder } from './assign';
import { Card } from './cards';
const P = ['p0', 'p1', 'p2'];
const C = (s: Card['suit'], v: number): Card => ({ suit: s, value: v });
const tk = (winner: string, cards: Card[]): CompletedTrick => ({ leader: 'p0', winner, plays: cards.map((c, i) => ({ player: P[i % 3]!, card: c })) });

test('derivePink9Holder finds the seat holding pink 9', () => {
  const g = { ...createGame({ players: P, missionId: 46, seed: 1 }), hands: { p0: [], p1: [C('pink', 9)], p2: [] } } as GameState;
  expect(derivePink9Holder(g)).toBe('p1');
});

test('pink-left-sweep: target = left of holder must win all pink', () => {
  // holder p1 → left (prev seat) is p0. p0 must win every trick containing pink.
  const base = { ...createGame({ players: P, missionId: 46, seed: 1 }) } as GameState;
  const s = assignRole(base, 'pink9holder', 'p1');
  const okHist = [tk('p0', [C('pink', 3), C('blue', 2), C('green', 1)])];
  expect(evaluateConstraint({ kind: 'pink-left-sweep' }, { ...s, trickHistory: okHist })).toBe('pending');
  const badHist = [tk('p2', [C('pink', 3), C('blue', 2), C('green', 1)])]; // pink won by p2 ≠ p0
  expect(evaluateConstraint({ kind: 'pink-left-sweep' }, { ...s, trickHistory: badHist })).toBe('violated');
});
```

- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: assign.ts 추가**
```ts
export function assignRole(state: GameState, key: string, player: PlayerId): GameState {
  if (!state.players.includes(player)) throw new Error(`unknown player ${player}`);
  return { ...state, roles: { ...state.roles, [key]: player } };
}

export function derivePink9Holder(state: GameState): PlayerId {
  for (const p of state.players) {
    if ((state.hands[p] ?? []).some((c) => c.suit === 'pink' && c.value === 9)) return p;
  }
  throw new Error('pink 9 not held by anyone');
}
```
- [ ] **Step 4: constraints.ts 추가**
```ts
    case 'pink-left-sweep': {
      const holder = state.roles['pink9holder'];
      if (holder === undefined) return 'pending';
      const idx = state.players.indexOf(holder);
      const target = state.players[(idx - 1 + state.players.length) % state.players.length]!;
      for (const t of state.trickHistory) {
        if (t.plays.some((p) => p.card.suit === 'pink') && t.winner !== target) return 'violated';
      }
      return state.trickHistory.length >= 13 ? 'satisfied' : 'pending';
    }
```
- [ ] **Step 5: 통과 확인** — PASS.
- [ ] **Step 6: 커밋** — `git commit -am "feat: pink-left-sweep constraint and role assignment helpers"`

---

## Task 7: MissionDef + createMission

**Files:** Create `packages/engine/src/mission.ts`; Modify `packages/engine/src/index.ts`; Test `packages/engine/src/mission.test.ts`

**Interfaces:**
- `interface MissionDef { id; sourceText; logbookPage; taskCount; orderTokens?: OrderToken[]; communication?: CommunicationPolicy; constraints?: ConstraintDef[]; assignment?: 'open-pick' | 'commander-decision' | 'commander-distribution'; optionalHandover?: boolean; }`
- `function createMission(def: MissionDef, args: { players: PlayerId[]; seed: number; attemptNumber?: number }): GameState` — `createGame`를 호출하되 `missionId=def.id`, `communicationPolicy=def.communication ?? 'normal'`, `constraints=def.constraints ?? []`를 주입. (태스크 카드 추첨·배정·역할 바인딩은 호출측 셋업 단계 책임 — 이 함수는 미션 메타를 state에 반영.)

- [ ] **Step 1: 실패 테스트** — `mission.test.ts`:
```ts
import { createMission, MissionDef } from './mission';

const P = ['p0', 'p1', 'p2'];
const def: MissionDef = { id: 16, sourceText: 'You cannot win a trick with a 9-value card.', logbookPage: 5, taskCount: 2, communication: 'normal', constraints: [{ kind: 'forbid-win-value', value: 9 }] };

test('createMission wires mission metadata into the game state', () => {
  const s = createMission(def, { players: P, seed: 5 });
  expect(s.missionId).toBe(16);
  expect(s.constraints).toEqual([{ kind: 'forbid-win-value', value: 9 }]);
  expect(s.communicationPolicy).toBe('normal');
  expect(s.phase).toBe('task-assignment');
});
```
- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현** — `mission.ts`:
```ts
import { createGame, GameState, PlayerId, OrderToken, CommunicationPolicy, ConstraintDef } from './state';

export interface MissionDef {
  id: number;
  sourceText: string;
  logbookPage: number;
  taskCount: number;
  orderTokens?: OrderToken[];
  communication?: CommunicationPolicy;
  constraints?: ConstraintDef[];
  assignment?: 'open-pick' | 'commander-decision' | 'commander-distribution';
  optionalHandover?: boolean;
}

export function createMission(
  def: MissionDef,
  args: { players: PlayerId[]; seed: number; attemptNumber?: number },
): GameState {
  return createGame({
    players: args.players,
    missionId: def.id,
    seed: args.seed,
    attemptNumber: args.attemptNumber,
    communicationPolicy: def.communication ?? 'normal',
    constraints: def.constraints ?? [],
  });
}
```
- [ ] **Step 4: 배럴** — index.ts에 `export * from './constraints';` `export * from './mission';` 추가(기존 유지).
- [ ] **Step 5: 통과 확인** — Run: `npm test ... && npm run typecheck ...` → PASS, 0 에러.
- [ ] **Step 6: 커밋** — `git commit -am "feat: MissionDef and createMission"`

---

## Task 8: 50개 미션 데이터 인코딩 (로그북 원문 기준)

**Files:** Create `packages/engine/src/missions.data.ts`; Modify `packages/engine/src/index.ts`; Test `packages/engine/src/missions.data.test.ts`

**원천(권위):** `docs/reference/logbook-en.pdf` (영문 로그북, 미션 1~50). 텍스트가 아닌 토큰/색이 그래픽으로만 표시된 부분은 **PDF 페이지 이미지를 직접 확인**할 것.

**작업:** `MISSIONS: MissionDef[]`(길이 50)를 만든다. 각 원소는 `id`(1..50), `sourceText`(로그북의 해당 미션 하이라이트 규칙 원문 1~2문장), `logbookPage`, `taskCount`, 그리고 해당하면 `orderTokens`/`communication`/`constraints`/`assignment`/`optionalHandover`를 채운다.

**매핑 규칙(로그북 심볼 → 데이터):**
- 빨강 팔각형 숫자 = `taskCount`.
- 보라 토큰 1~5 = `orderTokens: [{kind:'absolute',position}]`; Ω = `{kind:'last'}`; 화살표(셰브론 N) = `{kind:'relative',chevrons:N}`.
- "No Tricks with 9" / 9로 못 이김(M16,M17) → `constraints:[{kind:'forbid-win-value',value:9}]`.
- "1 Trick with [value]"(M9) → `{kind:'win-value-count',value:1,count:1}`; "2 Tricks with 1"(M26) → `{value:1,count:2,distinct:true}`.
- "1 Trick with Each [rocket]"(M13) → `{kind:'win-cards',cards:[rocket1..4],ordered:false}`; "in order"(M44) → `ordered:true`.
- 녹색 '?' 토큰 = dead-zone → `communication:'dead-zone'`; 번개/N = disruption → `communication:{noCommUntilTrick:N}`(둘 다면 dead-zone 우선 표기는 불가하므로 disruption을 우선 — 구현상 noCommUntilTrick). 특정 1인 통신금지(M11) → `{oneMemberNoComm:true}` + 셋업에서 커맨더 지목.
- "No Tricks"(아픈 승무원, M5) → `{kind:'player-trick-count',role:'sick',count:0,rocketAllowed:true}` + assignment 'commander-decision'(good/bad).
- "Exactly 1 Trick" not rocket(M33) → `{kind:'player-trick-count',role:'chosen',count:1,rocketAllowed:false}` + 'commander-decision'.
- "First & Last Trick"(커맨더, M34) → `{kind:'player-exact-tricks',role:'commander',tricks:'first-last',exclusive:false,rocketAllowed:true}`. 단 M34는 balance도 동반 → `{kind:'balance',maxDiff:1}` 추가.
- "Only 1st and Last Trick" not rocket(M41) → `{kind:'player-exact-tricks',role:'chosen',tricks:'first-last',exclusive:true,rocketAllowed:false}` + 'commander-decision'.
- balance "2 tricks more" 금지(M29) → `{kind:'balance',maxDiff:1}` + dead-zone.
- Ω in last trick(M48) → `{kind:'task-in-last-trick',card:<해당 태스크 카드>}` (+ 그 카드가 태스크).
- "All Pink Cards"(M46) → `{kind:'pink-left-sweep'}` + 셋업에서 pink9holder 역할 바인딩.
- M50 트릭 분할 → `{kind:'trick-partition',parts:[{role:'first4',range:'first4'},{role:'last',range:'last'},{role:'middle',range:'middle'}]}` + assignment 'open-pick'(협상 역할은 셋업).
- 커맨더 분배(M20·24·32·36·43 중 분배에 해당) → `assignment:'commander-distribution'`; 커맨더 결정(M5·20·27·33·37·41) → `'commander-decision'`; 그 외 → `'open-pick'`(기본). M27/M37 → `optionalHandover:true`.
- 특수 규칙 없는 미션(예: M1·M2·M4·M8·M10·M15…) → taskCount만, 나머지 생략.

> 정확한 분류는 **로그북 각 미션의 하이라이트 텍스트와 심볼**을 따른다. 위 매핑은 가이드이며, 실제 미션의 표기가 우선이다. M48 등 특정 카드가 필요한 제약은 로그북에 그려진 카드(색·값)를 이미지로 확인해 정확히 인코딩한다.

- [ ] **Step 1: 무결성 테스트 작성** — `missions.data.test.ts`:
```ts
import { MISSIONS } from './missions.data';
import { COLORS } from './cards';

test('there are exactly 50 missions, ids 1..50 unique and ordered', () => {
  expect(MISSIONS).toHaveLength(50);
  expect(MISSIONS.map((m) => m.id)).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
});

test('every mission has sourceText, a valid page, and a non-negative taskCount', () => {
  for (const m of MISSIONS) {
    expect(m.sourceText.length).toBeGreaterThan(0);
    expect(m.logbookPage).toBeGreaterThanOrEqual(1);
    expect(m.taskCount).toBeGreaterThanOrEqual(0);
  }
});

test('order tokens, when present, count matches and are well-formed', () => {
  for (const m of MISSIONS) {
    for (const ot of m.orderTokens ?? []) {
      if (ot.kind === 'absolute') expect(ot.position).toBeGreaterThanOrEqual(1);
      if (ot.kind === 'relative') expect(ot.chevrons).toBeGreaterThanOrEqual(1);
    }
  }
});

test('constraint cards reference real suits/values', () => {
  const valid = (c: { suit: string; value: number }) =>
    (c.suit === 'rocket' ? c.value >= 1 && c.value <= 4 : (COLORS as readonly string[]).includes(c.suit) && c.value >= 1 && c.value <= 9);
  for (const m of MISSIONS) {
    for (const con of m.constraints ?? []) {
      if (con.kind === 'win-cards') con.cards.forEach((c) => expect(valid(c)).toBe(true));
      if (con.kind === 'task-in-last-trick') expect(valid(con.card)).toBe(true);
    }
  }
});

test('known anchors: M16 forbids winning with 9, M44 is ordered rockets, M50 is a partition', () => {
  const m16 = MISSIONS.find((m) => m.id === 16)!;
  expect(m16.constraints).toContainEqual({ kind: 'forbid-win-value', value: 9 });
  const m44 = MISSIONS.find((m) => m.id === 44)!;
  expect(m44.constraints?.some((c) => c.kind === 'win-cards' && c.ordered)).toBe(true);
  const m50 = MISSIONS.find((m) => m.id === 50)!;
  expect(m50.constraints?.some((c) => c.kind === 'trick-partition')).toBe(true);
});
```

- [ ] **Step 2: 실패 확인** — FAIL (`missions.data` 없음).

- [ ] **Step 3: 50개 미션 인코딩** — `missions.data.ts`에 `export const MISSIONS: MissionDef[] = [ ... ]`로 미션 1~50을 작성한다. **반드시 `docs/reference/logbook-en.pdf`를 직접 읽어** 각 미션의 taskCount·토큰·특수규칙을 매핑 규칙대로 인코딩하고, 각 미션에 로그북 원문 `sourceText`와 `logbookPage`를 단다. 단순 미션은 `{ id, sourceText, logbookPage, taskCount }`만.

- [ ] **Step 4: 배럴** — index.ts에 `export * from './missions.data';` 추가.

- [ ] **Step 5: 대표 시나리오 테스트 추가** — `missions.data.test.ts`에 createMission으로 대표 미션(M16: 9로 이기면 패배 / M9: 1값 트릭 / M1: 무제약 단순)이 엔진에서 의도대로 동작하는지 1~2개 시나리오를 추가(트릭을 구성해 won/lost 검증).

- [ ] **Step 6: 전체 테스트 + 타입체크** — Run: `npm test ... && npm run typecheck ...` → 전부 PASS.

- [ ] **Step 7: 커밋** — `git commit -am "feat: encode all 50 missions as data from the logbook"`

---

## Self-Review (작성자 점검)

- **Spec 커버리지**: §4.4 카탈로그의 카드-승리(3)·값-금지(4)·트릭수/정체(5)·균형(6)·선언(7,8)·특정트릭(7)·분할(5,M50)을 제약 타입으로, 배정·통신·토큰은 Plan 2 + MissionDef로, 50미션은 데이터로 커버.
- **타입 일관성**: `ConstraintDef`·`MissionDef`는 state.ts/mission.ts 단일 출처. `evaluateConstraint`/`constraintsViolated`/`constraintsAllSatisfied`/`winningCard`/`assignRole`/`derivePink9Holder`/`createMission` 시그니처 일치.
- **통합**: 제약은 트릭 완료 시(방금 트릭 포함) 평가 → 위반 즉시 패배; outcome.ts는 13트릭 종료 시 (태스크+제약) 충족=승리, 미충족=패배.
- **데이터 무결성**: 50미션은 로그북 원문 기준 + 리뷰어 더블엔트리(아래). `task-in-last-trick`/`win-cards`의 카드는 이미지 확인.
- **알려진 한계(후속)**: 역할 바인딩(sick/chosen/pink9holder/M50 협상)·커맨더 질의 흐름·M50 협상 UI는 셋업/서버/클라 계획에서. dead-zone+disruption 동시 미션은 disruption 우선 인코딩(단순화).

## 후속
- 서버(방·좌석·봇 러너·뷰 직렬화) + shared 프로토콜 + BasicBot → 클라 → 캠페인.
