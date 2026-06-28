# Engine Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 순수 TypeScript 게임 엔진의 기초 — 카드 모델, 결정적 딜, 트릭테이킹, 기본 태스크 달성/위반, 미션 승패·시도 루프 — 을 TDD로 구현한다(서버/클라/통신/특수규칙 제외).

**Architecture:** `packages/engine`는 네트워크·UI·전역 난수에 의존하지 않는 순수 함수 모듈이다. 상태 전이는 `applyPlay(state, play) → state` 같은 순수 함수로 표현하고, 난수는 시드를 인자로 주입한다. 이 계획이 끝나면 태스크 카드만 쓰는 평범한 미션(M1·M2·M4류)을 손패만으로 끝까지 플레이하고 승/패/재시도를 판정할 수 있다.

**Tech Stack:** TypeScript (strict), npm workspaces, Vitest, Node 20+.

## Global Constraints

- TypeScript `strict: true`. `noUncheckedIndexedAccess: true`.
- 엔진 패키지(`packages/engine`)는 런타임 의존성 0 (devDependencies만: typescript, vitest).
- 모든 상태 전이 함수는 **순수**(입력 불변, 새 객체 반환). 입력 state를 변형하지 않는다.
- 난수는 항상 시드 인자로 주입 — `Date.now()`/`Math.random()` 직접 사용 금지.
- 카드: 4색(pink/blue/green/yellow) × 1–9 + rocket 1–4 = 40장. 3인 고정.
- 좌석은 `players: PlayerId[]`(길이 3, 시계방향). 추가 1장(14번째)은 **결정적으로 seat 0**에 귀속(spec의 "커맨더 좌석" 규칙은 순환참조라 고정 좌석으로 확정; 커맨더는 별도로 로켓4 보유자로 도출).
- 커밋 메시지 규칙: `feat:`/`test:`/`chore:` 프리픽스. 각 태스크 끝에 커밋.

---

## File Structure

- `package.json` (root) — npm workspaces 루트.
- `packages/engine/package.json` — 엔진 패키지 매니페스트.
- `packages/engine/tsconfig.json` — strict TS 설정.
- `packages/engine/vitest.config.ts` — 테스트 설정.
- `packages/engine/src/cards.ts` — 카드 타입·덱 생성·카드 유틸.
- `packages/engine/src/rng.ts` — 시드 RNG + 결정적 셔플.
- `packages/engine/src/deal.ts` — 3인 딜.
- `packages/engine/src/trick.ts` — 리드 색·합법 수·트릭 승자.
- `packages/engine/src/state.ts` — GameState 타입 + 초기 상태 생성.
- `packages/engine/src/play.ts` — `applyPlay` 전이(태스크 달성/위반 포함).
- `packages/engine/src/outcome.ts` — 미션 승패 평가.
- `packages/engine/src/loop.ts` — 시도 재시작/다음 미션 전이.
- `packages/engine/src/index.ts` — 공개 API 배럴.
- 각 소스 옆 `*.test.ts` (Vitest).

각 파일은 단일 책임을 가진다. `state.ts`가 공용 타입의 단일 출처다.

---

## Task 1: 모노레포 + 엔진 패키지 스캐폴딩

**Files:**
- Create: `package.json`
- Create: `packages/engine/package.json`
- Create: `packages/engine/tsconfig.json`
- Create: `packages/engine/vitest.config.ts`
- Create: `packages/engine/src/index.ts`
- Test: `packages/engine/src/smoke.test.ts`

**Interfaces:**
- Produces: 동작하는 `npm test`(engine 워크스페이스), 빈 배럴 `index.ts`.

- [ ] **Step 1: 루트 `package.json` 작성**

```json
{
  "name": "space-crew",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "test": "npm test --workspaces --if-present"
  }
}
```

- [ ] **Step 2: 엔진 패키지 매니페스트 작성**

`packages/engine/package.json`:
```json
{
  "name": "@space-crew/engine",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 3: TS·Vitest 설정 작성**

`packages/engine/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["vitest/globals"]
  },
  "include": ["src"]
}
```

`packages/engine/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { globals: true },
});
```

- [ ] **Step 4: 빈 배럴 + 스모크 테스트 작성**

`packages/engine/src/index.ts`:
```ts
export const ENGINE_VERSION = '0.0.0';
```

`packages/engine/src/smoke.test.ts`:
```ts
import { ENGINE_VERSION } from './index';

