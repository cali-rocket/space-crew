# Plan 8 — Remaining Rule UI (commander distribution, M50, distress, answers)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** 남은 인터랙티브 룰 흐름을 완성한다 — 커맨더 결정 일반화(M20 한 명이 전부, M50 3역할 협상)와 M5 데이터 정합, 조난 결정+카드 전달, 커맨더 응답(good/bad·yes/no) 표시. 끝나면 50미션 전부 셋업·플레이 가능해진다(역할/조난 인터랙션 포함).

**Architecture:** 엔진은 순수 유지. 컨트롤러가 task-assignment phase 동안 "결정(decision)"과 "조난 전달"을 오케스트레이션하고 뷰로 노출한다. 봇은 자동 처리, 사람은 UI로 처리. 프로토콜에 결정/조난 메시지를 추가한다.

**Tech Stack:** 기존(engine/server/shared/client, TS strict, Vitest, ws, React).

## Global Constraints

- 기존 149 테스트 무회귀, typecheck 0(4패키지), 클라 빌드 OK, src에 방출 .js 0(bare `tsc` 금지 — `tsc --noEmit`/vitest/vite만).
- 손패 비공개 유지. 새로 공개되는 것은 face-up 태스크풀과 (조난 전달 후) 자기 손패 변화뿐. 조난 제출 카드는 전원 제출 전까지 비공개(commit-then-reveal, 엔진이 이미 보장).
- 결정/조난 프롬프트는 해당 주체(커맨더/제출 대기자)에게만 뷰로 노출.
- 커밋 프리픽스 `feat:`/`fix:`/`test:`. 각 태스크 끝 커밋. `git add`는 특정 파일만(쓰레기 스테이징 금지).

## File Structure

- Modify: `packages/engine/src/missions.data.ts` (M5 assignment 정합).
- Modify: `packages/server/src/controller.ts` (결정 일반화 + 조난 오케스트레이션).
- Modify: `packages/engine/src/view.ts` (PlayerView.decision 일반화 + distressPass).
- Modify: `packages/shared/src/protocol.ts` (메시지 추가).
- Modify: `packages/server/src/wsServer.ts` (핸들러).
- Modify: `packages/client/src/{GameTable,Lobby,App}.tsx` (UI).
- Tests alongside.

---

## Task 1: 커맨더 결정 일반화 (role / all-tasks / m50-roles) + M5 정합

**Files:** Modify `missions.data.ts`, `view.ts`, `controller.ts`, `protocol.ts`, `wsServer.ts`, `GameTable.tsx`, `App.tsx`; Tests `controller.decision2.test.ts`, `GameTable.decision.test.tsx`(확장).

**M5 정합:** `missions.data.ts`에서 미션 id 5의 `assignment`를 `'commander-decision'` → `'open-pick'`로 바꾼다(M5는 태스크를 open-pick으로 나누고 'sick' 역할만 커맨더가 결정 — 기존 player-trick-count role 'sick' 제약은 그대로). 이러면 M5는 역할 결정 + open-pick 태스크가 된다.

**view.ts:** `PlayerView.decision`을 일반화:
```ts
decision?:
  | { kind: 'role'; role: string; candidates: PlayerId[] }
  | { kind: 'all-tasks'; candidates: PlayerId[] }
  | { kind: 'm50-roles'; roles: string[]; candidates: PlayerId[] };
```

