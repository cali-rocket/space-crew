# Space Crew — 카운팅·전략 연습 모드 설계 문서 (Practice Mode Design Spec)

- **작성일**: 2026-07-07
- **상위 문서**: [`2026-06-29-space-crew-online-design.md`](2026-06-29-space-crew-online-design.md) (본 게임 설계)
- **원작**: *The Crew: The Quest for Planet Nine* (협력 트릭테이킹, 3인, 1인+봇 2)
- **검증 근거**: 3개 아키텍처 안 병렬 생성 → 채점/합성 → 레드팀 + 완결성 비평(적대적 검증). 확정 결함 4건(HIGH) 반영.

---

## 1. 목표와 범위

기존 스페이스크루 웹게임에 **카드 카운팅과 전략을 학습/연습하는 솔로 모드**를 추가한다. UI/UX가 카운팅·전략의 학습/연습을 능동적으로 돕는 것이 핵심.

### 잠긴 결정(변경 불가)
- **D1. 점진적 스캐폴딩**: 보조가 처음엔 다 보이다가 단계적으로 걷힘("보조 → 테스트 → 무보조").
- **D2. 솔로 샌드박스 + 완전 공개**: 봇 상대 솔로 전용. 필요 시 상대 손패·정답(보이드/마스터/로켓)을 열어 내 카운팅 추론을 즉시 검증. 연습 전용.
- **D3. 가이드 레슨 + 자유 연습**: 개념별 고정-딜 시나리오(한 번에 한 개념) + 랜덤 풀게임에 보조 레이어.
- **D4. 설명형 휴리스틱 코치**: 카운팅 상태에서 계산되는 규칙 기반 조언, 항상 `why` + `principle` 동반. 탐색/시뮬레이션 블랙박스 아님.

### 잠긴 결정(브레인스토밍 확정)
- **A1. 진행 루프 공용화**: 서버 `advance()` 봇 진행 루프를 **순수 엔진 함수로 추출**해 서버와 연습 드라이버가 동일 코드를 사용(드리프트 0).
- **A2. 강한 크러치 방지**: 자유연습은 적응형 페이드 기본 ON(옵트아웃 가능), 레슨은 시작 레벨 고정·하향 금지, 한 판 내 레벨 하향(엿보기) 금지, 개념별 숙련도 미터.
- **A3. Phase 1 = 카운팅 코어 우선**: 코치·레슨은 후속 단계.

### 비목표
- 실전(멀티플레이) 게임에 리빌/코치를 넣지 않는다(정보모델 보존 §7). 실전 병행 HUD는 이번 범위 밖.
- 탐색/솔버 기반 "최선수"(D4에 의해 제외).
- 강한 봇 AI. 연습은 기존 `BasicBot`을 상대로 한다.
- 연습 결과의 캠페인 영속화(연습은 랭크 진행을 오염시키지 않음 — 서버가 연습을 아예 보지 않음).

## 2. 아키텍처 — "훈련장(dojo)": 100% 브라우저 로컬

연습은 WebSocket/서버를 거치지 않고 **브라우저 안에서** 순수 엔진 + `BasicBot`으로 구동한다.

- `createLocalDriver(cfg, handlers)` (client)가 기존 `Conn` 인터페이스(`send(msg)`/`close()`, [`conn.ts`](../../packages/client/src/conn.ts))를 **구조적으로 구현**한다. 따라서 `App`의 핸들러(`handlePlayCard`/`handlePickTask`/`handleCommunicate`/…)와 `GameTable`이 **그대로 재사용**된다.
- 드라이버는 권위 `GameState`를 closure로 소유하고, 인간 액션을 순수 리듀서(`applyPlay`/`assignTask`/…)로 적용한 뒤 **공용 진행 함수**(§A1)로 봇 수를 진행하고 `handlers.onMessage({t:'view', view})`를 방출한다.
- 드라이버는 여기에 연습 제어를 추가: `reveal()`, `setLevel(level)`, `step()`, `stepBack()`. `step*`은 **스냅샷 스택**(각 진행 단계의 `GameState` 복제)으로 구현.
- **판단 로직(카운팅/코치/스캐폴딩/리빌/레슨)은 전부 순수 엔진 모듈**에 두어 나머지 엔진과 동일하게 TDD로 단위 테스트한다. 클라이언트(드라이버/UI)는 표시·오케스트레이션만 담당.

### A1. 진행 루프 추출 (레드팀 HIGH-E 반영)
서버 `controller.ts`의 `advance()`(봇을 인간 차례까지 진행 + 조기승리/진행 규칙)를 **순수 엔진 함수**로 추출한다:

