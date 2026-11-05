import type { Color } from '@sq/shared';
import { SIDE } from '../screens/labels';

export interface SideBadgeProps {
  color: Color;
  /**
   * `you` : le camp que je joue (« Tu joues les Blancs ») ;
   * `turn` : le camp au trait quand les deux camps jouent sur le même écran.
   */
  mode?: 'you' | 'turn';
}

/**
 * Pastille du camp à jouer : un disque blanc ou noir, lisible au premier regard, et le nom du
 * camp en toutes lettres. Placée en tête du panneau de chaque écran où l'on joue des coups.
 */
export function SideBadge({ color, mode = 'you' }: SideBadgeProps) {
  const text = mode === 'you' ? `Tu joues les ${SIDE[color]}` : `Trait aux ${SIDE[color]}`;
  return (
    <div className={`side-badge ${color}`} data-testid="side-badge" data-color={color}>
      <span className="side-disc" aria-hidden="true" />
      <span className="side-badge-text">{text}</span>
    </div>
  );
}