test('engine package builds and tests run', () => {
  expect(ENGINE_VERSION).toBe('0.0.0');
});
```

- [ ] **Step 5: 설치 후 테스트 실행 (실패→통과 확인)**

Run: `npm install && npm test --workspace @space-crew/engine`
Expected: 스모크 테스트 1개 PASS.

- [ ] **Step 6: 커밋**

```bash
git init -q 2>/dev/null; git add -A && git commit -m "chore: scaffold monorepo and engine package"
```

---

## Task 2: 카드 모델과 덱 생성

**Files:**
- Create: `packages/engine/src/cards.ts`
- Test: `packages/engine/src/cards.test.ts`

**Interfaces:**
- Produces:
  - `type Color = 'pink'|'blue'|'green'|'yellow'`
  - `type Suit = Color | 'rocket'`
  - `interface Card { suit: Suit; value: number }`
  - `const COLORS: readonly Color[]`
  - `function makeDeck(): Card[]` (40장)
  - `function cardKey(c: Card): string`
  - `function sameCard(a: Card, b: Card): boolean`

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/engine/src/cards.test.ts`:
```ts
import { makeDeck, cardKey, sameCard } from './cards';

test('deck has 40 cards: 36 color + 4 rocket', () => {
  const deck = makeDeck();
  expect(deck).toHaveLength(40);
  expect(deck.filter((c) => c.suit === 'rocket')).toHaveLength(4);
  expect(deck.filter((c) => c.suit !== 'rocket')).toHaveLength(36);
});

test('each color has values 1..9 and rockets 1..4', () => {
  const deck = makeDeck();
  for (const color of ['pink', 'blue', 'green', 'yellow']) {
    const vals = deck.filter((c) => c.suit === color).map((c) => c.value).sort((a, b) => a - b);
    expect(vals).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  }
  const rockets = deck.filter((c) => c.suit === 'rocket').map((c) => c.value).sort((a, b) => a - b);
  expect(rockets).toEqual([1, 2, 3, 4]);
});

test('all cards are unique', () => {
  const keys = makeDeck().map(cardKey);
  expect(new Set(keys).size).toBe(40);
});

test('sameCard compares by suit and value', () => {
  expect(sameCard({ suit: 'pink', value: 3 }, { suit: 'pink', value: 3 })).toBe(true);
  expect(sameCard({ suit: 'pink', value: 3 }, { suit: 'blue', value: 3 })).toBe(false);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test --workspace @space-crew/engine`
Expected: FAIL ("cards" 모듈 없음).

- [ ] **Step 3: 구현**

`packages/engine/src/cards.ts`:
```ts
export const COLORS = ['pink', 'blue', 'green', 'yellow'] as const;
export type Color = (typeof COLORS)[number];
export type Suit = Color | 'rocket';

export interface Card {
  suit: Suit;
  value: number;
}

export function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of COLORS) {
    for (let v = 1; v <= 9; v++) deck.push({ suit, value: v });
  }
  for (let v = 1; v <= 4; v++) deck.push({ suit: 'rocket', value: v });
  return deck;
}

export function cardKey(c: Card): string {
  return `${c.suit}-${c.value}`;
}

export function sameCard(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.value === b.value;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test --workspace @space-crew/engine`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add -A && git commit -m "feat: card model and 40-card deck"
```

---

## Task 3: 시드 RNG와 결정적 셔플

**Files:**
- Create: `packages/engine/src/rng.ts`
- Test: `packages/engine/src/rng.test.ts`

**Interfaces:**
- Produces:
  - `function mulberry32(seed: number): () => number`
  - `function shuffle<T>(arr: readonly T[], seed: number): T[]` (입력 불변, 새 배열)

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/engine/src/rng.test.ts`:
```ts
import { shuffle, mulberry32 } from './rng';

test('shuffle is deterministic for the same seed', () => {
  const a = shuffle([1, 2, 3, 4, 5, 6, 7, 8], 42);
  const b = shuffle([1, 2, 3, 4, 5, 6, 7, 8], 42);
  expect(a).toEqual(b);
});

test('different seeds usually give different orders', () => {
  const a = shuffle([1, 2, 3, 4, 5, 6, 7, 8], 1);
  const b = shuffle([1, 2, 3, 4, 5, 6, 7, 8], 2);
  expect(a).not.toEqual(b);
});

test('shuffle is a permutation and does not mutate input', () => {
  const input = [1, 2, 3, 4, 5];
  const out = shuffle(input, 7);
  expect([...out].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5]);
  expect(input).toEqual([1, 2, 3, 4, 5]);
});

test('mulberry32 returns values in [0, 1)', () => {
  const rng = mulberry32(123);
  for (let i = 0; i < 100; i++) {
    const v = rng();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  }
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test --workspace @space-crew/engine`
Expected: FAIL ("rng" 모듈 없음).

- [ ] **Step 3: 구현**

`packages/engine/src/rng.ts`:
```ts
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: readonly T[], seed: number): T[] {
  const rng = mulberry32(seed);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test --workspace @space-crew/engine`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add -A && git commit -m "feat: seeded rng and deterministic shuffle"
```

---

## Task 4: 3인 딜과 커맨더 도출

**Files:**
- Create: `packages/engine/src/deal.ts`
- Test: `packages/engine/src/deal.test.ts`

**Interfaces:**
- Consumes: `makeDeck`, `Card`, `sameCard` (cards.ts); `shuffle` (rng.ts).
- Produces:
  - `function dealHands(seed: number): Card[][]` — 길이 3 배열, [14, 13, 13]장(seat 0이 14장).
  - `function findCommander(hands: readonly Card[][]): number` — 로켓4 보유 좌석 인덱스.

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/engine/src/deal.test.ts`:
```ts
import { dealHands, findCommander } from './deal';
import { cardKey } from './cards';

test('deals 14/13/13 and uses all 40 cards', () => {
  const hands = dealHands(99);
  expect(hands.map((h) => h.length)).toEqual([14, 13, 13]);
  const all = hands.flat().map(cardKey);
  expect(new Set(all).size).toBe(40);
});

test('deal is deterministic for the same seed', () => {
  expect(dealHands(5)).toEqual(dealHands(5));
});

test('findCommander returns the seat holding rocket 4', () => {
  const hands = dealHands(5);
  const seat = findCommander(hands);
  expect(hands[seat]!.some((c) => c.suit === 'rocket' && c.value === 4)).toBe(true);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test --workspace @space-crew/engine`
