# Space Crew Online — 설계 문서 (Design Spec) v2

- **작성일**: 2026-06-29 · **개정**: 2026-06-29 (다차원 리뷰 반영)
- **원작**: *The Crew: The Quest for Planet Nine* (Thomas Sing, Kosmos 2019) — 한국 정식명 "스페이스 크루"
- **기준 규칙 문서**: `docs/reference/rulebook-en.pdf`, `docs/reference/logbook-en.pdf` (영어판)

## 0. 개정 이력 (리뷰 반영)
v1 작성 후 6개 차원(규칙충실도/미션커버리지/아키텍처/UIUX/스펙품질/사각지대) 병렬 리뷰 + 적대적 검증을 수행해 확정 결함을 반영함. 주요 변경:
- **통신 타이밍**: "게임 전 1회 윈도우"가 아니라 **매 트릭 리드 직전 1회 인터럽트**로 정정 (§2, §4.1, §4.3).
- **손패 비공개 강화**: 권위 `GameState`와 클라이언트 `PlayerView`를 **타입 레벨로 분리**, `rngSeed`는 서버 전용 (§3.3, §4.1).
- **미션 데이터 정정**: M5(아픈 승무원, M4 아님), M20=커맨더 결정(분배 아님), M27/M37=결정+선택적 양도, M8은 통신 제약 없음, 화살표 토큰 4종, Ω vs 마지막-트릭 구분 (§4.4).
- **미션 루프/영속화**: 시도 재시작·다음 미션 전이, 캠페인 진행 저장 추가 (§4.1, §5, §10).
- **UI/UX IA 보강**: 로비·브리핑·결과 화면, 태스크 배정·커맨더 분배·dead-zone·M50 등 인터랙션 (§6).
- **i18n·색맹 대응** 추가 (§6).

---

## 1. 목표와 범위

보드게임 *The Crew*를 지인들과 온라인으로 즐기기 위한 웹 게임을 만든다.

### 확정된 요구사항
- **항상 3인 게임**으로만 진행한다. (2인/4인/5인 변형은 구현하지 않는다.)
- 호스트가 방을 만들면 빈 2자리는 **봇**으로 자동 채워진다.
- 방이 열려 있으면 **다른 사람이 들어와 봇 자리를 대체**할 수 있다. (로비=게임 시작 전 자유 교체. 게임 진행 중 이탈/복귀 정책은 §5.3.)
- 외부 공개 모집은 없다. 지인 한정(최대 3명).
- **50개 미션 전부**(모든 특수 규칙 포함)를 최종 목표로 한다.
- **봇 AI**: 처음엔 기본 동작(규칙 준수 + 단순 휴리스틱). 교체 가능하게 설계해 나중에 고도화.
- **호스팅**: 최종은 인터넷 호스팅이나 후순위. 우선 로컬에서 개발/테스트하고 배포는 나중에 얹는다.
- **기술 스택**: TypeScript 풀스택.

### 비목표 (Non-goals)
- 2/4/5인 플레이, JARVIS(2인 봇) 변형. (5인 전용 골든프레임 규칙도 구현 안 함 — 미션 데이터에 표시 플래그만 두고 3인에선 무시.)
- 공개 매치메이킹, 랭킹, 계정 시스템.
- 강한 봇 AI(탐색/시뮬레이션 기반) — 인터페이스만 열어두고 추후.
- 모바일 네이티브 앱(웹 반응형으로 충분).
- 전면 WCAG 접근성(키보드 내비/스크린리더 풀 대응)은 후순위. 단 **색-독립 식별(§6.5)** 은 기능으로 포함.

## 2. 게임 규칙 요약 (구현 기준)

구현이 의존하는 규칙의 정수만 정리한다. 상세는 PDF 참조.

