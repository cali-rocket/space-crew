# Plan 4 — Shared Protocol, View Serialization, BasicBot, Server

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** 클라이언트가 붙을 수 있는 서버 계층을 만든다 — 손패 비공개 뷰 직렬화, 봇 전략(BasicBot), 봇 자동 진행 + 인간 액션을 처리하는 매치 컨트롤러, shared 메시지 프로토콜, WebSocket 서버. 호스트1 + 봇2로 간단한 미션을 끝까지 플레이할 수 있다.

**Architecture:** 순수 엔진 위에 (1) 엔진 내 순수 뷰 직렬화·태스크덱·BasicBot, (2) 서버 내 순수 매치 컨트롤러(봇 턴 자동 진행 + 인간 액션 적용 + 페이즈 오케스트레이션), (3) 얇은 ws I/O 글루를 얹는다. 테스트는 컨트롤러를 봇만으로 또는 스크립트된 인간으로 시뮬레이션해 결정적으로 검증한다.

**Tech Stack:** TypeScript strict, npm workspaces, Vitest, `ws`(서버 WebSocket).

## Global Constraints

- 기존 `@space-crew/engine`(97 테스트)와 호환·무회귀. 엔진은 런타임 의존성 0 유지.
- 순수성: 뷰 직렬화·봇·컨트롤러 전이는 순수 함수(난수는 시드 주입). ws 글루만 I/O.
- **손패 비공개**: `PlayerView`에 타인 손패·`rngSeed`·미공개 태스크풀·dead-zone 분류가 절대 포함되지 않는다(타입+테스트로 강제).
- TS strict + noUncheckedIndexedAccess. 커밋 프리픽스 `feat:`/`test:`/`chore:`. 각 태스크 끝에 커밋.
- 결정적: 같은 시드+액션열 → 같은 상태. `Date.now()`/`Math.random()` 금지(서버 ws 글루의 코드 생성 제외, 거기선 시드 주입).

## File Structure

- Create: `packages/engine/src/view.ts` — `PlayerView`, `toPlayerView`, `legalMovesFromView`.
- Create: `packages/engine/src/taskdeck.ts` — `drawTaskCards(seed, count)`.
- Create: `packages/engine/src/bot.ts` — `BasicBot` 전략.
- Modify: `packages/engine/src/index.ts` — 배럴.
- Create: `packages/shared/{package.json,tsconfig.json,src/protocol.ts,src/index.ts}` — 메시지 프로토콜.
- Create: `packages/server/{package.json,tsconfig.json,vitest.config.ts}` + `src/controller.ts`, `src/room.ts`, `src/wsServer.ts`, `src/index.ts`.
- Tests alongside.

---

## Task 1: 뷰 직렬화 (PlayerView)

**Files:** Create `packages/engine/src/view.ts`; Test `packages/engine/src/view.test.ts`

**Interfaces:**
- `interface SeatView { player: PlayerId; isBot: boolean; connected: boolean; handCount: number; tricksWon: number; isCommander: boolean; tasks: TaskAssignment[]; communication: CommState[] }`
- `interface PlayerView { me: PlayerId; myHand: Card[]; seats: SeatView[]; missionId: number; attemptNumber: number; phase: Phase; currentTrick: { leader: PlayerId; plays: { player: PlayerId; card: Card }[]; leadSuit?: Suit }; objectives: ConstraintDef[]; communicationPolicy: CommunicationPolicy; distressActive: boolean; outcome: GameState['outcome']; legalMoves?: Card[] }`
- `function toPlayerView(state: GameState, viewer: PlayerId, opts?: { isBot?: Record<PlayerId, boolean>; connected?: Record<PlayerId, boolean> }): PlayerView` — viewer의 손패만 `myHand`; 타인은 `handCount`만. `rngSeed`·타인 hands 비포함. `legalMoves`는 트릭 진행 중 viewer 차례면 채움.
- `function legalMovesFromView(view: PlayerView): Card[]` — view.myHand + currentTrick의 leadSuit로 팔로우 합법수 계산(서버 권위 판정과 별개의 클라용 프리뷰).