```ts
// packages/engine/src/loop.ts (기존) 또는 신규 progress.ts
function runUntilHumanTurn(state: GameState, botFor: (view: PlayerView) => BotStrategy):
  { state: GameState; events: ProgressEvent[] }
```

서버 컨트롤러와 `LocalDriver`가 **이 한 함수를 공유**한다. 최근 커밋(`win the instant objective met`, `stop catastrophic bot play`)이 보여주듯 진행/승리 로직은 활발히 변한다 — 복제는 반드시 갈라진다. **패리티 테스트**: 동일 시드 + 동일 인간 수순을 서버 경로와 드라이버 경로로 돌렸을 때 **동일 `PlayerView` 스트림**을 산출해야 한다.

## 3. 모듈 맵

| 모듈 | 위치 | 순수? | 역할 |
|---|---|---|---|
| `counting.ts` | engine | ✅ | 공개정보 → 남은카드/로켓/보이드/마스터/제3의 손 복원/완전정보/태스크 도달성 |
| `coach.ts` | engine | ✅ | 원칙별 설명형 체크 레지스트리, `(CountingState, view) → Advice \| null` |
| `reveal.ts` | engine | ✅ | `toRevealView(state, viewer)` — `state.hands`를 만지는 **유일한** 지점 |
| `scaffolding.ts` | engine | ✅ | `ScaffoldLevel`/`gateFor`/`advanceFade`/`gradeSelfAnswer`/`Quiz` |
| `lessons.data.ts` | engine | (데이터) | 레슨 카탈로그(명시적 손패 + 개념 + 시작레벨 + 채점기) |
| `progress.ts` (or `loop.ts`) | engine | ✅ | 공용 `runUntilHumanTurn` (§A1) — 서버·드라이버 공유 |
| `LocalDriver.ts` | client | — | Conn형 로컬 드라이버 + 스냅샷 스택 + reveal/step |
| `PracticeShell`, `PracticeSelector`, `CountingHUD`, `CoachPanel`, `RevealDrawer`, `ScaffoldControls`, `DrillControls`, `usePracticeState` | client | — | 변경 없는 `GameTable` 주위 표시 전용 오버레이 |

- `packages/engine/src/index.ts`: 신규 모듈 export 추가(~6줄).
- **미변경**: `view.ts`(`toPlayerView`), `bot.ts`, `play.ts`, `trick.ts`, `conn.ts`, `Card.tsx`, `GameTable.tsx` 내부, `packages/shared/protocol.ts`, `packages/server`의 규칙(단, `advance` 본문을 §A1 공용 함수 호출로 치환하는 리팩터 1건은 포함).

## 4. 카운팅 substrate (`counting.ts`)

규칙을 재구현하지 않고 `trick.ts`의 `leadSuit`/`legalMoves`/`trickWinner`를 **import**한다. 모두 공개 `PlayerView`만 소비(신의 시점 금지).

```ts
deriveCounting(view: PlayerView): CountingState        // trickHistory 내용 해시로 메모이즈(§8 주의)
remainingByColor(view): Record<Color, number[]>        // 색별 1–9 − 나온 카드 − 내 손패
rocketState(view): { played: number[]; remaining: number; unseen: number[] }  // 4 − 본 로켓
detectVoids(view): Record<PlayerId, Set<Color>>        // play.suit !== leadSuit ⇒ 그 색 보이드(영구)
computeMasters(view, remaining): { card: Card; owner: 'me' | 'unknown' }[]
reconstructThirdHand(view, voids): Partial<Record<PlayerId, Card[]>>
taskReachability(view, cs): TaskReach[]
isPerfectInfo(view, cs): boolean
lowTaskNowWinnable(cs, task): { winnable: boolean; missing: string[] }
```

### 정확성 규정 (레드팀 MED/HIGH 반영)
- **마스터**: `card`가 마스터 ⇔ `(그 색 위 카드 전부 소진) ∧ (rocketsRemaining === 0 또는 두 상대 모두 그 색 보이드 불가)`. 후자는 복원/미소진 장수로 "상대가 그 색을 반드시 팔로우해야 함"이 증명될 때. **보수적 under-claim**(모호하면 마스터 아님). → **속성 테스트**: 주장된 마스터는 숨은 손패의 어떤 합법적 완성에서도 안 짐.
- **제3의 손 복원**: 각 플레이어의 **정확한 잔여 손패 장수**(초기 딜 − 낸 카드)에 앵커링. `색-미확인 장수 ≤ 강제 슬롯`이 정확히 한 손에서 성립할 때만 카드 방출. → **reveal `diffs`로 적대적 딜에서 검증**(해피패스 금지).
- **저카드 태스크 승리** `lowTaskNowWinnable` — **3중 조건**:
  1. `higherOutstanding.length === 0` (그 색 위 카드 전부 소진)
  2. `rocketsRemaining === 0` **또는** 모든 로켓 보유 가능자가 그 색 보이드(리빌/복원으로 확정)
  3. 그 색 **리드를 확보/유지 가능**(마스터 보유로 리드 탈취) **또는** 저카드 자체가 그 리드에서 마스터화
  → 하나라도 빠지면 코치는 **지는 수를 권함**. `trumpThreat`는 boolean이 아니라 `{ holderCouldTrump: boolean; why }`(보이드 데이터 사용).