- **카드 40장**: 4색(분홍/파랑/초록/노랑) × 1–9 = 36장 + 로켓(트럼프) 1–4 = 4장.
- **3인 딜**: 시드로 셔플한 40장을 좌석 순서대로 분배 → 13 / 13 / 14장. 트릭은 13회. **추가 1장을 받는 좌석은 결정적 규칙으로 고정**(딜 첫 좌석 = 커맨더 좌석). 14장 좌석은 13트릭 후 손에 1장이 **미사용으로 잔류**한다.
- **커맨더**: 로켓 4를 가진 플레이어. 태스크 선택과 첫 트릭을 시작한다. 이후 각 트릭은 직전 트릭 승자가 시작. 매 시도(attempt) 재딜마다 커맨더는 다시 결정된다.
- **트릭테이킹**: 리드 색을 팔로우해야 함(로켓도 하나의 슈트 — 해당 색 보유 시 로켓 사용 불가, 공백일 때만 가능; 첫 카드가 로켓이면 로켓이 리드 슈트). 같은 색 중 최고값이 승리. 로켓은 트럼프(항상 승리, 여러 장이면 최고값).
- **태스크**: 태스크 카드 = 특정 색·값 카드. 그 카드가 포함된 트릭을 **태스크 소유자**가 따면 달성. 소유자가 아닌 사람이 그 카드를 따면 **즉시 미션 실패**.
- **승리/패배**: 모든 태스크 + 모든 특수 제약이 충족되면 미션 성공. 트릭 승자 확정 시점에 제약 위반이 하나라도 있으면 즉시 패배(달성/성공보다 우선, §4.3).
- **통신**: **시도(attempt)당 1인 1회.** 태스크 분배 후, 그리고 **매 트릭이 시작되기 직전(현재 트릭에 카드가 0장 나간 상태)** 언제든 미사용 토큰을 1회 사용 가능 — **트릭 진행 중에는 불가**. 색 카드 1장을 공개 + 토큰으로 의미 전달(맨위=그 색 최고값 / 가운데=그 색 유일 / 맨아래=그 색 최저값). 로켓은 통신 불가. 공개한 카드는 손패에 남아 정상적으로 플레이 가능하며, 플레이되면 통신 표시는 소거된다. 미션 실패 후 재시도 시 통신 사용 여부는 초기화된다.
- **조난신호(distress)**: 미션 단위 옵션. 켜면 매 시도 시작 시 모두가 **같은 방향** 이웃에게 카드 1장 전달(로켓 제외, 전원 동시·비밀 제출 후 일괄 공개 — §4.2). 미션이 끝날 때까지 유지되며, 켜면 시도 수 +1로 채점.

## 3. 아키텍처

### 3.1 접근: 권위 서버 + 순수 함수형 게임 엔진
- 게임 규칙을 `reduce(state, action) → newState` 형태의 **순수 TS 리듀서**로 구현한다. 네트워크/UI/난수에 의존하지 않는다(난수 시드는 액션으로 주입).
- 서버가 유일한 권위 상태(authoritative `GameState`)를 보유하고, 들어온 액션을 엔진으로 검증·적용한 뒤 각 클라이언트에 **그 플레이어용 `PlayerView`만** 브로드캐스트한다(손패 비공개 보장).
- 봇도 서버 프로세스에서 동일 엔진을 사용하되, **봇에게도 인간과 동일한 `PlayerView`만 전달**한다(봇은 권위 `GameState`에 직접 접근하지 않는다 — §4.5).

### 3.2 코드 구조 (모노레포, npm/pnpm workspaces)
```
space-crew/
  packages/
    engine/   # 순수 TS 게임 엔진: 타입, 규칙 리듀서, 50개 미션 정의, 봇 전략, 뷰 직렬화 함수. 의존성 0(네트워크/UI 없음)
    shared/   # 클라/서버 공유: WebSocket 메시지 프로토콜(ClientToServer/ServerToClient), PlayerView DTO
    server/   # Node + ws. 방/세션 관리, 권위 상태, 단일 액션 큐, 봇 러너, 캠페인 영속화
    client/   # React + Vite. UI, WebSocket 클라이언트, 로컬 뷰 상태
  docs/
    reference/   # 규칙 PDF
    superpowers/specs/   # 설계 문서
  worklog.md
```

### 3.3 상태 가시성(뷰 직렬화) — 비공개 보장
- 권위 `GameState`(엔진 전용)와 클라이언트 `PlayerView`(직렬화 결과)를 **별도 타입**으로 둔다. `PlayerView`는 **화이트리스트 방식**으로만 필드를 가진다.
- `PlayerView`에는 **절대 포함하지 않는다**: `rngSeed`, 타인의 손패(장수만 노출), 미사용 카드, 미공개 태스크 더미, dead-zone에서 통신의 "어느 조건인지" 분류.
- `rngSeed`는 서버 권위 상태에만 존재한다(결정성 재현이 필요하면 server-only 리플레이 로그에만 보관). 뷰 직렬화에서 명시적으로 제외.
- 동일한 뷰 직렬화 경로를 인간·봇 모두에 사용한다. 7장에서 "뷰에 손패/시드 유출 0" 테스트로 검증.

## 4. 게임 엔진 상세

