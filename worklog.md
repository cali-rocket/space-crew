# Space Crew — 작업 일지 (worklog)

> 이 파일은 Claude의 작업 일지입니다. 세션이 진행되며 한 일, 결정, 다음 할 일을 시간순으로 기록합니다.

## 프로젝트 개요
- **목표**: 보드게임 *The Crew: The Quest for Planet Nine* (한국 정식명 "스페이스 크루")를 친구들과 즐길 수 있는 온라인 게임으로 구현.
- **플레이 형태**:
  - 항상 **3인** 게임으로 진행.
  - 호스트(나)가 방을 만들고 시작하면 나머지 2자리는 **봇**이 채움.
  - 방이 열려 있으면 **다른 사람이 들어와 봇 자리를 대체** 가능.
  - 외부 공개 유저 모집 계획은 없음 (지인 한정, 총 3명).
- **기준 문서**: 영어판 규칙서/로그북 (`docs/reference/rulebook-en.pdf`, `docs/reference/logbook-en.pdf`).

## 타임라인

### 2026-06-29
- 게임 식별: 한국 정식 발매명이 "스페이스 크루"(코리아보드게임즈)임을 확인. 원제 *The Crew: The Quest for Planet Nine* (Kosmos, 2019).
- 공식 영문 규칙서 + 50미션 로그북 PDF를 `docs/reference/`에 다운로드.
- **규칙서 전체 정독 완료** — 핵심 메커니즘 파악:
  - 40장(4색×1-9=36 + 로켓 1-4), 협력형 트릭테이킹, 로켓=트럼프.
  - 팔로우 슈트, 트릭 승자, 커맨더(로켓4 보유자), 태스크 카드(특정 카드를 딴 트릭으로 달성).
  - 통신 토큰(highest/only/lowest, 미션당 1회), 조난신호(이웃에게 카드 1장 전달), 태스크 토큰(순서: 1-5/Ω/화살표).
  - 특수 규칙: dead zone(직관 통신), disruption(N트릭까지 통신금지), 커맨더 결정/분배 등.
  - **3인 딜**: 13/13/14장, 트릭 13회, 마지막 1장은 미사용.
- **50미션 로그북 정독 완료** — 미션별 태스크 수·토큰·특수규칙 구조 파악.
- 빈 프로젝트 확인 (코드 없음). 브레인스토밍 스킬 진행 중.

## 핵심 설계 리스크 (메모)
- **봇 AI**: The Crew는 협력형 + 히든 인포메이션이라 "잘 두는" 봇 구현이 가장 어려운 부분. AI 수준 결정이 스코프를 크게 좌우함.
- 통신 메커니즘을 사람/봇 모두에게 어떻게 표현·전달할지.
- 실시간 멀티플레이 인프라(친구가 어떻게 접속·합류하는지).

## 결정 사항 (브레인스토밍)
- **봇 AI 수준**: 일단 **기본 동작**(규칙 준수 + 단순 휴리스틱)으로 시작. 나중에 필요해지면 고도화.
  → 봇 로직을 **교체 가능한 인터페이스(Strategy)** 뒤에 두어 나중에 강한 AI로 갈아끼움.
- **접속/호스팅**: 최종은 **인터넷 호스팅**이지만 후순위. **로컬에서 개발/테스트**, 배포는 나중에 얹음.
  → 처음부터 클라이언트–서버(실시간) 구조, 배포 가능하게 설계.
- **기술 스택**: **TypeScript 풀스택** — Node + WebSocket 서버, React 프론트, **순수 TS 게임 엔진을 클라/서버 공유**.
- **미션 범위**: **50개 전부**(모든 특수 규칙 포함)를 목표. 단 구현은 핵심 엔진부터 점진적으로.

## 진행
- 설계안 사용자 승인 완료.
- **Spec 문서 작성**: `docs/superpowers/specs/2026-06-29-space-crew-online-design.md` (자체 검토 완료).
  - 핵심: 권위 서버 + 순수 TS 게임 엔진, 모노레포(engine/shared/server/client), 데이터 기반 50미션 모델링, 교체 가능한 봇 전략.
  - 미션 제약 타입 카탈로그(로그북 정독 기반) 정리.
- 주의: 현재 폴더는 git 저장소 아님 → 커밋 보류. 셋업 단계에서 `git init` 후 커밋 예정.

## UI/UX (2026-06-29)
- 메인 게임 테이블 **레이아웃/정보 구조 목업** 제작 → 사용자 승인.
  - 상단 미션 목표 상시 배너, 상대 영역(태스크·트릭수·통신상태), 중앙 트릭, 내 손패(합법만 선명), 보조 액션.