### 리빌 출처(연습 전용, `reveal.ts`)
```ts
toRevealView(state: GameState, viewer: PlayerId): RevealView
// RevealView = { __practiceOnly: true; opponentHands; truth: CountingState; myDerived: CountingState; diffs: RevealDiff[] }
```
`truth`=신의 시점 `deriveCounting`, `myDerived`=공개 `toPlayerView` 기반, `diffs`=공개론 "unknown"이나 실제론 강제된 지점. "내 카운팅 검증" + 레슨 자동 채점 + 교육 하이라이트에 사용.

## 5. 코치 카탈로그 (`coach.ts`) — 원칙 7개 (보이드는 감지→복원 2체크 = 8체크)

각 체크는 `(CountingState, view) → Advice | null`, `Advice = { principle: PrincipleId; whyKey: I18nKey; params }`. **코치는 공개 `deriveCounting`만 읽는다**(리빌 on/off에도 출력 동일 — 테스트로 고정). i18n: 메시지는 `principle`별 키로.

| 원칙 | 트리거 | 메시지(요지) |
|---|---|---|
| 로켓 카운팅 | 로켓 잔여>0 & 비보이드 상대가 트럼프 보유 가능 & 색 승리 노림 | "로켓 N장 밖 — 네 파랑9 트럼프당함. 뽑아내거나 잔여 0 대기" |
| 마스터 인식 | 보유 카드 신규 마스터 진입 | "초록 위 다 빠짐 — 초록7 마스터. 리드로 주도권" |
| 보이드 감지 | `detectVoids` 신규 (player,color) | "bot-1 분홍 보이드 — 미확인 분홍은 나머지 두 손, 소거 단서" |
| 보이드 복원 | `reconstructThirdHand` 완전 해소 | "bot-2 손패 전부 읽힘 — 앞면 깐 셈 플레이" |
| 저카드 태스크 | `lowTaskNowWinnable.winnable=false` & 소유 미달성 저카드 | "yellow-2는 위 옐로 전부 소진 ∧ 트럼프 봉쇄 ∧ 리드 확보 시만 승리. 지금 없는 조건: {missing}" |
| 통신 타이밍 | 카운팅이 이미 주는 정보 통신 시도, 또는 싱글턴+토큰 존재 | "이미 계산됨 — 토큰(3개)은 싱글턴/진짜 최저에 아껴" |
| 리드 관리 | 리드 보유 + 다음 트릭 태스크 세팅 마스터 | "지금 이겨 리드 유지 후 태스크 색 런" |
| 엔드게임 완전정보 | `perfectInfo` 참 전환 & 잔여 트릭 존재 | "남은 카드 다 위치 확정 — 정확한 승리 라인" |

> 완결성 비평 반영: "보이드 감지"와 "보이드 복원"은 **한 원칙의 두 표현**(감지→복원 파이프라인)으로 문서화하고, 원칙 목록 × {코치 체크, 레슨} **커버리지 매트릭스**를 스펙 부록으로 유지. 통신 원칙엔 `commState(view)`(토큰 잔여) + `deducible(card, cs)` 술어가 선행 필요.

## 6. 스캐폴딩 + 드릴 (`scaffolding.ts`)

`gateFor(level): ScaffoldGate`는 **항상 완전 계산된** `CountingState` 위의 순수 표시 필터 — 페이드는 정답을 감출 뿐 정확성을 안 바꾼다.

- **L0 풀보조**: 전 파생값 표시(마스터/보이드/복원), 코치 선제, reveal 1클릭.
- **L1 보조**: 원시 집계(로켓/색별 seen)만, 결론(마스터/복원) 숨김, 코치는 "왜?" 버튼(on-demand).
- **L2 테스트**: HUD가 답 숨기고 **질문** → `gradeSelfAnswer`로 채점, 코치는 답 후 피드백.
- **L3 무보조**: 전부 off, reveal은 트릭/미션 종료 후만(먼저 커밋).