### 4.1 핵심 타입 (개념 스케치 — union 멤버 순서는 예시일 뿐)
```ts
type Suit = 'pink' | 'blue' | 'green' | 'yellow' | 'rocket';
type Card = { suit: Suit; value: number };       // rocket: 1–4, color: 1–9
type PlayerId = string;

// 미션 라이프사이클(정규 시퀀스). 통신은 별도 phase가 아니라 트릭 리드 직전의 인터럽트 액션.
type Phase =
  | 'lobby' | 'dealing' | 'task-assignment' | 'distress-decision'
  | 'distress-card-pass' | 'trick-in-progress' | 'mission-result';
// 주: taskCount=0 미션은 task-assignment를 건너뛴다. 조난 미사용 시 distress-card-pass 생략.

interface GameState {            // 권위 상태(서버 전용)
  players: PlayerId[];           // 자리 순서(시계방향), 길이 3
  commander: PlayerId;           // 로켓4 보유자
  hands: Record<PlayerId, Card[]>;
  missionId: number;             // 1..50
  attemptNumber: number;         // 현재 미션의 시도 회차(1..)
  phase: Phase;
  currentTrick: { leader: PlayerId; plays: { player: PlayerId; card: Card }[] };
  trickHistory: CompletedTrick[];
  tasks: TaskAssignment[];          // 태스크 카드 + 순서토큰 + 소유자
  objectives: ObjectiveState[];     // 특수 제약 상태(§4.4)
  communication: CommState[];       // 공개된 통신 정보(정상/ dead-zone)
  commUsed: Record<PlayerId, boolean>; // 이번 attempt 통신 토큰 사용 여부
  distressActive: boolean;          // 미션 단위(시도들에 걸쳐 유지)
  distressDirection?: 'left' | 'right';
  appointedNoCommPlayer?: PlayerId; // M11 등 커맨더 지목
  runtimeOrderTokens?: OrderToken[];// M23/M40로 런타임 변형되는 토큰(미션 데이터 복제본)
  declarations?: Record<string, unknown>; // M46 pink9 보유자, M50 역할배정 등 미션별 선언
  missionState?: Record<string, unknown>; // 미션별 확장 슬롯(상기로 부족할 때)
  outcome: 'in-progress' | 'won' | 'lost';
}

// 클라이언트로 직렬화되는 뷰(화이트리스트) — rngSeed/타인 손패 등 비포함
interface PlayerView {
  me: PlayerId;
  myHand: Card[];
  seats: { player: PlayerId; isBot: boolean; connected: boolean;
           handCount: number; tricksWon: number; isCommander: boolean;
           tasks: PublicTask[]; communication?: PublicComm }[];
  missionId: number; attemptNumber: number; phase: Phase;
  currentTrick: { leader: PlayerId; plays: { player: PlayerId; card: Card }[]; leadSuit?: Suit };
  objectivesPublic: ObjectivePublic[]; // 배너용(통신 정책·제약을 표시 문자열이 아니라 구조화 데이터로)
  distressActive: boolean; distressDirection?: 'left' | 'right';
  legalMoves?: Card[];   // 내 차례일 때 서버가 계산해 동봉(클라 표시는 보조, 최종 판정은 서버)
}
```

### 4.2 액션과 리듀서
- 액션 예: `JoinSeat`, `LeaveSeat`, `StartMission`, `ToggleDistress`, `SetDistressDirection`, `SubmitDistressCard`(비밀 제출), `PickTask`, `AssignTask`(커맨더 분배), `AppointNoCommMember`, `AdjustOrderTokens`(M23/M40), `Declare`(M46/M50), `Communicate`, `PlayCard`, `AnswerCommander`, `RestartAttempt`, `AdvanceMission`.
- 리듀서는 (1) 액션이 현재 phase·규칙상 합법인지 검증하고 (2) 상태를 전이한다. 불법이면 거부 사유(reason) 반환.
- **난수는 액션에 시드로 주입**(서버가 생성)되어 리듀서는 결정적. 게임 중 무작위(M12 카드 뽑기 등)도 동일 시드에서 파생되는 결정적 스트림(소비 인덱스 포함)으로 처리.
- **결정적 딜 절차**: 시드→셔플(40장)→좌석 순서 분배, 14번째 카드는 고정 좌석(커맨더 좌석)에 귀속, 미사용 카드는 그 손패에 잔류.
- **미션 루프 전이**: `mission-result`에서 `outcome='lost'` → `RestartAttempt`(같은 `missionId` 재딜, `attemptNumber+1`, 조난 active면 카드 재전달; 리셋: hands/tasks/communication/commUsed/currentTrick/trickHistory/outcome, 유지: missionId/distressActive/attemptNumber 누적). `outcome='won'` → `AdvanceMission`(다음 미션 셋업, 캠페인 진행 기록).
- **동시 동작(조난 카드 전달)**: 3인이 동시에 1장씩 넘기는 동작은 **전원 비밀 제출(commit) 후 일괄 공개**하는 2단계로 모델링(봇이 인간이 넘긴 카드를 먼저 보고 선택 바꾸는 누출 방지).