- [ ] **Step 1: 실패 테스트** — `view.test.ts`:
```ts
import { createGame, GameState } from './state';
import { toPlayerView, legalMovesFromView } from './view';
import { Card } from './cards';

const P = ['p0', 'p1', 'p2'];
const C = (s: Card['suit'], v: number): Card => ({ suit: s, value: v });
function game(): GameState {
  return { ...createGame({ players: P, missionId: 1, seed: 3 }), commander: 'p0',
    hands: { p0: [C('pink', 9), C('blue', 2)], p1: [C('green', 1)], p2: [C('yellow', 5)] } };
}

test('toPlayerView exposes only the viewer hand; others are counts; no rngSeed', () => {
  const v = toPlayerView(game(), 'p0');
  expect(v.myHand).toEqual([C('pink', 9), C('blue', 2)]);
  const p1 = v.seats.find((s) => s.player === 'p1')!;
  expect(p1.handCount).toBe(1);
  expect((p1 as Record<string, unknown>).hand).toBeUndefined();
  expect(JSON.stringify(v)).not.toContain('rngSeed');
});

test('legalMovesFromView follows the lead suit', () => {
  const s: GameState = { ...game(), phase: 'trick-in-progress',
    currentTrick: { leader: 'p1', plays: [{ player: 'p1', card: C('blue', 7) }] } };
  // viewer p0 has blue 2 → must follow blue
  const v = toPlayerView(s, 'p0');
  expect(legalMovesFromView(v)).toEqual([C('blue', 2)]);
});

test('toPlayerView includes legalMoves when it is the viewer turn', () => {
  const s: GameState = { ...game(), phase: 'trick-in-progress', currentTrick: { leader: 'p0', plays: [] } };
  const v = toPlayerView(s, 'p0');
  expect(v.legalMoves).toEqual([C('pink', 9), C('blue', 2)]); // empty trick → any
});
```

- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현** — `view.ts`:
```ts
import { Card, Suit } from './cards';
import { GameState, PlayerId, Phase, TaskAssignment, CommState, ConstraintDef, CommunicationPolicy } from './state';
import { legalMoves as engineLegal, leadSuit, Trick } from './trick';
import { currentPlayer } from './play';

export interface SeatView { player: PlayerId; isBot: boolean; connected: boolean; handCount: number; tricksWon: number; isCommander: boolean; tasks: TaskAssignment[]; communication: CommState[]; }
export interface PlayerView {
  me: PlayerId; myHand: Card[]; seats: SeatView[]; missionId: number; attemptNumber: number; phase: Phase;
  currentTrick: { leader: PlayerId; plays: { player: PlayerId; card: Card }[]; leadSuit?: Suit };
  objectives: ConstraintDef[]; communicationPolicy: CommunicationPolicy; distressActive: boolean; outcome: GameState['outcome']; legalMoves?: Card[];
}

export function toPlayerView(state: GameState, viewer: PlayerId, opts?: { isBot?: Record<PlayerId, boolean>; connected?: Record<PlayerId, boolean> }): PlayerView {
  const tricksWon: Record<PlayerId, number> = Object.fromEntries(state.players.map((p) => [p, 0]));
  for (const t of state.trickHistory) tricksWon[t.winner] = (tricksWon[t.winner] ?? 0) + 1;
  const seats: SeatView[] = state.players.map((p) => ({
    player: p, isBot: opts?.isBot?.[p] ?? false, connected: opts?.connected?.[p] ?? true,
    handCount: (state.hands[p] ?? []).length, tricksWon: tricksWon[p] ?? 0, isCommander: p === state.commander,
    tasks: state.tasks.filter((t) => t.owner === p), communication: state.communication.filter((c) => c.player === p),
  }));
  const view: PlayerView = {
    me: viewer, myHand: [...(state.hands[viewer] ?? [])], seats,
    missionId: state.missionId, attemptNumber: state.attemptNumber, phase: state.phase,
    currentTrick: { leader: state.currentTrick.leader, plays: state.currentTrick.plays.map((p) => ({ ...p })), leadSuit: leadSuit(state.currentTrick as Trick) },
    objectives: state.constraints, communicationPolicy: state.communicationPolicy, distressActive: state.distressActive, outcome: state.outcome,
  };
  if (state.phase === 'trick-in-progress' && state.outcome === 'in-progress' && currentPlayer(state) === viewer) {
    view.legalMoves = engineLegal(state.hands[viewer] ?? [], state.currentTrick);
  }
  return view;
}

export function legalMovesFromView(view: PlayerView): Card[] {
  const lead = view.currentTrick.leadSuit;
  if (lead === undefined) return [...view.myHand];
  const same = view.myHand.filter((c) => c.suit === lead);
  return same.length > 0 ? same : [...view.myHand];
}
```
- [ ] **Step 4: 통과 확인** — PASS.
- [ ] **Step 5: 커밋** — `git add -A && git commit -m "feat: PlayerView serialization (hides other hands and seed)"`

