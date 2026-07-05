import { useState } from 'react';
import { CardChip } from './Card';
import { legalMovesFromView } from '@space-crew/engine';
import type { Card, PlayerView, ConstraintDef, CommState, OrderToken, CommunicationPolicy, PlayerId } from '@space-crew/engine';

export interface GameTableProps {
  view: PlayerView;
  onPlayCard(c: Card): void;
  onPickTask(c: Card): void;
  onCommunicate?(c: Card): void;
  onCommanderAssign?(assignee: PlayerId): void;
  onCommanderAssignRoles?(assignments: Record<string, PlayerId>): void;
  onCommanderDistribute?(assignments: { card: Card; owner: PlayerId }[]): void;
  onSubmitDistress?(c: Card): void;
}

function objectiveText(c: ConstraintDef): string {
  switch (c.kind) {
    case 'forbid-win-value': return `${c.value} 값 카드로는 트릭을 따면 안 됨`;
    case 'win-value-count': return `${c.value} 값 카드로 트릭 ${c.count}회 따기`;
    case 'win-cards': return `지정 카드를 ${c.ordered ? '순서대로 ' : ''}각각 따기`;
    case 'player-trick-count': return `지정 플레이어가 정확히 ${c.count}트릭${c.rocketAllowed ? '' : ' (로켓 제외)'}`;
    case 'player-exact-tricks': return `지정 플레이어가 ${c.tricks === 'first-last' ? '첫·마지막' : '지정'} 트릭${c.exclusive ? '만' : ''}${c.rocketAllowed ? '' : ' (로켓 제외)'}`;
    case 'balance': return `누구도 남보다 ${c.maxDiff + 1}트릭 이상 더 따면 안 됨`;
    case 'task-in-last-trick': return `지정 태스크를 마지막 트릭에 달성`;
    case 'trick-partition': return `트릭 분할: 첫4 / 마지막 / 중간`;
    case 'pink-left-sweep': return `분홍9 보유자 왼쪽 사람이 분홍 카드를 전부 획득`;
    default: return '특수 목표';
  }
}

function commPolicyText(p: CommunicationPolicy): string | null {
  if (p === 'normal') return null;
  if (p === 'dead-zone') return '통신 제한 · dead zone (직관)';
  if ('noCommUntilTrick' in p) return `통신 차단 · ${p.noCommUntilTrick}트릭부터 가능`;
  if ('oneMemberNoComm' in p) return '통신 제한 · 지정 1인 통신 금지';
  return null;
}

function OrderBadge({ order }: { order: OrderToken }) {
  const label = order.kind === 'absolute' ? String(order.position) : order.kind === 'last' ? 'Ω' : '→'.repeat(order.chevrons);
  return <span className="sc-tok" title="순서 토큰">{label}</span>;
}

function CommView({ comm }: { comm: CommState }) {
  const pos = comm.token === 'highest' ? 'top' : comm.token === 'lowest' ? 'bot' : 'mid';
  const red = comm.token === null;
  return (
    <span className="sc-comm" title={comm.token ?? '직관(dead zone)'}>
      <CardChip card={comm.card} small />
      <span className={`tok ${pos} ${red ? 'red' : ''}`} />
    </span>
  );
}