Expected: FAIL ("deal" 모듈 없음).

- [ ] **Step 3: 구현**

`packages/engine/src/deal.ts`:
```ts
import { Card, makeDeck } from './cards';
import { shuffle } from './rng';

// seat 0 receives the extra (14th) card; seats 1 and 2 receive 13 each.
export function dealHands(seed: number): Card[][] {
  const deck = shuffle(makeDeck(), seed);
  const hands: Card[][] = [[], [], []];
  // round-robin deal of 39 cards, then the 40th goes to seat 0
  for (let i = 0; i < 39; i++) {
    hands[i % 3]!.push(deck[i]!);
  }
  hands[0]!.push(deck[39]!);
  return hands;
}

export function findCommander(hands: readonly Card[][]): number {
  for (let seat = 0; seat < hands.length; seat++) {
    if (hands[seat]!.some((c) => c.suit === 'rocket' && c.value === 4)) return seat;
  }
  throw new Error('no rocket-4 dealt — impossible with a full deck');
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test --workspace @space-crew/engine`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add -A && git commit -m "feat: 3-player deal and commander detection"
```

---

## Task 5: 트릭 규칙 — 리드 색, 합법 수, 승자

**Files:**
- Create: `packages/engine/src/trick.ts`
- Test: `packages/engine/src/trick.test.ts`

**Interfaces:**
- Consumes: `Card`, `Suit`, `sameCard` (cards.ts).
- Produces:
  - `interface Play { player: string; card: Card }`
  - `interface Trick { leader: string; plays: Play[] }`
  - `function leadSuit(trick: Trick): Suit | undefined`
  - `function legalMoves(hand: readonly Card[], trick: Trick): Card[]`
  - `function trickWinner(trick: Trick): string` (트릭이 3장 완성됐다고 가정)

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/engine/src/trick.test.ts`:
```ts
import { leadSuit, legalMoves, trickWinner, Trick } from './trick';
import { Card } from './cards';

const c = (suit: Card['suit'], value: number): Card => ({ suit, value });

test('leadSuit is the suit of the first card played', () => {
  const t: Trick = { leader: 'A', plays: [{ player: 'A', card: c('blue', 2) }] };
  expect(leadSuit(t)).toBe('blue');
  expect(leadSuit({ leader: 'A', plays: [] })).toBeUndefined();
});

test('must follow lead suit when able', () => {
  const hand: Card[] = [c('blue', 5), c('green', 9), c('rocket', 2)];
  const t: Trick = { leader: 'A', plays: [{ player: 'A', card: c('blue', 2) }] };
  expect(legalMoves(hand, t)).toEqual([c('blue', 5)]);
});

test('any card is legal when void in lead suit', () => {
  const hand: Card[] = [c('green', 9), c('rocket', 2)];
  const t: Trick = { leader: 'A', plays: [{ player: 'A', card: c('blue', 2) }] };
  expect(legalMoves(hand, t)).toEqual(hand);
});

test('leader (empty trick) may play anything', () => {
  const hand: Card[] = [c('green', 9), c('rocket', 2)];
  expect(legalMoves(hand, { leader: 'A', plays: [] })).toEqual(hand);
});

test('rocket is its own suit: must follow rocket lead when able', () => {
  const hand: Card[] = [c('rocket', 1), c('blue', 9)];
  const t: Trick = { leader: 'A', plays: [{ player: 'A', card: c('rocket', 3) }] };
  expect(legalMoves(hand, t)).toEqual([c('rocket', 1)]);
});

test('highest card of lead suit wins', () => {
  const t: Trick = {
    leader: 'A',
    plays: [
      { player: 'A', card: c('yellow', 2) },
      { player: 'B', card: c('yellow', 8) },
      { player: 'C', card: c('green', 9) },
    ],
  };
  expect(trickWinner(t)).toBe('B');
});

test('rocket beats any color; highest rocket wins', () => {
  const t: Trick = {
    leader: 'A',
    plays: [
      { player: 'A', card: c('blue', 9) },
      { player: 'B', card: c('rocket', 1) },
      { player: 'C', card: c('rocket', 4) },
    ],
  };
  expect(trickWinner(t)).toBe('C');
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test --workspace @space-crew/engine`
Expected: FAIL ("trick" 모듈 없음).

- [ ] **Step 3: 구현**

