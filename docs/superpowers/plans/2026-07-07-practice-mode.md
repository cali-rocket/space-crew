# Practice Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 카드 카운팅·전략을 학습/연습하는 솔로 모드를 브라우저-로컬 "훈련장"으로 추가한다.

**Architecture:** 연습은 서버/WS 없이 브라우저에서 순수 엔진 + BasicBot으로 구동한다. `advance`/`applyHumanAction`/`viewFor`(현 `server/controller.ts`, 이미 순수)를 엔진 `match.ts`로 이동해 서버·연습 드라이버가 공유(드리프트 0). 판단 로직(counting/coach/reveal/scaffolding/lessons)은 순수 엔진 모듈(TDD). 클라이언트는 `Conn`형 `LocalDriver` + 변경 없는 `GameTable` 주위 표시 전용 오버레이.

**Tech Stack:** TypeScript(모노레포 workspaces), vitest, React 18 + Vite.

## Global Constraints
- 3인 고정(1 human `me` + bots `bot-1`,`bot-2`). 카드 40장(4색×1–9 + 로켓1–4).
- 엔진은 순수·TDD. 규칙 재구현 금지 — `trick.ts`(`leadSuit`/`legalMoves`/`trickWinner`)를 import.
- 정보모델 안전: `toPlayerView` 불변. 리빌은 `reveal.ts`만, client `LocalDriver`만 import. `packages/server`는 `reveal` import 0. 프로토콜에 리빌 필드 0.
- 시각 IP: 원본 CSS/SVG만. Kosmos 자산 금지.
- 커밋 트레일러: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## File Structure

| 파일 | 상태 | 책임 |
|---|---|---|
| `packages/engine/src/match.ts` | 신규(이동) | `Match`/`Decision`/`setupMatch`/`advance`/`applyHumanAction`/`viewFor`/`pendingDecision` (controller.ts에서 이동) |
| `packages/server/src/controller.ts` | 수정 | `export * from '@space-crew/engine'`의 match 심볼 재export (서버 테스트 호환) |
| `packages/engine/src/counting.ts` | 신규 | 공개 PlayerView→카운팅 파생(remaining/rockets/voids/masters/복원/perfectInfo/taskReach) |
| `packages/engine/src/reveal.ts` | 신규 | `toRevealView(state, viewer)` — 유일 chokepoint |
| `packages/engine/src/coach.ts` | 신규(P2) | 원칙별 설명형 체크 레지스트리 |
| `packages/engine/src/scaffolding.ts` | 신규(P3) | ScaffoldLevel/gateFor/advanceFade/gradeSelfAnswer/Quiz |
| `packages/engine/src/lessons.data.ts` | 신규(P4) | 레슨 카탈로그(명시적 손패) + 빌더 검증 |
| `packages/engine/src/index.ts` | 수정 | 신규 모듈 export |
| `packages/client/src/practice/LocalDriver.ts` | 신규 | Conn형 로컬 드라이버 + 스냅샷 스택 + reveal |
| `packages/client/src/practice/usePracticeState.ts` | 신규 | view(+reveal)→카운팅/코치/스캐폴딩 메모이즈 훅 |
| `packages/client/src/practice/PracticeShell.tsx` | 신규 | GameTable + 레일 오버레이 |
| `packages/client/src/practice/CountingHUD.tsx` | 신규 | 로켓/색별 스트립/보이드/마스터 |
| `packages/client/src/practice/CoachPanel.tsx` | 신규(P2) | 코치 조언 스트림 |
| `packages/client/src/practice/RevealDrawer.tsx` | 신규 | 상대 손패 + PRACTICE 워터마크 + diffs |
| `packages/client/src/practice/ScaffoldControls.tsx` | 신규 | L0–L3 + (P3)드릴 |
| `packages/client/src/practice/PracticeSelector.tsx` | 신규 | 레슨/자유연습 진입 |
| `packages/client/src/App.tsx` | 수정 | practice 모드 상태 + LocalDriver 분기 + 라우팅 |
| `packages/client/src/Lobby.tsx` | 수정 | "훈련/Practice" 버튼 |
| `packages/client/src/theme.css` | 수정 | `.sc-practice-*` 클래스 |

---