export function GameTable({ view, onPlayCard, onPickTask, onCommunicate, onCommanderAssign, onCommanderAssignRoles, onCommanderDistribute, onSubmitDistress }: GameTableProps) {
  const [selecting, setSelecting] = useState(false);
  const [roleSel, setRoleSel] = useState<Record<string, string>>({});
  const [distSel, setDistSel] = useState<Record<string, string>>({});

  const showLegal = view.phase === 'trick-in-progress';
  const legalCards = showLegal ? (view.legalMoves ?? legalMovesFromView(view)) : [];
  const legalSet = new Set(legalCards.map((c) => `${c.suit}-${c.value}`));
  const isLegal = (c: Card) => legalSet.has(`${c.suit}-${c.value}`);

  const canCommunicate = view.phase === 'trick-in-progress' && view.currentTrick.leader === view.me && view.currentTrick.plays.length === 0;
  const commText = commPolicyText(view.communicationPolicy);
  const dec = view.decision;
  const m50Ready = dec?.kind === 'm50-roles' && dec.roles.every((r) => roleSel[r]) && new Set(dec.roles.map((r) => roleSel[r])).size === dec.roles.length;
  const distReady = (() => {
    if (dec?.kind !== 'distribute' || !view.taskPool) return false;
    const owners = view.taskPool.map((c) => distSel[`${c.suit}-${c.value}`]);
    if (owners.some((o) => !o)) return false;
    const counts = dec.candidates.map((p) => owners.filter((o) => o === p).length);
    return Math.max(...counts) - Math.min(...counts) <= 1; // even split
  })();

  return (
    <div className="sc-main">
      <div className="sc-title">
        <h1>SPACE CREW</h1>
        <span className="sub">Mission {view.missionId} · 시도 {view.attemptNumber}</span>
      </div>

      {/* objectives / communication banners */}
      {view.objectives.map((o, i) => (
        <div key={i} className="sc-banner obj"><span className="sc-dot" />{objectiveText(o)}</div>
      ))}
      {commText && <div className="sc-banner warn">{commText}</div>}
      {view.distressActive && <div className="sc-banner warn">조난신호 활성</div>}

      {/* distress card submission */}
      {view.distressPass?.mustSubmit && onSubmitDistress && (
        <div className="sc-panel">
          <div className="sc-h">조난신호 · 이웃에게 넘길 카드를 고르세요 (로켓 제외)</div>
          <div className="sc-pool">
            {view.myHand.filter((c) => c.suit !== 'rocket').map((card) => (
              <span key={`d-${card.suit}-${card.value}`} data-testid={`distress-card-${card.suit}-${card.value}`} onClick={() => onSubmitDistress(card)}>
                <CardChip card={card} pick />
              </span>
            ))}
          </div>
        </div>
      )}

      {/* commander decision (single assignee: role / all-tasks / appoint-no-comm) */}
      {dec && (dec.kind === 'role' || dec.kind === 'all-tasks' || dec.kind === 'appoint-no-comm') && onCommanderAssign && (
        <div className="sc-panel">
          <div className="sc-h">
            {dec.kind === 'all-tasks'
              ? '커맨더 결정 · 한 명에게 모든 태스크를 맡기세요'
              : dec.kind === 'appoint-no-comm'
                ? '커맨더 결정 · 통신 불가 승무원을 지목하세요'
                : `커맨더 결정 · '${dec.role}' 담당자를 지목하세요 (${dec.role === 'sick' ? 'good/bad' : 'yes/no'} 질문)`}
          </div>
          <div className="sc-row">
            {dec.candidates.map((p) => (
              <button key={p} className="sc-btn primary" data-testid={`decide-${p}`} onClick={() => onCommanderAssign(p)}>
                {p === view.me ? '나' : p}
              </button>
            ))}
          </div>
        </div>
      )}
      {dec && dec.kind === 'distribute' && onCommanderDistribute && view.taskPool && (
        <div className="sc-panel">
          <div className="sc-h">커맨더 결정 · 각 명령(태스크)을 승무원에게 분배하세요 (균등)</div>
          <div className="sc-pool">
            {view.taskPool.map((card) => (
              <label key={`dist-${card.suit}-${card.value}`} className="sc-meta" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <CardChip card={card} />
                <select className="sc-select" data-testid={`distribute-select-${card.suit}-${card.value}`}
                  value={distSel[`${card.suit}-${card.value}`] ?? ''}
                  onChange={(e) => setDistSel({ ...distSel, [`${card.suit}-${card.value}`]: e.target.value })}>
                  <option value="">—</option>
                  {dec.candidates.map((p) => (<option key={p} value={p}>{p === view.me ? '나' : p}</option>))}
                </select>
              </label>
            ))}
            <button className="sc-btn primary" data-testid="distribute-confirm" disabled={!distReady}
              onClick={() => onCommanderDistribute(view.taskPool!.map((card) => ({ card, owner: distSel[`${card.suit}-${card.value}`]! })))}>
              확정
            </button>
          </div>
        </div>
      )}
      {dec && dec.kind === 'm50-roles' && onCommanderAssignRoles && (
        <div className="sc-panel">
          <div className="sc-h">커맨더 결정 · 트릭 역할을 배정하세요</div>
          <div className="sc-row">
            {dec.roles.map((r) => (
              <label key={r} className="sc-meta" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {r}
                <select className="sc-select" data-testid={`role-select-${r}`} value={roleSel[r] ?? ''}
                  onChange={(e) => setRoleSel({ ...roleSel, [r]: e.target.value })}>
                  <option value="">—</option>
                  {dec.candidates.map((p) => (<option key={p} value={p}>{p === view.me ? '나' : p}</option>))}
                </select>
              </label>
            ))}
            <button className="sc-btn primary" data-testid="assign-roles" disabled={!m50Ready}
              onClick={() => onCommanderAssignRoles(roleSel as Record<string, PlayerId>)}>
              확정
            </button>
          </div>
        </div>
      )}

      {/* seats */}
      <div className="sc-panel">
        <div className="sc-h">크루</div>
        <div className="sc-seats">
          {view.seats.map((seat) => (
            <div key={seat.player} className={`sc-seat ${seat.player === view.me ? 'me' : ''}`}>
              <div className="sc-seat-top">
                <span className="sc-ava">{seat.isBot ? '🤖' : (seat.player === view.me ? '🧑‍🚀' : '🙂')}</span>
                <span>
                  <div className="sc-name">{seat.player === view.me ? '나' : seat.player}</div>
                  <div className="sc-meta">획득 트릭 {seat.tricksWon}{seat.isBot ? '' : ''}</div>
                </span>
                {seat.isCommander && <span className="sc-badge cmd">★ 커맨더</span>}
                {!seat.isCommander && seat.isBot && <span className="sc-badge bot">봇</span>}
                {!seat.connected && <span className="sc-badge off">끊김</span>}
              </div>
              <div className="sc-tasks">
                {seat.tasks.length === 0 && <span className="sc-meta">태스크 없음</span>}
                {seat.tasks.map((t) => (
                  <span key={`${t.card.suit}-${t.card.value}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                    <CardChip card={t.card} small check={t.fulfilled} dim={t.fulfilled} />
                    {t.order && <OrderBadge order={t.order} />}
                  </span>
                ))}
                {seat.communication.map((c, i) => <CommView key={`c${i}`} comm={c} />)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* current trick */}
      <div className="sc-panel">
        <div className="sc-h">현재 트릭 {view.currentTrick.leadSuit ? `· 리드 ${view.currentTrick.leadSuit}` : ''}</div>
        <div className="sc-trick">
          {view.currentTrick.plays.length === 0 && <div className="sc-turn">아직 카드가 없습니다</div>}
          {view.currentTrick.plays.map((p) => (
            <div key={p.player} className="slot">
              <CardChip card={p.card} />
              <div className="who">{p.player === view.me ? '나' : p.player}</div>
            </div>
          ))}
        </div>
      </div>

      {/* task pool */}
      {view.phase === 'task-assignment' && view.taskPool && (
        <div className="sc-panel">
          <div className="sc-h">태스크 풀 · 가져갈 카드를 고르세요</div>
          <div className="sc-pool">
            {view.taskPool.map((card) => (
              <span key={`${card.suit}-${card.value}`} data-testid={`pool-card-${card.suit}-${card.value}`} onClick={() => onPickTask(card)}>
                <CardChip card={card} pick />
              </span>
            ))}
          </div>
        </div>
      )}

      {/* my hand */}
      <div className="sc-panel">
        <div className="sc-h">내 손패 {showLegal && <span style={{ color: '#a78bfa' }}>· 낼 수 있는 카드만 선명</span>}</div>

        {canCommunicate && onCommunicate && (
          <div className="sc-row" style={{ marginBottom: 12 }}>
            {!selecting ? (
              <button className="sc-btn" aria-label="Communicate" onClick={() => setSelecting(true)}>📡 통신하기</button>
            ) : (
              <div>
                <div className="sc-meta" style={{ marginBottom: 6 }}>통신할 카드 선택 (로켓 제외):</div>
                <div className="sc-row">
                  {view.myHand.filter((c) => c.suit !== 'rocket').map((card) => (
                    <span key={`comm-${card.suit}-${card.value}`} data-testid={`comm-card-${card.suit}-${card.value}`}
                      onClick={() => { onCommunicate(card); setSelecting(false); }}>
                      <CardChip card={card} pick small />
                    </span>
                  ))}
                  <button className="sc-btn ghost" aria-label="Cancel" onClick={() => setSelecting(false)}>취소</button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="sc-hand">
          {view.myHand.map((card) => {
            const legal = isLegal(card) && showLegal;
            return (
              <span key={`${card.suit}-${card.value}`} data-testid={`hand-card-${card.suit}-${card.value}`}
                className={legal ? '' : 'dim'} onClick={legal ? () => onPlayCard(card) : undefined}>
                <CardChip card={card} legal={legal} dim={!legal} onClick={legal ? () => onPlayCard(card) : undefined} />
              </span>
            );
          })}
        </div>
      </div>

      {view.outcome !== 'in-progress' && (
        <div className="sc-panel">
          <div className={`sc-result ${view.outcome}`}>
            <h2>{view.outcome === 'won' ? '🎉 미션 성공' : '💥 미션 실패'}</h2>
            <div className="sc-meta">Mission {view.missionId} · 시도 {view.attemptNumber}</div>
          </div>
        </div>
      )}
    </div>
  );
}
