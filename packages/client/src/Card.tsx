import type { Card } from '@space-crew/engine';

export interface CardChipProps {
  card: Card;
  dim?: boolean;
  onClick?: () => void;
}

export function CardChip({ card, dim, onClick }: CardChipProps) {
  return (
    <div
      className={`card-chip ${dim ? 'dim' : ''}`}
      onClick={onClick}
      style={{
        padding: '8px 12px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        cursor: onClick ? 'pointer' : 'default',
        opacity: dim ? 0.4 : 1,
        backgroundColor: getSuitColor(card.suit),
        color: '#fff',
        display: 'inline-block',
        marginRight: '4px',
      }}
    >
      {card.suit} {card.value}
    </div>
  );
}

function getSuitColor(suit: string): string {
  const colors: Record<string, string> = {
    pink: '#e91e63',
    blue: '#2196f3',
    green: '#4caf50',
    yellow: '#ffc107',
    rocket: '#673ab7',
  };
  return colors[suit] ?? '#999';
}