**controller.ts:** `pendingRoleDecision`을 다음 `pendingDecision`으로 교체(호출처 advance/viewFor도 갱신):
```ts
import { ..., ConstraintDef } from '@space-crew/engine';

export type Decision =
  | { kind: 'role'; role: string; candidates: PlayerId[] }
  | { kind: 'all-tasks'; candidates: PlayerId[] }
  | { kind: 'm50-roles'; roles: string[]; candidates: PlayerId[] };

function unboundRole(match: Match): string | null {
  for (const c of match.def.constraints ?? []) {
    if ((c.kind === 'player-trick-count' || c.kind === 'player-exact-tricks') && c.role !== 'commander') {
      if (match.game.roles[c.role] === undefined) return c.role;
    }
  }
  return null;
}
function partitionRoles(match: Match): string[] | null {
  const c = (match.def.constraints ?? []).find((x) => x.kind === 'trick-partition');
  if (!c || c.kind !== 'trick-partition') return null;
  const roles = c.parts.map((p) => p.role);
  return roles.every((r) => match.game.roles[r] !== undefined) ? null : roles;
}
export function pendingDecision(match: Match): Decision | null {
  if (match.game.phase !== 'task-assignment') return null;
  const nonCmd = match.game.players.filter((p) => p !== match.game.commander);
  const role = unboundRole(match);
  if (role !== null) return { kind: 'role', role, candidates: nonCmd };
  const m50 = partitionRoles(match);
  if (m50 !== null) return { kind: 'm50-roles', roles: m50, candidates: [...match.game.players] };
  if (match.def.assignment === 'commander-decision' && match.taskPool.length > 0) {
    return { kind: 'all-tasks', candidates: nonCmd };
  }
  return null;
}
```
`advance` task-assignment 분기 시작부를 다음으로:
```ts
    if (game.phase === 'task-assignment') {
      const dec = pendingDecision(m);
      if (dec !== null) {
        if (!isBot[game.commander]) return m; // human commander decides
        if (dec.kind === 'role') {
          m.game = assignRole(game, dec.role, dec.candidates[0]!); m.step++;
        } else if (dec.kind === 'all-tasks') {
          let g = game; for (const card of taskPool) g = assignTask(g, dec.candidates[0]!, card);
          m.game = g; m.taskPool = []; m.step++;
        } else {
          let g = game; dec.roles.forEach((r, i) => { g = assignRole(g, r, game.players[i % game.players.length]!); });
          m.game = g; m.step++;
        }
      } else if (taskPool.length === 0) {
        m.game = beginTricks(m.game); m.step++;
      } else {
        // existing open-pick logic (unchanged)
        ...
      }
    } else if (game.phase === 'trick-in-progress') {
```
`applyHumanAction`: replace the `commander-assign` branch and add `commander-assign-roles`:
```ts
    | { type: 'commander-assign'; assignee: PlayerId }
    | { type: 'commander-assign-roles'; assignments: Record<string, PlayerId> }
...
  } else if (action.type === 'commander-assign') {
    if (player !== m.game.commander) throw new Error('only the commander may decide');
    const dec = pendingDecision(m);
    if (dec === null || dec.kind === 'm50-roles') throw new Error('no single-assignee decision pending');
    if (action.assignee === m.game.commander) throw new Error('commander cannot choose self');
    if (!m.game.players.includes(action.assignee)) throw new Error('unknown assignee');
    if (dec.kind === 'role') { m.game = assignRole(m.game, dec.role, action.assignee); }
    else { let g = m.game; for (const card of m.taskPool) g = assignTask(g, action.assignee, card); m.game = g; m.taskPool = []; }
  } else if (action.type === 'commander-assign-roles') {
    if (player !== m.game.commander) throw new Error('only the commander may decide');
    const dec = pendingDecision(m);
    if (dec === null || dec.kind !== 'm50-roles') throw new Error('no role-assignment decision pending');
    let g = m.game;
    for (const r of dec.roles) { const a = action.assignments[r]; if (!a || !g.players.includes(a)) throw new Error('invalid role assignment'); g = assignRole(g, r, a); }
    m.game = g;
  }
```
`viewFor`: replace the decision exposure with:
```ts
    const dec = pendingDecision(match);
    if (dec !== null && player === match.game.commander) v = { ...v, decision: dec };
```

**protocol.ts:** add to `ClientToServer`: `{ t: 'commander-assign'; assignee: PlayerId }`(already), `{ t: 'commander-assign-roles'; assignments: Record<string, PlayerId> }`.

**wsServer.ts:** add a `commander-assign-roles` handler mirroring `commander-assign` (calls applyHumanAction with `{ type: 'commander-assign-roles', assignments: msg.assignments }`).