`packages/engine/src/trick.ts`:
```ts
import { Card, Suit } from './cards';

export interface Play {
  player: string;
  card: Card;
}

export interface Trick {
  leader: string;
  plays: Play[];
}

export function leadSuit(trick: Trick): Suit | undefined {
  return trick.plays[0]?.card.suit;
}

export function legalMoves(hand: readonly Card[], trick: Trick): Card[] {
  const lead = leadSuit(trick);
  if (lead === undefined) return [...hand];
  const sameSuit = hand.filter((card) => card.suit === lead);
  return sameSuit.length > 0 ? sameSuit : [...hand];
}

export function trickWinner(trick: Trick): string {
  const lead = leadSuit(trick);
  if (lead === undefined) throw new Error('cannot resolve an empty trick');
  const rockets = trick.plays.filter((p) => p.card.suit === 'rocket');
  const contenders = rockets.length > 0
    ? rockets
    : trick.plays.filter((p) => p.card.suit === lead);
  return contenders.reduce((best, p) => (p.card.value > best.card.value ? p : best)).player;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test --workspace @space-crew/engine`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add -A && git commit -m "feat: trick rules — lead suit, legal moves, winner"
```

---

## Task 6: GameState 타입과 초기 상태 생성

**Files:**
- Create: `packages/engine/src/state.ts`
- Test: `packages/engine/src/state.test.ts`

**Interfaces:**
- Consumes: `Card` (cards.ts), `Play`, `Trick` (trick.ts), `dealHands`, `findCommander` (deal.ts).
- Produces:
  - `type PlayerId = string`
  - `type Phase = 'task-assignment' | 'trick-in-progress' | 'mission-result'`
  - `interface TaskAssignment { card: Card; owner: PlayerId; fulfilled: boolean }`
  - `interface CompletedTrick { leader: PlayerId; plays: Play[]; winner: PlayerId }`
  - `interface GameState { players; commander; hands; missionId; attemptNumber; phase; currentTrick; trickHistory; tasks; outcome }`
  - `function createGame(args: { players: PlayerId[]; missionId: number; seed: number; attemptNumber?: number }): GameState`

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/engine/src/state.test.ts`:
```ts
import { createGame } from './state';

const P = ['p0', 'p1', 'p2'];

test('createGame deals hands and sets the commander to the rocket-4 holder', () => {
  const s = createGame({ players: P, missionId: 1, seed: 5 });
  expect(s.players).toEqual(P);
  expect(P).toContain(s.commander);
  const cmdHand = s.hands[s.commander]!;
  expect(cmdHand.some((c) => c.suit === 'rocket' && c.value === 4)).toBe(true);
  expect(Object.values(s.hands).reduce((n, h) => n + h.length, 0)).toBe(40);
});

test('createGame starts in task-assignment with an empty trick led by the commander', () => {
  const s = createGame({ players: P, missionId: 1, seed: 5 });
  expect(s.phase).toBe('task-assignment');
  expect(s.currentTrick.plays).toEqual([]);
  expect(s.currentTrick.leader).toBe(s.commander);
  expect(s.outcome).toBe('in-progress');
  expect(s.attemptNumber).toBe(1);
});

test('createGame is deterministic for the same seed', () => {
  expect(createGame({ players: P, missionId: 1, seed: 7 }))
    .toEqual(createGame({ players: P, missionId: 1, seed: 7 }));
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test --workspace @space-crew/engine`
Expected: FAIL ("state" 모듈 없음).

- [ ] **Step 3: 구현**