### 4.3 미션 모델링 — 데이터 + 조합 가능한 규칙 훅
50개 미션을 상속이 아니라 **데이터 정의**로 표현한다. 각 미션:
```ts
interface MissionDef {
  id: number;                         // 1..50
  narrative: string;                  // 브리핑 본문(한국어; 영어 sourceText 별도 보관)
  sourceText: string;                 // 로그북 원문(영어) — 데이터↔원문 1:1 대조용
  logbookPage: number;                // 출처 페이지(이미지 대조용)
  taskCount: number;                  // 태스크 카드 수 (0 가능)
  orderTokens: OrderToken[];          // 절대(1..5) / Ω(대기 태스크 중 마지막) / 화살표(상대순서, 셰브론 1..4)
  assignment: {                       // 배정 방식(단일 enum 아님)
    baseMode: 'open-pick' | 'commander-decision' | 'commander-distribution' | 'negotiated-roles';
    optionalHandover?: boolean;       // 첫 트릭 전 1회 태스크 양도 허용(M27/M37, 5인 골든프레임)
  };
  communication: CommunicationPolicy; // 'normal' | {noCommUntilTrick:n} | 'dead-zone' | {oneMemberNoComm:'commander-appoints'} (조합 가능)
  constraints: ConstraintDef[];       // §4.4 카탈로그에서 조합
  setupModifiers: SetupModifier[];    // {kind, trigger:'onMissionStart' | {afterTrick:n}} — M12/M23/M40 등
  fivePlayerGoldenFrame?: boolean;    // 표시용(3인에선 무시)
}
```
- **배정 방식의 행동 규칙**: `commander-decision` = 한 명이 모든 태스크 수령, **커맨더는 자기 자신을 지명할 수 없음**, 질문 유형은 미션별(`yes-no` 또는 M5의 `good-bad`). `commander-distribution` = 커맨더가 한 장씩 배정, **자기 자신 포함 가능 + 균등 불변식(분배 종료 시 누구도 타인보다 태스크 2개 초과 보유 금지)**, 순서토큰은 태스크와 함께 순서대로 분배. `negotiated-roles` = M50 전용(아래).

**규칙 훅(인터페이스)** — 각 제약/정책은 다음 훅을 선택적으로 구현하는 작은 모듈. 합법성 판정의 권위 출처:
```ts
interface RuleModule {
  onSetup?(state): state;
  validatePlay?(state, play): ok | reason;        // 카드 단위 합법성(수 시점 거부)
  validateCommunication?(state, comm): ok | reason;// 통신 합법성(시점·1회·정책·진실성)
  onTrickComplete?(state): state;                  // 달성/위반 갱신
  evaluate?(state): 'pending' | 'satisfied' | 'violated';  // 미션 성공/실패 판정
}
```
- **평가 시점/우선순위**: `evaluate`는 **트릭 승자 확정 직후(손패/다음 리더 갱신 전, 단일 시점)** 호출한다. 한 트릭에서 `violated`가 하나라도 있으면 `satisfied`보다 **우선**해 즉시 패배로 종결. 모든 태스크/제약이 `satisfied`이면 미션 성공, 둘 다 아니면 `pending`. 카드 단위 위반(합법 수 제한)은 `evaluate`가 아니라 `validatePlay`에서 수 시점에 거부.
- **통신 정합성**: `validateCommunication`은 (a) 현재 트릭에 카드 0장(트릭 리드 직전), (b) 해당 플레이어 `commUsed=false`, (c) 정책 게이트(`noCommUntilTrick` → `trickHistory.length >= n`, `dead-zone`, `oneMemberNoComm`), (d) **진실성**(공개 카드가 선언 위치=최고/유일/최저에 실제 부합 — 서버가 손패에서 파생·검증, 클라 입력 신뢰 금지)을 모두 확인. dead-zone에서는 "셋 중 하나" 조건은 검증하되 **어느 것인지는 뷰에서 제거**(직관 보존).
- **클라/서버 합법성 분담**: 클라이언트는 자기 뷰(손패+리드색)로 **팔로우 슈트 합법수만** `legalMovesFromView(view)`로 미리 하이라이트한다. **최종 합법성·미션 제약은 항상 서버 `validatePlay(state, play)`가 권위적으로 판정**(미션 제약은 카드 단위가 아니라 사후 평가 조건이므로 클라는 숨은 정보 없이도 팔로우 규칙만으로 충분).

