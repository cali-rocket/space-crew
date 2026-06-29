# Plan 6 — Campaign, Multi-room Join, Mission Selection, Task-pick & Comm UI

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** 지금까지 미룬 핵심을 채워 완결한다 — (1) 공개 태스크풀을 뷰에 노출하고 클라에 태스크-픽 UI, (2) 호스트의 미션 선택, (3) 방 코드로 인간 합류(다중 방), (4) 캠페인 진행 영속화, (5) 최소 통신 UI. 끝나면 호스트가 미션을 골라 방을 만들고, 친구가 코드로 합류해(봇 자리 대체) 50미션 중 하나를 끝까지 협력 플레이하고 진행이 저장된다.

**Architecture:** 엔진 `PlayerView`에 공개 태스크풀(face-up 중앙 풀)을 선택 노출. 서버를 단일-방에서 **방 레지스트리(코드→Room)** 로 확장하고 join/미션선택/브로드캐스트를 처리. 캠페인 진행은 서버측 JSON으로 영속. 클라는 미션 선택·합류·태스크-픽·통신 UI 추가.

**Tech Stack:** 기존과 동일(engine/server/client, TS strict, Vitest, ws, React+Vite).

## Global Constraints

- 기존 워크스페이스(121 테스트, typecheck 0) 무회귀.
- 손패 비공개 유지: 공개되는 것은 **face-up 태스크풀**(중앙에 깔린 선택 대상 카드들 — 룰상 공개)뿐. 타인 손패·시드·미공개 덱은 절대 비노출.
- 항상 3인. 빈 자리는 봇. 합류는 봇 자리를 사람으로 교체(시작 전). 미션은 호스트가 선택.
- TS strict + noUncheckedIndexedAccess. 순수 함수 우선(ws/파일 I/O 글루만 예외). 커밋 프리픽스 `feat:`/`test:`/`chore:`. 각 태스크 끝 커밋.

## File Structure

- Modify: `packages/engine/src/view.ts` — `PlayerView`에 `taskPool?: Card[]`.
- Modify: `packages/server/src/controller.ts` — `viewFor`가 task-assignment에서 `taskPool` 포함.
- Modify: `packages/server/src/room.ts`, `packages/server/src/wsServer.ts` — 방 레지스트리·join·미션선택·브로드캐스트.
- Create: `packages/server/src/campaign.ts` — 진행 영속화.
- Modify: `packages/shared/src/protocol.ts` — `join`/`progress` 메시지(필요 시).
- Modify: `packages/client/src/{Lobby.tsx,GameTable.tsx,App.tsx}` — 미션선택·합류·태스크-픽·통신 UI.
- Tests alongside.

---

## Task 1: 공개 태스크풀을 뷰에 노출

**Files:** Modify `packages/engine/src/view.ts`, `packages/server/src/controller.ts`; Test `packages/server/src/controller.pool.test.ts`

**Interfaces:**
- `PlayerView`에 `taskPool?: Card[]` 추가(공개 face-up 풀; task-assignment에서만 채움).
- 컨트롤러 `viewFor(match, player)`가 `match.game.phase === 'task-assignment'`이면 `view.taskPool = match.taskPool`를 채워 반환. (다른 phase면 미포함.)

- [ ] **Step 1: 실패 테스트** — `controller.pool.test.ts`:
```ts
import { setupMatch, viewFor } from './controller';
import type { MissionDef } from '@space-crew/engine';
const P = ['p0', 'p1', 'p2'];
const m: MissionDef = { id: 9, sourceText: 'x', logbookPage: 4, taskCount: 2 };
test('viewFor exposes the public task pool during task-assignment', () => {
  const match = setupMatch(m, P, { p0: false, p1: true, p2: true }, 3);
  const v = viewFor(match, 'p0');
  if (match.game.phase === 'task-assignment') {
    expect(Array.isArray(v.taskPool)).toBe(true);
    expect(v.taskPool!.length).toBe(match.taskPool.length);
  }
});
```

- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현** — `view.ts`의 `PlayerView`에 `taskPool?: Card[];` 추가. `controller.ts`의 `viewFor`에서 `toPlayerView` 결과에 task-assignment일 때 `taskPool`을 얹어 반환(예: `const v = toPlayerView(...); return match.game.phase === 'task-assignment' ? { ...v, taskPool: [...match.taskPool] } : v;`).
- [ ] **Step 4: 통과 확인** — `npm test --workspace @space-crew/server` + engine 무회귀.
- [ ] **Step 5: 커밋** — `git commit -am "feat: expose public task pool in PlayerView during assignment"`

---

