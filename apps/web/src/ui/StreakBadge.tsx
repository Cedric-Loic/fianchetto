import { useCountUp } from '../lib/motion';
import { useStreak } from '../lib/streak';
import { IconFlame } from './icons';

/** Variation de classement : compteur animé de l'ancien classement vers le nouveau. */
export function RatingDelta(props: { before: number; after: number }) {
  const shown = useCountUp(props.after, props.before);
  const delta = props.after - props.before;
  return (
    <span className={`rating-delta ${delta >= 0 ? 'up' : 'down'}`} data-testid="rating-delta">
      Classement {shown} ({delta >= 0 ? '+' : '−'}
      {Math.abs(delta)})
    </span>
  );
}

/** Série de réussites de la session (petite pastille qui rebondit à chaque réussite). */
export function StreakBadge() {
  const { current, best } = useStreak();
  return (
    <span
      key={current}
      className={`streak${current > 0 ? ' bump' : ''}`}
      data-testid="streak"
      title={`Meilleure série de la session : ${best}`}
    >
      <IconFlame size={16} />
      Série : {current}
    </span>
  );
}
