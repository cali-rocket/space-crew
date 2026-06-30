# 배포 가이드 (Space Crew)

게임 서버 하나가 **클라이언트 정적 파일 + WebSocket 게임**을 같은 포트로 서빙합니다. 따라서 단일 Node 프로세스만 배포하면 됩니다.

## 빌드 산출물

```bash
npm install
npm run build:deploy      # → deploy/server.mjs (번들된 서버) + deploy/public (클라 빌드)
PORT=8787 npm start       # = node deploy/server.mjs
```

브라우저에서 `http://localhost:8787` 접속 → 로비가 뜨고, ws는 같은 오리진(`ws://localhost:8787`)으로 자동 연결됩니다.

### 환경 변수
- `PORT` — 리슨 포트 (기본 8787). 대부분의 PaaS가 자동 주입.
- `CLIENT_DIR` — 정적 파일 경로 (기본: 번들 옆 `public/`).
- `VITE_WS_URL` (빌드 타임, 선택) — 클라가 붙을 ws URL을 강제. 보통 불필요(같은 오리진 자동).

## 옵션 A — Docker (가장 이식성 높음)

```bash
docker build -t space-crew .
docker run -p 8787:8787 space-crew
```

`Dockerfile`이 멀티스테이지로 빌드 → 슬림 런타임 이미지를 만듭니다. Fly.io/Railway/Render 등 컨테이너를 받는 어떤 호스트에도 그대로 올릴 수 있습니다.

## 옵션 B — Render / Railway (Node 빌드팩)

- Build Command: `npm install && npm run build:deploy`
- Start Command: `npm start`
- 포트는 플랫폼이 `PORT`로 주입 → 코드가 이를 사용.

## 옵션 C — Fly.io

```bash
fly launch        # Dockerfile 자동 감지
fly deploy
```
`fly.toml`의 `internal_port`를 8787(또는 `PORT`)에 맞추세요.

## 주의
- HTTPS로 서빙되면 클라가 자동으로 `wss://`로 붙습니다(같은 오리진).
- 현재 룸/캠페인 상태는 인메모리입니다(`CrewProgress`는 `progressFile` 옵션 시 JSON 파일로 영속). 재시작 시 진행 중 게임은 사라집니다 — 영속화/재접속은 후속 과제.
- 단일 인스턴스 가정(인메모리 룸 레지스트리). 다중 인스턴스로 확장하려면 룸 상태를 외부 저장소로 빼야 합니다.