## Task 2: 다중 방 레지스트리 + 코드 합류 + 미션 선택

**Files:** Modify `packages/server/src/room.ts`, `packages/server/src/wsServer.ts`, `packages/shared/src/protocol.ts`; Test `packages/server/src/wsServer.join.test.ts`

**Behavior:**
- protocol: `ClientToServer`에 `{ t: 'join'; code: string }`가 이미 있음(없으면 추가). `create`는 `{ t:'create'; missionId:number }`.
- 서버는 **방 레지스트리** `Map<string, Room>`를 둔다. `Room`: `{ code; players: PlayerId[]; isBot; connected; conns: Map<PlayerId, WS>; missionId; match?; started }`.
- `create`: 코드 생성(주입 시드 기반, 충돌 회피), Room 생성(호스트=이 연결의 player, 봇2), `missionId` 저장, 이 연결을 호스트 player로 등록, `{t:'room'}` 전송.
- `join {code}`: 해당 방의 봇 자리 1개를 이 연결의 player로 교체(connected=true), conns 등록, 방 전체 연결에 `{t:'room'}` 브로드캐스트. 방 없으면 `nack`.
- `start`: 호스트만. 방의 `missionId`로 `MISSIONS.find`→`setupMatch`→`advance`, 방 전체에 각자 `viewFor`로 `{t:'view'}` 브로드캐스트.
- 액션(play-card/pick-task/communicate): 보낸 연결의 player로 `applyHumanAction`→`advance`→방 전체 뷰 브로드캐스트. 불법은 보낸 연결에만 `nack`.
- 연결 종료: 해당 좌석 `connected=false`(간단 처리). 방이 비면 GC.

- [ ] **Step 1: 실패 테스트(두 클라 합류)** — `wsServer.join.test.ts`:
```ts
import { startServer } from './index';
import { WebSocket } from 'ws';
function open(url: string) { return new Promise<WebSocket>((res) => { const w = new WebSocket(url); w.on('open', () => res(w)); }); }
const next = (w: WebSocket, pred: (m: any) => boolean) => new Promise<any>((res) => { const h = (d: any) => { const m = JSON.parse(d.toString()); if (pred(m)) { w.off('message', h); res(m); } }; w.on('message', h); });

test('host creates a room, a second client joins by code, both receive a view on start', async () => {
  const srv = startServer(0, { seed: 1 });
  const url = `ws://127.0.0.1:${srv.port}`;
  const host = await open(url);
  host.send(JSON.stringify({ t: 'create', missionId: 1 }));
  const room = await next(host, (m) => m.t === 'room');
  expect(room.code).toBeTruthy();
  const guest = await open(url);
  guest.send(JSON.stringify({ t: 'join', code: room.code }));
  await next(guest, (m) => m.t === 'room');
  host.send(JSON.stringify({ t: 'start' }));
  const hv = await next(host, (m) => m.t === 'view');
  const gv = await next(guest, (m) => m.t === 'view');
  expect(hv.view.me).not.toBe(gv.view.me); // each sees their own seat
  host.close(); guest.close(); await srv.close();
}, 15000);
```

- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현** — room.ts(레지스트리·createRoom·joinRoom·코드생성) + wsServer.ts(연결→player 매핑, create/join/start/action 디스패치, 방 브로드캐스트). 기존 단일-방 스모크 테스트도 통과하도록 유지(create+start 단독도 동작). 코드 생성은 주입 시드 기반 카운터로 결정적.
- [ ] **Step 4: 통과 확인** — `npm test --workspace @space-crew/server`(join + 기존 스모크 + 컨트롤러) 전부 PASS.
- [ ] **Step 5: 커밋** — `git commit -am "feat: multi-room registry, join-by-code, mission selection, broadcast"`

---

## Task 3: 캠페인 진행 영속화

**Files:** Create `packages/server/src/campaign.ts`; Modify `packages/server/src/wsServer.ts`; Test `packages/server/src/campaign.test.ts`

**Interfaces:**
- `interface CrewProgress { missionStatuses: Record<number, { attempts: number; cleared: boolean }>; currentMissionId: number }`
- `function emptyProgress(): CrewProgress`
- `function recordResult(p: CrewProgress, missionId: number, outcome: 'won' | 'lost'): CrewProgress` — won이면 cleared=true, attempts+1, currentMissionId=max(missionId+1); lost면 attempts+1.
- `function loadProgress(file: string): CrewProgress`(없으면 empty), `function saveProgress(file: string, p: CrewProgress): void`(JSON). 순수 `recordResult` + 얇은 파일 I/O.
- wsServer: 미션 종료(view.outcome가 won/lost로 전이) 시 `recordResult`+`saveProgress`. (영속 파일 경로는 서버 옵션/기본값.)

- [ ] **Step 1: 실패 테스트** — `campaign.test.ts`:
```ts
import { emptyProgress, recordResult } from './campaign';
test('recordResult marks cleared and advances on win', () => {
  let p = emptyProgress();
  p = recordResult(p, 3, 'won');
  expect(p.missionStatuses[3]).toEqual({ attempts: 1, cleared: true });
  expect(p.currentMissionId).toBe(4);
});
test('recordResult counts attempts on loss without clearing', () => {
  let p = recordResult(emptyProgress(), 3, 'lost');
  expect(p.missionStatuses[3]).toEqual({ attempts: 1, cleared: false });
  expect(p.currentMissionId).toBe(1);
});
```

- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현** — `campaign.ts`(emptyProgress/recordResult 순수 + load/save 파일 I/O via `node:fs`). wsServer에서 미션 종료 감지 시 기록·저장(파일 경로는 옵션, 테스트에선 임시/생략 가능). recordResult는 순수.
- [ ] **Step 4: 통과 확인** — `npm test --workspace @space-crew/server` PASS.
- [ ] **Step 5: 커밋** — `git commit -am "feat: campaign progress persistence (record + JSON store)"`

---

## Task 4: 클라 미션 선택 (로비)

**Files:** Modify `packages/client/src/Lobby.tsx`, `packages/client/src/App.tsx`; Test `packages/client/src/Lobby.mission.test.tsx`

**Interfaces:** Lobby에서 호스트가 미션 1~50 중 선택(기본 1) 후 "방 만들기" → `onCreate(missionId)`. App은 선택된 missionId로 `{t:'create', missionId}` 전송. (진행 표시는 선택적 — 있으면 cleared 마커.)

- [ ] **Step 1: 실패 테스트** — `Lobby.mission.test.tsx`: 미션 선택 컨트롤(예: `<select data-testid="mission-select">` 또는 숫자 입력)에서 값 변경 후 "방 만들기" 클릭 → `onCreate`가 선택값으로 호출되는지.
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Lobby } from './Lobby';
test('host picks a mission and creates with it', () => {
  const onCreate = vi.fn();
  render(<Lobby onCreate={onCreate} onStart={() => {}} onJoin={() => {}} />);
  fireEvent.change(screen.getByTestId('mission-select'), { target: { value: '9' } });
  fireEvent.click(screen.getByText(/방 만들기/));
  expect(onCreate).toHaveBeenCalledWith(9);
});
```
(주: `onCreate` 시그니처가 `(missionId:number)=>void`로 바뀐다. App·기존 테스트도 맞춘다.)

- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현** — Lobby에 미션 select(1~50) + onCreate(missionId). App의 handleCreate가 선택 missionId 사용. 기존 라우팅 테스트의 onCreate 호출 형태도 갱신.
- [ ] **Step 4: 통과 확인** — `npm test --workspace @space-crew/client` + build.
- [ ] **Step 5: 커밋** — `git commit -am "feat: client mission selection in lobby"`

---

## Task 5: 클라 태스크-픽 UI + 합법 하이라이트 보정

**Files:** Modify `packages/client/src/GameTable.tsx`; Test `packages/client/src/GameTable.pick.test.tsx`

**Interfaces:** `view.phase === 'task-assignment'`이고 `view.taskPool`가 있으면 중앙에 풀 카드를 렌더하고, 클릭 시 `onPickTask(card)`. 손패 합법 하이라이트는 `view.phase === 'trick-in-progress'`일 때만 적용(task-assignment에서 전체 손패가 합법처럼 보이던 문제 보정 — 그 phase에선 손패를 비활성/흐리게).

- [ ] **Step 1: 실패 테스트** — `GameTable.pick.test.tsx`: phase='task-assignment' + taskPool 2장 뷰 렌더 → 풀 카드 클릭 시 onPickTask 호출. 손패는 이 phase에서 클릭해도 onPlayCard 미호출(또는 비활성).
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { GameTable } from './GameTable';
import type { PlayerView } from '@space-crew/engine';
const base: PlayerView = { me: 'p0', myHand: [{ suit: 'blue', value: 7 }], seats: [{ player: 'p0', isBot: false, connected: true, handCount: 1, tricksWon: 0, isCommander: true, tasks: [], communication: [] }], missionId: 9, attemptNumber: 1, phase: 'task-assignment', currentTrick: { leader: 'p0', plays: [] }, objectives: [], communicationPolicy: 'normal', distressActive: false, outcome: 'in-progress', taskPool: [{ suit: 'pink', value: 1 }, { suit: 'green', value: 3 }] };
test('clicking a pool card fires onPickTask', () => {
  const onPick = vi.fn();
  render(<GameTable view={base} onPlayCard={() => {}} onPickTask={onPick} />);
  fireEvent.click(screen.getByTestId('pool-card-pink-1'));
  expect(onPick).toHaveBeenCalledWith({ suit: 'pink', value: 1 });
});
```

- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현** — GameTable에 task-assignment 풀 렌더(각 풀 카드 `data-testid={`pool-card-${suit}-${value}`}`, onClick=onPickTask). 손패 합법/활성 로직을 `phase==='trick-in-progress'`로 게이트. 기존 테스트 유지.
- [ ] **Step 4: 통과 확인** — `npm test --workspace @space-crew/client` + build.
- [ ] **Step 5: 커밋** — `git commit -am "feat: client task-pick UI and assignment-phase highlight fix"`

---

## Task 6: 클라 방 코드 합류 + 최소 통신 UI + 통합

**Files:** Modify `packages/client/src/Lobby.tsx`, `packages/client/src/GameTable.tsx`, `packages/client/src/App.tsx`; Test `packages/client/src/join.integration.test.tsx`

**Interfaces:**
- Lobby: 방 코드 입력 + "합류" 버튼 → `onJoin(code)` → App이 `{t:'join', code}` 전송. 방 생성 시 받은 코드 표시.
- GameTable: 내 차례 트릭 직전(`currentTrick.plays.length===0`) 통신 버튼 → 손패에서 카드 선택 → `onCommunicate(card)`(서버가 highest/only/lowest 검증). 최소 구현(토큰 위치는 서버 분류; 클라는 카드만 전송하고 token은 null 또는 자동). (룰 단순화: 클라는 카드를 보내고 서버 communicate가 검증; 정책상 normal이면 token 필요 → 클라가 가능한 분류를 같이 보내거나, 우선 dead-zone/생략 가능. 최소: 통신 버튼은 있으나 normal 정책에선 자동 분류 계산해 전송.)
- 통합 테스트: 실제 서버에 호스트+게스트 두 App을 붙여(두 개의 ws 폴리필 인스턴스) create→join→start→양쪽 테이블 렌더 확인.

> 통신 토큰 분류: 클라가 `legalMovesFromView` 대신 엔진의 통신 분류를 쓸 수 있으면 사용; 어려우면 이 태스크에선 "통신 버튼 + 카드 선택 → token=계산값" 최소 구현. 정확 검증은 서버 `communicate`가 담당.

- [ ] **Step 1: 실패 테스트** — `join.integration.test.tsx`(실제 서버, 두 App 또는 한 App+한 ws 게스트로 create→join→start→host 테이블 렌더). 최소: Lobby에 코드 입력 후 onJoin 호출 단위 테스트 + 실제 서버 join 흐름 1개.
- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현** — Lobby 합류 UI + App join 전송 + 코드 표시. GameTable 통신 버튼(최소). 통합 테스트.
- [ ] **Step 4: 통과 + 빌드 + 전체 무회귀** — `npm test --workspaces` 전부 PASS, `npm run build --workspace @space-crew/client` 성공, typecheck 0.
- [ ] **Step 5: 커밋** — `git commit -am "feat: client room-code join, minimal communicate UI, join integration"`

---

## Self-Review (작성자 점검)

- **Spec 커버리지**: §6.4 로비(방코드·미션선택)·§6.3 태스크 배정(open-pick 풀)·§5.3 좌석 교체(join)·§10 캠페인 영속화·통신 UI를 Task 1~6이 커버. 비주얼 스킨 후순위 유지.
- **비공개**: 공개되는 추가 정보는 face-up 태스크풀(룰상 공개)뿐. 타인 손패·시드 비노출 유지.
- **검증**: 서버는 단위+통합(두 클라 join), 클라는 단위+빌드+실제서버 통합. 캠페인 recordResult 순수 테스트.
- **남는 한계(문서화)**: 통신 토큰 위치 UI·조난 카드전달 UI·커맨더 결정/분배 질의 UI·재접속 정교화·역할 바인딩(M46/M50 sick/chosen/pink9holder)·5인 골든프레임은 범위 외(비목표 또는 추후). dead-zone+disruption 동시 미션 단순화 유지.

## 완료 후
- 전 계획(1~6) 완료 → 호스트+봇2 또는 호스트+합류자+봇으로 50미션 중 선택해 한 판 플레이 + 진행 저장이 동작. 비주얼 스킨·잔여 룰 UI·역할 바인딩은 후속 백로그.