## Phase 1 — 카운팅 코어 (빌드 가능한 슬라이스)

### Task 1: advance 루프 엔진 이동 (A1)

**Files:** Create `packages/engine/src/match.ts`; Modify `packages/server/src/controller.ts`, `packages/engine/src/index.ts`.

**Interfaces — Produces:** `Match`, `Decision`, `setupMatch(def,players,isBot,seed,distress?,attemptNumber?)`, `advance(match)`, `applyHumanAction(match,player,action)`, `viewFor(match,player)`, `pendingDecision(match)`.

- [ ] **S1** `git mv packages/server/src/controller.ts packages/engine/src/match.ts`; fix imports to relative engine paths (drop `@space-crew/engine` self-import → import from `./mission`,`./state`,`./assign`,`./play`,`./comm`,`./view`,`./bot`,`./taskdeck`,`./order`,`./constraints`,`./handover`,`./distress`).
- [ ] **S2** Add `export * from './match'` to `engine/src/index.ts`.
- [ ] **S3** New `packages/server/src/controller.ts` = `export { Match, Decision, setupMatch, advance, applyHumanAction, viewFor, pendingDecision } from '@space-crew/engine';` (+ `export type`).
- [ ] **S4** Run engine + server tests → all green (parity by reuse). `npx vitest run` in each package.
- [ ] **S5** Commit `refactor(engine): move pure match controller into engine (shared by server + practice)`.

### Task 2: counting.ts — remaining / rockets / voids

**Files:** Create `packages/engine/src/counting.ts`, `packages/engine/src/counting.test.ts`. Modify `index.ts`.

**Interfaces — Produces:**
```ts
interface CountingState {
  remaining: Record<Color, number[]>;          // 색별 아직 안 나온 값(내 손 제외)
  rockets: { played: number[]; remaining: number };
  voids: Record<PlayerId, Suit[]>;             // 확정 보이드
  masters: Card[];                              // 내 손패 중 마스터(보수적)
  reconstructed: Record<PlayerId, Card[]>;      // 강제 확정된 상대 카드
  perfectInfo: boolean;
}
function deriveCounting(view: PlayerView): CountingState;
```

- [ ] **S1 (fail test)** `remainingByColor`: 딜 없이, `view`에 trickHistory=[pink9,pink8 by others], myHand=[pink7] → `remaining.pink`는 1..6 (7=내손 제외, 8/9=나옴 제외). 로켓 별도.
- [ ] **S2** run → fail.
- [ ] **S3 (impl)** all-values(1..9) minus played(trickHistory+currentTrick) minus myHand, per color; rockets: played rocket values, remaining=4−played.
- [ ] **S4** run → pass.
- [ ] **S5 (fail test)** `detectVoids`: 트릭에서 leadSuit=blue인데 bot-1이 green을 냄 → voids['bot-1'] 포함 'blue'. 로켓으로 안 따라간 경우도 보이드.
- [ ] **S6–S7** impl(각 완료 트릭 + 현재 트릭 plays 스캔: `p.card.suit !== leadSuit ⇒ void in leadSuit`) → pass.
- [ ] **S8** Commit `feat(engine): counting substrate — remaining, rockets, voids`.

### Task 3: counting.ts — masters / reconstruction / perfectInfo

**Interfaces — Consumes** Task 2 CountingState. **Produces** `masters`, `reconstructed`, `perfectInfo` populated.

- [ ] **S1 (fail)** master(보수적): myHand=[green7]; remaining.green above 7 = [] (8,9 나옴) AND (rockets.remaining===0 OR 두 상대 green 보이드 아님이 확정) → masters=[green7]. rockets>0 & 상대 green 보이드 가능 → masters=[].
- [ ] **S2–S4** impl `computeMasters`: `higherSameColor.length===0 && (rockets.remaining===0 || bothOpponentsProvenNonVoid(color))`. 모호하면 제외.
- [ ] **S5 (property test)** 임의 합법 완성에서 주장 마스터가 안 짐(간이: 남은 상위 카드 0 & 트럼프 위협 0 확인).
- [ ] **S6 (fail)** reconstruction: bot-1 보이드(green,yellow,pink), 남은 손패 장수=3, blue 미확인 3장 → reconstructed['bot-1']=그 blue 3장. 잔여 장수 앵커.
- [ ] **S7–S8** impl fixpoint(정확 잔여 장수 기반, `색미확인 ≤ 강제슬롯`인 유일 손만 방출) → pass.
- [ ] **S9 (fail+impl)** `perfectInfo` = 모든 상대 손 reconstructed 완전.
- [ ] **S10** Commit `feat(engine): counting — masters, reconstruction, perfectInfo`.