- **비주얼 디자인(스킨/색감)은 후순위**로 미룸 — 기능·레이아웃 먼저.
- spec 6장(클라이언트)에 화면 흐름 + 게임 테이블 IA 반영.
- 미해결: 게임 내 "카드 얘기 금지" 채팅 정책(A/B/C) — 후반 확정.

## ultracode 재검토 (2026-06-29)
- 6개 차원(규칙충실도/미션커버리지/아키텍처/UIUX/스펙품질/사각지대) 병렬 리뷰 + 적대적 검증 워크플로우 실행.
  - 1차: 60건 발견(architecture는 API에러로 누락) → 재개(resume)로 architecture 채움 → 총 68건, 65 채택.
  - 2차 검증 패스가 더 보수적 재판정(대부분 minor): spec에 이미 훅/액션/정책 골격이 있어 "재설계"가 아니라 "문서 명확화"로 판단된 케이스 다수. 발견 자체는 유효 → 전부 반영.
- **spec v2로 전면 개정** (docs/superpowers/specs/2026-06-29-space-crew-online-design.md). 주요 수정:
  - 통신 = 매 트릭 리드 직전 1회 인터럽트(단일 윈도우 아님), 시도당 리셋.
  - 권위 GameState vs PlayerView 타입 분리(rngSeed 서버 전용, 손패 유출 차단).
  - 미션 데이터 정정: M5(아픈 승무원), M20=커맨더 결정, M27/M37=결정+선택적 양도, M8 통신제약 없음, 화살표 토큰 4종, Ω vs 마지막트릭(M48) 구분, M44 로켓순서.
  - AssignmentMode를 baseMode+optionalHandover로 분리, 자기지명 규칙 명시.
  - 미션 루프 전이(RestartAttempt/AdvanceMission), attemptNumber, 단일 액션 큐, 조난 동시 제출.
  - WebSocket 프로토콜(뷰 스냅샷 push + NACK), 진행 중 이탈 정책.
  - 캠페인 진행 영속화(§10), i18n·색맹 대응(§6.5), UI IA 대폭 보강(로비/브리핑/결과/배정/dead-zone/M50).
  - evaluate 시점/우선순위, MissionDef.sourceText/logbookPage + 더블엔트리 검증, 봇 PlayerView 계약·합법성 속성테스트.
- 기각 6건(검증관 반려): dead-zone 통신조건 누락(이미 충족), 클라/서버 엔진 이중실행 발산(단일출처라 무효) 등.
- 참고: 채팅 목업 배너 문구 "9가 든 트릭 금지"는 향후 "9로 트릭 획득 금지"로 (구현 시 반영).

## 디자인 진행 결정 (2026-06-29)
- 비주얼 디자인은 **계속 후순위** — 지금은 미루고 구현 계획으로. 비주얼 단계가 오면 전담 위임(디자인 워크플로우/서브에이전트)으로 제대로 진행.
- v2 IA 반영한 게임 테이블 와이어프레임 재렌더(동적 통신배너·순서토큰 배지·dead-zone·좌석 연결상태·색-독립 기호·통신 비활성 사유). 뼈대 레이아웃은 유지.
- 아직 시각화 안 한 화면: 로비/브리핑/결과/태스크배정/M50 (필요 시 나중에).

## 구현 계획 (2026-06-29)
- 스코프 체크: 다중 서브시스템이라 **계획을 분할**(엔진코어 → 통신/조난/토큰/배정 → 50미션 → 서버 → 클라 → 캠페인).
- 기술 확정: **TypeScript strict + npm workspaces + Vitest** (spec §9 패키지매니저 미정 해소).
- **계획 1: 엔진 코어** 작성 — `docs/superpowers/plans/2026-06-29-engine-core.md`.
  - Task 1~9 (TDD, bite-sized): 스캐폴딩 → 카드 → 시드RNG/셔플 → 딜/커맨더 → 트릭규칙 → GameState → 태스크배정 → applyPlay(달성/위반) → 승패평가/시도·미션 루프.
  - 순수 함수·결정성(시드 주입)·태스크-only 미션 한정(특수규칙은 후속 계획). 자체 점검 완료.

## 엔진 코어 구현 (2026-06-29, 서브에이전트 구동)
- git 초기화 + `engine-core` 브랜치. 태스크별 implementer(haiku) → 독립 reviewer(haiku/sonnet) → ledger 기록.
- **Task 1~9 전부 완료** (커밋 `0315d8c..33c6a00`):
  스캐폴딩 → 카드 → 시드RNG/셔플 → 딜/커맨더 → 트릭규칙 → GameState → 태스크배정 → applyPlay(달성/위반) → 승패평가/시도·미션 루프.