### 4.4 50개 미션에서 도출한 제약 타입 카탈로그
> 구현 노트: 아래 카탈로그를 RuleModule로 1:1 구현하면 50개 미션은 데이터 조합으로 정의된다. **각 미션 데이터는 `sourceText`(로그북 원문)·`logbookPage`를 동반**하고, 1차 인코딩 후 **독립 재인코딩(더블엔트리) 또는 별도 리뷰 패스**로 검증한다. 토큰/색이 그래픽으로만 표현된 미션(M48의 파란3, M13/16/26/44 순서·로켓 등)은 **PDF 페이지 이미지를 직접 대조**한다. 미션별 시나리오 테스트로 1:1 확정.

1. **태스크 달성** (기본): 소유자가 해당 카드를 딴다 / 비소유자가 따면 패배.
2. **순서 토큰**: 절대순서(1–5), Ω(**대기(pending) 태스크 중 마지막 달성** — 트릭 번호와 무관), 화살표 상대순서(셰브론 1~4: `>`, `>>`, `>>>`, `>>>>`). 순서 판정은 트릭 번호가 아니라 **미달성 태스크 간 상대순서**로 한다. 동시 달성 허용은 **연속 숫자 토큰 쌍**에 한정. 화살표·Ω 혼재 시 해당 트릭 종료 시점에 각 제약(X before Y, Ω=다른 모든 pending 달성 후)을 위반하지 않으면 낸 순서 무관하게 정상 달성.
3. **카드-승리 목표(소유자 없음)**: "1값 카드가 트릭을 따야"(M9), "각 로켓으로 트릭 1회"(M13, 순서무관), "1값 2장 각각 트릭"(M26). (주의: M44는 **로켓 4장을 1→2→3→4 순서로 각각 승리** — 로켓은 태스크 카드가 아니므로 항목2의 표준 토큰이 아니라 이 목표에 내재된 순서다.)
4. **값-금지 목표**: 어떤 값(예:9) 카드로 **트릭을 따면(=그 카드가 트릭의 승리 카드면) 위반**. 단순 포함은 위반 아님 — 더 높은 카드/로켓으로 따는 트릭에 9가 들어 있는 건 합법(**M16, M17**). 판정: `onTrickComplete`에서 승리 카드 값 검사.
5. **플레이어 트릭-수/정체 제약**: "X는 트릭 0"(**M5**, 아픈 승무원), "X는 정확히 1트릭, 로켓 제외"(M33), "커맨더가 첫·마지막 트릭"(M34), "X는 첫·마지막만, 로켓 제외"(M41), 트릭 분할(M50: 한 명 첫4트릭 / 한 명 마지막 / 나머지 중간 전부).
6. **균형 제약**: "어느 순간에도 누가 남보다 2트릭 이상 더 따지 않음"(M29, M34). `trickHistory` 누적 트릭수로 매 트릭 승자 확정 직후 비교.
7. **특정 트릭 지정 달성**: 지정 태스크/오더를 **특정 번호 트릭에 달성** — M48(Ω 오더를 **마지막=13번째 트릭**에 달성). (Ω 토큰의 "대기 중 마지막"과 구분.)
8. **선언 기반**: "분홍9 보유자 왼쪽 사람이 분홍 전부 획득"(M46) — 분홍9 보유자는 엔진이 딜에서 도출해 공개(읽기 전용 reveal).
9. **통신 정책**: disruption(N트릭부터 통신 재개: **M18/19/28/30/38**), dead-zone(직관, 토큰 위치 없이 빨강면: M6/14/21/25/39…), 특정 인원 통신금지(M11 — 커맨더가 1인 지목 `appointedNoCommPlayer`). 조합 가능(예: 일부 미션 = dead-zone + disruption(N)). **M8은 통신 제약 없는 일반 미션이다(카탈로그에서 제외).**
10. **셋업 변형**(`setupModifiers`): 조난신호(상시 옵션), 트릭1 후 오른쪽 이웃에게서 무작위 카드 뽑기(M12, `trigger:{afterTrick:1}`), 태스크 선택 전 토큰 위치 교환(M23)·빈 슬롯에 토큰 추가(M40, `trigger:'onMissionStart'`).
11. **배정 방식**: 커맨더 결정(한 명이 전부, 자기지명 불가, yes/no 또는 M5의 good/bad: **M5/20/33/41**), 커맨더 분배(자기 포함·균등: M24/32/36/43), 협상 역할(M50). **M27/M37은 커맨더 결정 + `optionalHandover`**(양도는 원래 5인 추가규칙, 3인에선 선택). `assignment.baseMode`/`optionalHandover`로 표현.