### 크러치 방지 (A2 — 레드팀 HIGH-B 반영)
- **자유연습**: 적응형 페이드 **기본 ON**(명시적 옵트아웃 가능). `advanceFade`가 동일 개념 L2 N연속 정답 시 한 단계 상승 제안(비차단 토스트, 사용자 확인). L0에서 "이 개념 N회 정답 — 걷어낼까?" 넛지.
- **레슨**: `startLevel` **고정**, 그 아래로 못 내림.
- **한 판(attempt) 내 레벨 monotonic**: 하향(엿보기)은 "막힘 — 보여줘"(숙련도 패널티 기록)로만. L0로 떨어져 L3 커밋을 우회하는 구멍 차단.
- **개념별 숙련도 미터**로 크러치 가시화.

### L2 퀴즈 스키마 (완결성 비평 반영)
```ts
interface Quiz {
  prompt: I18nKey;
  kind: 'count' | 'boolean' | 'multiselect' | 'card';
  answerFromCS(cs: CountingState): Answer;       // 정답 파생
  accept(input: Answer, truth: Answer): GradeResult;  // 정규화/부분점수 포함
}
```
- **생성 시점**: 이벤트 트리거(새 보이드 출현, 새 마스터, 완전정보 전환) — 매 트릭 스팸 금지.
- **정규화**: 보이드=집합 상등, 로켓 잔여=집합, 마스터=카드 집합. 부분점수 규칙 명시.
- **streak 저장**: 개념별. 오답 시 리셋(감쇠 아님, MVP). `advanceFade`가 소비.

## 7. 정보모델 안전성 — "플래그가 아니라 구조상 불가능"

1. `toPlayerView` **불변**(reveal 파라미터 자체가 없음) → 어떤 서버 경로도 상대 손패 직렬화 불가.
2. 상대 손패는 `reveal.ts`에서만, client `LocalDriver`만 import(실전은 `connect()`/ws).
3. reveal을 나를 **프로토콜 메시지 없음** → 실전 서버는 보낼 수도, 실전 클라는 읽을 필드도 없음.
4. 봇도 `toPlayerView(game, bot)`로만 결정 → reveal이 봇 플레이에 안 닿음.

### 강화 (레드팀 반영)
- `RevealView`에 `__practiceOnly: true` **브랜드 타입** → 실전 `GameTable` props가 타입 레벨에서 reveal 파생 객체를 거부(미래 리팩터의 우발적 전달 차단).
- **CI 가드 테스트(Phase 1, failing-first)**: (a) `packages/server/**`가 `reveal`를 import 0, (b) `shared/protocol.ts`에 `opponentHands`류 필드 0, (c) 임의 경로에서 `toPlayerView(...).seats[non-viewer]`에 손패 0, `myHand`는 viewer 것만.

## 8. 테스트 전략

- **엔진 순수 모듈 TDD**: `counting`(remaining/rockets/voids/masters/복원/저카드), `coach`, `scaffolding`, `reveal`.
- **속성 테스트**: `computeMasters`(주장 마스터는 어떤 합법 완성에서도 안 짐), `reconstructThirdHand`(적대적 딜에서 `toRevealView.diffs`와 일치, 잘못된 강제 카드 0).
- **패리티 테스트(§A1)**: 서버 경로 vs `LocalDriver` 경로 — 동일 시드·수순 → 동일 뷰 스트림.
- **안전성 테스트(§7)**: CI grep + 뷰 유출 0.
- **코치 불변식**: reveal on/off에도 코치 출력 동일.
- **레슨 검증기**: 모든 고정 딜이 합법 13/13/14 분할(중복 0, 로켓 4장, 색별 범위), 각 레슨의 `startLevel`/채점기/시퀀스가 실제로 그 개념을 재현.
- **메모이즈 주의**: `deriveCounting`은 trickHistory 길이가 아니라 **내용 해시**로 키(step-back/리플레이에서 같은 위치에 다른 카드 → stale 방지).
- **접근성**: 마스터/보이드 하이라이트는 색 외 아이콘/라벨로 이중 인코딩(색맹 대응 — 상위 설계 §6.5 계승).

## 9. 레슨 카탈로그 + 결정성 (`lessons.data.ts`)

7개 개념 각 최소 1레슨: 마스터 인식 / 로켓 카운팅 / 보이드 추론(복원 자동 채점) / **저카드 따기** / 통신 타이밍 / 리드 체이닝 / 엔드게임 완전정보.