`packages/engine/src/state.ts`:
```ts
import { Card } from './cards';
import { Play, Trick } from './trick';
import { dealHands, findCommander } from './deal';

export type PlayerId = string;
export type Phase = 'task-assignment' | 'trick-in-progress' | 'mission-result';

export interface TaskAssignment {
  card: Card;
  owner: PlayerId;
  fulfilled: boolean;
}

export interface CompletedTrick {
  leader: PlayerId;
  plays: Play[];
  winner: PlayerId;
}

export interface GameState {
  players: PlayerId[];
  commander: PlayerId;
  hands: Record<PlayerId, Card[]>;
  missionId: number;
  attemptNumber: number;
  phase: Phase;
  currentTrick: Trick;
  trickHistory: CompletedTrick[];
  tasks: TaskAssignment[];
  outcome: 'in-progress' | 'won' | 'lost';
}

export function createGame(args: {
  players: PlayerId[];
  missionId: number;
  seed: number;
  attemptNumber?: number;
}): GameState {
  const { players, missionId, seed, attemptNumber = 1 } = args;
  if (players.length !== 3) throw new Error('exactly 3 players required');
  const dealt = dealHands(seed);
  const hands: Record<PlayerId, Card[]> = {};
  players.forEach((p, seat) => {
    hands[p] = dealt[seat]!;
  });
  const commander = players[findCommander(dealt)]!;
  return {
    players,
    commander,
    hands,
    missionId,
    attemptNumber,
    phase: 'task-assignment',
    currentTrick: { leader: commander, plays: [] },
    trickHistory: [],
    tasks: [],
    outcome: 'in-progress',
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test --workspace @space-crew/engine`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add -A && git commit -m "feat: GameState type and createGame factory"
```

---

## Task 7: 태스크 배정 (open-pick 최소 구현)

**Files:**
- Modify: `packages/engine/src/state.ts` (배정 헬퍼 추가)
- Create: `packages/engine/src/assign.ts`
- Test: `packages/engine/src/assign.test.ts`

**Interfaces:**
- Consumes: `GameState`, `TaskAssignment`, `PlayerId` (state.ts); `Card`, `sameCard` (cards.ts).
- Produces:
  - `function assignTask(state: GameState, owner: PlayerId, card: Card): GameState` — `tasks`에 추가, 검증 후 마지막 배정이면 phase를 `trick-in-progress`로.
  - `function beginTricks(state: GameState): GameState` — 태스크 없는 미션에서 즉시 트릭 시작.

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/engine/src/assign.test.ts`:
```ts
import { createGame } from './state';
import { assignTask, beginTricks } from './assign';

const P = ['p0', 'p1', 'p2'];

test('assignTask records owner + card and keeps phase in assignment until begun', () => {
  const s0 = createGame({ players: P, missionId: 1, seed: 5 });
  const s1 = assignTask(s0, 'p1', { suit: 'pink', value: 1 });
  expect(s1.tasks).toEqual([{ card: { suit: 'pink', value: 1 }, owner: 'p1', fulfilled: false }]);
  expect(s1.phase).toBe('task-assignment');
});

test('beginTricks moves to trick-in-progress', () => {
  const s0 = createGame({ players: P, missionId: 1, seed: 5 });
  const s1 = assignTask(s0, 'p1', { suit: 'pink', value: 1 });
  const s2 = beginTricks(s1);
  expect(s2.phase).toBe('trick-in-progress');
  expect(s2.currentTrick.leader).toBe(s2.commander);
});

test('assignTask rejects a duplicate task card', () => {
  const s0 = createGame({ players: P, missionId: 1, seed: 5 });
  const s1 = assignTask(s0, 'p1', { suit: 'pink', value: 1 });
  expect(() => assignTask(s1, 'p2', { suit: 'pink', value: 1 })).toThrow(/already a task/);
});

test('assignTask does not mutate the input state', () => {
  const s0 = createGame({ players: P, missionId: 1, seed: 5 });
  assignTask(s0, 'p1', { suit: 'pink', value: 1 });
  expect(s0.tasks).toEqual([]);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test --workspace @space-crew/engine`
Expected: FAIL ("assign" 모듈 없음).

- [ ] **Step 3: 구현**

