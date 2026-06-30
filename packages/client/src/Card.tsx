import type { Card } from '@space-crew/engine';
import type { CSSProperties } from 'react';

const SUIT_VARS: Record<string, { c: string; cd: string }> = {
  pink: { c: 'var(--pink)', cd: 'var(--pink-deep)' },
  blue: { c: 'var(--blue)', cd: 'var(--blue-deep)' },
  green: { c: 'var(--green)', cd: 'var(--green-deep)' },
  yellow: { c: 'var(--yellow)', cd: 'var(--yellow-deep)' },
  rocket: { c: 'var(--rocket)', cd: 'var(--rocket-deep)' },
};

/** The four colour-blind suit symbols (geometric shapes) + rocket trump glyph. */
function SuitGlyph({ suit, size = 30 }: { suit: string; size?: number }) {
  const col = 'var(--c)';
  const s = size;
  if (suit === 'pink') return <svg width={s} height={s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke={col} strokeWidth="2.4" /></svg>;
  if (suit === 'blue') return <svg width={s} height={s} viewBox="0 0 24 24"><path d="M4 6 H20 L12 20 Z" fill="none" stroke={col} strokeWidth="2.4" strokeLinejoin="round" /></svg>;
  if (suit === 'green') return <svg width={s} height={s} viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="1.5" fill="none" stroke={col} strokeWidth="2.4" /></svg>;
  if (suit === 'yellow') return <svg width={s} height={s} viewBox="0 0 24 24"><path d="M6 6 L18 18 M18 6 L6 18" fill="none" stroke={col} strokeWidth="2.6" strokeLinecap="round" /></svg>;
  // rocket (trump)
  return <svg width={s} height={s} viewBox="0 0 24 24"><path d="M12 2c3 2 4.5 5 4.5 9 0 2-.6 3.6-1.5 5h-6c-.9-1.4-1.5-3-1.5-5 0-4 1.5-7 4.5-9z" fill="none" stroke={col} strokeWidth="1.9" /><circle cx="12" cy="9.5" r="1.8" fill={col} /><path d="M9 16l-2 4 3-1.4M15 16l2 4-3-1.4" fill="none" stroke={col} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export interface CardChipProps {
  card: Card;
  dim?: boolean;
  legal?: boolean;
  pick?: boolean;
  small?: boolean;
  check?: boolean;
  onClick?: () => void;
}

export function CardChip({ card, dim, legal, pick, small, check, onClick }: CardChipProps) {
  const v = SUIT_VARS[card.suit] ?? { c: '#888', cd: '#444' };
  const style = { ['--c' as string]: v.c, ['--cd' as string]: v.cd } as CSSProperties;
  const cls = ['pc', card.suit === 'rocket' ? 'rocket' : '', small ? 'small' : '', dim ? 'dim' : '', legal ? 'legal' : '', pick ? 'pick' : '']
    .filter(Boolean).join(' ');
  return (
    <div className={cls} style={style} onClick={onClick}>
      <span className="v tl">{card.value}</span>
      <span className="vsym"><SuitGlyph suit={card.suit} size={small ? 9 : 11} /></span>
      <span className="glyph"><SuitGlyph suit={card.suit} size={small ? 20 : 30} /></span>
      <span className="v br">{card.value}</span>
      {check && <span className="ok">✓</span>}
    </div>
  );
}