### 4.5 봇 전략 (교체 가능)
```ts
interface BotStrategy {
  chooseTask(view: PlayerView, options): TaskChoice;
  playCard(view: PlayerView, legalMoves: Card[]): Card;
  decideCommunication(view: PlayerView): CommAction | null;
  answerCommanderQuestion(view: PlayerView, kind): Answer;
}
```
- 봇의 입력 `view`는 **인간과 동일한 `PlayerView`** (봇도 자기 손패만 본다 — 권위 상태 미접근). 봇이 결정하는 통신은 자기 손패만으로 합법 계산 가능하므로 누출 없음.
- **BasicBot (v1)**: 합법 수 내 단순 휴리스틱 — 내 태스크 카드는 가능하면 따고, 남의 태스크/금지 카드는 피하고, 아니면 가장 무난한(낮은) 카드. 통신은 보수적으로 사용/생략.
- **봇 능력 수용 기준**: v1 BasicBot 단독(인간1+봇2)으로 무태스크/단순 소수 태스크의 초반 미션군을 합리적 재시도 내 클리어할 수 있어야 한다. 고난도 협력 제약 미션은 SmartBot 또는 인간 합류를 전제로 한다(테스트로 "봇 약함"이 회귀인지 의도인지 구분).
- 추후 `SmartBot`이 같은 인터페이스로 교체. 엔진이 순수 함수라 시뮬레이션 기반 탐색을 얹기 쉽다.

## 5. 서버

### 5.1 방·동시성
- **WebSocket(ws)** 기반. MVP는 **다중 방 허용**: `roomId → Room` 맵. `Room = {코드, 좌석 3개, GameState, 봇 러너, campaignRef}`.
- 방 코드 생성 시 충돌 회피, 빈 방·종료 게임은 GC(타이머/소켓/봇 러너 확실히 해제).

### 5.2 액션 큐·프로토콜
- 서버는 **모든 액션(봇·인간)을 단일 큐로 직렬 적용**한다. 봇 지연(사람 같은 페이싱)은 **enqueue 타이밍에만** 영향, 적용 순서는 큐 순서로 권위적 결정(결정성 유지).
- 프로토콜(`shared`): `ClientToServer` = Action. `ServerToClient` = 액션 적용 후 **각 클라에 갱신된 per-player `PlayerView` 스냅샷 push**가 기본(클라측 리듀서 델타 재적용은 비채택 — 클라는 부분 뷰라 동일 리듀서 불가). 불법 액션은 **요청한 클라에게만** `NACK(reason)` 회신.
- 권위 상태만 신뢰. 클라이언트 액션은 항상 엔진으로 재검증.

### 5.3 좌석 생명주기 (인간↔봇)
- 로비(시작 전): 봇↔사람 자유 교체(`JoinSeat`/`LeaveSeat`).
- 진행 중 이탈: 기본은 **해당 좌석 손패 동결 + 일시정지/재접속 대기**. 타임아웃 시 동작은 정책으로 선택(미션 폐기·재시작, 또는 봇 인계). **봇 인계 시에도 봇 러너는 그 좌석의 `PlayerView`만** 받는다(권위 상태 직접 노출 금지). 인간 복귀 시 손패 재이양.
- 세부 재접속 정책은 인터넷 호스팅 단계에서 구체화(§11).

## 6. 클라이언트 (UI/UX)

- **React + Vite**. 자기 손패만 인터랙션. 합법 수 하이라이트는 클라가 뷰로 미리 켜되 최종 판정은 서버(§4.3).
- **비주얼 디자인(스킨/색감/일러스트)은 후순위로 확정** — 우선 레이아웃·정보 구조·기능을 완성하고, 우주 테마 스킨은 나중에 얹는다.

### 6.1 화면 흐름
로비(방 생성/참가) → 미션 브리핑 → 게임 테이블 → 결과 → (다음 미션 브리핑 / 재시도).