`packages/engine/src/assign.ts`:
```ts
import { Card, sameCard } from './cards';
import { GameState, PlayerId } from './state';

export function assignTask(state: GameState, owner: PlayerId, card: Card): GameState {
  if (state.phase !== 'task-assignment') throw new Error('not in task-assignment phase');
  if (!state.players.includes(owner)) throw new Error(`unknown player ${owner}`);
  if (state.tasks.some((t) => sameCard(t.card, card))) {
    throw new Error(`card ${card.suit}-${card.value} is already a task`);
  }
  return {
    ...state,
    tasks: [...state.tasks, { card, owner, fulfilled: false }],
  };
}

export function beginTricks(state: GameState): GameState {
  if (state.phase !== 'task-assignment') throw new Error('not in task-assignment phase');
  return {
    ...state,
    phase: 'trick-in-progress',
    currentTrick: { leader: state.commander, plays: [] },
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test --workspace @space-crew/engine`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add -A && git commit -m "feat: minimal open-pick task assignment"
```

---

## Task 8: 카드 플레이 전이 + 태스크 달성/위반

**Files:**
- Create: `packages/engine/src/play.ts`
- Test: `packages/engine/src/play.test.ts`

**Interfaces:**
- Consumes: `GameState`, `CompletedTrick`, `PlayerId` (state.ts); `Card`, `sameCard` (cards.ts); `legalMoves`, `trickWinner` (trick.ts).
- Produces:
  - `function currentPlayer(state: GameState): PlayerId` — 이번에 낼 차례인 플레이어.
  - `function applyPlay(state: GameState, player: PlayerId, card: Card): GameState` — 검증·전이. 트릭 완성 시 승자 확정→태스크 갱신→`evaluate`(Task 9)는 호출하지 않고 트릭만 닫는다. 위반(비소유자가 태스크 카드 획득)은 즉시 `outcome='lost'`.

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/engine/src/play.test.ts`:
```ts
import { createGame, GameState } from './state';
import { assignTask, beginTricks } from './assign';
import { applyPlay, currentPlayer } from './play';
import { Card } from './cards';

const P = ['p0', 'p1', 'p2'];

// 손패를 고정해 결정적으로 트릭을 구성하기 위한 헬퍼
function withHands(base: GameState, hands: Record<string, Card[]>): GameState {
  return { ...base, hands: { ...hands } };
}

function setup(): GameState {
  const g = createGame({ players: P, missionId: 1, seed: 1 });
  // 커맨더를 p0로 고정하고 손패를 직접 지정
  const s: GameState = {
    ...g,
    commander: 'p0',
    currentTrick: { leader: 'p0', plays: [] },
    hands: {
      p0: [{ suit: 'pink', value: 9 }],
      p1: [{ suit: 'pink', value: 5 }],
      p2: [{ suit: 'pink', value: 1 }],
    },
  };
  return s;
}

test('currentPlayer follows seat order from the leader', () => {
  const s = beginTricks(assignTask(setup(), 'p0', { suit: 'pink', value: 1 }));
  expect(currentPlayer(s)).toBe('p0');
});

test('a full trick resolves to the highest follower and starts the next trick from the winner', () => {
  let s = beginTricks(assignTask(setup(), 'p0', { suit: 'pink', value: 1 }));
  s = applyPlay(s, 'p0', { suit: 'pink', value: 9 });
  s = applyPlay(s, 'p1', { suit: 'pink', value: 5 });
  s = applyPlay(s, 'p2', { suit: 'pink', value: 1 });
  expect(s.trickHistory).toHaveLength(1);
  expect(s.trickHistory[0]!.winner).toBe('p0');
  expect(s.currentTrick.leader).toBe('p0');
  expect(s.currentTrick.plays).toEqual([]);
});

test('owner winning their task card marks it fulfilled', () => {
  let s = beginTricks(assignTask(setup(), 'p0', { suit: 'pink', value: 1 }));
  s = applyPlay(s, 'p0', { suit: 'pink', value: 9 });
  s = applyPlay(s, 'p1', { suit: 'pink', value: 5 });
  s = applyPlay(s, 'p2', { suit: 'pink', value: 1 });
  expect(s.tasks[0]!.fulfilled).toBe(true);
  expect(s.outcome).toBe('in-progress');
});

test('a non-owner winning a task card loses immediately', () => {
  // 태스크 pink1을 p1에게 줬는데 p0가 그 트릭을 따면 패배
  let s = beginTricks(assignTask(setup(), 'p1', { suit: 'pink', value: 1 }));
  s = applyPlay(s, 'p0', { suit: 'pink', value: 9 });
  s = applyPlay(s, 'p1', { suit: 'pink', value: 5 });
  s = applyPlay(s, 'p2', { suit: 'pink', value: 1 });
  expect(s.outcome).toBe('lost');
});

test('applyPlay rejects an out-of-turn play', () => {
  const s = beginTricks(assignTask(setup(), 'p0', { suit: 'pink', value: 1 }));
  expect(() => applyPlay(s, 'p1', { suit: 'pink', value: 5 })).toThrow(/not .* turn/i);
});

test('applyPlay rejects an illegal (non-following) card', () => {
  let s = beginTricks(assignTask(setup(), 'p0', { suit: 'pink', value: 1 }));
  s = { ...s, hands: { ...s.hands, p1: [{ suit: 'green', value: 2 }, { suit: 'pink', value: 5 }] } };
  s = applyPlay(s, 'p0', { suit: 'pink', value: 9 });
  expect(() => applyPlay(s, 'p1', { suit: 'green', value: 2 })).toThrow(/must follow|illegal/i);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test --workspace @space-crew/engine`
Expected: FAIL ("play" 모듈 없음).

- [ ] **Step 3: 구현**

