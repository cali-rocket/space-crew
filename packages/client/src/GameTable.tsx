import { CardChip } from './Card';
import { legalMovesFromView } from '@space-crew/engine';
import type { Card, PlayerView } from '@space-crew/engine';

export interface GameTableProps {
  view: PlayerView;
  onPlayCard(c: Card): void;
  onPickTask(c: Card): void;
}

export function GameTable({ view, onPlayCard, onPickTask }: GameTableProps) {
  // Only compute legal moves during trick-in-progress; task-assignment should not highlight
  const shouldShowLegalMoves = view.phase === 'trick-in-progress';
  const legalCards = shouldShowLegalMoves ? (view.legalMoves ?? legalMovesFromView(view)) : [];
  const legalSet = new Set(legalCards.map((c) => `${c.suit}-${c.value}`));

  const isLegal = (c: Card) => legalSet.has(`${c.suit}-${c.value}`);

  return (
    <div style={{ padding: '16px', fontFamily: 'system-ui' }}>
      {/* Mission header */}
      <h1>Mission {view.missionId}</h1>

      {/* Seats info */}
      <section style={{ marginBottom: '24px' }}>
        <h2>Seats</h2>
        {view.seats.map((seat) => (
          <div key={seat.player} style={{ padding: '8px', border: '1px solid #ddd', marginBottom: '8px' }}>
            <strong>{seat.player}</strong> {seat.isBot ? '(Bot)' : ''} — Tricks: {seat.tricksWon}, Hand: {seat.handCount}
            {seat.isCommander && <span style={{ marginLeft: '8px', color: '#2b7' }}>Commander</span>}
          </div>
        ))}
      </section>

      {/* Current trick */}
      {view.currentTrick.plays.length > 0 && (
        <section style={{ marginBottom: '24px' }}>
          <h2>Current Trick (led by {view.currentTrick.leader})</h2>
          {view.currentTrick.plays.map((play) => (
            <div key={play.player} style={{ padding: '8px', marginBottom: '4px' }}>
              {play.player}: <span style={{ fontWeight: 'bold' }}>{play.card.suit} {play.card.value}</span>
            </div>
          ))}
        </section>
      )}

      {/* Task pool (during task-assignment) */}
      {view.phase === 'task-assignment' && view.taskPool && (
        <section style={{ marginBottom: '24px' }}>
          <h2>Task Pool</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {view.taskPool.map((card) => (
              <span
                key={`${card.suit}-${card.value}`}
                data-testid={`pool-card-${card.suit}-${card.value}`}
                onClick={() => onPickTask(card)}
              >
                <CardChip card={card} />
              </span>
            ))}
          </div>
        </section>
      )}

      {/* My hand */}
      <section style={{ marginBottom: '24px' }}>
        <h2>My Hand</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {view.myHand.map((card) => {
            const legal = isLegal(card);
            const handleClick = legal && shouldShowLegalMoves ? () => onPlayCard(card) : undefined;
            return (
              <span
                key={`${card.suit}-${card.value}`}
                data-testid={`hand-card-${card.suit}-${card.value}`}
                className={legal && shouldShowLegalMoves ? '' : 'dim'}
                onClick={handleClick}
              >
                <CardChip
                  card={card}
                  dim={!legal || !shouldShowLegalMoves}
                  onClick={handleClick}
                />
              </span>
            );
          })}
        </div>
      </section>

      {/* Outcome if finished */}
      {view.outcome !== 'in-progress' && (
        <section style={{ padding: '16px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          <h2>Mission Result: {view.outcome}</h2>
        </section>
      )}
    </div>
  );
}