- **전체 36 테스트 통과, 타입체크 0 에러.** 순수 함수·결정성(시드 주입)·런타임 의존성 0.
- 최종 전체-브랜치 리뷰(opus): **MERGE-READY**, Critical/Important 0, Minor 4건 모두 수용가능.
  - 진행 원장: `.superpowers/sdd/progress.md`.
  - 옵션 후속: play.test.ts 미사용 `withHands` 헬퍼 제거; engine-core 계획 산문(assignTask 자동전이) 정정.

## 브랜치 마무리 (2026-06-29)
- `engine-core` → `main` 로컬 머지(`--no-ff`, merge commit `4f03375`). 병합 결과 36/36 테스트 통과. 브랜치 삭제.
- 현재 `main`이 엔진 코어를 포함. 원격 미설정(로컬 전용).

## 계획 2 완료 (2026-06-29)
- 브랜치 `plan-2-rules`에서 8태스크 서브에이전트 구동 → 각 리뷰 통과 → opus 최종 MERGE-READY → `main` 머지(merge `e3978bc`).
- 추가: 통신(트릭 직전 인터럽트·4정책 게이트)·조난(동시제출·전달)·순서토큰(absolute/relative/Ω)·배정(결정/분배/양도). **71 테스트 통과.**
- Minor(후속): distress 재제출 가드·left 방향 테스트, handover from 검증, order.ts 타입가드.

## 계획 3 완료 (2026-06-29)
- 브랜치 `plan-3-constraints-missions`에서 8태스크 서브에이전트 구동 → `main` 머지(merge `24948bb`).
- 제약 프레임워크 + 9개 제약 타입(forbid-win-value, win-value-count, win-cards, player-trick-count, player-exact-tricks, balance, task-in-last-trick, trick-partition, pink-left-sweep), MissionDef/createMission, 역할 헬퍼, **50미션 데이터**.
- **opus 더블엔트리 리뷰가 10개 Critical taskCount 오류를 잡아 수정**(로그북 PDF 시각 대조). **97 테스트 통과, typecheck 0.**
- Minor(후속): order 토큰 ~15미션 누락, M48 마지막트릭 런타임 카드바인딩, trick-partition 부분지정 엣지, createMission이 roles 미주입(셋업에서 assignRole).

## 현재 상태
- `main`이 **순수 TS 게임 엔진 전체**(엔진 코어 + 통신/조난/토큰/배정 + 제약/50미션)를 포함. 97 테스트, typecheck 0.
- 50미션 데이터까지 엔진에서 셋업·플레이·승패판정 가능(역할 바인딩·봇·서버·UI는 후속).

## 계획 4·5·6 완료 (2026-06-29~30, 워크플로우 오케스트레이션)
- ultracode on → 남은 계획은 **Workflow로 순차 구현+적대적 검증** 오케스트레이션, 플랜 사이엔 직접 테스트·머지 관문.
- **계획 4**(server/bot): 뷰 직렬화·태스크덱·BasicBot·매치 컨트롤러·shared 프로토콜·ws 서버 → merge.
- **계획 5**(client): React+Vite 로비/테이블/연결 + jsdom 통합 테스트(실제 ws 서버 연동) + vite 빌드 → merge.
- **계획 6**(capstone): 공개 태스크풀·다중방 join(방코드)·미션선택·캠페인 영속화·태스크픽/통신 UI → merge.
  - 최종 리뷰가 잡은 것: 10개 critical taskCount 오류(계획3, opus 더블엔트리), 통신 picker 로켓 노출 버그, src에 방출된 .js 75개(2개는 커밋됨) 정리·gitignore.

## ✅ 전체 완료 (계획 1~6, main)
- **140 테스트 통과**(engine 106 / server 10 / client 23 / shared 1), **typecheck 0**(4패키지), 클라 빌드 OK, src 방출파일 0, 64커밋.
- 호스트+봇2(또는 +합류자)로 **50미션 중 선택해 한 판 협력 플레이 + 진행 저장**이 동작.
- 패키지: `engine`(순수 규칙·50미션·봇·뷰), `shared`(프로토콜), `server`(다중방·컨트롤러·ws·캠페인), `client`(React UI).