`packages/engine/src/play.ts`:
```ts
import { Card, sameCard } from './cards';
import { legalMoves, trickWinner } from './trick';
import { CompletedTrick, GameState, PlayerId } from './state';

export function currentPlayer(state: GameState): PlayerId {
  const leaderIdx = state.players.indexOf(state.currentTrick.leader);
  const offset = state.currentTrick.plays.length;
  return state.players[(leaderIdx + offset) % state.players.length]!;
}

export function applyPlay(state: GameState, player: PlayerId, card: Card): GameState {
  if (state.phase !== 'trick-in-progress') throw new Error('not in trick phase');
  if (state.outcome !== 'in-progress') throw new Error('mission already ended');
  if (player !== currentPlayer(state)) throw new Error(`not ${player}'s turn`);

  const hand = state.hands[player]!;
  if (!hand.some((c) => sameCard(c, card))) throw new Error('card not in hand');
  if (!legalMoves(hand, state.currentTrick).some((c) => sameCard(c, card))) {
    throw new Error('illegal: must follow the lead suit');
  }

  const hands = { ...state.hands, [player]: hand.filter((c) => !sameCard(c, card)) };
  const plays = [...state.currentTrick.plays, { player, card }];

  // 트릭이 아직 완성되지 않았으면 카드만 추가
  if (plays.length < state.players.length) {
    return { ...state, hands, currentTrick: { ...state.currentTrick, plays } };
  }

  // 트릭 완성 → 승자 확정
  const completed: CompletedTrick = {
    leader: state.currentTrick.leader,
    plays,
    winner: trickWinner({ leader: state.currentTrick.leader, plays }),
  };

  // 태스크 갱신: 이 트릭에 포함된 태스크 카드를 승자가 가져갔는지 검사
  let outcome = state.outcome;
  const tasks = state.tasks.map((t) => {
    const inTrick = plays.some((p) => sameCard(p.card, t.card));
    if (!inTrick) return t;
    if (completed.winner === t.owner) return { ...t, fulfilled: true };
    // 비소유자가 태스크 카드를 획득 → 즉시 패배
    outcome = 'lost';
    return t;
  });

  return {
    ...state,
    hands,
    tasks,
    outcome,
    trickHistory: [...state.trickHistory, completed],
    currentTrick: { leader: completed.winner, plays: [] },
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test --workspace @space-crew/engine`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add -A && git commit -m "feat: applyPlay transition with task fulfillment and loss"
```

---

## Task 9: 미션 승패 평가 + 시도/미션 루프

**Files:**
- Create: `packages/engine/src/outcome.ts`
- Create: `packages/engine/src/loop.ts`
- Modify: `packages/engine/src/play.ts` (트릭 종료 후 `evaluateOutcome` 호출)
- Modify: `packages/engine/src/index.ts` (공개 API 배럴)
- Test: `packages/engine/src/outcome.test.ts`
- Test: `packages/engine/src/loop.test.ts`

**Interfaces:**
- Consumes: `GameState` (state.ts); `createGame` (state.ts).
- Produces:
  - `function evaluateOutcome(state: GameState): GameState` — 모든 태스크 fulfilled & 13트릭 종료면 `won`; 이미 `lost`면 유지. 미션 종료 시 phase를 `mission-result`로.
  - `function restartAttempt(state: GameState, seed: number): GameState` — 같은 미션 재딜, `attemptNumber+1`.
  - `function advanceMission(state: GameState, seed: number): GameState` — `missionId+1`로 새 게임.

- [ ] **Step 1: 실패하는 테스트 작성 (outcome)**

`packages/engine/src/outcome.test.ts`:
```ts
import { createGame, GameState } from './state';
import { assignTask, beginTricks } from './assign';
import { applyPlay } from './play';
import { evaluateOutcome } from './outcome';
import { Card } from './cards';

const P = ['p0', 'p1', 'p2'];

// 1트릭짜리 미니 미션: 각자 카드 1장, p0의 태스크 pink1
function oneTrickGame(): GameState {
  const g = createGame({ players: P, missionId: 1, seed: 1 });
  const s: GameState = {
    ...g,
    commander: 'p0',
    currentTrick: { leader: 'p0', plays: [] },
    hands: {
      p0: [{ suit: 'pink', value: 9 }],
      p1: [{ suit: 'pink', value: 5 }],
      p2: [{ suit: 'pink', value: 1 }],
    },
  };
  return beginTricks(assignTask(s, 'p0', { suit: 'pink', value: 1 }));
}

test('mission is won when every task is fulfilled and all hands are empty', () => {
  let s = oneTrickGame();
  s = applyPlay(s, 'p0', { suit: 'pink', value: 9 });
  s = applyPlay(s, 'p1', { suit: 'pink', value: 5 });
  s = applyPlay(s, 'p2', { suit: 'pink', value: 1 });
  s = evaluateOutcome(s);
  expect(s.outcome).toBe('won');
  expect(s.phase).toBe('mission-result');
});

test('evaluateOutcome leaves an in-progress mission untouched', () => {
  const s = oneTrickGame();
  expect(evaluateOutcome(s).outcome).toBe('in-progress');
  expect(evaluateOutcome(s).phase).toBe('trick-in-progress');
});
```

> 주: 14/13/13 실제 딜에서는 seat 0이 1장을 미사용으로 남긴다. "all hands empty"가 아니라 **"플레이 가능한 카드가 모두 소진(=13트릭 종료)"** 기준으로 평가해야 한다(아래 구현은 `trickHistory.length === 13`을 종료 기준으로 사용; 미니 미션 테스트는 1트릭이므로 별도 종료 헬퍼를 둔다).

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test --workspace @space-crew/engine`
Expected: FAIL ("outcome" 모듈 없음).

- [ ] **Step 3: 구현 (outcome) — 종료 기준을 주입 가능하게**

`packages/engine/src/outcome.ts`:
```ts
import { GameState } from './state';

// 실제 3인 미션은 13트릭, 미니 테스트는 더 짧을 수 있으므로
// "모든 손패의 플레이가능 카드 소진"을 종료로 본다(seat 0의 미사용 1장 제외 불가하므로
// 트릭 수가 곧 종료 신호 — 손패에 카드가 1장 이하만 남으면 더 둘 트릭이 없다).
function allTricksPlayed(state: GameState): boolean {
  const maxHand = Math.max(...state.players.map((p) => state.hands[p]!.length));
  return maxHand <= 1; // 한 명만 미사용 1장 남고 나머지는 0 → 더 진행 불가
}

export function evaluateOutcome(state: GameState): GameState {
  if (state.outcome === 'lost') {
    return { ...state, phase: 'mission-result' };
  }
  if (state.outcome === 'won') return state;
  const allFulfilled = state.tasks.every((t) => t.fulfilled);
  if (allTricksPlayed(state) && allFulfilled) {
    return { ...state, outcome: 'won', phase: 'mission-result' };
  }
  return state;
}
```

- [ ] **Step 4: `applyPlay`가 트릭 종료 후 `evaluateOutcome`을 호출하도록 수정**

`packages/engine/src/play.ts`의 마지막 `return`을 다음으로 교체(`import { evaluateOutcome } from './outcome';` 추가):
```ts
  const next: GameState = {
    ...state,
    hands,
    tasks,
    outcome,
    trickHistory: [...state.trickHistory, completed],
    currentTrick: { leader: completed.winner, plays: [] },
  };
  return evaluateOutcome(next);
```

- [ ] **Step 5: outcome 테스트 통과 확인**

Run: `npm test --workspace @space-crew/engine`
Expected: PASS (outcome + 기존 play 테스트 모두).

- [ ] **Step 6: 실패하는 테스트 작성 (loop)**

`packages/engine/src/loop.test.ts`:
```ts
import { createGame } from './state';
import { restartAttempt, advanceMission } from './loop';

const P = ['p0', 'p1', 'p2'];

test('restartAttempt re-deals the same mission and bumps attemptNumber', () => {
  const s0 = createGame({ players: P, missionId: 3, seed: 1 });
  const s1 = restartAttempt(s0, 2);
  expect(s1.missionId).toBe(3);
  expect(s1.attemptNumber).toBe(2);
  expect(s1.phase).toBe('task-assignment');
  expect(s1.outcome).toBe('in-progress');
  expect(s1.trickHistory).toEqual([]);
});

test('advanceMission starts the next mission at attempt 1', () => {
  const s0 = createGame({ players: P, missionId: 3, seed: 1 });
  const s1 = advanceMission(s0, 9);
  expect(s1.missionId).toBe(4);
  expect(s1.attemptNumber).toBe(1);
  expect(s1.phase).toBe('task-assignment');
});
```

- [ ] **Step 7: 구현 (loop)**

`packages/engine/src/loop.ts`:
```ts
import { createGame, GameState } from './state';

export function restartAttempt(state: GameState, seed: number): GameState {
  return createGame({
    players: state.players,
    missionId: state.missionId,
    seed,
    attemptNumber: state.attemptNumber + 1,
  });
}

export function advanceMission(state: GameState, seed: number): GameState {
  return createGame({
    players: state.players,
    missionId: state.missionId + 1,
    seed,
    attemptNumber: 1,
  });
}
```

- [ ] **Step 8: 공개 API 배럴 갱신**

`packages/engine/src/index.ts`:
```ts
export const ENGINE_VERSION = '0.0.0';
export * from './cards';
export * from './rng';
export * from './deal';
export * from './trick';
export * from './state';
export * from './assign';
export * from './play';
export * from './outcome';
export * from './loop';
```

- [ ] **Step 9: 전체 테스트 + 타입체크 통과 확인**

Run: `npm test --workspace @space-crew/engine && npm run typecheck --workspace @space-crew/engine`
Expected: 모든 테스트 PASS, 타입 에러 0.

- [ ] **Step 10: 커밋**

```bash
git add -A && git commit -m "feat: mission outcome evaluation and attempt/mission loop"
```

---

## Self-Review (작성자 점검 완료)

- **Spec 커버리지**: 카드 모델(§2)·결정적 딜 14/13/13 + 미사용 1장(§2)·커맨더=로켓4(§2)·팔로우 슈트/로켓 트럼프/최고값 승자(§2)·태스크 달성·비소유자 획득 즉시 패배(§2)·미션 성공(모든 태스크)(§2)·시도 재시작/다음 미션 전이(§4.2)를 Task 2~9가 구현. 통신·조난·순서토큰·특수제약·서버·클라·캠페인은 **이 계획의 비범위**(후속 계획 2~6).
- **결정성**: 모든 무작위는 시드 주입(`dealHands(seed)`, `createGame({seed})`, `restartAttempt/advanceMission(seed)`). `evaluate` 시점은 트릭 종료 직후 단일 호출(spec §4.3과 일치).
- **타입 일관성**: `applyPlay`/`currentPlayer`/`legalMoves`/`trickWinner`/`createGame`/`assignTask`/`beginTricks`/`evaluateOutcome`/`restartAttempt`/`advanceMission` 시그니처가 태스크 간 일치. `Trick`/`Play`는 trick.ts, `GameState` 계열은 state.ts 단일 출처.
- **알려진 단순화(후속 계획에서 대체)**: open-pick 배정은 수동 `assignTask`(인터랙티브 선택 UI/봇 선택은 Plan 4~5). 종료 기준 `maxHand<=1`은 태스크-only 미션 가정(특수 제약·트릭수 제약은 Plan 2~3에서 `evaluate` 기반으로 확장). seat 0 고정 추가카드는 결정적 단순화.

---

## 후속 계획 (이 계획 완료 후)
2. 통신(트릭 리드 직전 인터럽트·진실성)·조난신호·순서 토큰·배정 방식(결정/분배/양도) — 엔진.
3. 전체 제약 카탈로그(§4.4) + 50미션 데이터(§8 6a~6e 슬라이스) — 엔진.
4. shared 프로토콜 + 서버(방·좌석·단일 큐·봇 러너·뷰 직렬화) + BasicBot.
5. 클라이언트(테이블·로비·브리핑·결과 UI).
6. 캠페인 영속화 + 인간 합류 흐름.