### Task 4: reveal.ts + 안전성 테스트

**Files:** Create `packages/engine/src/reveal.ts`, `reveal.test.ts`, `packages/engine/src/safety.test.ts`. Modify `index.ts`.

**Interfaces — Produces:**
```ts
interface RevealView { __practiceOnly: true; opponentHands: Record<PlayerId, Card[]>;
  truth: CountingState; myDerived: CountingState; diffs: { player: PlayerId; card: Card }[]; }
function toRevealView(state: GameState, viewer: PlayerId): RevealView;
```

- [ ] **S1 (fail)** truth = 신의시점 deriveCounting(모든 손 노출로 만든 뷰), myDerived = deriveCounting(toPlayerView), diffs = truth.reconstructed에는 있으나 myDerived에는 없는 상대 카드.
- [ ] **S2–S4** impl → pass.
- [ ] **S5 (safety)** `toPlayerView(state, 'me').seats[bot]` 손패 노출 0; `myHand`은 viewer 것만. grep 테스트: `packages/server/**` 소스가 `reveal` 미참조(fs로 파일 스캔), `shared/protocol.ts`에 `opponentHands` 문자열 0.
- [ ] **S6** Commit `feat(engine): reveal chokepoint (practice-only) + info-safety tests`.

### Task 5: LocalDriver — Conn형 로컬 구동

**Files:** Create `packages/client/src/practice/LocalDriver.ts`, `LocalDriver.test.ts`.

**Interfaces — Consumes** engine `setupMatch/advance/applyHumanAction/viewFor/toRevealView`, `MISSIONS`, `Conn`. **Produces:**
```ts
interface PracticeConn extends Conn { reveal(): RevealView; snapshotDepth(): number; }
function createLocalDriver(cfg: { missionId: number; seed: number;
  distress?: { active: boolean; direction: 'left'|'right' } },
  handlers: { onMessage(msg: ServerToClient): void }): PracticeConn;
```

- [ ] **S1 (fail)** create→start→emit `{t:'view'}` for `me`; players=['me','bot-1','bot-2'], isBot={me:false,...}. viewer='me'.
- [ ] **S2–S4** impl: on `send({t:'create'|'start'})` setupMatch(MISSIONS.find(id), players, isBot, seed, distress) → advance → onMessage(view). Map action msgs → applyHumanAction (play-card/pick-task/communicate/commander-*/submit-distress). `retry`→restartAttempt+re-setup, `next-mission`→advanceMission. push GameState snapshot each emit.
- [ ] **S5 (fail+impl)** `reveal()` returns `toRevealView(match.game,'me')`.
- [ ] **S6 (integration test)** open-pick 미션 1판: 인간이 태스크 픽 + 카드 다 내면 outcome≠in-progress. legalMoves는 항상 view에 존재(내 차례일 때).
- [ ] **S7** Commit `feat(client): local practice driver (Conn-shaped, no server)`.

### Task 6: CountingHUD + RevealDrawer + usePracticeState

**Files:** Create `usePracticeState.ts`, `CountingHUD.tsx`, `RevealDrawer.tsx`, `ScaffoldControls.tsx` (L0/L3만), `PracticeShell.tsx`. Modify `theme.css`.

- [ ] **S1 (fail test, RTL)** `usePracticeState(view)`가 deriveCounting 결과 반환(메모이즈: trickHistory 내용 해시 키).
- [ ] **S2–S4** impl 훅 → pass.
- [ ] **S5 (fail test)** `CountingHUD`가 로켓 잔여 텍스트 + 색별 9칸 렌더(live=강조, seen=흐림). `data-testid`로 검증.
- [ ] **S6–S7** impl HUD + ScaffoldControls(L0=전체표시, L3=숨김) + RevealDrawer(reveal() 호출, PRACTICE 워터마크, diffs 하이라이트) → pass.
- [ ] **S8** `PracticeShell` = `<GameTable .../>` + 좌/우 레일 + 하단 서랍, `gateFor(level)`로 표시 필터.
- [ ] **S9** Commit `feat(client): counting HUD + reveal drawer + practice shell`.

