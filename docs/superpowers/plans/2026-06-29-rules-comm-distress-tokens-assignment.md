# Plan 2 — Communication, Distress, Order Tokens, Assignment Modes

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 엔진(`packages/engine`)에 통신(매 트릭 직전 인터럽트), 조난신호, 순서 토큰, 커맨더 배정 방식을 순수 함수로 추가한다 — 모두 단위 테스트로 완결. (특수 제약 카탈로그·50미션 데이터·서버·클라는 이후 계획.)

**Architecture:** Plan 1의 순수 엔진 위에 기능별 모듈을 추가한다. `GameState`에 통신/조난/순서 관련 필드를 추가하고(기존 필드·테스트 불변), 새 액션 함수를 추가하며, 트릭 완료 시 순서 위반을 검사하도록 `play.ts`를 확장한다.

**Tech Stack:** 기존과 동일 — TypeScript strict, npm workspaces, Vitest.

## Global Constraints

- 기존 Plan 1 코드(`cards/rng/deal/trick/state/assign/play/outcome/loop`)와 시그니처 호환. 기존 36개 테스트는 계속 통과해야 한다.
- TS `strict` + `noUncheckedIndexedAccess`. 순수 함수(입력 불변, 새 객체 반환). 엔진 런타임 의존성 0.
- 난수 주입(시드)·결정성 유지. `Date.now()`/`Math.random()` 금지.
- 통신 타이밍: **현재 트릭에 카드 0장 나간 상태(트릭 리드 직전)에서만**, 시도당 1인 1회.
- 커밋 프리픽스 `feat:`/`test:`. 각 태스크 끝에 커밋.
- 기존 파일에 필드/함수를 추가할 때 기존 export를 깨지 않는다.

---

## File Structure

- Modify: `packages/engine/src/state.ts` — 새 타입(`CommToken`, `CommState`, `CommunicationPolicy`, `OrderToken`) + `GameState`/`TaskAssignment` 필드 + `createGame` 옵션.
- Create: `packages/engine/src/comm.ts` — 통신 분류·통신 액션.
- Create: `packages/engine/src/distress.ts` — 조난신호.
- Create: `packages/engine/src/order.ts` — 순서 위반 검사.
- Modify: `packages/engine/src/play.ts` — 트릭 완료 시 순서 위반 검사 호출.
- Modify: `packages/engine/src/assign.ts` — 커맨더 결정/분배/양도 함수.
- Modify: `packages/engine/src/index.ts` — 배럴에 신규 모듈 추가.
- 각 신규/수정 옆 `*.test.ts`.

---

## Task 1: 상태·타입 확장

**Files:**
- Modify: `packages/engine/src/state.ts`
- Test: `packages/engine/src/state.comm.test.ts`

**Interfaces:**
- Produces (state.ts 추가):
  - `type CommToken = 'highest' | 'only' | 'lowest'`
  - `interface CommState { player: PlayerId; card: Card; token: CommToken | null }`
  - `type CommunicationPolicy = 'normal' | 'dead-zone' | { noCommUntilTrick: number } | { oneMemberNoComm: true }`
  - `type OrderToken = { kind: 'absolute'; position: number } | { kind: 'last' } | { kind: 'relative'; chevrons: number }`
  - `TaskAssignment` 에 `order?: OrderToken` 추가.
  - `GameState` 에 `commUsed: Record<PlayerId, boolean>`, `communication: CommState[]`, `communicationPolicy: CommunicationPolicy`, `appointedNoCommPlayer?: PlayerId`, `distressActive: boolean`, `distressDirection?: 'left' | 'right'`, `distressCommits?: Record<PlayerId, Card>` 추가.
  - `createGame` 옵션에 `communicationPolicy?: CommunicationPolicy`(기본 `'normal'`), `distressActive?: boolean`(기본 `false`) 추가; `commUsed`(전원 false)·`communication: []` 초기화.

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/engine/src/state.comm.test.ts`:
```ts
import { createGame } from './state';

const P = ['p0', 'p1', 'p2'];

test('createGame initializes communication and distress defaults', () => {
  const s = createGame({ players: P, missionId: 1, seed: 5 });
  expect(s.communicationPolicy).toBe('normal');
  expect(s.distressActive).toBe(false);
  expect(s.communication).toEqual([]);
  expect(s.commUsed).toEqual({ p0: false, p1: false, p2: false });
});

test('createGame accepts a communication policy and distress flag', () => {
  const s = createGame({ players: P, missionId: 18, seed: 5, communicationPolicy: { noCommUntilTrick: 2 }, distressActive: true });
  expect(s.communicationPolicy).toEqual({ noCommUntilTrick: 2 });
  expect(s.distressActive).toBe(true);
});