### 6.2 게임 테이블 정보 구조 (확정)
레이아웃/IA를 목업으로 검증해 확정함. 구성 요소:
- **상단 미션 목표 배너(상시 노출)**: 이번 미션의 특수 제약과 통신 정책을 항상 표시(예: "9로 트릭 따기 금지"). 표시 문자열은 자유텍스트가 아니라 `ConstraintDef`/`CommunicationPolicy`→한국어 템플릿으로 생성(§6.4). 통신 차단은 현재 트릭 기준 동적 전이("통신 차단 · 트릭 N부터" → 해제). M46 등 선언 정보(분홍9 보유자)도 여기 reveal.
- **상단 헤더**: 미션 번호/제목, 시도 횟수(attemptNumber), 조난신호 상태 토글.
- **상대(봇/사람) 영역 2개**: 아바타·이름, **연결 상태(사람/봇/끊김·봇대행)**, 커맨더 뱃지, 획득 트릭 수(+ 트릭-수 제약 활성 미션에선 제약 진행: 균형 최대격차/정확히 N/역할별), **공개된 태스크 카드(+순서토큰 배지 1–5/Ω/→…)**, 통신 상태(정상=공개 카드+위치 토큰 / dead-zone=공개 카드+빨강 토큰, 위치 없음 "직관" 라벨). 통신 카드가 플레이되면 표시 소거.
- **중앙 현재 트릭**: 플레이어별로 낸 카드 + 리드 색, 내 차례면 빈 슬롯 강조.
- **내 손패**: 색별 그룹·정렬, **합법 카드만 선명/나머지 흐리게**(색·명도 외 단서로 이중 인코딩 §6.5), 내 태스크 카드(+순서토큰)와 획득 트릭 수.
- **차례·팔로우 인디케이터**: "당신 차례 · 파랑 팔로우".
- **보조 액션**: 통신하기(정책별 분기 — 정상: 카드→최고/유일/최저 중 합법만; dead-zone: 위치 단계 생략, 빨강 토큰), 지난 트릭 보기, 미션 규칙 보기. 비활성 시 사유 표시(차단/이미 사용/로켓만 보유).

### 6.3 인터랙티브 단계 IA (미션별)
- **태스크 선택(open-pick)**: 중앙 태스크 풀(요구 수만큼, 순서토큰 부착), 픽 차례 인디케이터(커맨더 우선 → 시계방향).
- **커맨더 결정 / 분배**: 결정=공개 N장 + 좌석별 yes/no(또는 M5 good/bad) → 커맨더 1인 선택(자기 제외). 분배=uncover 1장 + 좌석별 yes/no → 커맨더 수령자 선택(자기 포함) + 좌석별 누적 태스크 수·"2개 초과 금지" 가드 + 카드별 반복.
- **조난신호**: on/off + **좌/우 방향 선택**(`SetDistressDirection`), 카드 비밀 제출(로켓 비활성), 매 시도 재노출.
- **M50 역할 배정**: 세 역할 슬롯(첫4트릭/마지막트릭/중간전부) ↔ 3좌석, 좌석별 선호 입력 후 공동 확정.
- **M11 통신금지 지목**, **M23/M40 토큰 조작**, **M12 트릭1 후 무작위 카드 교환**(자동 진행 + 토스트, 손패 장수 갱신, 뺏긴 카드는 비공개) 등 셋업/이벤트 surfacing 패턴 공통 적용.

### 6.4 로비 / 브리핑 / 결과 IA
- **로비**: 방 코드 표시+복사/공유, 3좌석 카드(호스트/봇/합류자 상태·봇↔사람 교체·시작 전/후 잠금), 미션 선택 1–50(주체=호스트), 조난 사전 옵션, 호스트 시작 버튼.
- **미션 브리핑**: `MissionDef.narrative` 본문 + 특수 규칙 하이라이트(배너와 동일 출처 재사용) + 태스크/순서토큰 미리보기 + 조난 on/off(distress-decision 연결) + 시작.
- **결과**: 승/패, **실패 사유 요약**(`evaluate`가 `violated` 반환한 RuleModule·위반 카드), 누적 시도 횟수(조난 시 +1), 액션 = 재시도 / 다음 미션 / **스킵(시도 10으로 기록 후 다음 미션 해금 — 캠페인 기능, §10)**.

### 6.5 i18n·색-독립 식별
- UI 기본 언어 `ko`, 키 구조만 i18n 대응으로 열어둠. 배너/제약 문구는 §6.2대로 구조화 데이터→템플릿 생성. 미션 `narrative`는 번역 자원으로 분리하고 영어 `sourceText` 병행 보관. 카드 색/통신토큰/역할 용어는 "스페이스 크루" 정식판 기준 용어집으로 고정.
- **색-독립**: 각 색에 모양/기호 병기(원작 4기호 또는 도형)로 색맹 대응. 합법/불법은 명도뿐 아니라 테두리/아이콘으로 이중 인코딩.