### 결정성 (레드팀 HIGH-D 반영)
- 특정 손패는 **시드로 못 만든다**(시드→딜 하나, 역산 불가). → 레슨은 **명시적 손패 주입**: 3개 손패 리터럴 + 태스크 배정 → **13/13/14 합법 분할 검증** 후 `GameState` 직접 구성(셔플 우회, 이후 리듀서는 전부 재사용).
- 카드 **순서 의존** 레슨("위 카드가 1~2트릭에 빠진다")은 **오프닝 트릭을 미리 `trickHistory`에 재생**하거나 중반 포지션으로 로드(봇 협조에 의존 금지).
- **시드는 자유연습 전용**(랜덤/고정 시드 토글).

### 저카드 레슨(최난이도) — 다중 트릭 계획
단발 채점 금지. **체크리스트 모델**: (1) 위 카드 소진 → (2) `rocketsRemaining===0` 또는 트럼프 보유자 그 색 보이드 확인 → (3) 저카드로 트릭 승리. 매 트릭 `lowTaskNowWinnable`로 진척 채점, "아직 저카드 리드 위험" 경고를 일반 태스크 체크와 별도로.

## 10. UI/UX

- **진입**: `Lobby`에 세 번째 기본 버튼 **"훈련 / Practice"** → `PracticeSelector`(2열: 가이드 레슨 7개 카드 / 자유연습 = 지원 미션 목록 + 시드 토글). 선택 시 `LocalDriver` 생성 후 `PracticeShell` 진입.
- **레이아웃**: 가운데 **`GameTable` 그대로**. 우측 레일 `CountingHUD`(로켓 핍 4→잔여, 색별 1–9 seen/live 스트립, 보이드 배지, 마스터 글로우) + `CoachPanel`(원칙 태그 조언 스트림). 좌측 레일 `ScaffoldControls`(L0–L3, monotonic) + `DrillControls`(⏸/▶스텝/◀되감기). 하단 `RevealDrawer`(상대 실제 손패 via `CardChip`, 상시 PRACTICE 워터마크·앰버 테두리; reveal 시 `diffs` 하이라이트 — "bot-2의 분홍4를 추론할 수 있었다").
- 모든 레일은 하나의 메모이즈된 `usePracticeState(view, reveal)` 소비.
- **자유연습 피드백 루프**: 미션 종료 시 **세션 요약**(놓친 마스터, 무시한 코치 경고, 카운트 오류) — 무보조 학습의 주 피드백.
- **내비게이션**: 뒤로(Selector/Lobby), 같은 시드 재시도 / 새 시드, 레슨→다음 레슨, 현재 레슨 지속.
- **미션 필터**: Phase 1은 단순 open-pick/커맨더 미션만 노출(레슨 카탈로그도 미지원 페이즈 미참조).

## 11. 단계별 범위

- **Phase 1 (빌드 가능한 코어)**: §A1 진행 루프 추출 + `counting.ts`(remaining/rockets/voids/masters + `deriveCounting`, TDD) + `LocalDriver`(자유연습·랜덤시드·스냅샷 스택) + App 트랜스포트 스왑 + `PracticeShell`(`GameTable` 감싸기) + `CountingHUD` + 페이드 1개(L0⇄L3) + `reveal.ts`/`RevealDrawer` + 안전성/패리티 테스트. → **카운팅 substrate + HUD + 페이드 1 + 정답 리빌** 제공.
- **Phase 2**: `coach.ts`(7원칙 / 8체크) + `CoachPanel` + `reconstructThirdHand`/`isPerfectInfo`/`taskReachability`/`lowTaskNowWinnable`.
- **Phase 3**: `scaffolding.ts` L1/L2 퀴즈 + `gradeSelfAnswer` + `DrillControls` step/step-back + 세션 요약.
- **Phase 4**: `lessons.data.ts`(명시적 손패 빌더 검증) + `PracticeSelector` 가이드 탭 + 적응형 `advanceFade` + 저카드/보이드 자동 채점.

**YAGNI**: Phase 1에 서버/프로토콜/봇 규칙 변경 없음(진행 루프 추출은 동작 동일 리팩터). 자유연습·레슨은 초기엔 단순 미션에 한정, M12/조난/순서토큰 미션은 뒤로.

## 12. 미해결/추후

- 적응형 페이드의 승급 임계 N(기본 2) 튜닝.
- 세션 요약의 지표 범위(카운트 오류 트래킹 비용).
- 레슨 개수 확장(개념당 다중 난이도) — Phase 4 이후.
- 지원 미션 서브셋의 정확한 목록(엔진 미션 데이터에서 파생).