---

## Task 2: 태스크 덱 (drawTaskCards)

**Files:** Create `packages/engine/src/taskdeck.ts`; Test `packages/engine/src/taskdeck.test.ts`

**Interfaces:** `function drawTaskCards(seed: number, count: number): Card[]` — 36장의 색 태스크 카드(4색×1-9, 로켓 없음)에서 시드로 셔플 후 앞 `count`장. 결정적.

- [ ] **Step 1: 실패 테스트** — `taskdeck.test.ts`:
```ts
import { drawTaskCards } from './taskdeck';
test('draws `count` distinct color task cards deterministically', () => {
  const a = drawTaskCards(7, 3); const b = drawTaskCards(7, 3);
  expect(a).toEqual(b);
  expect(a).toHaveLength(3);
  expect(a.every((c) => c.suit !== 'rocket')).toBe(true);
  expect(new Set(a.map((c) => `${c.suit}-${c.value}`)).size).toBe(3);
});
test('count 0 → empty', () => { expect(drawTaskCards(1, 0)).toEqual([]); });
```
- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현** — `taskdeck.ts`:
```ts
import { Card, COLORS } from './cards';
import { shuffle } from './rng';

export function drawTaskCards(seed: number, count: number): Card[] {
  const deck: Card[] = [];
  for (const suit of COLORS) for (let v = 1; v <= 9; v++) deck.push({ suit, value: v });
  return shuffle(deck, seed).slice(0, count);
}
```
- [ ] **Step 4: 통과 확인** — PASS.
- [ ] **Step 5: 커밋** — `git commit -am "feat: task-card deck draw"`

---

## Task 3: BasicBot 전략

**Files:** Create `packages/engine/src/bot.ts`; Test `packages/engine/src/bot.test.ts`

**Interfaces:**
- `interface BotStrategy { chooseTask(view: PlayerView, pool: Card[]): Card; playCard(view: PlayerView, legalMoves: Card[]): Card; decideCommunication(view: PlayerView): null; answerCommander(view: PlayerView, kind: 'yes-no' | 'good-bad'): 'yes' | 'no' | 'good' | 'bad' }`
- `const BasicBot: BotStrategy` — chooseTask: 풀의 첫 카드(결정적). playCard: 합법수 중 (a) 내 태스크 카드가 합법수에 있으면 그걸 내고(따려 시도), (b) 아니면 가장 낮은 값(무난). decideCommunication: 항상 null. answerCommander: 'yes'/'good'.

- [ ] **Step 1: 실패 테스트** — `bot.test.ts`:
```ts
import { BasicBot } from './bot';
import { PlayerView } from './view';
import { Card } from './cards';
const C = (s: Card['suit'], v: number): Card => ({ suit: s, value: v });
const baseView = (over: Partial<PlayerView>): PlayerView => ({
  me: 'p0', myHand: [], seats: [], missionId: 1, attemptNumber: 1, phase: 'trick-in-progress',
  currentTrick: { leader: 'p0', plays: [] }, objectives: [], communicationPolicy: 'normal', distressActive: false, outcome: 'in-progress', ...over,
});

test('chooseTask picks the first pool card deterministically', () => {
  expect(BasicBot.chooseTask(baseView({}), [C('pink', 3), C('blue', 1)])).toEqual(C('pink', 3));
});
test('playCard plays a legal card that matches my own task if possible', () => {
  const v = baseView({ me: 'p0', seats: [{ player: 'p0', isBot: true, connected: true, handCount: 2, tricksWon: 0, isCommander: false, tasks: [{ card: C('blue', 5), owner: 'p0', fulfilled: false }], communication: [] }] });
  const legal = [C('green', 2), C('blue', 5)];
  expect(BasicBot.playCard(v, legal)).toEqual(C('blue', 5));
});
test('playCard otherwise plays the lowest-value legal card', () => {
  const v = baseView({ seats: [{ player: 'p0', isBot: true, connected: true, handCount: 2, tricksWon: 0, isCommander: false, tasks: [], communication: [] }] });
  expect(BasicBot.playCard(v, [C('green', 8), C('blue', 2)])).toEqual(C('blue', 2));
});
test('decideCommunication is always null', () => { expect(BasicBot.decideCommunication(baseView({}))).toBeNull(); });
```
- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현** — `bot.ts`:
```ts
import { Card, sameCard } from './cards';
import { PlayerView } from './view';

export interface BotStrategy {
  chooseTask(view: PlayerView, pool: Card[]): Card;
  playCard(view: PlayerView, legalMoves: Card[]): Card;
  decideCommunication(view: PlayerView): null;
  answerCommander(view: PlayerView, kind: 'yes-no' | 'good-bad'): 'yes' | 'no' | 'good' | 'bad';
}

export const BasicBot: BotStrategy = {
  chooseTask(_view, pool) {
    if (pool.length === 0) throw new Error('empty task pool');
    return pool[0]!;
  },
  playCard(view, legalMoves) {
    if (legalMoves.length === 0) throw new Error('no legal moves');
    const myTasks = view.seats.find((s) => s.player === view.me)?.tasks ?? [];
    const taskHit = legalMoves.find((m) => myTasks.some((t) => !t.fulfilled && sameCard(t.card, m)));
    if (taskHit) return taskHit;
    return legalMoves.reduce((lo, m) => (m.value < lo.value ? m : lo));
  },
  decideCommunication() { return null; },
  answerCommander(_view, kind) { return kind === 'good-bad' ? 'good' : 'yes'; },
};
```
- [ ] **Step 4: 통과 확인** — PASS.
- [ ] **Step 5: 배럴** — index.ts에 `export * from './view'; export * from './taskdeck'; export * from './bot';` 추가.
- [ ] **Step 6: 커밋** — `git commit -am "feat: BasicBot strategy + engine barrel for view/taskdeck/bot"`