## 계획 7 — 비주얼 스킨 + 룰 UI (2026-06-30)
- **Part 1**: 우주 테마 스킨(theme.css — 다크 별하늘, 4색 슈트 + 규칙서 4기호 ○▽□✕, 로켓 트럼프, glassy 패널), 카드 재설계(모서리 값 + 기호 + 합법/흐림 상태), GameTable/Lobby 재구성. 클라 룰 UI: 목표 배너(ConstraintDef→한국어), 통신 토큰 위치(최고/유일/최저·dead-zone 빨강), 순서 토큰 배지. 서버 자동 역할 바인딩(M34 커맨더, M46 분홍9). **라이브 프리뷰 스크린샷으로 확인.** merge.
- **Part 2**: 커맨더 결정 역할 흐름(M33/M41) — engine PlayerView.decision + controller pendingRoleDecision/commander-assign + protocol + ws + 클라 결정 패널. 봇 커맨더 자동 지목, 사람 커맨더는 후보 버튼으로 'chosen' 지목 → 역할 바인딩 → 미션 판정. merge.
- 현재 **149 테스트, typecheck 0(4패키지), 빌드 OK, src 방출파일 0, 70커밋.**
- 모두 원본 일러스트 복제 없이 디자인 언어를 CSS/SVG로 직접 재현.

## 계획 8 — 남은 룰 UI (2026-06-30, 손수 재구현)
- 워크플로우가 typecheck를 오보고(통합 상태에 server 타입오류 21 + 테스트 11 실패: 테스트/소스 불일치)해 **plan-8 브랜치를 플랜문서 커밋으로 리셋 후 전부 손수 재구현**, 각 단계 `tsc --noEmit` 확인.
- **커맨더 결정 일반화**: `PlayerView.decision`을 `{kind:'role'|'all-tasks'|'m50-roles'}` 유니온으로. 컨트롤러 `pendingDecision`이 미션별 결정 종류를 산출 → 봇 자동/사람 패널.
- **조난 카드전달**(commit-then-reveal): 봇은 최저 비로켓 자동 제출, 사람은 멈춰서 제출. `distressDone` 가드.
- **M50 역할 협상**(서로 다른 플레이어 검증) + 커맨더 all-tasks 분배 흐름. 풀스택 배선(engine→controller→protocol→ws→client).
- 결과 **166 테스트, typecheck 0**. merge(c969871).

## 계획 9 — 인터넷 배포 (2026-06-30)
- **단일 Node 프로세스**가 클라 정적파일 + ws 게임을 **한 포트**로 서빙하도록 통합.
  - `wsServer.startServer(port, {clientDir, host})` — `clientDir` 주면 같은 http 서버에 정적 핸들러 부착(`createServer(staticHandler)` + `WebSocketServer({server})`). MIME 맵, SPA fallback(미존재 경로→index.html), **경로 traversal 가드**(분리자 경계 검사 — sibling-prefix 우회 차단, `%2e%2e` 인코딩 포함 테스트).
  - `prod.ts` — 프로덕션 엔트리(`PORT` env, `0.0.0.0`, 번들 옆 `public/` 서빙).
  - 클라 `main.tsx` — 프로덕션은 같은 오리진 ws(`wss://`는 https일 때 자동), 개발은 `:8787`.