**GameTable.tsx:** render based on `view.decision.kind`:
- `role` / `all-tasks`: candidate buttons (existing, with `data-testid={`decide-${p}`}`); the heading reads role name (role) or "한 명에게 모든 태스크" (all-tasks).
- `m50-roles`: for each role, a `<select data-testid={`role-select-${role}`}>` of players, plus a "확정" button (`data-testid="assign-roles"`) calling `onCommanderAssignRoles(map)`.
- Add prop `onCommanderAssignRoles?(assignments: Record<string, PlayerId>): void`.

**App.tsx:** add `handleCommanderAssignRoles` → `conn.send({ t: 'commander-assign-roles', assignments })`, pass to GameTable.

- [ ] **Step 1: 실패 테스트** — `controller.decision2.test.ts`: (a) M20-style (commander-decision, taskCount>0, no role): bot commander → all pool tasks go to one non-commander; human commander → decision kind 'all-tasks', `applyHumanAction('commander-assign')` assigns all tasks to assignee, pool empties. (b) M50-style (trick-partition 3 roles): bot commander → 3 roles bound; human commander → decision kind 'm50-roles', `commander-assign-roles` binds all 3. (c) M5 mission (id 5) from MISSIONS has assignment 'open-pick'.
- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현** (위 코드).
- [ ] **Step 4: 통과 + 빌드** — `npm test --workspaces`; `npm run build --workspace @space-crew/client`; typecheck 0. No stray .js.
- [ ] **Step 5: 커밋** — `git commit -m "feat: generalize commander decision (all-tasks M20, m50 roles) + M5 assignment fix"`

---

## Task 2: 조난 결정 + 카드 전달 흐름

**Files:** Modify `controller.ts`, `view.ts`, `protocol.ts`, `wsServer.ts`, `room.ts`, `Lobby.tsx`, `GameTable.tsx`, `App.tsx`; Test `controller.distress.test.ts`.

**설계:** 조난은 로비에서 호스트가 켜고 방향을 정한다. 게임 시작 시 컨트롤러가 task-assignment 진입 직후(결정/픽 이전) 조난 카드 전달을 오케스트레이션한다: 각 플레이어가 비-로켓 카드 1장을 제출(봇 자동: 가장 낮은 비-로켓; 사람: UI). 3인 모두 제출되면 엔진 `submitDistressCard`가 방향대로 전달(commit-then-reveal). 그 후 결정/픽으로 진행.

**room.ts/setupMatch:** 방의 distress 옵션(`active: boolean`, `direction: 'left'|'right'`)을 받아 `setupMatch`에서 `setDistress(game, active, direction)` 적용. `createRoom`/`start`에 distress 옵션 전달. (room에 `distress?: {active, direction}` 필드.)

**controller.ts:** advance 시작부(트릭/결정보다 먼저), task-assignment에서 조난 미완료면 처리:
```ts
function distressPending(m: Match): boolean {
  return m.game.phase === 'task-assignment' && m.game.distressActive
    && Object.keys(m.game.distressCommits ?? {}).length < m.game.players.length;
}
// in advance task-assignment branch, BEFORE pendingDecision:
if (m.game.distressActive && Object.keys(m.game.distressCommits ?? {}).length < game.players.length) {
  const pending = game.players.filter((p) => !(game.distressCommits ?? {})[p]);
  const next = pending[0]!;
  if (isBot[next]) {
    const hand = game.hands[next]!.filter((c) => c.suit !== 'rocket');
    const card = hand.reduce((lo, c) => (c.value < lo.value ? c : lo));
    m.game = submitDistressCard(game, next, card); m.step++;
  } else { return m; } // human must submit
}
```
(import `submitDistressCard`.) Once all submit, engine clears `distressCommits` and updates hands; loop continues to decision/picks.

`applyHumanAction`: add `{ type: 'submit-distress'; card: Card }` → `m.game = submitDistressCard(m.game, player, action.card)`.