---

## Task 4: 매치 컨트롤러 (봇 자동 진행 + 인간 액션)

**Files:** Create `packages/server/{package.json,tsconfig.json,vitest.config.ts,src/controller.ts}`; Test `packages/server/src/controller.test.ts`

서버 패키지를 스캐폴드하고(엔진을 워크스페이스 의존성으로), 매치 컨트롤러를 구현한다.

**Interfaces (controller.ts):**
- `interface Match { game: GameState; isBot: Record<PlayerId, boolean>; taskPool: Card[]; seed: number; step: number }`
- `function setupMatch(def: MissionDef, players: PlayerId[], isBot: Record<PlayerId, boolean>, seed: number): Match` — `createMission` + `drawTaskCards(seed', def.taskCount)`로 풀 준비.
- `function advance(match: Match): Match` — 더 진행할 봇 액션이 없거나(인간 차례) 미션 종료까지 봇 액션을 자동 적용:
  - phase 'task-assignment': 풀에 카드가 남아 있으면 픽 순서(커맨더부터 시계방향)의 다음 픽 주체가 봇이면 `BasicBot.chooseTask`로 풀 첫 카드를 그 봇에 `assignTask`하고 풀에서 제거; 인간 차례면 멈춤. 풀이 비면 `beginTricks`. (taskCount 0이면 바로 beginTricks.)
  - phase 'trick-in-progress': `currentPlayer`가 봇이면 `toPlayerView`→`legalMovesFromView`(또는 엔진 legalMoves)→`BasicBot.playCard`→`applyPlay`; 인간이면 멈춤.
  - 'mission-result'면 멈춤.
- `function applyHumanAction(match: Match, player: PlayerId, action: { type: 'pick-task'; card: Card } | { type: 'play-card'; card: Card } | { type: 'communicate'; card: Card; token: CommToken | null }): Match` — 인간 액션을 엔진으로 적용(검증 위임)하고 `advance`로 봇을 이어 진행.
- `function viewFor(match: Match, player: PlayerId): PlayerView`.

> 픽 순서: 커맨더 인덱스부터 시계방향으로 한 명씩 한 장. 풀 길이만큼 라운드로빈(이 단순화는 Plan 5/6에서 정교화).

- [ ] **Step 1: 서버 패키지 스캐폴드** — `packages/server/package.json`:
```json
{ "name": "@space-crew/server", "version": "0.0.0", "private": true, "type": "module", "main": "src/index.ts",
  "scripts": { "test": "vitest run", "typecheck": "tsc --noEmit" },
  "dependencies": { "@space-crew/engine": "*", "ws": "^8.18.0" },
  "devDependencies": { "typescript": "^5.5.0", "vitest": "^2.0.0", "@types/ws": "^8.5.0" } }
```
`packages/server/tsconfig.json`(엔진과 동일 옵션 + `"moduleResolution":"Bundler"`), `vitest.config.ts`(globals true). 루트에서 `npm install`.