test('existing fields are unchanged (regression)', () => {
  const s = createGame({ players: P, missionId: 1, seed: 5 });
  expect(s.phase).toBe('task-assignment');
  expect(s.outcome).toBe('in-progress');
  expect(P).toContain(s.commander);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test --workspace @space-crew/engine`
Expected: FAIL (new fields undefined).

- [ ] **Step 3: 구현**

`state.ts`에 타입을 추가하고 `GameState`/`TaskAssignment`/`createGame`를 확장한다. 추가할 타입(파일 상단 export 영역):
```ts
export type CommToken = 'highest' | 'only' | 'lowest';
export interface CommState {
  player: PlayerId;
  card: Card;
  token: CommToken | null; // null = dead-zone(직관)
}
export type CommunicationPolicy =
  | 'normal'
  | 'dead-zone'
  | { noCommUntilTrick: number }
  | { oneMemberNoComm: true };
export type OrderToken =
  | { kind: 'absolute'; position: number } // 1..5
  | { kind: 'last' }                        // Ω
  | { kind: 'relative'; chevrons: number }; // 1..4
```
`TaskAssignment`에 `order?: OrderToken;` 추가. `GameState`에 다음 필드 추가:
```ts
  commUsed: Record<PlayerId, boolean>;
  communication: CommState[];
  communicationPolicy: CommunicationPolicy;
  appointedNoCommPlayer?: PlayerId;
  distressActive: boolean;
  distressDirection?: 'left' | 'right';
  distressCommits?: Record<PlayerId, Card>;
```
`createGame` 인자 타입에 `communicationPolicy?: CommunicationPolicy; distressActive?: boolean;`를 추가하고, 반환 객체에:
```ts
    commUsed: Object.fromEntries(players.map((p) => [p, false])),
    communication: [],
    communicationPolicy: args.communicationPolicy ?? 'normal',
    distressActive: args.distressActive ?? false,
```
를 포함시킨다(기존 필드는 그대로 유지).

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test --workspace @space-crew/engine`
Expected: PASS (신규 3개 + 기존 36개).

- [ ] **Step 5: 커밋**

```bash
git add -A && git commit -m "feat: extend GameState with communication/distress/order fields"
```

---

## Task 2: 통신 분류 헬퍼 (highest/only/lowest)

**Files:**
- Create: `packages/engine/src/comm.ts`
- Test: `packages/engine/src/comm.test.ts`

**Interfaces:**
- Consumes: `Card` (cards.ts), `CommToken` (state.ts), `sameCard` (cards.ts).
- Produces: `function commClassification(hand: readonly Card[], card: Card): CommToken | null` — 색 카드가 그 색의 유일/최고/최저면 해당 토큰, 아니면(로켓·손패에 없음·중간값) null. 유일이 최우선.

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/engine/src/comm.test.ts`:
```ts
import { commClassification } from './comm';
import { Card } from './cards';

const c = (suit: Card['suit'], v: number): Card => ({ suit, value: v });

test('only card of its color → only', () => {
  const hand = [c('pink', 4), c('blue', 2)];
  expect(commClassification(hand, c('pink', 4))).toBe('only');
});

test('highest of its color → highest', () => {
  const hand = [c('pink', 4), c('pink', 9)];
  expect(commClassification(hand, c('pink', 9))).toBe('highest');
});

test('lowest of its color → lowest', () => {
  const hand = [c('pink', 4), c('pink', 9)];
  expect(commClassification(hand, c('pink', 4))).toBe('lowest');
});

test('middle card → null', () => {
  const hand = [c('pink', 2), c('pink', 6), c('pink', 9)];
  expect(commClassification(hand, c('pink', 6))).toBeNull();
});

test('rocket → null', () => {
  const hand = [c('rocket', 2), c('pink', 9)];
  expect(commClassification(hand, c('rocket', 2))).toBeNull();
});

test('card not in hand → null', () => {
  const hand = [c('pink', 9)];
  expect(commClassification(hand, c('pink', 3))).toBeNull();
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test --workspace @space-crew/engine`
Expected: FAIL ("comm" 없음).

- [ ] **Step 3: 구현**

`packages/engine/src/comm.ts`:
```ts
import { Card, sameCard } from './cards';
import { CommToken } from './state';

export function commClassification(hand: readonly Card[], card: Card): CommToken | null {
  if (card.suit === 'rocket') return null;
  if (!hand.some((h) => sameCard(h, card))) return null;
  const sameColor = hand.filter((h) => h.suit === card.suit);
  if (sameColor.length === 1) return 'only';
  const values = sameColor.map((h) => h.value);
  if (card.value === Math.max(...values)) return 'highest';
  if (card.value === Math.min(...values)) return 'lowest';
  return null;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test --workspace @space-crew/engine`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add -A && git commit -m "feat: communication card classification (highest/only/lowest)"
```

---

## Task 3: 통신 액션 + 정책 게이트

**Files:**
- Modify: `packages/engine/src/comm.ts`
- Test: `packages/engine/src/comm.action.test.ts`

**Interfaces:**
- Consumes: `GameState`, `PlayerId`, `CommToken` (state.ts); `Card`, `sameCard` (cards.ts); `commClassification` (comm.ts).
- Produces: `function communicate(state: GameState, player: PlayerId, card: Card, declaredToken: CommToken | null): GameState` — 검증 후 `commUsed[player]=true`, `communication`에 `{player, card, token}` 추가. 위반 시 throw.

검증 규칙:
1. `phase === 'trick-in-progress'` 그리고 `currentTrick.plays.length === 0` (트릭 리드 직전).
2. `outcome === 'in-progress'`.
3. `commUsed[player] === false`.
4. card가 player 손패에 있고 `card.suit !== 'rocket'`.
5. 정책 게이트:
   - `'normal'`: `declaredToken !== null` 그리고 `declaredToken === commClassification(hand, card)`.
   - `'dead-zone'`: `declaredToken === null` 그리고 `commClassification(hand, card) !== null`.
   - `{ noCommUntilTrick: n }`: `trickHistory.length >= n - 1` (트릭 n부터 가능) 그리고 그 외 normal 규칙 적용(`declaredToken === commClassification`).
   - `{ oneMemberNoComm: true }`: `player !== appointedNoCommPlayer`, 그 외 normal 규칙.

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/engine/src/comm.action.test.ts`:
```ts
import { createGame, GameState, CommunicationPolicy } from './state';
import { beginTricks } from './assign';
import { communicate } from './comm';
import { applyPlay } from './play';
import { Card } from './cards';

const P = ['p0', 'p1', 'p2'];
const c = (suit: Card['suit'], v: number): Card => ({ suit, value: v });

function preTrick(policy: CommunicationPolicy = 'normal', extra: Partial<GameState> = {}): GameState {
  const g = createGame({ players: P, missionId: 1, seed: 1, communicationPolicy: policy });
  return {
    ...g,
    commander: 'p0',
    phase: 'trick-in-progress',
    currentTrick: { leader: 'p0', plays: [] },
    hands: { p0: [c('pink', 9), c('pink', 4)], p1: [c('blue', 2)], p2: [c('green', 3)] },
    ...extra,
  };
}

test('normal: truthful highest is accepted and marks commUsed', () => {
  const s = communicate(preTrick(), 'p0', c('pink', 9), 'highest');
  expect(s.communication).toEqual([{ player: 'p0', card: c('pink', 9), token: 'highest' }]);
  expect(s.commUsed.p0).toBe(true);
});

test('normal: a false token is rejected', () => {
  expect(() => communicate(preTrick(), 'p0', c('pink', 9), 'lowest')).toThrow(/truth|classif|invalid/i);
});

test('rocket cannot be communicated', () => {
  const s = preTrick('normal', { hands: { p0: [c('rocket', 2)], p1: [c('blue', 2)], p2: [c('green', 3)] } });
  expect(() => communicate(s, 'p0', c('rocket', 2), null)).toThrow(/rocket/i);
});

test('cannot communicate twice in one attempt', () => {
  let s = communicate(preTrick(), 'p0', c('pink', 9), 'highest');
  expect(() => communicate(s, 'p0', c('pink', 4), 'lowest')).toThrow(/already|once/i);
});

test('cannot communicate mid-trick (a card already played)', () => {
  let s = preTrick();
  s = applyPlay(s, 'p0', c('pink', 9));
  expect(() => communicate(s, 'p1', c('blue', 2), 'only')).toThrow(/before a trick|mid-trick|not allowed/i);
});

test('dead-zone: token must be null but card must still be classifiable', () => {
  const s = preTrick('dead-zone');
  expect(communicate(s, 'p0', c('pink', 9), null).communication[0]!.token).toBeNull();
  expect(() => communicate(s, 'p0', c('pink', 9), 'highest')).toThrow(/dead.?zone|intuition|null/i);
});

test('disruption: blocked until the nth trick', () => {
  const s = preTrick({ noCommUntilTrick: 2 }); // trickHistory.length === 0 → blocked
  expect(() => communicate(s, 'p0', c('pink', 9), 'highest')).toThrow(/disrupt|blocked|trick/i);
  const s2 = { ...s, trickHistory: [{ leader: 'p0', plays: [], winner: 'p0' }] }; // length 1 → allowed
  expect(communicate(s2, 'p0', c('pink', 9), 'highest').commUsed.p0).toBe(true);
});

test('oneMemberNoComm: the appointed player cannot communicate', () => {
  const s = preTrick({ oneMemberNoComm: true }, { appointedNoCommPlayer: 'p0' });
  expect(() => communicate(s, 'p0', c('pink', 9), 'highest')).toThrow(/not allowed|appointed|cannot/i);
  expect(communicate(s, 'p1', c('blue', 2), 'only').commUsed.p1).toBe(true);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test --workspace @space-crew/engine`
Expected: FAIL (`communicate` 없음).

- [ ] **Step 3: 구현 (comm.ts에 추가)**

```ts
import { GameState, PlayerId, CommToken } from './state';
// (기존 import에 추가)

export function communicate(
  state: GameState,
  player: PlayerId,
  card: Card,
  declaredToken: CommToken | null,
): GameState {
  if (state.phase !== 'trick-in-progress' || state.currentTrick.plays.length !== 0) {
    throw new Error('communication only allowed before a trick begins');
  }
  if (state.outcome !== 'in-progress') throw new Error('mission already ended');
  if (state.commUsed[player]) throw new Error('already communicated once this attempt');
  const hand = state.hands[player] ?? [];
  if (!hand.some((h) => sameCard(h, card))) throw new Error('card not in hand');
  if (card.suit === 'rocket') throw new Error('rocket cards cannot be communicated');

  const policy = state.communicationPolicy;
  const classification = commClassification(hand, card);

  if (policy === 'dead-zone') {
    if (declaredToken !== null) throw new Error('dead-zone: token must be null (intuition)');
    if (classification === null) throw new Error('card is not highest/only/lowest of its color');
  } else {
    if (typeof policy === 'object' && 'noCommUntilTrick' in policy) {
      if (state.trickHistory.length < policy.noCommUntilTrick - 1) {
        throw new Error('communication disrupted until later trick');
      }
    }
    if (typeof policy === 'object' && 'oneMemberNoComm' in policy) {
      if (player === state.appointedNoCommPlayer) throw new Error('appointed player cannot communicate');
    }
    if (declaredToken === null || declaredToken !== classification) {
      throw new Error('communication token must truthfully match the card');
    }
  }

  return {
    ...state,
    commUsed: { ...state.commUsed, [player]: true },
    communication: [...state.communication, { player, card, token: declaredToken }],
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test --workspace @space-crew/engine`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add -A && git commit -m "feat: communicate action with policy gates (normal/dead-zone/disruption/no-comm)"
```

---

## Task 4: 조난신호 (토글·방향·동시 제출·전달)

**Files:**
- Create: `packages/engine/src/distress.ts`
- Test: `packages/engine/src/distress.test.ts`

**Interfaces:**
- Consumes: `GameState`, `PlayerId` (state.ts); `Card`, `sameCard` (cards.ts).
- Produces:
  - `function setDistress(state: GameState, active: boolean, direction?: 'left' | 'right'): GameState` — 셋업(phase 'task-assignment')에서만.
  - `function submitDistressCard(state: GameState, player: PlayerId, card: Card): GameState` — 비-로켓 카드 1장 비밀 제출(`distressCommits`). 3인 모두 제출되면 방향대로 이웃에게 전달하고 hands 갱신·commits 제거.
- 방향: `players`는 시계방향. `'right'` = 다음 좌석 `(i+1)%n`이 받음, `'left'` = 이전 좌석 `(i-1+n)%n`이 받음.

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/engine/src/distress.test.ts`:
```ts
import { createGame, GameState } from './state';
import { setDistress, submitDistressCard } from './distress';
import { Card } from './cards';

const P = ['p0', 'p1', 'p2'];
const c = (suit: Card['suit'], v: number): Card => ({ suit, value: v });

function base(): GameState {
  const g = createGame({ players: P, missionId: 1, seed: 1 });
  return {
    ...g,
    hands: { p0: [c('pink', 1), c('pink', 2)], p1: [c('blue', 1), c('blue', 2)], p2: [c('green', 1), c('green', 2)] },
  };
}

test('setDistress activates with a direction', () => {
  const s = setDistress(base(), true, 'right');
  expect(s.distressActive).toBe(true);
  expect(s.distressDirection).toBe('right');
});

test('rocket cannot be submitted for distress', () => {
  const s = setDistress({ ...base(), hands: { ...base().hands, p0: [c('rocket', 1)] } }, true, 'right');
  expect(() => submitDistressCard(s, 'p0', c('rocket', 1))).toThrow(/rocket/i);
});

test('cards are passed only after all three submit (right = next seat)', () => {
  let s = setDistress(base(), true, 'right');
  s = submitDistressCard(s, 'p0', c('pink', 1));
  s = submitDistressCard(s, 'p1', c('blue', 1));
  expect(s.distressCommits && Object.keys(s.distressCommits).length).toBe(2);
  s = submitDistressCard(s, 'p2', c('green', 1));
  // right: p0→p1, p1→p2, p2→p0
  expect(s.hands.p1).toContainEqual(c('pink', 1));
  expect(s.hands.p2).toContainEqual(c('blue', 1));
  expect(s.hands.p0).toContainEqual(c('green', 1));
  // givers no longer hold the passed card
  expect(s.hands.p0).not.toContainEqual(c('pink', 1));
  expect(s.distressCommits).toBeUndefined();
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test --workspace @space-crew/engine`
Expected: FAIL ("distress" 없음).

- [ ] **Step 3: 구현**

`packages/engine/src/distress.ts`:
```ts
import { Card, sameCard } from './cards';
import { GameState, PlayerId } from './state';

export function setDistress(
  state: GameState,
  active: boolean,
  direction?: 'left' | 'right',
): GameState {
  if (state.phase !== 'task-assignment') throw new Error('distress can only be set during setup');
  return { ...state, distressActive: active, distressDirection: active ? direction : undefined };
}

export function submitDistressCard(state: GameState, player: PlayerId, card: Card): GameState {
  if (!state.distressActive) throw new Error('distress is not active');
  if (card.suit === 'rocket') throw new Error('rocket cards cannot be passed');
  const hand = state.hands[player] ?? [];
  if (!hand.some((h) => sameCard(h, card))) throw new Error('card not in hand');
  const commits = { ...(state.distressCommits ?? {}), [player]: card };

  if (Object.keys(commits).length < state.players.length) {
    return { ...state, distressCommits: commits };
  }

  // all submitted → reveal and pass
  const dir = state.distressDirection;
  if (dir === undefined) throw new Error('distress direction not set');
  const n = state.players.length;
  const hands: Record<PlayerId, Card[]> = {};
  // remove each giver's submitted card first
  state.players.forEach((p) => {
    hands[p] = (state.hands[p] ?? []).filter((h) => !sameCard(h, commits[p]!));
  });
  // deliver to neighbor
  state.players.forEach((p, i) => {
    const recipientIdx = dir === 'right' ? (i + 1) % n : (i - 1 + n) % n;
    const recipient = state.players[recipientIdx]!;
    hands[recipient] = [...hands[recipient]!, commits[p]!];
  });

  const next = { ...state, hands };
  delete (next as { distressCommits?: unknown }).distressCommits;
  return next;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test --workspace @space-crew/engine`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add -A && git commit -m "feat: distress signal (activate, simultaneous commit, neighbor pass)"
```

---

## Task 5: 순서 토큰 위반 검사 + play 통합

**Files:**
- Create: `packages/engine/src/order.ts`
- Modify: `packages/engine/src/play.ts`
- Test: `packages/engine/src/order.test.ts`

**Interfaces:**
- Consumes: `TaskAssignment` (state.ts).
- Produces: `function orderViolated(tasks: readonly TaskAssignment[]): boolean` — 트릭 종료 시점 평가:
  - absolute: 어떤 fulfilled absolute(pos p) 태스크에 대해, pos < p 인 모든 absolute 태스크가 fulfilled 여야 한다(prefix). 아니면 위반.
  - relative: 어떤 fulfilled relative(chev c)에 대해, chev < c 인 모든 relative 태스크가 fulfilled 여야 한다.
  - last(Ω): fulfilled Ω 태스크가 있는데 non-Ω 태스크 중 미달성이 있으면 위반.
- `play.ts`: 트릭 완료 분기에서 태스크 fulfilled 갱신 후 `orderViolated(tasks)`면 `outcome='lost'`.

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/engine/src/order.test.ts`:
```ts
import { orderViolated } from './order';
import { TaskAssignment } from './state';
import { Card } from './cards';

const t = (card: Card, fulfilled: boolean, order?: TaskAssignment['order']): TaskAssignment =>
  ({ card, owner: 'p0', fulfilled, order });
const C = (s: Card['suit'], v: number): Card => ({ suit: s, value: v });

test('absolute: ok when fulfilled in ascending position order', () => {
  const tasks = [t(C('pink', 1), true, { kind: 'absolute', position: 1 }), t(C('blue', 1), false, { kind: 'absolute', position: 2 })];
  expect(orderViolated(tasks)).toBe(false);
});

test('absolute: violated when a later position is fulfilled before an earlier one', () => {
  const tasks = [t(C('pink', 1), false, { kind: 'absolute', position: 1 }), t(C('blue', 1), true, { kind: 'absolute', position: 2 })];
  expect(orderViolated(tasks)).toBe(true);
});

test('absolute: consecutive positions fulfilled together is ok', () => {
  const tasks = [t(C('pink', 1), true, { kind: 'absolute', position: 1 }), t(C('blue', 1), true, { kind: 'absolute', position: 2 })];
  expect(orderViolated(tasks)).toBe(false);
});

test('last (Ω): violated when fulfilled while another task pending', () => {
  const tasks = [t(C('pink', 1), true, { kind: 'last' }), t(C('blue', 1), false)];
  expect(orderViolated(tasks)).toBe(true);
});

test('last (Ω): ok when fulfilled after all others', () => {
  const tasks = [t(C('pink', 1), true, { kind: 'last' }), t(C('blue', 1), true)];
  expect(orderViolated(tasks)).toBe(false);
});

test('relative: violated when higher chevron fulfilled before lower', () => {
  const tasks = [t(C('pink', 1), false, { kind: 'relative', chevrons: 1 }), t(C('blue', 1), true, { kind: 'relative', chevrons: 2 })];
  expect(orderViolated(tasks)).toBe(true);
});

test('no order tokens → never violated', () => {
  const tasks = [t(C('pink', 1), true), t(C('blue', 1), false)];
  expect(orderViolated(tasks)).toBe(false);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test --workspace @space-crew/engine`
Expected: FAIL ("order" 없음).

- [ ] **Step 3: 구현 (order.ts)**

`packages/engine/src/order.ts`:
```ts
import { TaskAssignment } from './state';

export function orderViolated(tasks: readonly TaskAssignment[]): boolean {
  const abs = tasks.filter((t) => t.order?.kind === 'absolute');
  for (const tk of abs) {
    if (!tk.fulfilled) continue;
    const p = (tk.order as { kind: 'absolute'; position: number }).position;
    const earlierAllDone = abs.every((o) => {
      const op = (o.order as { kind: 'absolute'; position: number }).position;
      return op >= p || o.fulfilled;
    });
    if (!earlierAllDone) return true;
  }

  const rel = tasks.filter((t) => t.order?.kind === 'relative');
  for (const tk of rel) {
    if (!tk.fulfilled) continue;
    const c = (tk.order as { kind: 'relative'; chevrons: number }).chevrons;
    const earlierAllDone = rel.every((o) => {
      const oc = (o.order as { kind: 'relative'; chevrons: number }).chevrons;
      return oc >= c || o.fulfilled;
    });
    if (!earlierAllDone) return true;
  }

  const last = tasks.filter((t) => t.order?.kind === 'last');
  if (last.some((t) => t.fulfilled)) {
    const others = tasks.filter((t) => t.order?.kind !== 'last');
    if (others.some((t) => !t.fulfilled)) return true;
  }

  return false;
}
```

- [ ] **Step 4: play.ts 통합**

`packages/engine/src/play.ts`에 `import { orderViolated } from './order';`를 추가하고, 트릭 완료 분기에서 `tasks`를 계산한 직후(현재 `outcome`가 'lost'로 바뀌는 비소유자 검사 다음)에 순서 위반을 검사하도록 추가한다. 구체적으로 `next` 객체를 만들기 직전에:
```ts
  if (outcome === 'in-progress' && orderViolated(tasks)) {
    outcome = 'lost';
  }
```
(이미 `let outcome = state.outcome;` 가 있으므로 재할당 가능. 기존 비소유자-패배 로직은 그대로 둔다.)

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test --workspace @space-crew/engine`
Expected: PASS (order 7개 + 기존 전부).

- [ ] **Step 6: 커밋**

```bash
git add -A && git commit -m "feat: order-token violation check integrated into trick resolution"
```

---

## Task 6: 커맨더 결정 배정

**Files:**
- Modify: `packages/engine/src/assign.ts`
- Test: `packages/engine/src/assign.decision.test.ts`

**Interfaces:**
- Consumes: `GameState`, `PlayerId`, `OrderToken` (state.ts); `Card`, `sameCard` (cards.ts).
- Produces:
  - `interface TaskSpec { card: Card; order?: OrderToken }`
  - `function assignByDecision(state: GameState, assignee: PlayerId, specs: TaskSpec[]): GameState` — 한 명(assignee)이 모든 태스크 수령. **assignee는 커맨더가 아니어야 함**. phase 'task-assignment'. 중복 카드 거부.

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/engine/src/assign.decision.test.ts`:
```ts
import { createGame, GameState } from './state';
import { assignByDecision } from './assign';
import { Card } from './cards';

const P = ['p0', 'p1', 'p2'];
const C = (s: Card['suit'], v: number): Card => ({ suit: s, value: v });

function g(): GameState {
  return { ...createGame({ players: P, missionId: 5, seed: 1 }), commander: 'p0' };
}

test('assignByDecision gives all tasks to one non-commander assignee', () => {
  const s = assignByDecision(g(), 'p1', [{ card: C('pink', 1) }, { card: C('blue', 2) }]);
  expect(s.tasks.map((t) => t.owner)).toEqual(['p1', 'p1']);
  expect(s.tasks.map((t) => t.card)).toEqual([C('pink', 1), C('blue', 2)]);
});

test('commander cannot be the assignee', () => {
  expect(() => assignByDecision(g(), 'p0', [{ card: C('pink', 1) }])).toThrow(/commander|self/i);
});

test('duplicate task cards are rejected', () => {
  expect(() => assignByDecision(g(), 'p1', [{ card: C('pink', 1) }, { card: C('pink', 1) }])).toThrow(/duplicate|already/i);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test --workspace @space-crew/engine`
Expected: FAIL (`assignByDecision` 없음).

- [ ] **Step 3: 구현 (assign.ts에 추가)**

```ts
import { OrderToken } from './state';
// 기존 import에 추가: sameCard from './cards' (이미 import되어 있으면 생략)

export interface TaskSpec {
  card: Card;
  order?: OrderToken;
}

export function assignByDecision(state: GameState, assignee: PlayerId, specs: TaskSpec[]): GameState {
  if (state.phase !== 'task-assignment') throw new Error('not in task-assignment phase');
  if (!state.players.includes(assignee)) throw new Error(`unknown player ${assignee}`);
  if (assignee === state.commander) throw new Error('commander cannot choose self (commander-decision)');
  const cards = specs.map((s) => s.card);
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      if (sameCard(cards[i]!, cards[j]!)) throw new Error('duplicate task card');
    }
    if (state.tasks.some((t) => sameCard(t.card, cards[i]!))) throw new Error('task card already assigned');
  }
  return {
    ...state,
    tasks: [
      ...state.tasks,
      ...specs.map((s) => ({ card: s.card, owner: assignee, fulfilled: false, order: s.order })),
    ],
  };
}
```
(주: `assign.ts` 상단에 `import { Card, sameCard } from './cards';`가 이미 있다. `OrderToken`/`PlayerId`/`GameState`는 `./state`에서 import.)

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test --workspace @space-crew/engine`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add -A && git commit -m "feat: commander-decision assignment (one assignee, commander excluded)"
```

---

## Task 7: 커맨더 분배 배정 (균등)

**Files:**
- Modify: `packages/engine/src/assign.ts`
- Test: `packages/engine/src/assign.distribution.test.ts`

**Interfaces:**
- Consumes: `GameState`, `PlayerId` (state.ts); `TaskSpec` (assign.ts); `Card`, `sameCard` (cards.ts).
- Produces: `function assignByDistribution(state: GameState, entries: { spec: TaskSpec; owner: PlayerId }[]): GameState` — 커맨더가 각 태스크를 배정(자기 포함 가능). **균등 불변식**: 배정 후 어느 플레이어도 다른 플레이어보다 태스크 2개 이상 많지 않음(max-min ≤ 1). 중복 카드 거부.

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/engine/src/assign.distribution.test.ts`:
```ts
import { createGame, GameState } from './state';
import { assignByDistribution } from './assign';
import { Card } from './cards';

const P = ['p0', 'p1', 'p2'];
const C = (s: Card['suit'], v: number): Card => ({ suit: s, value: v });
const g = (): GameState => ({ ...createGame({ players: P, missionId: 24, seed: 1 }), commander: 'p0' });

test('distributes tasks to chosen owners including commander', () => {
  const s = assignByDistribution(g(), [
    { spec: { card: C('pink', 1) }, owner: 'p0' },
    { spec: { card: C('blue', 2) }, owner: 'p1' },
    { spec: { card: C('green', 3) }, owner: 'p2' },
  ]);
  expect(s.tasks.map((t) => t.owner).sort()).toEqual(['p0', 'p1', 'p2']);
});

test('rejects uneven distribution (someone has 2+ more than another)', () => {
  expect(() =>
    assignByDistribution(g(), [
      { spec: { card: C('pink', 1) }, owner: 'p0' },
      { spec: { card: C('blue', 2) }, owner: 'p0' },
    ]),
  ).toThrow(/even|균등|distribut/i);
});

test('rejects duplicate task cards', () => {
  expect(() =>
    assignByDistribution(g(), [
      { spec: { card: C('pink', 1) }, owner: 'p0' },
      { spec: { card: C('pink', 1) }, owner: 'p1' },
    ]),
  ).toThrow(/duplicate|already/i);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test --workspace @space-crew/engine`
Expected: FAIL.

- [ ] **Step 3: 구현 (assign.ts에 추가)**

```ts
export function assignByDistribution(
  state: GameState,
  entries: { spec: TaskSpec; owner: PlayerId }[],
): GameState {
  if (state.phase !== 'task-assignment') throw new Error('not in task-assignment phase');
  const cards = entries.map((e) => e.spec.card);
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      if (sameCard(cards[i]!, cards[j]!)) throw new Error('duplicate task card');
    }
    if (state.tasks.some((t) => sameCard(t.card, cards[i]!))) throw new Error('task card already assigned');
  }
  for (const e of entries) {
    if (!state.players.includes(e.owner)) throw new Error(`unknown player ${e.owner}`);
  }
  const counts: Record<PlayerId, number> = Object.fromEntries(state.players.map((p) => [p, 0]));
  for (const t of state.tasks) counts[t.owner] = (counts[t.owner] ?? 0) + 1;
  for (const e of entries) counts[e.owner] = (counts[e.owner] ?? 0) + 1;
  const values = state.players.map((p) => counts[p] ?? 0);
  if (Math.max(...values) - Math.min(...values) > 1) {
    throw new Error('tasks must be evenly distributed (max-min ≤ 1)');
  }
  return {
    ...state,
    tasks: [
      ...state.tasks,
      ...entries.map((e) => ({ card: e.spec.card, owner: e.owner, fulfilled: false, order: e.spec.order })),
    ],
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test --workspace @space-crew/engine`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add -A && git commit -m "feat: commander-distribution assignment with even-split invariant"
```

---

## Task 8: 태스크 양도 (optionalHandover) + 배럴

**Files:**
- Modify: `packages/engine/src/assign.ts`
- Modify: `packages/engine/src/index.ts`
- Test: `packages/engine/src/assign.handover.test.ts`

**Interfaces:**
- Consumes: `GameState`, `PlayerId` (state.ts); `Card`, `sameCard` (cards.ts).
- Produces: `function handoverTask(state: GameState, from: PlayerId, to: PlayerId, card: Card): GameState` — 첫 트릭 전(phase 'task-assignment') `from` 소유 태스크를 `to`에게 이전. 해당 태스크가 없거나 from 소유가 아니면 throw.

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/engine/src/assign.handover.test.ts`:
```ts
import { createGame, GameState } from './state';
import { assignByDecision, handoverTask } from './assign';
import { Card } from './cards';

const P = ['p0', 'p1', 'p2'];
const C = (s: Card['suit'], v: number): Card => ({ suit: s, value: v });
const g = (): GameState => ({ ...createGame({ players: P, missionId: 27, seed: 1 }), commander: 'p0' });

test('handoverTask moves a task from one player to another', () => {
  let s = assignByDecision(g(), 'p1', [{ card: C('pink', 1) }]);
  s = handoverTask(s, 'p1', 'p2', C('pink', 1));
  expect(s.tasks[0]!.owner).toBe('p2');
});

test('handover of a task not owned by `from` is rejected', () => {
  let s = assignByDecision(g(), 'p1', [{ card: C('pink', 1) }]);
  expect(() => handoverTask(s, 'p2', 'p0', C('pink', 1))).toThrow(/not owned|no such task/i);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test --workspace @space-crew/engine`
Expected: FAIL.

- [ ] **Step 3: 구현 (assign.ts에 추가)**

```ts
export function handoverTask(state: GameState, from: PlayerId, to: PlayerId, card: Card): GameState {
  if (state.phase !== 'task-assignment') throw new Error('handover only before tricks begin');
  if (!state.players.includes(to)) throw new Error(`unknown player ${to}`);
  const idx = state.tasks.findIndex((t) => sameCard(t.card, card) && t.owner === from);
  if (idx === -1) throw new Error('no such task owned by `from`');
  const tasks = state.tasks.map((t, i) => (i === idx ? { ...t, owner: to } : t));
  return { ...state, tasks };
}
```

- [ ] **Step 4: 배럴 갱신**

`packages/engine/src/index.ts`에 다음 export 추가:
```ts
export * from './comm';
export * from './distress';
export * from './order';
```
(기존 export는 유지. `assign.ts`는 이미 `export * from './assign'`로 신규 함수가 노출된다.)

- [ ] **Step 5: 전체 테스트 + 타입체크 통과 확인**

Run: `npm test --workspace @space-crew/engine && npm run typecheck --workspace @space-crew/engine`
Expected: 모든 테스트 PASS, 타입 에러 0.

- [ ] **Step 6: 커밋**

```bash
git add -A && git commit -m "feat: optional task handover and engine barrel exports"
```

---

## Self-Review (작성자 점검)

- **Spec 커버리지**: 통신(매 트릭 직전·시도당 1회·진실성·정책 게이트, spec §2/§4.3)·조난(방향·동시 비밀 제출·전달, §2/§4.2)·순서 토큰(absolute/Ω/relative + prefix 위반, §4.4-2)·배정(결정 자기제외/분배 균등/양도, §4.4-11)을 Task 1~8이 구현.
- **타입 일관성**: `CommToken`/`CommState`/`CommunicationPolicy`/`OrderToken`/`TaskSpec`는 state.ts·assign.ts 단일 출처. `communicate`/`commClassification`/`setDistress`/`submitDistressCard`/`orderViolated`/`assignByDecision`/`assignByDistribution`/`handoverTask` 시그니처가 태스크 간 일치.
- **기존 코드 보존**: state.ts·play.ts·assign.ts·index.ts는 추가만 하고 기존 export·동작 보존. 기존 36개 테스트 회귀 없음.
- **단순화/후속**: dead-zone은 "토큰 null + 분류 가능"으로 모델링(직관의 '어느 조건인지' 비공개는 뷰 직렬화 단계=서버 계획). M50 협상 역할·특정-트릭 제약·통신 정책의 미션 데이터 연결은 Plan 3(제약 카탈로그+50미션).

## 다음 계획
- Plan 3: 제약 타입 카탈로그(RuleModule 일반화: 카드-승리/값-금지/트릭수·정체/균형/선언/특정트릭) + 50미션 데이터(§8 6a~6e) + MissionDef 연결.