**view.ts:** `PlayerView` += `distressPass?: { mustSubmit: boolean }`. (set in viewFor.)
**controller viewFor:** if `m.game.distressActive` and the viewer hasn't committed and others pending, set `distressPass: { mustSubmit: true }` for that viewer.

**protocol.ts:** `ClientToServer` += `{ t: 'submit-distress'; card: Card }`. `create` message += optional `distress?: { active: boolean; direction: 'left'|'right' }` (host sets at create).

**wsServer.ts:** `create` reads `msg.distress` → store on room; `start` passes it to setupMatch; add `submit-distress` handler.

**Lobby.tsx:** add a distress toggle + direction select in the create panel (`data-testid="distress-toggle"`, `data-testid="distress-direction"`), passed via `onCreate(missionId, distress?)`. (Update onCreate signature; App sends it.)

**GameTable.tsx:** if `view.distressPass?.mustSubmit`, show "조난: 이웃에게 넘길 카드를 고르세요(로켓 제외)" + hand cards (non-rocket) with `data-testid={`distress-card-${suit}-${value}`}` → `onSubmitDistress(card)`. Add prop.

**App.tsx:** `handleSubmitDistress` → send `{ t: 'submit-distress', card }`; pass to GameTable. `handleCreate` sends optional distress.

- [ ] **Step 1: 실패 테스트** — `controller.distress.test.ts`: setupMatch with distress active+direction (a plain mission). All-bot → bots auto-submit, cards pass to neighbor, distressCommits cleared, game proceeds to tricks/terminal. Human present → advance stops with `distressPass.mustSubmit` true for a human who hasn't submitted; `applyHumanAction('submit-distress')` advances. Verify a card actually moved to the neighbor.
- [ ] **Step 2: 실패 확인** — FAIL.
- [ ] **Step 3: 구현** (위).
- [ ] **Step 4: 통과 + 빌드** — full suite, build, typecheck 0, no stray .js.
- [ ] **Step 5: 커밋** — `git commit -m "feat: distress decision (lobby toggle) and card-pass orchestration"`

---

## Task 3: 커맨더 응답 표시 (good/bad·yes/no) + 마무리

**Files:** Modify `GameTable.tsx`; Test `GameTable.decision.test.tsx`(확장).

**설계(플레이버, 가벼움):** 커맨더 결정 패널 위에, 각 비-커맨더 크루의 답변(룰상 good/bad 또는 yes/no)을 표시한다. 답변 자체는 메커니즘에 영향 없으므로, 컨트롤러가 봇 답변을 미리 채워 뷰로 노출하거나(선택), 최소 구현으로 패널에 "커맨더가 손패를 보고 담당자를 정합니다" 안내 + 후보 버튼만 둔다. 질문 종류(role 'sick' → good/bad, 그 외 → yes/no)를 헤딩에 표기.

- [ ] **Step 1: 테스트** — 결정 패널 헤딩이 질문 종류를 반영(role==='sick'이면 'good/bad', 아니면 'yes/no' 문구 포함). 후보 버튼 동작은 기존 테스트 유지.
- [ ] **Step 2~4:** 구현 + 통과 + 빌드.
- [ ] **Step 5: 커밋** — `git commit -m "feat: commander question-kind label in decision panel"`

---

## Self-Review (작성자 점검)
- **커버리지**: M20(all-tasks)·M50(3역할)·M5(open-pick+sick)·M33/M41(role, 기존)·조난(전달)·커맨더 응답 표기. 50미션 인터랙션 완비.
- **비공개**: 조난 제출은 엔진 commit-then-reveal로 전원 제출 전 비공개. 결정/조난 프롬프트는 주체에게만 노출.
- **무회귀**: 기존 open-pick·트릭·통신·역할 바인딩 경로 보존. bare tsc 금지(방출 .js 0 유지).
- **남는 것(백로그)**: 커맨더 분배 균등(M24/32/36/43 — 현재 데이터상 commander-decision로 일괄 처리되거나 open-pick), order 토큰 데이터 보강.

## 다음
- Plan 9: 인터넷 배포 — 서버 빌드/엔트리, 클라 prod ws URL, 배포 설정·문서.