- [ ] **Step 2: 실패 테스트** — `controller.test.ts`:
```ts
import { setupMatch, advance, applyHumanAction, viewFor, Match } from './controller';
import type { MissionDef } from '@space-crew/engine';

const P = ['p0', 'p1', 'p2'];
const m1: MissionDef = { id: 1, sourceText: 'training', logbookPage: 3, taskCount: 1 };

test('all-bot match plays mission 1 to a terminal outcome deterministically', () => {
  const isBot = { p0: true, p1: true, p2: true };
  let m = setupMatch(m1, P, isBot, 42);
  m = advance(m);
  expect(['won', 'lost']).toContain(m.game.outcome);
  // determinism
  let m2 = advance(setupMatch(m1, P, isBot, 42));
  expect(m2.game.outcome).toBe(m.game.outcome);
});

test('with a human seat, advance stops on the human turn and resumes after their action', () => {
  const isBot = { p0: false, p1: true, p2: true };
  let m = setupMatch({ id: 1, sourceText: 't', logbookPage: 3, taskCount: 0 }, P, isBot, 5);
  m = advance(m);
  // taskCount 0 → trick phase; if it's p0(human) turn, advance stopped there
  if (m.game.phase === 'trick-in-progress' && m.game.outcome === 'in-progress') {
    const v = viewFor(m, 'p0');
    const legal = v.legalMoves ?? [];
    if (legal.length > 0) {
      m = applyHumanAction(m, 'p0', { type: 'play-card', card: legal[0]! });
      expect(m.step).toBeGreaterThan(0);
    }
  }
  expect(m.game).toBeDefined();
});

test('viewFor never leaks other hands', () => {
  let m = advance(setupMatch(m1, P, { p0: false, p1: true, p2: true }, 9));
  const v = viewFor(m, 'p0');
  expect(JSON.stringify(v)).not.toContain('rngSeed');
});
```
- [ ] **Step 3: 실패 확인** — FAIL.
- [ ] **Step 4: 구현** — `controller.ts` (엔진 API 사용: `createMission`, `drawTaskCards`, `assignTask`, `beginTricks`, `currentPlayer`, `applyPlay`, `communicate`, `toPlayerView`, `legalMovesFromView`, `BasicBot`). 픽 순서·봇 자동 진행·인간 액션 적용·종료 감지를 구현. (구현자는 엔진 시그니처를 확인해 정확히 호출한다. 풀 카드 분배 시 `assignTask(state, owner, card)` 사용. 봇 트릭 플레이는 `BasicBot.playCard(view, legalMoves)`.)
  - `advance`는 무한 루프 방지를 위해 진행이 없으면(상태 불변) 멈춘다.
- [ ] **Step 5: 통과 확인** — Run `npm test --workspace @space-crew/server` → PASS. 엔진도 회귀 없는지 `npm test --workspace @space-crew/engine`.
- [ ] **Step 6: 커밋** — `git commit -am "feat: server match controller (bot auto-advance + human actions)"`

---

## Task 5: shared 프로토콜

**Files:** Create `packages/shared/{package.json,tsconfig.json,src/protocol.ts,src/index.ts}`; Test `packages/shared/src/protocol.test.ts`

**Interfaces (protocol.ts):**
- `type ClientToServer = { t: 'join'; code: string; name?: string } | { t: 'create'; missionId: number } | { t: 'pick-task'; card: Card } | { t: 'play-card'; card: Card } | { t: 'communicate'; card: Card; token: CommToken | null } | { t: 'start' }`
- `type ServerToClient = { t: 'view'; view: PlayerView } | { t: 'nack'; reason: string } | { t: 'room'; code: string; seats: { player: PlayerId; isBot: boolean; connected: boolean }[]; started: boolean }`
- (Card/CommToken/PlayerView/PlayerId는 `@space-crew/engine`에서 재수출.)

- [ ] **Step 1: 스캐폴드 + 실패 테스트** — `packages/shared/package.json`(name `@space-crew/shared`, deps `@space-crew/engine: "*"`, devDeps typescript+vitest), tsconfig, `src/index.ts`(`export * from './protocol'`). `protocol.test.ts`:
```ts
import type { ClientToServer, ServerToClient } from './protocol';
test('protocol message unions are well-typed', () => {
  const a: ClientToServer = { t: 'play-card', card: { suit: 'pink', value: 3 } };
  const b: ServerToClient = { t: 'nack', reason: 'illegal' };
  expect(a.t).toBe('play-card'); expect(b.t).toBe('nack');
});
```
- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현** — `protocol.ts`에 위 유니온 + 엔진 타입 재수출(`export type { Card, CommToken, PlayerId } from '@space-crew/engine'`; `PlayerView`도). `npm install`.
- [ ] **Step 4: 통과 확인** — `npm test --workspace @space-crew/shared` → PASS.
- [ ] **Step 5: 커밋** — `git commit -am "feat: shared client/server protocol types"`