### 6.6 미해결 — "카드 얘기 금지" 채팅 정책
게임 룰상 손패 대화 금지. 게임 내 채팅을 (A) 아예 없앰 / (B) 자유 채팅 + 양심 / (C) 통신 토큰만 둘지 **미정**. 구현 후반(인간 합류 단계)에서 확정.

## 7. 품질·테스트 전략

- **엔진은 TDD로 구현**: 트릭 승자 판정, 팔로우 슈트 합법성(로켓=슈트 포함), 통신 제약(시점·1회·정책·진실성·재시도 리셋), 각 제약 타입, 미션별 승/패 판정을 단위 테스트. M16/M17은 "off-suit 9 버리고 다른 카드로 승리=합법" 케이스 포함.
- **봇 합법성 속성 테스트(필수)**: 임의 상태×시드에서 모든 `BotStrategy` 출력이 `legalMoves`에 포함됨을 검증. 결정적 엔진 기반 시드 회귀(대표 미션 골든 테스트).
- **미션 데이터 무결성**: `sourceText`↔데이터 더블엔트리/리뷰, 정적 검사(모든 태스크 토큰이 유효, 색/값 범위 등), 미션별 시나리오 테스트(대표+엣지).
- **비공개 보장**: 뷰 직렬화에 손패/시드 유출 0을 **클라 경로와 봇 입력 경로 모두** 검증. 좌석 교체 상태머신 테스트.

## 8. 구현 순서 (점진적, 목표는 50개 전부)

1. 모노레포 + 엔진 스캐폴딩. 카드/결정적 딜/트릭테이킹 핵심 + 테스트.
2. 기본 태스크(소유자 달성/위반) + 미션 루프(시도 재시작/다음 미션).
3. 서버(방·좌석·단일 큐·봇 러너) + 클라(테이블 UI)로 **3인 1미션 엔드투엔드**. 평이한 open-pick·특수정책 없는 초반 미션(M1·M2·M4류) 사용, 봇은 `chooseTask`·`playCard`만 구현하고 `decideCommunication`=null 스텁.
4. 통신(트릭 리드 직전 인터럽트 + 진실성) · 조난신호(방향·동시 제출).
5. 순서 토큰 + 배정 방식(커맨더 결정/분배 + optionalHandover).
6. 나머지 제약을 **제약 군별 수직 슬라이스**로(각 슬라이스 = 해당 제약 RuleModule + 그 제약을 쓰는 미션 데이터 + 테스트):
   - 6a 카드-승리/값-금지(M9/13/16/17/26/44), 6b 트릭수·정체·균형(M5/29/33/34/41/50), 6c 선언(M46) + 특정트릭(M48), 6d 통신정책 disruption/dead-zone/인원금지(M6/11/14/18/19/21/25/28/30/38/39), 6e 셋업변형(M12/23/40).
7. 캠페인 진행 영속화 + 로비/브리핑/결과 화면 + 인간 합류(봇 대체) 흐름 + 다듬기.
8. (후순위) 인터넷 호스팅 배포.

## 9. 미해결/추후 결정
- 패키지 매니저(npm vs pnpm), 정확한 WebSocket 라이브러리는 구현 계획에서 확정.
- UI 비주얼 수준(카드 그래픽/일러스트)은 기능 완성 후 결정.
- 게임 내 채팅 정책(§6.6).
- 진행 중 이탈 타임아웃 동작(미션 폐기 vs 봇 인계)의 기본값.
- 재접속(reconnect) 세부 처리는 인터넷 호스팅 단계에서 구체화.

## 10. 캠페인 진행·영속화
- **Campaign/CrewProgress를 1급 개념**으로 둔다: `{ campaignId(=크루), missionStatuses: Record<missionId, {attempts, distressUsed, clearedAt}>, currentMissionId }`. (물리 로그북의 6크루 비교/날짜는 디지털에선 선택.)
- **영속 계층**: 로컬 우선 방침에 맞춰 초기엔 서버측 JSON 또는 SQLite. 방(일시적·인메모리)과 캠페인(영속)을 분리하고 `campaignRef`로 연결.
- 로그북의 **"10 입력=스킵"** 은 종이 캠페인 점수기록 관습이며 트릭 리듀서의 액션이 아니다. 스킵(시도=10 기록 후 다음 미션 해금)은 **캠페인 기능(결과/브리핑 화면)** 으로만 구현하고 엔진에 넣지 않는다.