### Task 7: 진입점 배선 (App/Lobby/Selector)

**Files:** Create `PracticeSelector.tsx`. Modify `App.tsx`, `Lobby.tsx`.

- [ ] **S1 (fail test)** Lobby에 "훈련/Practice" 버튼; 클릭 시 `onPractice()` 호출.
- [ ] **S2–S4** impl: App에 `mode: 'online'|'practice'` 상태. practice 진입 시 `PracticeSelector`(자유연습: 지원 미션 목록 + 시드) → 선택 시 `createLocalDriver`를 `conn` 슬롯에 넣고 `PracticeShell` 렌더. 기존 핸들러 재사용.
- [ ] **S5 (integration)** Practice 버튼→미션 선택→GameTable+HUD 렌더, 리빌 토글 동작.
- [ ] **S6** Commit `feat(client): practice entry point + free-practice selector`.

### Task 8: Phase 1 검증 + 빌드
- [ ] 전체 테스트(`npx vitest run` 각 패키지) green.
- [ ] `tsc --noEmit`(각 패키지) 통과.
- [ ] 클라이언트 빌드(`vite build`) 성공.
- [ ] preview로 Practice 흐름 수동 검증(카드 냄→HUD 갱신→리빌 대조).
- [ ] Commit `chore: phase-1 build green`.

---

## Phase 2 — 설명형 코치
- **T9 coach.ts**: `Advice = { principle: PrincipleId; whyKey: string; params }`; `evaluateCoach(cs, view): Advice[]`. 원칙 7개(보이드 감지→복원 2체크). `lowTaskNowWinnable(cs, task)` 3중 조건(위카드 소진 ∧ (로켓0 ∨ 로켓보유자 그색보이드) ∧ 리드확보/저카드마스터화). `trumpThreat={holderCouldTrump,why}`. TDD 각 체크 + "코치는 공개정보만"(reveal on/off 동일) 테스트.
- **T10 CoachPanel.tsx**: 원칙 태그 + why. `commState(view)`(토큰 잔여)+`deducible`. i18n 키=principle.

## Phase 3 — 스캐폴딩 L1/L2 + 드릴
- **T11 scaffolding.ts**: `ScaffoldLevel`, `gateFor`, `Quiz{prompt,kind,answerFromCS,accept}`, `gradeSelfAnswer`, `advanceFade`(적응형). 퀴즈 생성=이벤트 트리거. streak 개념별 저장. TDD.
- **T12 ScaffoldControls/DrillControls**: L0–L3 monotonic(판 내 하향 금지), 숙련도 미터, step/stepBack(스냅샷 스택). 세션 요약.

## Phase 4 — 가이드 레슨
- **T13 lessons.data.ts**: 7개념 명시적-손패 레슨 + `buildFixedDeal(hands, tasks)` 13/13/14 분할 검증. 순서의존 레슨은 오프닝 트릭 프리-플레이. 저카드 레슨=다중트릭 체크리스트. 검증기 테스트(합법 분할·개념 재현).
- **T14 PracticeSelector 가이드 탭 + 자동채점**: 보이드/저카드 diff 채점, 레슨→다음 진행.

---

## Self-Review
- **스펙 커버리지**: §2 아키텍처=T1/T5, §4 카운팅=T2/T3, §5 코치=T9, §6 스캐폴딩=T11/T12, §7 안전성=T4, §9 레슨=T13, §10 UI=T6/T7/T10. ✅
- **타입 일관성**: `CountingState`(T2 정의)→T3 채움→reveal(T4)/coach(T9)/HUD(T6) 소비. `RevealView`(T4)→LocalDriver(T5)→RevealDrawer(T6). ✅
- **플레이스홀더**: Phase 1 태스크는 구체 테스트/시그니처 확정. Phase 2–4는 실행 시 각 태스크 진입에서 실제 코드로 상세화(엔진 재확인 후).