---

## Task 6: WebSocket 서버 + 룸 스토어 + 스모크 테스트

**Files:** Create `packages/server/src/room.ts`, `packages/server/src/wsServer.ts`, `packages/server/src/index.ts`; Test `packages/server/src/wsServer.test.ts`

**Interfaces:**
- room.ts: `interface Room { code: string; players: PlayerId[]; isBot: Record<PlayerId, boolean>; connected: Record<PlayerId, boolean>; match?: Match; started: boolean }`; `function createRoom(code: string, hostId: PlayerId): Room`(좌석=호스트+봇2); `function joinRoom(room, playerId): Room`(봇 좌석 1개를 사람으로 교체, 시작 전); `function startRoom(room, def, seed): Room`(setupMatch+advance).
- wsServer.ts: `function startServer(port: number, opts?: { seed?: number }): { close(): Promise<void>; port: number }` — `ws` 서버. 연결→메시지(JSON ClientToServer)→룸/컨트롤러 갱신→각 연결에 `{t:'view'}` 또는 `{t:'nack'}` 전송. 코드 생성은 주입 시드 기반(테스트 결정성).

- [ ] **Step 1: 실패 테스트(스모크)** — `wsServer.test.ts` (ws 클라이언트로 연결→create/start→view 수신):
```ts
import { startServer } from './wsServer';
import { WebSocket } from 'ws';

test('client can connect, create a room, and receive a view', async () => {
  const srv = startServer(0, { seed: 1 });
  const url = `ws://127.0.0.1:${srv.port}`;
  const ws = new WebSocket(url);
  const got: any[] = [];
  await new Promise<void>((res) => ws.on('open', () => res()));
  ws.on('message', (d) => got.push(JSON.parse(d.toString())));
  ws.send(JSON.stringify({ t: 'create', missionId: 1 }));
  ws.send(JSON.stringify({ t: 'start' }));
  await new Promise((r) => setTimeout(r, 300));
  expect(got.some((m) => m.t === 'room' || m.t === 'view')).toBe(true);
  ws.close(); await srv.close();
}, 10000);
```
- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현** — room.ts + wsServer.ts + index.ts(`startServer` 재수출, `if (import.meta.url === ...)` 직접 실행 시 기본 포트 리슨). 연결당 하나의 호스트 룸을 만들고(MVP), create→createRoom, start→startRoom+broadcast view, play-card/pick-task/communicate→applyHumanAction+broadcast, 불법이면 nack. setTimeout 같은 타이밍은 ws 글루에만.
- [ ] **Step 4: 통과 확인** — `npm test --workspace @space-crew/server` → PASS(컨트롤러 + 스모크). 엔진 회귀 없음.
- [ ] **Step 5: 타입체크** — `npm run typecheck`(engine/server/shared) 0 에러.
- [ ] **Step 6: 커밋** — `git commit -am "feat: ws server, room store, smoke test"`

---

## Self-Review (작성자 점검)

- **Spec 커버리지**: spec §3.1/3.3(뷰 직렬화·비공개)·§4.5(BotStrategy=PlayerView 입력)·§5(방·좌석·단일 적용·뷰 스냅샷 push + nack)를 Task 1~6이 커버.
- **비공개**: `toPlayerView`가 타인 hands·rngSeed 비포함, 봇도 동일 뷰 사용(BasicBot.playCard는 legalMoves만). 테스트로 유출 0 검증.
- **결정성**: 컨트롤러 전이 순수(시드), ws 타이밍만 비결정.
- **단순화/후속**: 픽 순서·커맨더 결정/분배 UI 연동·재접속·다중 방·역할 바인딩(M46/M50)·조난 흐름은 Plan 5/6. 컨트롤러는 open-pick + 트릭 자동 진행 중심.

## 다음
- Plan 5: 클라이언트(React+Vite) — 로비/브리핑/테이블/결과 UI, ws 연결, 합법수 프리뷰. (빌드+실제 구동 검증 포함.)
- Plan 6: 캠페인 영속화 + 인간 합류 흐름 + 역할 바인딩/조난 UI.