- **빌드 파이프라인**: `scripts/build-deploy.mjs` — vite로 클라 빌드 → esbuild로 `prod.ts`를 `deploy/server.mjs`(esm, node20, createRequire 배너)로 번들 → `deploy/public`에 클라 복사. 루트 스크립트 `build:deploy`/`start`/`typecheck`, esbuild devDep, `deploy/` gitignore.
- **`Dockerfile`**(node:20-slim 멀티스테이지) + `.dockerignore` + **`DEPLOY.md`**(Docker/Render·Railway/Fly 절차, env, 주의: 인메모리 단일 인스턴스).
- **검증**: 빌드 산출물(server.mjs 183KB + public)을 실제 구동해 **e2e PASS** — `GET /`가 실제 클라 index(#root+번들 스크립트), 157KB JS 에셋 200, SPA fallback 200, ws create→room·start→view 정상. 정적 스모크 테스트(서빙+SPA+traversal) 추가.
- 현재 **167 테스트, typecheck 0(4패키지), 빌드 OK, src 방출파일 0.**

## 남은 백로그 (비차단)
- 커맨더 분배 균등분할(M24/32/36/43), 미션 order 토큰 ~15미션 보강, M48 마지막트릭 런타임 카드 바인딩.
- M5 뉘앙스(아픈 승무원 'sick' + 태스크 3 혼합), 커맨더 good/bad·yes/no 응답 표시(플레이버).
- started/full 방 join nack, 방코드 충돌(극단), 재접속 정교화.
- 영속화/재시작 복원(현재 룸은 인메모리), 다중 인스턴스 확장(룸 레지스트리 외부화).

## 실 배포 완료 — Render (2026-07-05)
- 깃헙 public 레포 생성·push: **github.com/cali-rocket/space-crew** (커밋 신원은 cali-rocket noreply로 통일 — filter-branch 재작성).
- `render.yaml`(Blueprint) + Dockerfile `npm ci --include=dev` 보강.
- **Render API로 서비스 생성·배포**(익명 배포 불가 → 사용자 API 키로 REST 호출): docker/free/싱가포르/health `/`.
- **라이브: https://space-crew-nflx.onrender.com** (srv-d94vrecvikkc73d2ofq0). e2e 검증 — HTTPS index 200 + 158KB 번들 + SPA fallback, **wss 게임 연결 create→view 정상**.
- 무료 티어 특성: 15분 무접속 시 슬립(첫 접속 콜드스타트), 재시작 시 인메모리 룸 소실 — 상시가동/영속화는 후속.

## 자가플레이 + 미션 충실도 감사 (2026-07-05)
- **자가플레이 하니스**(봇3 × 50미션 × 60시드 + 조난 스윕 ≈ 6000판): 크래시·교착·카드보존·트릭승자·승리판정·결정성·조난경로 **이상 0건**. 엔진 기계적 무결성 확인.
- **미션 인코딩 감사**(워크플로우 21에이전트: sourceText↔인코딩 대조 → 적대검증):
  - 🔴 **M11 (미문서화 실버그, high)**: "지정된 승무원은 통신 불가" 규칙이 실제로 아무 효과 없음. `appointedNoCommPlayer`가 프로덕션 경로에서 한 번도 설정되지 않음(테스트에서만). → 전원 통신 가능한 평범한 게임으로 플레이됨.
  - 🔴 **M36 (미문서화 실버그, high)**: taskCount 0 + 제약 0 → 무조건 자동승리(no-op). "커맨더가 명령을 분배" 미션인데 분배할 태스크가 0개. taskCount를 로그북 값으로 채워야 함.
  - 🟠 **M12 (미문서화 실버그, medium)**: 1트릭 후 오른쪽 이웃과 카드 교환 규칙 미구현 + 코드 주석("셋업에서 처리")이 사실과 다름(트릭 후=게임 중 이벤트). 평범한 4태스크 게임으로 플레이됨.
  - 🟡 이미 백로그로 문서화된 것(실 격차지만 기지): M24/32/43 커맨더분배→open-pick 폴백, M48 last-trick 미바인딩, M40/49 order 토큰 미인코딩.
  - ✅ 나머지 39미션 인코딩 충실. M22/23("one by one"·order tile 재배치)는 flavor/셋업옵션으로 판정 → 오탐 기각.

## 감사 결함 수정 완료 (branch: fix/mission-fidelity, 2026-07-05)
사용자 요청 "백로그까지 전부" → 발견 결함 + 백로그 격차 모두 구현 (TDD, 각 단계 자가플레이 재검증).
- **M36 no-op**: taskCount 0→7(로그북) + **commander-distribution 구현**(봇 균등 round-robin, 사람 분배 결정+`commander-distribute` 액션; assignByDistribution 균등 검증). M24/32/36/43 모두 실제 분배로 동작.
- **order 토큰 런타임 바인딩**: `applyOrderTokens`가 배정 순서대로 태스크에 토큰 부여 → `orderViolated` 발동. M48('last') 강제, M49(abs 1-2-3)·M40(abs 1-2) 추가.
- **M11 통신금지**: `setAppointedNoCommPlayer` + `appoint-no-comm` 결정(봇 자동/사람 지목); M11의 잘못된 `commander-decision`(전부 한 명) 제거 → 태스크는 open-pick, 지목된 승무원만 통신 차단(실제 comm.ts에서 검증).
- **M12 카드교환**: `exchangeWithRightNeighbor`(시드 결정적, 40장 보존) + `exchangeAfterTrick1` 플래그 + 컨트롤러가 1트릭 후 1회 실행.
- **클라 UI**: appoint-no-comm/distribute 패널 + protocol `commander-distribute` + ws 핸들러.
- 결과: **184 테스트 통과**(engine 106/shared 1/server 42/client 35), typecheck 0(4패키지), 자가플레이 HARD 이상 0, 클라 빌드 OK. 커밋 6개.
- 남은 근사/미구현(문서화): M40 "선택적 추가 order tile" 배치(고급 셋업 옵션), order 토큰의 특정 카드 매핑은 시드별 근사(물리 로그북 레이아웃 필요).
